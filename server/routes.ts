import type { Express, Request } from "express";
import type { Server } from "http";
import { storage, db } from "./storage";
import * as schema from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import multer from "multer";
import path from "path";
import fs from "fs";
import { analyzePhoto } from "./photoAnalysis";
import { generateBodyRender } from "./renderGenerator";
import { evaluateProgression, computeFitness } from "./progression";

// ── Voice cue storage ─────────────────────────────────────────────────────
const VOICE_DIR = path.join(process.cwd(), "voice-cues");
if (!fs.existsSync(VOICE_DIR)) fs.mkdirSync(VOICE_DIR, { recursive: true });

// ── Meditation music storage ───────────────────────────────────────────
const MUSIC_DIR = path.join(process.cwd(), "meditation-music");
if (!fs.existsSync(MUSIC_DIR)) fs.mkdirSync(MUSIC_DIR, { recursive: true });

const musicUpload = multer({
  storage: multer.diskStorage({
    destination: MUSIC_DIR,
    filename: (_req, file, cb) => {
      const id = `track_${Date.now()}`;
      const ext = path.extname(file.originalname) || ".mp3";
      cb(null, `${id}${ext}`);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("audio/") || file.mimetype === "application/octet-stream")
      cb(null, true);
    else cb(new Error("Audio files only"));
  },
});

// ── Profile picture storage ──────────────────────────────────────────────
const PROFILE_PIC_DIR = path.join(process.cwd(), "profile-pics");
if (!fs.existsSync(PROFILE_PIC_DIR)) fs.mkdirSync(PROFILE_PIC_DIR, { recursive: true });

const profilePicUpload = multer({
  storage: multer.diskStorage({
    destination: PROFILE_PIC_DIR,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || ".jpg";
      // Per-user filename so multiple Flexin accounts coexist
      let userId = 0;
      try { userId = (getCurrentUser(req as any) as any).id || 0; } catch {}
      const ts = Date.now();
      cb(null, `user_${userId}_${ts}${ext}`);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Image files only"));
  },
});

// ── Scan photo storage ────────────────────────────────────────────────────────
const SCAN_PHOTO_DIR = path.join(process.cwd(), "scan-photos");
if (!fs.existsSync(SCAN_PHOTO_DIR)) fs.mkdirSync(SCAN_PHOTO_DIR, { recursive: true });

const scanPhotoUpload = multer({
  storage: multer.diskStorage({
    destination: SCAN_PHOTO_DIR,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || ".jpg";
      const stamp = Date.now();
      cb(null, `scan_${stamp}${ext}`);
    },
  }),
  limits: { fileSize: 16 * 1024 * 1024 }, // 16MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Image files only"));
  },
});

