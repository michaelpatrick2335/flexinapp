import type { Express, Request } from "express";
import type { Server } from "http";
import { storage, db } from "./storage";
import * as schema from "@shared/schema";
import { eq } from "drizzle-orm";
import multer from "multer";
import path from "path";
import fs from "fs";

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
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || ".jpg";
      cb(null, `profile${ext}`);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB max
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
      // Save path relative to cwd in the user record
      const relativePath = `/api/profile-pic/file`;
      const user = getCurrentUser(req);
      const updated = storage.updateUser(user.id, { profilePic: req.file.path });
      res.json({ url: relativePath, user: updated });
    });
  });

  // Serve profile picture: GET /api/profile-pic/file
  app.get("/api/profile-pic/file", (_req, res) => {
    // Find the file in profile-pics dir
    const files = fs.existsSync(PROFILE_PIC_DIR) ? fs.readdirSync(PROFILE_PIC_DIR) : [];
    const pic = files.find(f => /^profile\./i.test(f));
    if (!pic) return res.status(404).json({ error: "No profile pic" });
    const filePath = path.join(PROFILE_PIC_DIR, pic);
    const ext = path.extname(pic).toLowerCase();
    const mimeMap: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".gif": "image/gif", ".webp": "image/webp" };
    res.setHeader("Content-Type", mimeMap[ext] || "image/jpeg");
    res.setHeader("Cache-Control", "no-cache");
    fs.createReadStream(filePath).pipe(res);
  });

  // Delete profile picture: DELETE /api/profile-pic
  app.delete("/api/profile-pic", (_req, res) => {
    const files = fs.existsSync(PROFILE_PIC_DIR) ? fs.readdirSync(PROFILE_PIC_DIR) : [];
    files.filter(f => /^profile\./i.test(f)).forEach(f => fs.unlinkSync(path.join(PROFILE_PIC_DIR, f)));
    const user = getCurrentUser(req);
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

  return httpServer;
}