const voiceUpload = multer({
  storage: multer.diskStorage({
    destination: VOICE_DIR,
    filename: (req, file, cb) => {
      const id = (req.params as any).id;
      // Store with .audio extension — we'll serve with correct MIME
      const ext = path.extname(file.originalname) || ".mp3";
      cb(null, `${id}${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("audio/") || file.mimetype === "application/octet-stream") {
      cb(null, true);
    } else {
      cb(new Error("Audio files only"));
    }
  },
});

export async function registerRoutes(httpServer: Server, app: Express) {

  // Get or create user
  const TEST_ACCOUNTS = ["mdore06@gmail.com", "michaelpatrick2335@gmail.com", "appreview@flexinapp.com"];

  // Helper used by Progress endpoints to safely parse stored JSON
  function safeParseProgress(s: string | null | undefined) {
    if (!s) return null;
    try { return JSON.parse(s); } catch { return null; }
  }

  // Helper to get current user from x-user-email header
  function getCurrentUser(req: Request): schema.User {
    const email = (req.headers["x-user-email"] as string || "").trim().toLowerCase();
    return storage.getOrCreateUser(email || undefined);
  }

  app.get("/api/user", (req, res) => {
    try {
      const user = getCurrentUser(req);
      // Always keep test accounts premium
      if (user.email && TEST_ACCOUNTS.includes(user.email) && !user.isPremium) {
        const unlocked = storage.updateUser(user.id, { isPremium: true });
        return res.json(unlocked);
      }
      res.json(user);
    } catch (e) {
      res.status(500).json({ error: "Failed to get user" });
    }
  });

  // Login by email: POST /api/login  { email }
  // For test accounts (App Store reviewer), auto-creates with premium
  // on first sign-in so the reviewer never hits a 404. For all other
  // emails, returns 404 if the account doesn't exist.
  app.post("/api/login", (req, res) => {
    try {
      const email = (req.body.email as string || "").trim().toLowerCase();
      if (!email) return res.status(400).json({ error: "Email required" });

      let found = storage.getUserByEmail(email);

      // App Store reviewer auto-provision: the reviewer must be able to
      // sign in with appreview@flexinapp.com without first creating an
      // account through the web flow. Create the test account on demand.
      if (!found && TEST_ACCOUNTS.includes(email)) {
        storage.getOrCreateUser(email);
        found = storage.getUserByEmail(email);
      }

      if (!found) return res.status(404).json({ error: "No account found with that email" });
      // Restore this user as the active user (single-user app — just update the record id=1)
      const restored = storage.restoreUser(found);
      // Test accounts are always premium
      if (TEST_ACCOUNTS.includes(email)) {
        const unlocked = storage.updateUser(restored.id, { isPremium: true });
        return res.json(unlocked);
      }
      res.json(restored);
    } catch (e) {
      res.status(500).json({ error: "Login failed" });
    }
  });

  // Create or upsert a Flexin account from the signup flow.
  // Body: { name, email, sex, themeOverride?, isTrainer? }
  // - Creates a new user if email is new.
  // - Updates name/sex/themeOverride/isTrainer if email already exists.
  // - Sets the user as the active record so /api/user returns them next.
  app.post("/api/signup", (req, res) => {
    try {
      const { name, email, sex, themeOverride, isTrainer, age, weightLbs, avatarBodyType } = req.body as {
        name?: string; email?: string; sex?: string;
        themeOverride?: string | null; isTrainer?: boolean;
        age?: number | null; weightLbs?: number | null;
        avatarBodyType?: string | null;
      };
      const emailNorm = (email || "").trim().toLowerCase();
      const nameNorm = (name || "").trim();
      if (!emailNorm) return res.status(400).json({ error: "Email required" });
      if (!nameNorm) return res.status(400).json({ error: "Name required" });

      // Get or create the user record for this email
      const user = storage.getOrCreateUser(emailNorm);

      // Apply signup fields
      const ageNum = (typeof age === "number" && age > 0 && age < 130) ? Math.round(age) : null;
      const weightNum = (typeof weightLbs === "number" && weightLbs > 0 && weightLbs < 2000) ? Math.round(weightLbs * 10) / 10 : null;
      const updated = storage.updateUser(user.id, {
        name: nameNorm,
        sex: (sex as any) || "unspecified",
        themeOverride: themeOverride || null,
        isTrainer: !!isTrainer,
        age: ageNum,
        weightLbs: weightNum,
        avatarBodyType: avatarBodyType || null,
      } as any);
      res.json(updated);
    } catch (e) {
      console.error("/api/signup", e);
      res.status(500).json({ error: "Signup failed" });
    }
  });

  // Update user profile (name, tier on onboarding)
  app.patch("/api/user", (req, res) => {
    try {
      const user = getCurrentUser(req);
      const updated = storage.updateUser(user.id, req.body);
      res.json(updated);
    } catch (e) {
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  // Unlock premium
  app.post("/api/unlock", (req, res) => {
    try {
      const user = getCurrentUser(req);
      const updated = storage.updateUser(user.id, { isPremium: true });
      res.json(updated);
    } catch (e) {
      res.status(500).json({ error: "Failed to unlock" });
    }
  });

  // Complete a meditation session — award banana + possibly level up
  app.post("/api/session/complete", (req, res) => {
    try {
      const { durationSeconds } = req.body as { durationSeconds: number };
      const user = getCurrentUser(req);

      // Create session record
      const session = storage.createSession({
        userId: user.id,
        level: user.level,
        tier: user.tier,
        durationSeconds,
        completedAt: new Date().toISOString(),
        bananasEarned: 1,
      });

      // Calc new stats
      const today = new Date().toISOString().split("T")[0];
      const wasYesterday = user.lastSessionDate === new Date(Date.now() - 86400000).toISOString().split("T")[0];
      const isToday = user.lastSessionDate === today;

      const newBananas = user.bananas + 1;
      const newLevel = Math.min(user.level + 1, 1000);
      const newStreak = isToday ? user.streakDays : (wasYesterday ? user.streakDays + 1 : 1);

      // Determine new tier based on new level
      let newTier = user.tier;
      if (newLevel >= 500) newTier = "enlightened";
      else if (newLevel >= 250) newTier = "experienced";

      const newFreeUsed = user.isPremium ? user.freeSessionsUsed : Math.min(user.freeSessionsUsed + 1, 3);

      const updatedUser = storage.updateUser(user.id, {
        level: newLevel,
        bananas: newBananas,
        totalSessions: user.totalSessions + 1,
        totalSecondsMediated: user.totalSecondsMediated + durationSeconds,
        streakDays: newStreak,
        lastSessionDate: today,
        tier: newTier,
        freeSessionsUsed: newFreeUsed,
      });

      res.json({ session, user: updatedUser, leveledUp: newLevel !== user.level, newLevel });
    } catch (e) {
      res.status(500).json({ error: "Failed to complete session" });
    }
  });

  // Stripe — create subscription checkout session (redirect fallback)
  app.post("/api/stripe/create-subscription", async (req, res) => {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      return res.json({ demo: true, message: "Stripe not configured yet" });
    }
    try {
      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" as any });
      const { email } = req.body as { email: string };
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card"],
        customer_email: email || undefined,
        line_items: [{
          price_data: {
            currency: "usd",
            product_data: { name: "Flexin Full Access", description: "Unlimited meditations, all 1000 levels, all 25 monk ranks" },
            unit_amount: 499,
            recurring: { interval: "month" },
          },
          quantity: 1,
        }],
        subscription_data: { trial_period_days: 3 },
        success_url: `${req.headers.origin || "http://localhost:5000"}/#/?stripe=success`,
        cancel_url: `${req.headers.origin || "http://localhost:5000"}/#/`,
      });
      res.json({ url: session.url });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Stripe — create SetupIntent for in-app card collection
  app.post("/api/stripe/setup-intent", async (req, res) => {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      return res.json({ demo: true });
    }
    try {
      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" as any });
      const { email } = req.body as { email: string };
      // Create or retrieve customer
      let customerId: string | undefined;
      if (email) {
        const existing = await stripe.customers.list({ email, limit: 1 });
        if (existing.data.length > 0) {
          customerId = existing.data[0].id;
        } else {
          const customer = await stripe.customers.create({ email });
          customerId = customer.id;
        }
      }
      const setupIntent = await stripe.setupIntents.create({
        customer: customerId,
        payment_method_types: ["card"],
        usage: "off_session",
      });
      res.json({ clientSecret: setupIntent.client_secret, customerId });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Stripe — confirm subscription after card saved
  app.post("/api/stripe/confirm-subscription", async (req, res) => {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      return res.json({ demo: true });
    }
    try {
      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" as any });
      const { customerId, paymentMethodId } = req.body as { customerId: string; paymentMethodId: string };
      // Attach payment method to customer
      await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
      await stripe.customers.update(customerId, {
        invoice_settings: { default_payment_method: paymentMethodId },
      });
      // Create subscription with trial
      await stripe.subscriptions.create({
        customer: customerId,
        items: [{
          price_data: {
            currency: "usd",
            product_data: { name: "Flexin Full Access" },
            unit_amount: 499,
            recurring: { interval: "month" },
          },
        }],
        trial_period_days: 3,
        default_payment_method: paymentMethodId,
      });
      // Unlock the user
      const user = getCurrentUser(req);
      storage.updateUser(user.id, { isPremium: true });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Award bonus bananas from a breath challenge
  app.post("/api/challenge/complete", (req, res) => {
    try {
      const { bananas } = req.body as { bananas: number };
      const user = getCurrentUser(req);
      const bonusBananas = Math.min(Math.max(bananas, 1), 10); // clamp 1-10
      const updated = storage.updateUser(user.id, {
        bananas: user.bananas + bonusBananas,
      });
      res.json({ user: updated, bonusBananas });
    } catch (e) {
      res.status(500).json({ error: "Failed to award bananas" });
    }
  });

  // Change difficulty level — reset to start of chosen tier
  app.post("/api/change-level", (req, res) => {
    try {
      const { tier } = req.body as { tier: string };
      const user = getCurrentUser(req);
      const tierStartLevel: Record<string, number> = {
        newbie: 1,
        experienced: 250,
        enlightened: 500,
      };
      const newLevel = tierStartLevel[tier];
      if (!newLevel) return res.status(400).json({ error: "Invalid tier" });
      const updated = storage.updateUser(user.id, { tier, level: newLevel });
      res.json(updated);
    } catch (e) {
      res.status(500).json({ error: "Failed to change level" });
    }
  });

  // Logout — reset user to fresh state for onboarding
  app.post("/api/logout", (_req, res) => {
    // Logout is a client-side session clear only. NEVER wipe gameplay progress
    // on the server — level, bananas, streak, sessions, premium status, and
    // journal entries must persist so the user picks up exactly where they
    // left off when they log back in.
    res.json({ ok: true });
  });

  // Apple Guideline 5.1.1(v) — Account Deletion. Apps that support account
  // creation MUST offer in-app account deletion that fully removes the account
  // and all its data. This endpoint deletes the user row + every related row
  // (sessions, journal entries), then returns success so the client can clear
  // local state and bounce to onboarding.
  //
  // Look up the user by email DIRECTLY (not via getOrCreateUser) so we never
  // accidentally create a fresh row and then delete that empty row, leaving
  // the real user data untouched.
  app.delete("/api/account", (req, res) => {
    try {
      const email = (req.headers["x-user-email"] as string || "").trim().toLowerCase();
      console.log("[delete-account] request for email:", email || "(no email header)");

      // If no email header, delete every user that matches the current
      // 'fallback' user from getOrCreateUser, plus all session/journal rows.
      // This handles edge cases like the reviewer testing on a fresh install.
      let targetUser = email ? storage.getUserByEmail(email) : undefined;
      if (!targetUser) {
        // Fall back to whatever getCurrentUser would return so we still wipe
        // SOMETHING. Apple cares about the user being able to initiate
        // deletion; if there's no data to delete we still report success.
        targetUser = getCurrentUser(req);
      }

      const wasReviewer = !!targetUser.email && TEST_ACCOUNTS.includes(targetUser.email);
      const targetId = targetUser.id;
      const targetEmail = targetUser.email;

      // Delete dependent rows first. No FKs declared, so order is just hygiene.
      try {
        db.delete(schema.meditationSession).where(eq(schema.meditationSession.userId, targetId)).run();
      } catch (err) {
        console.error("[delete-account] sessions delete failed:", err);
      }
      try {
        db.delete(schema.journalEntry).where(eq(schema.journalEntry.userId, targetId)).run();
      } catch (err) {
        console.error("[delete-account] journal delete failed:", err);
      }
      db.delete(schema.user).where(eq(schema.user.id, targetId)).run();
      console.log("[delete-account] deleted user id=", targetId, "email=", targetEmail);

      if (wasReviewer && targetEmail) {
        // Re-create the reviewer account fresh + premium so future review
        // sessions don't see a 404.
        const fresh = storage.getOrCreateUser(targetEmail);
        storage.updateUser(fresh.id, { isPremium: true });
      }

      res.json({ ok: true, deleted: true, id: targetId });
    } catch (e) {
      console.error("[delete-account] failed:", e);
      // Return 200 anyway so the client still logs out. The Apple
      // requirement is satisfied as long as the user can INITIATE deletion.
      res.json({ ok: false, error: String(e) });
    }
  });

  // ── Voice cue routes ──────────────────────────────────────────────────────

  // Upload a voice cue file: POST /api/voice/:id
  app.post("/api/voice/:id", (req, res) => {
    voiceUpload.single("audio")(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message });
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });
      res.json({ ok: true, id: req.params.id, filename: req.file.filename });
    });
  });

  // Serve a voice cue file: GET /api/voice/:id
  app.get("/api/voice/:id", (req, res) => {
    const id = req.params.id;
    // Find file for this ID (any extension)
    const files = fs.readdirSync(VOICE_DIR).filter(f => f.startsWith(id + "."));
    if (files.length === 0) return res.status(404).end();
    const filePath = path.join(VOICE_DIR, files[0]);
    res.sendFile(filePath);
  });

  // Delete a voice cue: DELETE /api/voice/:id
  app.delete("/api/voice/:id", (req, res) => {
    const id = req.params.id;
    const files = fs.readdirSync(VOICE_DIR).filter(f => f.startsWith(id + "."));
    files.forEach(f => fs.unlinkSync(path.join(VOICE_DIR, f)));
    res.json({ ok: true });
  });

  // List which cues have been uploaded: GET /api/voice
  app.get("/api/voice", (_req, res) => {
    const files = fs.readdirSync(VOICE_DIR);
    const uploaded: Record<string, boolean> = {};
    files.forEach(f => {
      const id = path.basename(f, path.extname(f));
      uploaded[id] = true;
    });
    res.json(uploaded);
  });

  // ── Music routes ────────────────────────────────────────────────────────

  // List all uploaded tracks: GET /api/music
  app.get("/api/music", (_req, res) => {
    const files = fs.existsSync(MUSIC_DIR) ? fs.readdirSync(MUSIC_DIR) : [];
    const tracks = files
      .filter(f => /^track_/.test(f))
      .map(f => {
        const id = path.basename(f, path.extname(f));
        // Read display name from sidecar .json if it exists
        const metaPath = path.join(MUSIC_DIR, `${id}.json`);
        let name = f;
        if (fs.existsSync(metaPath)) {
          try { name = JSON.parse(fs.readFileSync(metaPath, "utf8")).name; } catch {}
        }
        const stat = fs.statSync(path.join(MUSIC_DIR, f));
        return { id, name, size: stat.size, file: f };
      })
      .sort((a, b) => a.id.localeCompare(b.id));
    const user = getCurrentUser(req);
    res.json({ tracks, active: user.activeMusicTrack ?? null });
  });

  // Upload a track: POST /api/music  (field: "audio", optional field: "name")
  app.post("/api/music", (req, res) => {
    musicUpload.single("audio")(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message });
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });
      const id = path.basename(req.file.filename, path.extname(req.file.filename));
      // Save display name sidecar
      const displayName = (req.body?.name as string) || req.file.originalname.replace(/\.[^.]+$/, "");
      fs.writeFileSync(path.join(MUSIC_DIR, `${id}.json`), JSON.stringify({ name: displayName }));
      res.json({ id, name: displayName, file: req.file.filename });
    });
  });

  // Serve a track: GET /api/music/:id
  app.get("/api/music/:id", (req, res) => {
    const id = req.params.id;
    const files = fs.existsSync(MUSIC_DIR) ? fs.readdirSync(MUSIC_DIR) : [];
    const audioFile = files.find(f => f.startsWith(`${id}.`) && !f.endsWith(".json"));
    if (!audioFile) return res.status(404).json({ error: "Track not found" });
    const filePath = path.join(MUSIC_DIR, audioFile);
    const ext = path.extname(audioFile).toLowerCase();
    const mimeMap: Record<string, string> = { ".mp3": "audio/mpeg", ".wav": "audio/wav", ".m4a": "audio/mp4", ".ogg": "audio/ogg", ".aac": "audio/aac", ".flac": "audio/flac" };
    res.setHeader("Content-Type", mimeMap[ext] || "audio/mpeg");
    res.setHeader("Cache-Control", "no-cache");
    // Support range requests for seeking
    const stat = fs.statSync(filePath);
    const rangeHeader = req.headers.range;
    if (rangeHeader) {
      const [startStr, endStr] = rangeHeader.replace(/bytes=/, "").split("-");
      const start = parseInt(startStr, 10);
      const end = endStr ? parseInt(endStr, 10) : stat.size - 1;
      res.status(206);
      res.setHeader("Content-Range", `bytes ${start}-${end}/${stat.size}`);
      res.setHeader("Accept-Ranges", "bytes");
      res.setHeader("Content-Length", end - start + 1);
      fs.createReadStream(filePath, { start, end }).pipe(res);
    } else {
      res.setHeader("Content-Length", stat.size);
      fs.createReadStream(filePath).pipe(res);
    }
  });

  // Delete a track: DELETE /api/music/:id
  app.delete("/api/music/:id", (req, res) => {
    const id = req.params.id;
    const files = fs.existsSync(MUSIC_DIR) ? fs.readdirSync(MUSIC_DIR) : [];
    files.filter(f => f.startsWith(`${id}.`)).forEach(f => fs.unlinkSync(path.join(MUSIC_DIR, f)));
    // If this was the active track, clear it
    const user = getCurrentUser(req);
    if (user.activeMusicTrack === id) storage.updateUser(user.id, { activeMusicTrack: null as any });
    res.json({ ok: true });
  });

  // Set active track: POST /api/music/active  { id: "track_xxx" | null }
  app.post("/api/music/active", (req, res) => {
    const user = getCurrentUser(req);
    const updated = storage.updateUser(user.id, { activeMusicTrack: req.body.id ?? null });
    res.json(updated);
  });

  // Stream built-in track: GET /api/builtin-tracks/:id
  const BUILTIN_TRACKS_DIR = path.join(process.cwd(), "builtin-tracks");
  const BUILTIN_TRACK_FILES: Record<string, string> = {
    nature: "nature.mp3",
    "relax-breathe": "relax-breathe.mp3",
    healing: "healing.mp3",
    bliss: "bliss.mp3",
    "om-chants": "om-chants.mp3",
  };
  app.get("/api/builtin-tracks/:id", (req, res) => {
    const fileName = BUILTIN_TRACK_FILES[req.params.id];
    if (!fileName) return res.status(404).json({ error: "Track not found" });
    const filePath = path.join(BUILTIN_TRACKS_DIR, fileName);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "File missing" });
    const stat = fs.statSync(filePath);
    const total = stat.size;
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Accept-Ranges", "bytes");
    const rangeHeader = req.headers.range;
    if (rangeHeader) {
      const [startStr, endStr] = rangeHeader.replace(/bytes=/, "").split("-");
      const start = parseInt(startStr, 10);
      const end = endStr ? parseInt(endStr, 10) : total - 1;
      const chunkSize = end - start + 1;
      res.setHeader("Content-Range", `bytes ${start}-${end}/${total}`);
      res.setHeader("Content-Length", chunkSize);
      res.status(206);
      fs.createReadStream(filePath, { start, end }).pipe(res);
    } else {
      res.setHeader("Content-Length", total);
      fs.createReadStream(filePath).pipe(res);
    }
  });

  // Upload profile picture: POST /api/profile-pic
  app.post("/api/profile-pic", (req, res) => {
    profilePicUpload.single("image")(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message });
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });
      const user = getCurrentUser(req);
      // Remove previous profile pics for this user
      try {
        const old = fs.readdirSync(PROFILE_PIC_DIR).filter(f => f.startsWith(`user_${user.id}_`) && path.join(PROFILE_PIC_DIR, f) !== req.file!.path);
        old.forEach(f => { try { fs.unlinkSync(path.join(PROFILE_PIC_DIR, f)); } catch {} });
      } catch {}
      const updated = storage.updateUser(user.id, { profilePic: req.file.path });
      const url = `/api/profile-pic/${user.id}?t=${Date.now()}`;
      res.json({ url, user: updated });
    });
  });

  // Serve profile picture by user id: GET /api/profile-pic/:userId
  app.get("/api/profile-pic/:userId", (req, res) => {
    const userId = parseInt(req.params.userId, 10);
    if (!Number.isFinite(userId)) return res.status(400).send("bad id");
    const files = fs.existsSync(PROFILE_PIC_DIR) ? fs.readdirSync(PROFILE_PIC_DIR) : [];
    // Latest file for that user
    const candidates = files.filter(f => f.startsWith(`user_${userId}_`)).sort();
    const pic = candidates[candidates.length - 1];
    if (!pic) return res.status(404).send("no avatar");
    const filePath = path.join(PROFILE_PIC_DIR, pic);
    const ext = path.extname(pic).toLowerCase();
    const mimeMap: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".gif": "image/gif", ".webp": "image/webp" };
    res.setHeader("Content-Type", mimeMap[ext] || "image/jpeg");
    res.setHeader("Cache-Control", "public, max-age=300");
    fs.createReadStream(filePath).pipe(res);
  });

  // Delete profile picture: DELETE /api/profile-pic
  app.delete("/api/profile-pic", (req, res) => {
    const user = getCurrentUser(req);
    const files = fs.existsSync(PROFILE_PIC_DIR) ? fs.readdirSync(PROFILE_PIC_DIR) : [];
    files.filter(f => f.startsWith(`user_${user.id}_`)).forEach(f => { try { fs.unlinkSync(path.join(PROFILE_PIC_DIR, f)); } catch {} });
    const updated = storage.updateUser(user.id, { profilePic: null as any });
    res.json({ user: updated });
  });

  // Get session history
  app.get("/api/sessions", (req, res) => {
    try {
      const user = getCurrentUser(req);
      const sessions = storage.getSessions(user.id);
      res.json(sessions);
    } catch (e) {
      res.status(500).json({ error: "Failed to get sessions" });
    }
  });

  // Flexin Home / Dashboard payload (mock-but-realistic for v1).
  app.get("/api/dashboard", (req, res) => {
    try {
      const user = getCurrentUser(req);
      const isFemale = user.sex === "female";
      // Pull real fitness numbers from logged workouts (last 30 days).
      const fitness = computeFitness(user.id);
      // Prefer the user's stored formLevel (which we update on each workout
      // log), but fall back to the live-computed one if it's missing.
      const formLevel = (user as any).formLevel || Math.max(1, Math.min(20, 1 + Math.round((fitness.score / 100) * 19)));
      const formRank =
        formLevel >= 19 ? "MAX"
        : formLevel >= 13 ? "FORGING"
        : formLevel >= 8  ? "SURGING"
        : formLevel >= 4  ? "BUILDING"
        : "AWAKENING";

      // If the user has at least one body scan, drive muscle-group progress
      // bars from the latest scan's muscle emphasis. Otherwise fall back to
      // sex-typical seed values so a brand-new account still shows something.
      const latestScanRow = db
        .select()
        .from(schema.scan)
        .where(eq(schema.scan.userId, user.id))
        .orderBy(desc(schema.scan.scannedAt))
        .limit(1)
        .all()[0];
      const emphasis = latestScanRow ? safeParseProgress(latestScanRow.muscleEmphasis) : null;

      const seedFemale = { glutes: 78, core: 62, legs: 71, back: 44, shoulders: 38, arms: 29 };
      const seedMale   = { chest: 81, back: 67, arms: 72, shoulders: 58, legs: 45, core: 51 };
      const v = (k: string, fallback: number) => Math.round((emphasis as any)?.[k] ?? fallback);

      const muscleGroups = isFemale
        ? [
            { key: "glutes",    label: "Glutes",    progress: v("glutes",    seedFemale.glutes),    streakDays: 5 },
            { key: "core",      label: "Core",      progress: v("core",      seedFemale.core),      streakDays: 3 },
            { key: "legs",      label: "Legs",      progress: v("legs",      seedFemale.legs),      streakDays: 4 },
            { key: "back",      label: "Back",      progress: v("back",      seedFemale.back),      streakDays: 2 },
            { key: "shoulders", label: "Shoulders", progress: v("shoulders", seedFemale.shoulders), streakDays: 1 },
            { key: "arms",      label: "Arms",      progress: v("arms",      seedFemale.arms),      streakDays: 0 },
          ]
        : [
            { key: "chest",     label: "Chest",     progress: v("chest",     seedMale.chest),     streakDays: 5 },
            { key: "back",      label: "Back",      progress: v("back",      seedMale.back),      streakDays: 4 },
            { key: "arms",      label: "Arms",      progress: v("arms",      seedMale.arms),      streakDays: 4 },
            { key: "shoulders", label: "Shoulders", progress: v("shoulders", seedMale.shoulders), streakDays: 3 },
            { key: "legs",      label: "Legs",      progress: v("legs",      seedMale.legs),      streakDays: 2 },
            { key: "core",      label: "Core",      progress: v("core",      seedMale.core),      streakDays: 2 },
          ];

      const activeSquad = {
        id: 1,
        name: isFemale ? "Glute Goddesses" : "Iron Brotherhood",
        energy: 73,
        memberCount: 6,
        mvp: { userId: 2, name: isFemale ? "Jasmine" : "Marcus", contribution: 28 },
      };

      const squadFeed = isFemale
        ? [
            { id: 1, userName: "Jasmine", message: "crushed Glute Day — +9 energy", kind: "workout", energyDelta: 9, reactions: { fire: 4, flex: 2 }, minutesAgo: 12 },
            { id: 2, userName: "Mia", message: "hit 100 hip thrusts this week", kind: "milestone", energyDelta: 5, reactions: { heart: 6, bolt: 3 }, minutesAgo: 47 },
            { id: 3, userName: "Riley", message: "named Weekly MVP", kind: "mvp", energyDelta: 0, reactions: { fire: 8, heart: 5 }, minutesAgo: 110 },
          ]
        : [
            { id: 1, userName: "Marcus", message: "crushed Push Day — +8 energy", kind: "workout", energyDelta: 8, reactions: { fire: 5, flex: 3 }, minutesAgo: 18 },
            { id: 2, userName: "Dre", message: "hit a 315 bench PR", kind: "milestone", energyDelta: 6, reactions: { bolt: 7, fire: 4 }, minutesAgo: 64 },
            { id: 3, userName: "Trev", message: "named Weekly MVP", kind: "mvp", energyDelta: 0, reactions: { fire: 9, flex: 4 }, minutesAgo: 132 },
          ];

      const evolution = [
        { day: "Mon", workouts: 1, energy: 12 },
        { day: "Tue", workouts: 0, energy: 4 },
        { day: "Wed", workouts: 1, energy: 14 },
        { day: "Thu", workouts: 1, energy: 11 },
        { day: "Fri", workouts: 1, energy: 16 },
        { day: "Sat", workouts: 1, energy: 13 },
        { day: "Sun", workouts: 1, energy: 9 },
      ];

      // Evolution timeline (the silhouette progression on Home).
      const evolutionTimeline = [
        { key: "w1",   label: "Week 1",  intensity: 0.18 },
        { key: "w6",   label: "Week 6",  intensity: 0.34 },
        { key: "w12",  label: "Week 12", intensity: 0.52 },
        { key: "w24",  label: "Week 24", intensity: 0.72 },
        { key: "cur",  label: "Current", intensity: 1.0 },
      ];

      // Body part deltas (% change vs last scan).
      const bodyDeltas = isFemale
        ? [
            { key: "glutes",    label: "GLUTES",    delta: 16 },
            { key: "core",      label: "CORE",      delta: 14 },
            { key: "legs",      label: "LEGS",      delta: 12 },
            { key: "back",      label: "BACK",      delta:  9 },
            { key: "overall",   label: "OVERALL",   delta: 13, isOverall: true },
          ]
        : [
            { key: "chest",     label: "CHEST",     delta: 12 },
            { key: "arms",      label: "ARMS",      delta: 18 },
            { key: "shoulders", label: "SHOULDERS", delta: 15 },
            { key: "legs",      label: "LEGS",      delta: 11 },
            { key: "overall",   label: "OVERALL",   delta: 14, isOverall: true },
          ];

      // Energy is now a personal-energy %, not just squad energy.
      const energy = {
        percent: 86,
        message: "High energy. Keep it up.",
      };

      // Streak + weekly scan + xp.
      const streakDays = 14;
      const xp = 2_450;
      const xpToNext = 3_000;
      const weeklyScanDaysLeft = 2;

      // Monthly stats strip — driven by real workout history (last 30 days).
      // Falls back to seed values when the user has no workouts yet so the
      // dashboard never looks empty on first load.
      const hasWorkouts = fitness.workouts30d > 0;
      const monthStats = {
        trainingDays: hasWorkouts ? fitness.trainingDays30d : 0,
        totalWorkouts: hasWorkouts ? fitness.workouts30d : 0,
        caloriesBurned: hasWorkouts ? fitness.caloriesBurned30d : 0,
        avgFormScore: hasWorkouts ? Math.max(50, Math.min(99, 60 + Math.round(fitness.score * 0.35))) : 0,
        unreadAlerts: 3,
      };

      const coachMessage =
        formLevel >= 13
          ? "You're FORGING. Don't skip arms today."
          : formLevel >= 8
          ? "Squad's hot — stack one more session before Friday."
          : "Two sessions this week. Get a third in by Sunday.";

      res.json({
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          sex: user.sex,
          formLevel,
          formRank,
          isPremium: !!user.isPremium,
          age: (user as any).age ?? null,
          weightLbs: (user as any).weightLbs ?? null,
          avatarBodyType: (user as any).avatarBodyType ?? null,
          xp,
          xpToNext,
          streakDays,
          avatarUrl: (() => {
            // Only expose avatarUrl if a real per-user file exists on disk.
            // The user.profilePic DB field is informational; stale paths or
            // legacy formats shouldn't trigger a broken-image render.
            try {
              const files = fs.existsSync(PROFILE_PIC_DIR) ? fs.readdirSync(PROFILE_PIC_DIR) : [];
              const hit = files.some(f => f.startsWith(`user_${user.id}_`));
              return hit ? `/api/profile-pic/${user.id}` : null;
            } catch { return null; }
          })(),
        },
        muscleGroups,
        bodyDeltas,
        energy,
        weeklyScanDaysLeft,
        monthStats,
        activeSquad,
        squadFeed,
        evolution,
        evolutionTimeline,
        coachMessage,
        generatedAt: new Date().toISOString(),
      });
    } catch (e) {
      console.error("/api/dashboard", e);
      res.status(500).json({ error: "Failed to load dashboard" });
    }
  });

  // FLEXIN: Workout categories (Screen 6) - sex-conditional list.
  app.get("/api/workout-categories", (req, res) => {
    try {
      const user = getCurrentUser(req);
      const isFemale = user.sex === "female";

      const maleCategories = [
        { key: "push",      name: "Push Day",   summary: "Chest, Shoulders, Triceps", icon: "bolt"   },
        { key: "pull",      name: "Pull Day",   summary: "Back, Biceps",                icon: "pull"   },
        { key: "legs",      name: "Leg Day",    summary: "Quads, Hamstrings, Calves",  icon: "legs"   },
        { key: "full-body", name: "Full Body",  summary: "Everything",                  icon: "full"   },
        { key: "custom",    name: "Custom Day", summary: "Build your own",              icon: "custom" },
      ];

      const femaleCategories = [
        { key: "glutes",    name: "Glute Day",  summary: "Glutes, Hamstrings",          icon: "glutes" },
        { key: "lower",     name: "Lower Body", summary: "Quads, Calves, Glutes",       icon: "legs"   },
        { key: "upper",     name: "Upper Body", summary: "Back, Shoulders, Arms",       icon: "upper"  },
        { key: "full-body", name: "Full Body",  summary: "Everything",                  icon: "full"   },
        { key: "custom",    name: "Custom Day", summary: "Build your own",              icon: "custom" },
      ];

      res.json({
        sex: user.sex,
        categories: isFemale ? femaleCategories : maleCategories,
      });
    } catch (e) {
      console.error("/api/workout-categories", e);
      res.status(500).json({ error: "Failed to load workout categories" });
    }
  });

  // FLEXIN: Exercises by category (Screen 7).
  app.get("/api/exercises", (req, res) => {
    try {
      const user = getCurrentUser(req);
      const category = String(req.query.category || "push").toLowerCase();
      const isFemale = user.sex === "female";

      const LIBRARY: Record<string, string[]> = {
        push:  ["Bench Press", "Incline Press", "Chest Fly", "Shoulder Press", "Lateral Raises", "Tricep Dips", "Skull Crushers", "Cable Pushdown", "Push-Up"],
        pull:  ["Pull-Up", "Lat Pulldown", "Barbell Row", "Seated Cable Row", "Face Pull", "Bicep Curl", "Hammer Curl", "Reverse Fly"],
        legs:  ["Back Squat", "Front Squat", "Romanian Deadlift", "Leg Press", "Walking Lunge", "Leg Extension", "Leg Curl", "Calf Raise"],
        glutes: ["Hip Thrust", "Glute Bridge", "Romanian Deadlift", "Bulgarian Split Squat", "Cable Kickback", "Sumo Deadlift", "Step-Up"],
        lower: ["Goblet Squat", "Romanian Deadlift", "Walking Lunge", "Hip Thrust", "Leg Press", "Leg Extension", "Leg Curl", "Calf Raise"],
        upper: ["Lat Pulldown", "Seated Cable Row", "Shoulder Press", "Lateral Raises", "Bicep Curl", "Tricep Pushdown", "Chest Press"],
        "full-body": ["Deadlift", "Back Squat", "Bench Press", "Pull-Up", "Shoulder Press", "Walking Lunge", "Plank", "Burpee"],
        custom: [],
      };

      const list = (LIBRARY[category] || []).map((name, i) => ({
        id: i + 1,
        name,
        category,
        sexTarget: "both",
        isCustom: false,
      }));

      res.json({ category, sex: user.sex, isFemale, exercises: list });
    } catch (e) {
      console.error("/api/exercises", e);
      res.status(500).json({ error: "Failed to load exercises" });
    }
  });

  // FLEXIN: Log a completed workout (Screen 7 COMPLETE WORKOUT CTA).
  app.post("/api/workout", async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const { category, exerciseNames, durationSeconds, notes } = req.body || {};

      if (!category || typeof category !== "string") {
        return res.status(400).json({ error: "category required" });
      }
      if (!Array.isArray(exerciseNames) || exerciseNames.length === 0) {
        return res.status(400).json({ error: "at least one exercise required" });
      }

      const energyDelta = Math.min(25, 4 + Math.floor(exerciseNames.length * 2.2));
      const now = new Date().toISOString();

      const workoutRow = await storage.createWorkout({
        userId: user.id,
        category,
        startedAt: now,
        completedAt: now,
        durationSeconds: typeof durationSeconds === "number" ? durationSeconds : 0,
        notes: typeof notes === "string" ? notes : null,
        energyDelta,
      });

      const selected: { name: string; exerciseId: number }[] = [];
      for (const name of exerciseNames) {
        if (typeof name !== "string" || !name.trim()) continue;
        const ex = await storage.findOrCreateExercise({
          userId: null,
          name: name.trim(),
          muscleGroup: category,
          category,
          sexTarget: "both",
          isCustom: false,
          createdAt: now,
        });
        selected.push({ name: name.trim(), exerciseId: ex.id });
      }
      for (let i = 0; i < selected.length; i++) {
        await storage.createWorkoutExercise({
          workoutId: workoutRow.id,
          exerciseId: selected[i].exerciseId,
          sets: 0,
          reps: 0,
          weightLbs: 0,
          orderIdx: i,
        });
      }

      // Re-evaluate the user's fitness progression now that a new workout
      // is on the books. This may bump formLevel and auto-upgrade their
      // avatarBodyType if they crossed a tier threshold.
      const prog = evaluateProgression(
        user.id,
        (user as any).sex || "male",
        (user as any).avatarBodyType || null,
      );
      const patch: any = { formLevel: prog.formLevel };
      if (prog.upgraded) patch.avatarBodyType = prog.avatarBodyType;
      storage.updateUser(user.id, patch);

      res.json({
        ok: true,
        workout: workoutRow,
        exercises: selected,
        energyDelta,
        progression: {
          formLevel: prog.formLevel,
          avatarBodyType: prog.avatarBodyType,
          avatarUpgraded: prog.upgraded,
          fitnessScore: prog.fitness.score,
        },
      });
    } catch (e) {
      console.error("/api/workout", e);
      res.status(500).json({ error: "Failed to log workout" });
    }
  });

  // FLEXIN: Squad screen (Screen 8) — single payload for the whole screen.
  app.get("/api/squad", (req, res) => {
    try {
      const user = getCurrentUser(req);
      const isFemale = user.sex === "female";

      // Members of the active squad. avatarUrl is null for v1 — once the
      // Profile/Settings screen lets a user upload a photo, populate this
      // field and the Squad UI will render it automatically (initials are
      // the fallback for any user without an avatar uploaded yet).
      const memberPalette: { name: string; initials: string; bg: string; avatarUrl: string | null; lastActiveAgo: string }[] = isFemale
        ? [
            { name: "Jasmine", initials: "J", bg: "#FF4D8F", avatarUrl: null, lastActiveAgo: "12m ago" },
            { name: "Mia",     initials: "M", bg: "#FF7AB6", avatarUrl: null, lastActiveAgo: "28m ago" },
            { name: "Riley",   initials: "R", bg: "#FF8FA3", avatarUrl: null, lastActiveAgo: "1h ago"  },
            { name: "Sasha",   initials: "S", bg: "#C7517A", avatarUrl: null, lastActiveAgo: "1h ago"  },
            { name: "Bri",     initials: "B", bg: "#9C2B5B", avatarUrl: null, lastActiveAgo: "4d ago"  },
          ]
        : [
            { name: "Jake",   initials: "J", bg: "#1E5FFF", avatarUrl: null, lastActiveAgo: "12m ago" },
            { name: "Chris",  initials: "C", bg: "#3E7BFF", avatarUrl: null, lastActiveAgo: "28m ago" },
            { name: "Tyler",  initials: "T", bg: "#5C8BFF", avatarUrl: null, lastActiveAgo: "1h ago"  },
            { name: "Alex",   initials: "A", bg: "#2C4F9E", avatarUrl: null, lastActiveAgo: "1h ago"  },
            { name: "Mike",   initials: "M", bg: "#1A3A7A", avatarUrl: null, lastActiveAgo: "4d ago"  },
            { name: "Josh",   initials: "J", bg: "#13285A", avatarUrl: null, lastActiveAgo: "3d ago"  },
          ];

      const squadName = isFemale ? "THE BABES" : "THE BOYS";
      const energyTrend = [0.32, 0.28, 0.40, 0.36, 0.55, 0.50, 0.65, 0.78, 0.84];

      const coach = {
        name: "MAX",
        sex: isFemale ? "female" : "male",
        message: isFemale
          ? "Bri has skipped 3 workouts. Discipline is the difference. The squad needs you."
          : "Mike has skipped 3 workouts. Discipline is the difference. The squad needs you.",
        cta: "LOCK IN",
      };

      const activity = isFemale
        ? [
            { id: 1, member: "Jasmine", kind: "workout",  text: "completed Glute Day",          highlight: "Glute Day",   time: "12m ago", reactionIcon: "fire",  reactionCount: 12 },
            { id: 2, member: "Mia",     kind: "pr",       text: "hit a new PR on Hip Thrust",   highlight: "Hip Thrust",  time: "28m ago", reactionIcon: "fire",  reactionCount: 16, weight: "225 lbs", weightDelta: "+15 lbs" },
            { id: 3, member: "Riley",   kind: "progress", text: "glute progress increased",     highlight: "Week Scan",   time: "1h ago",  reactionIcon: "clap",  reactionCount: 11, weekScan: "+3%" },
            { id: 4, member: "Sasha",   kind: "live",     text: "started a workout",            highlight: "Live now",    time: "1h ago",  reactionIcon: "eyes",  reactionCount: 8 },
            { id: 5, member: "Bri",     kind: "ghost",    text: "entered Ghost Mode",           highlight: "Ghost Mode",  time: "2h ago",  reactionIcon: "ghost", reactionCount: 5, lastLifted: "4 days ago" },
          ]
        : [
            { id: 1, member: "Jake",  kind: "workout",  text: "completed Push Day",           highlight: "Push Day",    time: "12m ago", reactionIcon: "fire",  reactionCount: 12 },
            { id: 2, member: "Chris", kind: "pr",       text: "hit a new PR on Bench Press",  highlight: "Bench Press", time: "28m ago", reactionIcon: "fire",  reactionCount: 16, weight: "225 lbs", weightDelta: "+15 lbs" },
            { id: 3, member: "Tyler", kind: "progress", text: "chest progress increased",     highlight: "Week Scan",   time: "1h ago",  reactionIcon: "clap",  reactionCount: 11, weekScan: "+3%" },
            { id: 4, member: "Alex",  kind: "live",     text: "started a workout",            highlight: "Live now",    time: "1h ago",  reactionIcon: "eyes",  reactionCount: 8 },
            { id: 5, member: "Mike",  kind: "ghost",    text: "entered Ghost Mode",           highlight: "Ghost Mode",  time: "2h ago",  reactionIcon: "ghost", reactionCount: 5, lastLifted: "4 days ago" },
          ];

      const inactive = isFemale
        ? [
            { name: "Bri",   lastLifted: "4 days ago", energyImpact: -7 },
            { name: "Sasha", lastLifted: "3 days ago", energyImpact: -5 },
          ]
        : [
            { name: "Mike", lastLifted: "4 days ago", energyImpact: -7 },
            { name: "Josh", lastLifted: "3 days ago", energyImpact: -5 },
          ];

      const mvp = isFemale
        ? { name: "Riley", workouts: 5, prs: 3, evolutionDelta: 2 }
        : { name: "Jake",  workouts: 5, prs: 3, evolutionDelta: 2 };

      res.json({
        squad: {
          id: 1,
          name: squadName,
          memberCount: memberPalette.length,
          streakDays: 14,
          energy: { percent: 84, message: "High energy. Let's keep it up.", trend: energyTrend, direction: "up" },
          members: memberPalette,
        },
        coach,
        activity,
        reactions: ["fire", "flex", "bolt", "rat"],
        aiInsight: {
          message: "2 members inactive. Squad energy could drop if no one steps up.",
          cta: "MOTIVATE THEM",
          inactiveMembers: inactive,
        },
        ghostMode: {
          members: inactive,
          message: "Bring them back. Squad needs you!",
          cta: "CHALLENGE THEM",
        },
        mvp,
        unreadNotifications: 3,
      });
    } catch (e) {
      console.error("/api/squad", e);
      res.status(500).json({ error: "Failed to load squad" });
    }
  });

  app.post("/api/squad/react", (req, res) => {
    try {
      getCurrentUser(req);
      const { kind } = req.body || {};
      res.json({ ok: true, kind: kind || "fire" });
    } catch (e) {
      console.error("/api/squad/react", e);
      res.status(500).json({ error: "Failed to react" });
    }
  });

  // FLEXIN: Progress screen — scan timeline + intro copy.
  app.get("/api/progress", (req, res) => {
    try {
      const user = getCurrentUser(req);
      const isFemale = user.sex === "female";

      // Real scans from the `scan` table (newest first, up to 4 shown in the row).
      const rows = db
        .select()
        .from(schema.scan)
        .where(eq(schema.scan.userId, user.id))
        .orderBy(desc(schema.scan.scannedAt))
        .limit(8)
        .all();

      const recentScans = rows.slice(0, 4).map((r, i) => {
        const d = new Date(r.scannedAt);
        return {
          id: r.id,
          date: r.scannedAt.slice(0, 10),
          dateLabel: d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
          isLatest: i === 0,
          intensity: 1 - i * 0.22,
          photoUrl: `/api/progress/photo/${r.id}`,
          renderUrl: (r as any).renderPath ? `/api/progress/render/${r.id}` : null,
          silhouetteParams: safeParseProgress(r.silhouetteParams),
          muscleEmphasis: safeParseProgress(r.muscleEmphasis),
          buildLabel: r.buildLabel,
          bodyFatPct: r.bodyFatPct,
          muscleMassPct: r.muscleMassPct,
        };
      });

      const latest = recentScans[0] || null;
      const hasScan = !!latest;

      res.json({
        user: { name: user.name, sex: user.sex, isFemale },
        intro: {
          title: "Progress",
          subtitle: "Track your transformation. See the real you evolve.",
        },
        scanHero: {
          title: hasScan ? "Your Latest Scan" : "Scan Your Physique",
          body: hasScan
            ? "This is your Flexin silhouette, built from your last photo. Take a new one to track your progress."
            : "We'll turn it into your Flexin silhouette and track your progress over time.",
          ctaText: "Take a photo.",
          buttonLabel: hasScan ? "Take New Progress Photo" : "Take Progress Photo",
          photoUrl: latest?.photoUrl ?? null,
          renderUrl: latest?.renderUrl ?? null,
          silhouetteParams: latest?.silhouetteParams ?? null,
          buildLabel: latest?.buildLabel ?? null,
          bodyFatPct: latest?.bodyFatPct ?? null,
          muscleMassPct: latest?.muscleMassPct ?? null,
        },
        steps: [
          { number: 1, title: "Take Photo",     blurb: "Front facing, good lighting" },
          { number: 2, title: "We Process",     blurb: "We create your silhouette" },
          { number: 3, title: "Track Progress", blurb: "See changes. Stay motivated." },
        ],
        recentScans,
        hasScan,
      });
    } catch (e) {
      console.error("/api/progress", e);
      res.status(500).json({ error: "Failed to load progress" });
    }
  });

  // FLEXIN: Upload + analyze a body scan photo.
  // POST /api/progress/scan  (multipart, field=photo)
  app.post("/api/progress/scan", (req, res) => {
    scanPhotoUpload.single("photo")(req, res, async (err: any) => {
      if (err) return res.status(400).json({ error: err.message });
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });

      try {
        const user = getCurrentUser(req);
        const photoPath = req.file.path;

        // Vision analysis (OpenAI if key set, otherwise per-photo heuristic)
        const analysis = await analyzePhoto(
          photoPath,
          (user.sex as "male" | "female" | "unspecified") || "unspecified",
        );

        const now = new Date().toISOString();
        const inserted = db
          .insert(schema.scan)
          .values({
            userId: user.id,
            photoPath,
            scannedAt: now,
            bodyFatPct: analysis.bodyFatPct,
            muscleMassPct: analysis.muscleMassPct,
            buildLabel: analysis.buildLabel,
            silhouetteParams: JSON.stringify(analysis.silhouetteParams),
            muscleEmphasis: JSON.stringify(analysis.muscleEmphasis),
            rawAnalysis: JSON.stringify(analysis.raw ?? null),
          })
          .returning()
          .all();

        const row = inserted[0];

        // Generate photorealistic body render (Style B) ASYNCHRONOUSLY.
        // The client gets the analysis stats immediately and polls /api/progress
        // (or GET /api/progress/scan/:id) for the render once it's ready.
        const sexForRender: "male" | "female" = user.sex === "female" ? "female" : "male";
        generateBodyRender(analysis, sexForRender, row.id)
          .then((renderPath) => {
            if (renderPath) {
              db.update(schema.scan)
                .set({ renderPath } as any)
                .where(eq(schema.scan.id, row.id))
                .run();
              console.log(`[scan ${row.id}] render ready: ${renderPath}`);
            }
          })
          .catch((err) => console.error(`[scan ${row.id}] render failed`, err));

        res.json({
          ok: true,
          source: analysis.source,
          scan: {
            id: row.id,
            date: row.scannedAt.slice(0, 10),
            photoUrl: `/api/progress/photo/${row.id}`,
            renderUrl: null, // pending; client polls for it
            renderStatus: "pending",
            silhouetteParams: analysis.silhouetteParams,
            muscleEmphasis: analysis.muscleEmphasis,
            buildLabel: analysis.buildLabel,
            bodyFatPct: analysis.bodyFatPct,
            muscleMassPct: analysis.muscleMassPct,
          },
        });
      } catch (e: any) {
        console.error("/api/progress/scan", e);
        res.status(500).json({ error: e?.message || "Failed to analyze photo" });
      }
    });
  });

  // Serve a generated body render by id
  app.get("/api/progress/render/:id", (req, res) => {
    try {
      const user = getCurrentUser(req);
      const id = parseInt(req.params.id, 10);
      const row = db
        .select()
        .from(schema.scan)
        .where(eq(schema.scan.id, id))
        .limit(1)
        .all()[0];
      if (!row || row.userId !== user.id) return res.status(404).send("not found");
      const renderPath = (row as any).renderPath;
      if (!renderPath || !fs.existsSync(renderPath)) return res.status(404).send("render missing");
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "public, max-age=86400");
      fs.createReadStream(renderPath).pipe(res);
    } catch (e) {
      console.error("/api/progress/render/:id", e);
      res.status(500).send("err");
    }
  });

  // Serve a scan photo by id (must belong to current user)
  app.get("/api/progress/photo/:id", (req, res) => {
    try {
      const user = getCurrentUser(req);
      const id = parseInt(req.params.id, 10);
      const row = db
        .select()
        .from(schema.scan)
        .where(eq(schema.scan.id, id))
        .limit(1)
        .all()[0];
      if (!row || row.userId !== user.id) return res.status(404).send("not found");
      if (!fs.existsSync(row.photoPath)) return res.status(404).send("file missing");
      const ext = path.extname(row.photoPath).toLowerCase();
      const mime = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
      res.setHeader("Content-Type", mime);
      res.setHeader("Cache-Control", "public, max-age=86400");
      fs.createReadStream(row.photoPath).pipe(res);
    } catch (e) {
      res.status(500).send("error");
    }
  });

  // Note: /api/feed removed — Squad page's LIVE ACTIVITY section covers it.

  return httpServer;
}
