// Single API router for all Flexin endpoints
// Consolidates everything into one Vercel function to stay within the 12-function limit

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Pool } from "pg";
// Stripe is loaded dynamically per-request to avoid bundling issues
// Using require() at module level - Vercel bundles this fine at runtime

// ── DB helpers ──────────────────────────────────────────────────────────────

const TEST_ACCOUNTS = ["mdore06@gmail.com", "michaelpatrick2335@gmail.com", "appreview@flexinapp.com"];

function makePool() {
  return new Pool({
    connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false },
    max: 3,
  });
}

async function ensureTables(pool: Pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY, email TEXT UNIQUE,
      name TEXT NOT NULL DEFAULT 'Seeker', tier TEXT NOT NULL DEFAULT 'newbie',
      level INTEGER NOT NULL DEFAULT 1, bananas INTEGER NOT NULL DEFAULT 0,
      total_sessions INTEGER NOT NULL DEFAULT 0, total_seconds_meditated INTEGER NOT NULL DEFAULT 0,
      streak_days INTEGER NOT NULL DEFAULT 0, last_session_date TEXT,
      is_premium BOOLEAN NOT NULL DEFAULT FALSE, free_sessions_used INTEGER NOT NULL DEFAULT 0,
      profile_pic TEXT, active_music_track TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS meditation_sessions (
      id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL, level INTEGER NOT NULL,
      tier TEXT NOT NULL, duration_seconds INTEGER NOT NULL, completed_at TEXT NOT NULL,
      bananas_earned INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS journal_entries (
      id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL, level INTEGER NOT NULL,
      tier TEXT NOT NULL, entry TEXT NOT NULL, created_at TEXT NOT NULL
    );
    -- Tribe / Groups feature (v1.1)
    CREATE TABLE IF NOT EXISTS groups (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      join_code TEXT UNIQUE NOT NULL,
      image_url TEXT,
      created_by_user_id INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS group_members (
      id SERIAL PRIMARY KEY,
      group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(group_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS group_activity (
      id SERIAL PRIMARY KEY,
      group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL,
      activity_type TEXT NOT NULL, -- session_complete | level_up | streak | challenge_complete
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      bananas_earned INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_group_activity_group_time
      ON group_activity (group_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_group_members_user
      ON group_members (user_id);
    CREATE TABLE IF NOT EXISTS activity_reactions (
      id SERIAL PRIMARY KEY,
      activity_id INTEGER NOT NULL REFERENCES group_activity(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL,
      icon TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(activity_id, user_id, icon)
    );
    CREATE INDEX IF NOT EXISTS idx_reactions_activity ON activity_reactions (activity_id);
    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      recipient_user_id INTEGER NOT NULL,
      sender_user_id INTEGER,
      type TEXT NOT NULL,            -- 'reaction' for now
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      read_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_notif_recipient_time ON notifications (recipient_user_id, created_at DESC);
    -- Track which group is each user's currently selected one (single row per user).
    -- We store it on the users table so it's loaded with the user object.
    ALTER TABLE users ADD COLUMN IF NOT EXISTS active_group_id INTEGER;
    -- Tribe code stashed at web signup; consumed by the native app on first launch
    ALTER TABLE users ADD COLUMN IF NOT EXISTS pending_join_code TEXT;
    -- Flexin profile fields (added during onboarding flow)
    ALTER TABLE users ADD COLUMN IF NOT EXISTS sex TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS theme_override TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS is_trainer BOOLEAN DEFAULT FALSE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS age INTEGER;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS weight_lbs REAL;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_body_type TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS goal_avatar_body_type TEXT;
    -- Flexin progression fields (mirror what the Home dashboard expects)
    ALTER TABLE users ADD COLUMN IF NOT EXISTS form_level INTEGER NOT NULL DEFAULT 1;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS form_rank TEXT NOT NULL DEFAULT 'Newbie';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS xp INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS xp_to_next INTEGER NOT NULL DEFAULT 100;
    -- Flexin workouts log. One row per completed workout. The Home dashboard
    -- tiles "TRAINING DAYS" and "TOTAL WORKOUTS" are computed from this table
    -- (per-user, current calendar month).
    CREATE TABLE IF NOT EXISTS workouts (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      category TEXT NOT NULL,
      exercise_names JSONB NOT NULL DEFAULT '[]'::jsonb,
      duration_seconds INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_workouts_user_time
      ON workouts (user_id, completed_at DESC);
  `);
}

// ── Workout dashboard stats ─────────────────────────────────────────────────
// Computes the "This month" tiles shown on Home: TRAINING DAYS is the count
// of distinct calendar days with at least one logged workout, TOTAL WORKOUTS
// is the count of workout rows. Both are scoped to the current calendar
// month in UTC and to the given user. Safe to call even if the workouts
// table is brand new (returns zeros).
async function computeMonthStats(pool: any, userId: number) {
  try {
    const r = await pool.query(
      `SELECT
         COUNT(*)::int AS total_workouts,
         COUNT(DISTINCT (completed_at AT TIME ZONE 'UTC')::date)::int AS training_days
       FROM workouts
       WHERE user_id = $1
         AND completed_at >= date_trunc('month', NOW())
         AND completed_at <  date_trunc('month', NOW()) + INTERVAL '1 month'`,
      [userId]
    );
    const row = r.rows[0] || {};
    return {
      trainingDays: Number(row.training_days) || 0,
      totalWorkouts: Number(row.total_workouts) || 0,
      caloriesBurned: 0,
      avgFormScore: 0,
      unreadAlerts: 0,
    };
  } catch (e) {
    console.error("[computeMonthStats] failed", e);
    return { trainingDays: 0, totalWorkouts: 0, caloriesBurned: 0, avgFormScore: 0, unreadAlerts: 0 };
  }
}

// ── Group helpers ───────────────────────────────────────────────────────────

// Generate a short, friendly, non-confusing join code (no 0/O/1/I/L)
function generateJoinCode(len = 6): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < len; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

async function emitGroupActivity(
  pool: Pool,
  userId: number,
  activityType: string,
  payload: Record<string, any>,
  bananasEarned = 0,
) {
  // Fan out to every group the user belongs to. Cheap because each user
  // is in a small number of groups.
  const memberships = await pool.query(
    "SELECT group_id FROM group_members WHERE user_id = $1",
    [userId],
  );
  for (const m of memberships.rows) {
    await pool.query(
      `INSERT INTO group_activity (group_id, user_id, activity_type, payload, bananas_earned)
       VALUES ($1, $2, $3, $4::jsonb, $5)`,
      [m.group_id, userId, activityType, JSON.stringify(payload), bananasEarned],
    );
  }
}

function rowToUser(row: any) {
  return {
    id: row.id, email: row.email ?? null, name: row.name, tier: row.tier,
    level: row.level, bananas: row.bananas, totalSessions: row.total_sessions,
    totalSecondsMediated: row.total_seconds_meditated, streakDays: row.streak_days,
    lastSessionDate: row.last_session_date ?? null, isPremium: row.is_premium,
    freeSessionsUsed: row.free_sessions_used, profilePic: row.profile_pic ?? null,
    activeMusicTrack: row.active_music_track ?? null,
    pendingJoinCode: row.pending_join_code ?? null,
    sex: row.sex ?? null,
    themeOverride: row.theme_override ?? null,
    isTrainer: row.is_trainer ?? false,
    age: row.age ?? null,
    weightLbs: row.weight_lbs ?? null,
    avatarBodyType: row.avatar_body_type ?? null,
    goalAvatarBodyType: row.goal_avatar_body_type ?? null,
    formLevel: row.form_level ?? 1,
    formRank: row.form_rank ?? "Newbie",
    xp: row.xp ?? 0,
    xpToNext: row.xp_to_next ?? 100,
  };
}

function getEmail(req: VercelRequest): string | null {
  const raw = req.headers["x-user-email"];
  const val = Array.isArray(raw) ? raw[0] : raw;
  return val ? val.trim().toLowerCase() : null;
}

async function getOrCreate(pool: Pool, email: string | null) {
  if (email) {
    const r = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (r.rows.length > 0) {
      const u = r.rows[0];
      if (TEST_ACCOUNTS.includes(email) && !u.is_premium) {
        const upd = await pool.query("UPDATE users SET is_premium = TRUE WHERE id = $1 RETURNING *", [u.id]);
        return upd.rows[0];
      }
      return u;
    }
    const isPremium = TEST_ACCOUNTS.includes(email);
    const r2 = await pool.query(
      `INSERT INTO users (email, is_premium) VALUES ($1, $2) ON CONFLICT (email) DO UPDATE SET email=EXCLUDED.email RETURNING *`,
      [email, isPremium]
    );
    return r2.rows[0];
  }
  const r = await pool.query("SELECT * FROM users WHERE email IS NULL ORDER BY id LIMIT 1");
  if (r.rows.length > 0) return r.rows[0];
  const r2 = await pool.query("INSERT INTO users DEFAULT VALUES RETURNING *");
  return r2.rows[0];
}

const COL_MAP: Record<string, string> = {
  name: "name", tier: "tier", level: "level", bananas: "bananas",
  totalSessions: "total_sessions", totalSecondsMediated: "total_seconds_meditated",
  streakDays: "streak_days", lastSessionDate: "last_session_date",
  isPremium: "is_premium", freeSessionsUsed: "free_sessions_used",
  profilePic: "profile_pic", activeMusicTrack: "active_music_track", email: "email",
  activeGroupId: "active_group_id",
  sex: "sex", themeOverride: "theme_override", isTrainer: "is_trainer",
  age: "age", weightLbs: "weight_lbs", avatarBodyType: "avatar_body_type",
  goalAvatarBodyType: "goal_avatar_body_type",
  formLevel: "form_level", formRank: "form_rank", xp: "xp", xpToNext: "xp_to_next",
};

async function updateUser(pool: Pool, id: number, fields: Record<string, any>) {
  const sets: string[] = []; const vals: any[] = []; let idx = 1;
  for (const [k, v] of Object.entries(fields)) {
    if (COL_MAP[k]) { sets.push(`${COL_MAP[k]} = $${idx++}`); vals.push(v); }
  }
  if (!sets.length) { const r = await pool.query("SELECT * FROM users WHERE id = $1", [id]); return r.rows[0]; }
  vals.push(id);
  const r = await pool.query(`UPDATE users SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`, vals);
  return r.rows[0];
}

// ── Main handler ─────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-user-email");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  // Route based on query param (Vercel passes path as ?path=...)
  // In Vercel, /api/[...slug] would be req.query.slug
  // Since this is api/index.ts, the URL path after /api/ needs routing
  const url = req.url || "";
  const path = url.split("?")[0].replace(/^\/api/, "");
  const method = req.method || "GET";

  const pool = makePool();
  try {
    await ensureTables(pool);
    const email = getEmail(req);

    // ── GET /api/user ────────────────────────────────────────────────────────
    if (path === "/user" || path === "" || path === "/") {
      if (method !== "GET" && method !== "PATCH") return res.status(405).json({ error: "Method not allowed" });
      if (method === "GET") {
        const row = await getOrCreate(pool, email);
        return res.json(rowToUser(row));
      }
      if (method === "PATCH") {
        const row = await getOrCreate(pool, email);
        const updated = await updateUser(pool, row.id, req.body);
        return res.json(rowToUser(updated));
      }
    }

    // ── POST /api/signup ─────────────────────────────────────────────────────
    // In-app signup for iOS (Apple guideline 3.1.1 compliant — no payment
    // collected here, user gets free tier + paywall for IAP later).
    if (path === "/signup") {
      if (method !== "POST") return res.status(405).json({ error: "Method not allowed" });
      const signupEmail = ((req.body?.email as string) || "").trim().toLowerCase();
      const signupName = ((req.body?.name as string) || "").trim().slice(0, 60);
      const signupJoinCode = ((req.body?.joinCode as string) || "").trim().toUpperCase().slice(0, 10) || null;
      if (!signupEmail) return res.status(400).json({ error: "Email required" });
      if (!signupEmail.includes("@")) return res.status(400).json({ error: "Invalid email" });
      const existing = await pool.query("SELECT id FROM users WHERE email = $1", [signupEmail]);
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: "An account already exists with this email. Please log in." });
      }
      let user = await getOrCreate(pool, signupEmail);
      // Persist display name from signup form (overrides the default 'Seeker').
      if (signupName) {
        const upd = await pool.query("UPDATE users SET name = $1 WHERE id = $2 RETURNING *", [signupName, user.id]);
        user = upd.rows[0];
      }
      // Stash the invite tribe code on the user record so the native app can
      // auto-join after first login. Only set if valid format.
      if (signupJoinCode && /^[A-Z0-9]{4,10}$/.test(signupJoinCode)) {
        const upd = await pool.query(
          "UPDATE users SET pending_join_code = $1 WHERE id = $2 RETURNING *",
          [signupJoinCode, user.id],
        );
        user = upd.rows[0];
      }
      // Persist the onboarding profile fields (sex / theme / trainer / age /
      // weight / avatar). Filtered through COL_MAP — unknown keys are dropped.
      const profilePatch: Record<string, any> = {};
      const b = (req.body || {}) as Record<string, any>;
      for (const k of ["sex", "themeOverride", "isTrainer", "age", "weightLbs", "avatarBodyType"]) {
        if (b[k] !== undefined && b[k] !== null && b[k] !== "") profilePatch[k] = b[k];
      }
      if (Object.keys(profilePatch).length) {
        user = await updateUser(pool, user.id, profilePatch);
      }
      return res.json(rowToUser(user));
    }

    // ── POST /api/login ──────────────────────────────────────────────────────
    if (path === "/login") {
      if (method !== "POST") return res.status(405).json({ error: "Method not allowed" });
      const loginEmail = ((req.body?.email as string) || "").trim().toLowerCase();
      if (!loginEmail) return res.status(400).json({ error: "Email required" });
      const r = await pool.query("SELECT * FROM users WHERE email = $1", [loginEmail]);
      let user;
      if (r.rows.length === 0) {
        // Auto-provision allow-listed test/reviewer accounts so the Apple
        // reviewer (and our internal test accounts) can sign in on a fresh
        // device without needing to go through the web signup flow.
        if (TEST_ACCOUNTS.includes(loginEmail)) {
          user = await getOrCreate(pool, loginEmail);
          const upd = await pool.query("UPDATE users SET is_premium = TRUE WHERE id = $1 RETURNING *", [user.id]);
          user = upd.rows[0];
        } else {
          return res.status(404).json({ error: "No account found with that email" });
        }
      } else {
        user = r.rows[0];
        if (TEST_ACCOUNTS.includes(loginEmail) && !user.is_premium) {
          const upd = await pool.query("UPDATE users SET is_premium = TRUE WHERE id = $1 RETURNING *", [user.id]);
          user = upd.rows[0];
        }
      }
      return res.json(rowToUser(user));
    }

    // GET /api/dashboard
    // Home screen payload. Returns the user profile plus sensible empty
    // defaults for the rich "stats" sections that don't yet have backing
    // tables. As workout logging / squad activity tables come online we will
    // hydrate these fields from real data; for now this unblocks the Home
    // screen so testers don't get stuck on a permanent "Loading...".
    if (path === "/dashboard") {
      if (method !== "GET") return res.status(405).json({ error: "Method not allowed" });
      if (!email) return res.status(401).json({ error: "Sign in required" });
      const row = await getOrCreate(pool, email);
      const u = rowToUser(row);
      const dashboard = {
        user: {
          id: u.id,
          name: u.name || "Friend",
          email: u.email,
          sex: u.sex || "unspecified",
          formLevel: u.formLevel,
          formRank: u.formRank,
          isPremium: u.isPremium,
          xp: u.xp,
          xpToNext: u.xpToNext,
          streakDays: u.streakDays,
          avatarBodyType: u.avatarBodyType,
          goalAvatarBodyType: u.goalAvatarBodyType,
          // Profile page (which reads from /api/dashboard) needs these.
          // Onboarding (NameEmail screen) collects age + weight and POSTs
          // them to /api/signup; without surfacing them here the Profile
          // tiles would always read "Add" even after the user typed them in.
          age: u.age,
          weightLbs: u.weightLbs,
          avatarUrl: u.profilePic || null,
        },
        muscleGroups: [
          { key: "chest",     label: "Chest",     progress: 0, streakDays: 0 },
          { key: "back",      label: "Back",      progress: 0, streakDays: 0 },
          { key: "legs",      label: "Legs",      progress: 0, streakDays: 0 },
          { key: "shoulders", label: "Shoulders", progress: 0, streakDays: 0 },
          { key: "arms",      label: "Arms",      progress: 0, streakDays: 0 },
          { key: "core",      label: "Core",      progress: 0, streakDays: 0 },
        ],
        bodyDeltas: [
          { key: "overall",   label: "Overall",   delta: 0, isOverall: true },
          { key: "chest",     label: "Chest",     delta: 0 },
          { key: "back",      label: "Back",      delta: 0 },
          { key: "legs",      label: "Legs",      delta: 0 },
          { key: "shoulders", label: "Shoulders", delta: 0 },
          { key: "arms",      label: "Arms",      delta: 0 },
          { key: "core",      label: "Core",      delta: 0 },
        ],
        energy: { percent: 100, message: "Fresh start — let's go" },
        weeklyScanDaysLeft: 7,
        monthStats: await computeMonthStats(pool, u.id),
        activeSquad: {
          id: 0, name: "", energy: 0, memberCount: 0,
          mvp: { userId: 0, name: "", contribution: 0 },
        },
        squadFeed: [],
        evolution: [],
        evolutionTimeline: [
          { key: "start",  label: "Start",   intensity: 0 },
          { key: "week1",  label: "Week 1",  intensity: 0 },
          { key: "month1", label: "Month 1", intensity: 0 },
          { key: "month3", label: "Month 3", intensity: 0 },
          { key: "goal",   label: "Goal",    intensity: 0 },
        ],
        coachMessage: `Welcome, ${u.name || "friend"}. Log your first workout to start your transformation.`,
        generatedAt: new Date().toISOString(),
      };
      return res.json(dashboard);
    }

    // ── GET /api/squad ──────────────────────────────────────────────────────
    // Squad tab payload. Returns a friendly empty/welcome state for users
    // who don't yet have a real squad set up. Wires up an inviting UI
    // instead of an indefinite loading spinner.
    if (path === "/squad") {
      if (method !== "GET") return res.status(405).json({ error: "Method not allowed" });
      if (!email) return res.status(401).json({ error: "Sign in required" });
      const row = await getOrCreate(pool, email);
      const u = rowToUser(row);
      const isFemale = u.sex === "female";
      const squadPayload = {
        squad: {
          id: 0,
          name: "Your Squad",
          memberCount: 1,
          streakDays: 0,
          energy: { percent: 100, message: "Invite friends to fire up the squad", trend: [50, 60, 70, 80, 90, 100], direction: "up" as const },
          members: [
            { name: u.name || "You", initials: ((u.name || "You")[0] || "Y").toUpperCase(), bg: "#3B82F6", avatarUrl: null, lastActiveAgo: "now" },
          ],
        },
        coach: { name: isFemale ? "Maxine" : "Max", sex: isFemale ? "female" as const : "male" as const, message: "Bring two friends in this week — squads of 3+ stay 4x more consistent.", cta: "Invite friends" },
        activity: [],
        reactions: ["fire", "clap", "eyes", "ghost"],
        aiInsight: { message: "Once your squad is rolling I'll flag inactive members here.", cta: "", inactiveMembers: [] },
        ghostMode: { members: [], message: "No ghosts yet.", cta: "" },
        mvp: { name: u.name || "You", workouts: 0, prs: 0, evolutionDelta: 0 },
        unreadNotifications: 0,
      };
      return res.json(squadPayload);
    }

    // ── GET /api/progress ───────────────────────────────────────────────────
    // Progress tab payload. Returns intro/onboarding state until the user
    // takes their first progress scan.
    if (path === "/progress") {
      if (method !== "GET") return res.status(405).json({ error: "Method not allowed" });
      if (!email) return res.status(401).json({ error: "Sign in required" });
      const row = await getOrCreate(pool, email);
      const u = rowToUser(row);
      const isFemale = u.sex === "female";
      const progressPayload = {
        user: { name: u.name || "Friend", sex: u.sex || "unspecified", isFemale },
        intro: {
          title: "Track your transformation",
          subtitle: "Snap a weekly progress photo. We'll render a clean silhouette and chart your real changes over time.",
        },
        scanHero: {
          title: "Take your first scan",
          body: "Stand in good lighting, arms slightly out, palms forward. Front view works best.",
          ctaText: "Take Progress Photo",
          buttonLabel: "Take Photo",
          photoUrl: null,
          renderUrl: null,
          silhouetteParams: null,
          buildLabel: null,
          bodyFatPct: null,
          muscleMassPct: null,
        },
        steps: [
          { number: 1, title: "Snap weekly", blurb: "One photo a week, same lighting and angle." },
          { number: 2, title: "AI render", blurb: "We turn it into a clean silhouette in seconds." },
          { number: 3, title: "See change", blurb: "Side-by-side scans show real progress, not vibes." },
        ],
        recentScans: [],
        hasScan: false,
      };
      return res.json(progressPayload);
    }

    // ── GET /api/workout-categories ─────────────────────────────────────────
    // LogWorkout tab payload — list of day tiles (matches v1 mockup).
    if (path === "/workout-categories") {
      if (method !== "GET") return res.status(405).json({ error: "Method not allowed" });
      if (!email) return res.status(401).json({ error: "Sign in required" });
      const row = await getOrCreate(pool, email);
      const u = rowToUser(row);
      const categoriesPayload = {
        sex: u.sex || "unspecified",
        categories: [
          { key: "push",     name: "Push Day",     summary: "Chest, Shoulders, Triceps",  icon: "bolt"  },
          { key: "pull",     name: "Pull Day",     summary: "Back, Biceps",               icon: "pull"  },
          { key: "legs",     name: "Leg Day",      summary: "Quads, Hamstrings, Calves",  icon: "legs"  },
          { key: "fullbody", name: "Full Body",    summary: "Everything",                 icon: "body"  },
          { key: "arms",     name: "Arm Day",      summary: "Biceps, Triceps, Forearms",  icon: "bicep" },
          { key: "shoulders",name: "Shoulder Day", summary: "Front, Side, Rear Delts",    icon: "bolt"  },
          { key: "glutes",   name: "Glute Day",    summary: "Glutes, Hamstrings",         icon: "legs"  },
          { key: "back",     name: "Back Day",     summary: "Lats, Rhomboids, Traps",     icon: "pull"  },
          { key: "chest",    name: "Chest Day",    summary: "Chest, Triceps",             icon: "body"  },
          { key: "custom",   name: "Custom Day",   summary: "Build your own",             icon: "plus"  },
        ],
      };
      return res.json(categoriesPayload);
    }

    // ── GET /api/exercises?category=push ────────────────────────────────────
    // Returns the built-in exercise list for a given category. Matches the
    // v1 SelectExercises mockup so users see a real list immediately.
    if (path === "/exercises") {
      if (method !== "GET") return res.status(405).json({ error: "Method not allowed" });
      if (!email) return res.status(401).json({ error: "Sign in required" });
      const row = await getOrCreate(pool, email);
      const u = rowToUser(row);
      const isFemale = u.sex === "female";
      const category = String(req.query.category || "push").toLowerCase();
      const byCategory: Record<string, string[]> = {
        push:      ["Bench Press", "Incline Press", "Chest Fly", "Shoulder Press", "Lateral Raises", "Tricep Dips", "Skull Crushers", "Cable Pushdown", "Push-Up"],
        pull:      ["Pull-Up", "Lat Pulldown", "Barbell Row", "Seated Cable Row", "Face Pull", "Bicep Curl", "Hammer Curl", "Preacher Curl", "Reverse Fly"],
        legs:      ["Back Squat", "Front Squat", "Romanian Deadlift", "Leg Press", "Walking Lunge", "Hip Thrust", "Leg Curl", "Leg Extension", "Calf Raise"],
        fullbody:  ["Deadlift", "Back Squat", "Bench Press", "Pull-Up", "Overhead Press", "Barbell Row", "Lunge", "Plank", "Burpee"],
        arms:      ["Bicep Curl", "Hammer Curl", "Preacher Curl", "Concentration Curl", "Tricep Dips", "Skull Crushers", "Cable Pushdown", "Overhead Tricep Extension", "Wrist Curl"],
        shoulders: ["Overhead Press", "Shoulder Press", "Lateral Raises", "Front Raises", "Rear Delt Fly", "Arnold Press", "Upright Row", "Face Pull", "Shrugs"],
        glutes:    ["Hip Thrust", "Glute Bridge", "Romanian Deadlift", "Bulgarian Split Squat", "Cable Kickback", "Sumo Squat", "Walking Lunge", "Step-Up", "Glute Ham Raise"],
        back:      ["Pull-Up", "Lat Pulldown", "Barbell Row", "Seated Cable Row", "T-Bar Row", "Single-Arm Dumbbell Row", "Face Pull", "Straight-Arm Pulldown", "Hyperextension"],
        chest:     ["Bench Press", "Incline Bench Press", "Decline Bench Press", "Dumbbell Press", "Incline Dumbbell Press", "Chest Fly", "Cable Crossover", "Push-Up", "Dumbbell Pullover"],
        custom:    [],
      };
      const names = byCategory[category] ?? byCategory.fullbody;
      const exercises = names.map((name, i) => ({
        id: i + 1, name, category, sexTarget: isFemale ? "female" : "male", isCustom: false,
      }));
      return res.json({ category, sex: u.sex || "unspecified", isFemale, exercises });
    }

    // ── POST /api/progress/scan ──────────────────────────────────────────
    // Accepts a base64 photo data URL and (for now) returns a stub render
    // URL so the Progress UI can refresh with a visible "first scan" state.
    // The actual AI body render is a follow-up milestone.
    if (path === "/progress/scan") {
      if (method !== "POST") return res.status(405).json({ error: "Method not allowed" });
      if (!email) return res.status(401).json({ error: "Sign in required" });
      const body = (req.body || {}) as { photoDataUrl?: string };
      const dataUrl = (body.photoDataUrl || "").trim();
      if (!dataUrl.startsWith("data:image/")) {
        return res.status(400).json({ error: "photoDataUrl must be a base64 image data URL" });
      }
      // Sanity cap to avoid massive payloads (8 MB base64 ≈ 6 MB raw)
      if (dataUrl.length > 8_000_000) {
        return res.status(413).json({ error: "Photo too large — try a smaller image" });
      }
      const row = await getOrCreate(pool, email);
      const u = rowToUser(row);

      // Parse the data URL into mime + base64 payload for Gemini
      const m = dataUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
      if (!m) return res.status(400).json({ error: "Invalid data URL" });
      const inputMime = m[1];
      const inputBase64 = m[2];

      // Build the render prompt. We bias toward a clean, brand-aligned look
      // (dark background, blue rim light) and the user's recorded sex so the
      // output silhouette matches their identity.
      const sex = (u.sex || "unspecified").toLowerCase();
      const sexHint = sex === "female" ? "a woman" : sex === "male" ? "a man" : "the person";
      const prompt = [
        `Render ${sexHint} from this progress photo as a clean, full-body fitness silhouette.`,
        "Keep the same body proportions, height, and pose.",
        "Style: athletic profile silhouette, deep navy/black background, subtle electric-blue rim light along the muscles,",
        "smooth modern look like a premium fitness app illustration.",
        "No face details, no logos, no text. Clean studio lighting. Centered.",
        "Output a single high-quality image.",
      ].join(" ");

      // Call Google Gemini (gemini-2.5-flash-image, aka "Nano Banana"). If
      // GOOGLE_API_KEY isn't set the function falls back to a stub response
      // so the UI still works end-to-end.
      const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
      let renderUrl: string | null = null;
      let renderError: string | null = null;
      let status: "rendered" | "failed" | "stub" = "stub";

      if (apiKey) {
        try {
          const model = "gemini-2.5-flash-image";
          const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
          const geminiBody = {
            contents: [
              {
                role: "user",
                parts: [
                  { text: prompt },
                  { inlineData: { mimeType: inputMime, data: inputBase64 } },
                ],
              },
            ],
            generationConfig: {
              responseModalities: ["IMAGE"],
            },
          };
          const r = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(geminiBody),
          });
          const j: any = await r.json().catch(() => ({}));
          if (!r.ok) {
            renderError = j?.error?.message || `Gemini error (${r.status})`;
            status = "failed";
          } else {
            const parts: any[] = j?.candidates?.[0]?.content?.parts || [];
            const imgPart = parts.find((p) => p?.inlineData?.data);
            if (imgPart?.inlineData?.data) {
              const outMime = imgPart.inlineData.mimeType || "image/png";
              renderUrl = `data:${outMime};base64,${imgPart.inlineData.data}`;
              status = "rendered";
            } else {
              renderError = j?.candidates?.[0]?.finishReason || "No image returned";
              status = "failed";
            }
          }
        } catch (e: any) {
          renderError = e?.message || "Gemini call failed";
          status = "failed";
        }
      }

      return res.json({
        ok: true,
        scanId: Date.now(),
        receivedBytes: dataUrl.length,
        photoUrl: dataUrl,
        renderUrl,
        status,
        renderError,
        user: { id: u.id, name: u.name, sex: u.sex },
        receivedAt: new Date().toISOString(),
      });
    }

    // ── POST /api/workout ───────────────────────────────────────────────────
    // Records a completed workout. Inserts a row in `workouts` so the Home
    // dashboard tiles "TRAINING DAYS" and "TOTAL WORKOUTS" can be computed
    // from real data instead of always returning 0.
    if (path === "/workout") {
      if (method !== "POST") return res.status(405).json({ error: "Method not allowed" });
      if (!email) return res.status(401).json({ error: "Sign in required" });
      const body = (req.body || {}) as { category?: string; exerciseNames?: string[]; durationSeconds?: number; notes?: string | null };
      const row = await getOrCreate(pool, email);
      const user = rowToUser(row);
      const category = (body.category || "").trim() || "custom";
      const names = Array.isArray(body.exerciseNames) ? body.exerciseNames.filter((s) => typeof s === "string" && s.trim()) : [];
      const durationSeconds = Number.isFinite(body.durationSeconds) ? Math.max(0, Math.floor(body.durationSeconds as number)) : 0;
      const notes = typeof body.notes === "string" ? body.notes : null;
      const insertRes = await pool.query(
        `INSERT INTO workouts (user_id, category, exercise_names, duration_seconds, notes, completed_at)
         VALUES ($1, $2, $3::jsonb, $4, $5, NOW())
         RETURNING id, category, exercise_names, duration_seconds, completed_at`,
        [user.id, category, JSON.stringify(names), durationSeconds, notes]
      );
      return res.json({
        ok: true,
        workout: insertRes.rows[0],
        category,
        exerciseCount: names.length,
        loggedAt: insertRes.rows[0].completed_at,
      });
    }

    // ── POST /api/unlock ─────────────────────────────────────────────────────
    if (path === "/unlock") {
      if (method !== "POST") return res.status(405).json({ error: "Method not allowed" });
      // Accept email from body (post-Stripe flow) or header
      const bodyEmail = (req.body as any)?.email as string | undefined;
      const bodyName = (req.body as any)?.name as string | undefined;
      const unlockEmail = bodyEmail?.trim().toLowerCase() || email;
      if (!unlockEmail) return res.status(400).json({ error: "Email required" });
      const row = await getOrCreate(pool, unlockEmail);
      const updates: Record<string, any> = { isPremium: true };
      if (bodyName) updates.name = bodyName;
      const updated = await updateUser(pool, row.id, updates);
      return res.json(rowToUser(updated));
    }

    // ── POST /api/logout ─────────────────────────────────────────────────────
    if (path === "/logout") {
      if (method !== "POST") return res.status(405).json({ error: "Method not allowed" });
      // Logout is a client-side session clear only. NEVER wipe gameplay
      // progress on the server — level, bananas, streak, sessions, premium
      // status, and journal entries must persist so the user picks up exactly
      // where they left off when they log back in.
      return res.json({ ok: true });
    }

    // ── POST /api/session-complete ───────────────────────────────────────────
    if (path === "/session-complete" || path === "/session/complete") {
      if (method !== "POST") return res.status(405).json({ error: "Method not allowed" });
      const { durationSeconds } = req.body as { durationSeconds: number };
      const row = await getOrCreate(pool, email);
      const user = rowToUser(row);
      const sRes = await pool.query(
        `INSERT INTO meditation_sessions (user_id,level,tier,duration_seconds,completed_at,bananas_earned) VALUES ($1,$2,$3,$4,$5,1) RETURNING *`,
        [user.id, user.level, user.tier, durationSeconds, new Date().toISOString()]
      );
      const today = new Date().toISOString().split("T")[0];
      const wasYesterday = user.lastSessionDate === new Date(Date.now() - 86400000).toISOString().split("T")[0];
      const isToday = user.lastSessionDate === today;
      const newBananas = user.bananas + 1;
      const newLevel = Math.min(user.level + 1, 1000);
      const newStreak = isToday ? user.streakDays : wasYesterday ? user.streakDays + 1 : 1;
      let newTier = user.tier;
      if (newLevel >= 500) newTier = "enlightened"; else if (newLevel >= 250) newTier = "experienced";
      const newFreeUsed = user.isPremium ? user.freeSessionsUsed : Math.min(user.freeSessionsUsed + 1, 3);
      const updatedRow = await updateUser(pool, user.id, {
        level: newLevel, bananas: newBananas, totalSessions: user.totalSessions + 1,
        totalSecondsMediated: user.totalSecondsMediated + durationSeconds,
        streakDays: newStreak, lastSessionDate: today, tier: newTier, freeSessionsUsed: newFreeUsed,
      });
      // Emit group activity (best-effort, never blocks the response).
      try {
        await emitGroupActivity(pool, user.id, "session_complete", {
          level: newLevel, tier: newTier, durationSeconds,
        }, 1);
        if (newLevel !== user.level) {
          await emitGroupActivity(pool, user.id, "level_up", { level: newLevel, tier: newTier }, 0);
        }
        // Notable streak milestones get their own activity card.
        if (newStreak > user.streakDays && [3, 7, 14, 30, 60, 100].includes(newStreak)) {
          await emitGroupActivity(pool, user.id, "streak", { days: newStreak }, 0);
        }
      } catch (e) {
        console.error("[group-activity] emit failed", e);
      }
      return res.json({ session: sRes.rows[0], user: rowToUser(updatedRow), leveledUp: newLevel !== user.level, newLevel });
    }

    // ── POST /api/challenge-complete ─────────────────────────────────────────
    if (path === "/challenge-complete" || path === "/challenge/complete") {
      if (method !== "POST") return res.status(405).json({ error: "Method not allowed" });
      const { bananas } = req.body as { bananas: number };
      const row = await getOrCreate(pool, email);
      const user = rowToUser(row);
      const bonus = Math.min(Math.max(bananas, 1), 10);
      const updated = await updateUser(pool, user.id, { bananas: user.bananas + bonus });
      try {
        await emitGroupActivity(pool, user.id, "challenge_complete", { bonus }, bonus);
      } catch (e) { console.error("[group-activity] emit failed", e); }
      return res.json({ user: rowToUser(updated), bonusBananas: bonus });
    }

    // ── POST /api/change-level ───────────────────────────────────────────────
    if (path === "/change-level") {
      if (method !== "POST") return res.status(405).json({ error: "Method not allowed" });
      const { tier } = req.body as { tier: string };
      const levelMap: Record<string, number> = { newbie: 1, experienced: 250, enlightened: 500 };
      const newLevel = levelMap[tier];
      if (!newLevel) return res.status(400).json({ error: "Invalid tier" });
      const row = await getOrCreate(pool, email);
      const updated = await updateUser(pool, row.id, { tier, level: newLevel });
      return res.json(rowToUser(updated));
    }

    // ── GET /api/sessions ────────────────────────────────────────────────────
    // POST /api/journal — save a journal entry for the current level
    if (path === "/journal" && method === "POST") {
      const { entry, level, tier } = req.body as { entry: string; level?: number; tier?: string };
      const cleaned = (entry || "").trim();
      if (!cleaned) return res.status(400).json({ error: "Entry is required" });
      if (cleaned.length > 500) return res.status(400).json({ error: "Entry too long (max 500 chars)" });
      const u0 = await getOrCreate(pool, email);
      const user0 = rowToUser(u0);
      const jr = await pool.query(
        `INSERT INTO journal_entries (user_id, level, tier, entry, created_at) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [user0.id, level ?? user0.level, tier ?? user0.tier, cleaned, new Date().toISOString()]
      );
      const j0 = jr.rows[0];
      return res.json({
        entry: { id: j0.id, userId: j0.user_id, level: j0.level, tier: j0.tier, entry: j0.entry, createdAt: j0.created_at }
      });
    }

    // GET /api/journal — list journal entries (newest first)
    if (path === "/journal" && method === "GET") {
      const u1 = await getOrCreate(pool, email);
      const jr2 = await pool.query(
        "SELECT * FROM journal_entries WHERE user_id = $1 ORDER BY created_at DESC", [u1.id]
      );
      return res.json(jr2.rows.map((j: any) => ({
        id: j.id, userId: j.user_id, level: j.level, tier: j.tier,
        entry: j.entry, createdAt: j.created_at,
      })));
    }

    if (path === "/sessions") {
      if (method !== "GET") return res.status(405).json({ error: "Method not allowed" });
      const row = await getOrCreate(pool, email);
      const r = await pool.query(
        "SELECT * FROM meditation_sessions WHERE user_id = $1 ORDER BY completed_at DESC", [row.id]
      );
      return res.json(r.rows.map((s: any) => ({
        id: s.id, userId: s.user_id, level: s.level, tier: s.tier,
        durationSeconds: s.duration_seconds, completedAt: s.completed_at, bananasEarned: s.bananas_earned,
      })));
    }

    // ── GET /api/music ───────────────────────────────────────────────────────
    if (path === "/music") {
      if (method !== "GET") return res.status(405).json({ error: "Method not allowed" });
      const row = await getOrCreate(pool, email);
      return res.json({ tracks: [], active: rowToUser(row).activeMusicTrack });
    }

    // ── POST /api/music-active ───────────────────────────────────────────────
    if (path === "/music-active" || path === "/music/active") {
      if (method !== "POST") return res.status(405).json({ error: "Method not allowed" });
      const row = await getOrCreate(pool, email);
      const updated = await updateUser(pool, row.id, { activeMusicTrack: req.body?.id ?? null });
      return res.json(rowToUser(updated));
    }

    // ── GET /api/voice ───────────────────────────────────────────────────────
    if (path === "/voice") {
      return res.json({});
    }

    // ── Stripe ───────────────────────────────────────────────────────────────
    if (path === "/stripe-setup-intent" || path === "/stripe/setup-intent") {
      if (method !== "POST") return res.status(405).json({ error: "Method not allowed" });
      const stripeKey = process.env.STRIPE_SECRET_KEY;
      if (!stripeKey) return res.json({ demo: true });
      const StripeMod = await import("stripe");
      const StripeLib = (StripeMod as any).default || StripeMod;
      const stripe = new StripeLib(stripeKey, { apiVersion: "2024-06-20" });
      const { email: stripeEmail } = req.body as { email: string };
      let customerId: string | undefined;
      if (stripeEmail) {
        const existing = await stripe.customers.list({ email: stripeEmail, limit: 1 });
        customerId = existing.data.length > 0
          ? existing.data[0].id
          : (await stripe.customers.create({ email: stripeEmail })).id;
      }
      const si = await stripe.setupIntents.create({ customer: customerId, payment_method_types: ["card"], usage: "off_session" });
      return res.json({ clientSecret: si.client_secret, customerId });
    }

    if (path === "/stripe-confirm-subscription" || path === "/stripe/confirm-subscription") {
      if (method !== "POST") return res.status(405).json({ error: "Method not allowed" });
      const stripeKey = process.env.STRIPE_SECRET_KEY;
      if (!stripeKey) return res.json({ demo: true });
      const StripeMod = await import("stripe");
      const StripeLib = (StripeMod as any).default || StripeMod;
      const stripe = new StripeLib(stripeKey, { apiVersion: "2024-06-20" });
      const { customerId, paymentMethodId } = req.body as { customerId: string; paymentMethodId: string };
      await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
      await stripe.customers.update(customerId, { invoice_settings: { default_payment_method: paymentMethodId } });
      await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price_data: { currency: "usd", product_data: { name: "Flexin Full Access" }, unit_amount: 499, recurring: { interval: "month" } } }],
        trial_period_days: 3, default_payment_method: paymentMethodId,
      });
      const row = await getOrCreate(pool, email);
      await updateUser(pool, row.id, { isPremium: true });
      return res.json({ success: true });
    }

    if (path === "/stripe-create-subscription" || path === "/stripe/create-subscription") {
      if (method !== "POST") return res.status(405).json({ error: "Method not allowed" });
      const stripeKey = process.env.STRIPE_SECRET_KEY;
      if (!stripeKey) return res.json({ demo: true });
      const StripeMod = await import("stripe");
      const StripeLib = (StripeMod as any).default || StripeMod;
      const stripe = new StripeLib(stripeKey, { apiVersion: "2024-06-20" });
      const { email: stripeEmail, joinCode: stripeJoinCode } = req.body as { email: string; joinCode?: string };
      const origin = (req.headers.origin as string) || "https://www.flexinfitapp.com";
      // If this is a tribe invite signup flow, redirect to /post-signup so the
      // user gets an App Store CTA. Otherwise stay with the legacy in-app redirect.
      const isInviteFlow = !!stripeJoinCode && /^[A-Z0-9]{4,10}$/i.test(stripeJoinCode);
      const successUrl = isInviteFlow
        ? `${origin}/post-signup?email=${encodeURIComponent(stripeEmail || "")}&join=${encodeURIComponent(stripeJoinCode!.toUpperCase())}`
        : `${origin}/app/#/?stripe=success`;
      const cancelUrl = isInviteFlow
        ? `${origin}/signup?join=${encodeURIComponent(stripeJoinCode!.toUpperCase())}`
        : `${origin}/app/#/`;
      const session = await stripe.checkout.sessions.create({
        mode: "subscription", payment_method_types: ["card"], customer_email: stripeEmail || undefined,
        line_items: [{ price_data: { currency: "usd", product_data: { name: "Flexin Full Access" }, unit_amount: 499, recurring: { interval: "month" } }, quantity: 1 }],
        subscription_data: { trial_period_days: 3 },
        success_url: successUrl, cancel_url: cancelUrl,
      });
      return res.json({ url: session.url });
    }

    // ── /api/profile-pic ─────────────────────────────────────────────────────
    // Stores avatar as base64 data URL directly in the users.profile_pic TEXT
    // column. We can't use multer/disk on Vercel serverless (ephemeral FS), so
    // the client converts the image to a base64 data URL and POSTs JSON.
    if (path === "/profile-pic" || path === "/profile-pic/file") {
      if (method === "GET") {
        // Return the data URL string for the current user (or 404)
        const row = await getOrCreate(pool, email);
        const pic = row.profile_pic as string | null;
        if (!pic) return res.status(404).json({ error: "No profile pic" });
        return res.json({ url: pic });
      }
      if (method === "POST") {
        if (!email) return res.status(401).json({ error: "Not authenticated" });
        const dataUrl = (req.body as any)?.image as string | undefined;
        if (!dataUrl || typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) {
          return res.status(400).json({ error: "Invalid image data" });
        }
        // Cap stored size to 1.5MB of base64 (~1.1MB raw) to keep DB rows small
        if (dataUrl.length > 1_500_000) {
          return res.status(413).json({ error: "Image too large after compression" });
        }
        const row = await getOrCreate(pool, email);
        const updated = await updateUser(pool, row.id, { profilePic: dataUrl });
        return res.json({ url: dataUrl, user: rowToUser(updated) });
      }
      if (method === "DELETE") {
        if (!email) return res.status(401).json({ error: "Not authenticated" });
        const row = await getOrCreate(pool, email);
        const updated = await updateUser(pool, row.id, { profilePic: null });
        return res.json({ user: rowToUser(updated) });
      }
      return res.status(405).json({ error: "Method not allowed" });
    }

    // ── DELETE /api/account ──────────────────────────────────────────────────
    // Apple Guideline 5.1.1(v) — full account deletion. Removes the user row
    // and every meditation_session / journal_entry tied to it.
    if (path === "/account") {
      if (method !== "DELETE") return res.status(405).json({ error: "Method not allowed" });
      if (!email) return res.status(401).json({ error: "Not authenticated" });
      const r = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
      if (r.rows.length === 0) {
        // Treat as already-deleted so the client logs out cleanly.
        return res.json({ deleted: true });
      }
      const userId = r.rows[0].id;
      await pool.query("DELETE FROM meditation_sessions WHERE user_id = $1", [userId]);
      await pool.query("DELETE FROM journal_entries WHERE user_id = $1", [userId]);
      await pool.query("DELETE FROM users WHERE id = $1", [userId]);
      return res.json({ deleted: true });
    }

    // ── 404 ──────────────────────────────────────────────────────────────────
        // ============ GROUPS / TRIBE ============================================
    // ── NOTIFICATIONS ────────────────────────────────────────────────
    // GET /api/notifications?unreadOnly=1 — list recent notifications + unread count
    if (path === "/notifications" && method === "GET") {
      if (!email) return res.status(401).json({ error: "Not authenticated" });
      const me = await getOrCreate(pool, email);
      const unreadOnly = (req.query as any)?.unreadOnly === "1";
      const r = await pool.query(
        `SELECT n.id, n.sender_user_id, n.type, n.payload, n.read_at, n.created_at,
                s.name AS sender_name, s.profile_pic AS sender_profile_pic
         FROM notifications n
         LEFT JOIN users s ON s.id = n.sender_user_id
         WHERE n.recipient_user_id = $1
         ${unreadOnly ? "AND n.read_at IS NULL" : ""}
         ORDER BY n.created_at DESC LIMIT 30`,
        [me.id],
      );
      const unread = await pool.query(
        "SELECT COUNT(*)::int AS c FROM notifications WHERE recipient_user_id = $1 AND read_at IS NULL",
        [me.id],
      );
      return res.json({
        unreadCount: unread.rows[0]?.c ?? 0,
        items: r.rows.map((n: any) => ({
          id: n.id,
          senderUserId: n.sender_user_id,
          senderName: n.sender_name,
          senderProfilePic: n.sender_profile_pic ?? null,
          type: n.type,
          payload: n.payload,
          readAt: n.read_at,
          createdAt: n.created_at,
        })),
      });
    }

    // POST /api/notifications/mark-read — mark all (or specific ids) as read
    if (path === "/notifications/mark-read" && method === "POST") {
      if (!email) return res.status(401).json({ error: "Not authenticated" });
      const me = await getOrCreate(pool, email);
      const ids: number[] | undefined = Array.isArray(req.body?.ids) ? req.body.ids : undefined;
      if (ids && ids.length > 0) {
        await pool.query(
          "UPDATE notifications SET read_at = NOW() WHERE recipient_user_id = $1 AND id = ANY($2::int[]) AND read_at IS NULL",
          [me.id, ids],
        );
      } else {
        await pool.query(
          "UPDATE notifications SET read_at = NOW() WHERE recipient_user_id = $1 AND read_at IS NULL",
          [me.id],
        );
      }
      return res.json({ ok: true });
    }

    // All group endpoints require the user to be authenticated (x-user-email).

    // GET /api/groups — list all groups the current user belongs to
    if (path === "/groups" && method === "GET") {
      if (!email) return res.status(401).json({ error: "Not authenticated" });
      const row = await getOrCreate(pool, email);
      const r = await pool.query(
        `SELECT g.id, g.name, g.join_code, g.image_url, g.created_by_user_id, g.created_at,
                (SELECT COUNT(*)::int FROM group_members gm2 WHERE gm2.group_id = g.id) AS member_count
         FROM groups g
         JOIN group_members gm ON gm.group_id = g.id
         WHERE gm.user_id = $1
         ORDER BY g.created_at DESC`,
        [row.id],
      );
      return res.json({
        activeGroupId: row.active_group_id ?? null,
        groups: r.rows.map((g: any) => ({
          id: g.id, name: g.name, joinCode: g.join_code, imageUrl: g.image_url,
          createdByUserId: g.created_by_user_id, memberCount: g.member_count,
          createdAt: g.created_at,
        })),
      });
    }

    // POST /api/groups — create a new group
    if (path === "/groups" && method === "POST") {
      if (!email) return res.status(401).json({ error: "Not authenticated" });
      const { name, imageUrl } = (req.body as any) || {};
      const cleanName = (name || "").trim().slice(0, 60);
      if (!cleanName) return res.status(400).json({ error: "Group name required" });
      const row = await getOrCreate(pool, email);
      let code = generateJoinCode();
      for (let attempt = 0; attempt < 5; attempt++) {
        const existing = await pool.query("SELECT 1 FROM groups WHERE join_code = $1", [code]);
        if (existing.rows.length === 0) break;
        code = generateJoinCode();
      }
      const ins = await pool.query(
        `INSERT INTO groups (name, join_code, image_url, created_by_user_id)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [cleanName, code, imageUrl || null, row.id],
      );
      const group = ins.rows[0];
      await pool.query(
        "INSERT INTO group_members (group_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [group.id, row.id],
      );
      if (!row.active_group_id) {
        await updateUser(pool, row.id, { activeGroupId: group.id });
      }
      return res.json({
        group: {
          id: group.id, name: group.name, joinCode: group.join_code,
          imageUrl: group.image_url, createdByUserId: group.created_by_user_id,
          memberCount: 1, createdAt: group.created_at,
        },
      });
    }

    // POST /api/groups/join — join by code (multi-use codes)
    if (path === "/groups/join" && method === "POST") {
      if (!email) return res.status(401).json({ error: "Not authenticated" });
      // Accept either `code` or `joinCode` for body field (legacy + new clients).
      const code = (((req.body as any)?.code || (req.body as any)?.joinCode) || "").toString().trim().toUpperCase();
      if (!code) return res.status(400).json({ error: "Code required" });
      const row = await getOrCreate(pool, email);
      const gr = await pool.query("SELECT * FROM groups WHERE join_code = $1", [code]);
      if (gr.rows.length === 0) return res.status(404).json({ error: "Invalid invite code" });
      const group = gr.rows[0];
      const before = await pool.query(
        "SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2",
        [group.id, row.id],
      );
      const wasAlreadyMember = before.rows.length > 0;
      await pool.query(
        "INSERT INTO group_members (group_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [group.id, row.id],
      );
      await updateUser(pool, row.id, { activeGroupId: group.id });
      // Emit a member_joined activity only on first join (not re-join)
      if (!wasAlreadyMember) {
        await pool.query(
          `INSERT INTO group_activity (group_id, user_id, activity_type, payload, bananas_earned)
           VALUES ($1, $2, 'member_joined', $3::jsonb, 0)`,
          [group.id, row.id, JSON.stringify({ userName: row.name || row.email?.split("@")[0] || "A new squad member" })],
        );
      }
      return res.json({
        group: {
          id: group.id, name: group.name, joinCode: group.join_code,
          imageUrl: group.image_url, createdByUserId: group.created_by_user_id,
        },
      });
    }

    // POST /api/groups/:id/leave — leave a group
    const leaveMatch = path.match(/^\/groups\/(\d+)\/leave$/);
    if (leaveMatch && method === "POST") {
      if (!email) return res.status(401).json({ error: "Not authenticated" });
      const groupId = Number(leaveMatch[1]);
      const row = await getOrCreate(pool, email);
      await pool.query(
        "DELETE FROM group_members WHERE group_id = $1 AND user_id = $2",
        [groupId, row.id],
      );
      if (row.active_group_id === groupId) {
        const next = await pool.query(
          "SELECT group_id FROM group_members WHERE user_id = $1 ORDER BY joined_at DESC LIMIT 1",
          [row.id],
        );
        await updateUser(pool, row.id, {
          activeGroupId: next.rows.length > 0 ? next.rows[0].group_id : null,
        });
      }
      return res.json({ ok: true });
    }

    // POST /api/groups/consume-pending — auto-join the tribe stashed on the
    // user record at web signup time. Idempotent: returns ok even if no code
    // is pending. Clears the code on success so it won't fire again.
    if (path === "/groups/consume-pending" && method === "POST") {
      if (!email) return res.status(401).json({ error: "Not authenticated" });
      const u = await getOrCreate(pool, email);
      const code = u.pending_join_code;
      if (!code) return res.json({ ok: true, joined: false });
      const gr = await pool.query("SELECT * FROM groups WHERE join_code = $1", [code]);
      // Always clear the pending code, even if the group no longer exists,
      // so we don't keep retrying a dead code.
      await pool.query("UPDATE users SET pending_join_code = NULL WHERE id = $1", [u.id]);
      if (gr.rows.length === 0) return res.json({ ok: true, joined: false, reason: "code_not_found" });
      const group = gr.rows[0];
      const before = await pool.query(
        "SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2",
        [group.id, u.id],
      );
      const wasAlreadyMember = before.rows.length > 0;
      await pool.query(
        "INSERT INTO group_members (group_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [group.id, u.id],
      );
      await updateUser(pool, u.id, { activeGroupId: group.id });
      if (!wasAlreadyMember) {
        await pool.query(
          `INSERT INTO group_activity (group_id, user_id, activity_type, payload, bananas_earned)
           VALUES ($1, $2, 'member_joined', $3::jsonb, 0)`,
          [group.id, u.id, JSON.stringify({ userName: u.name || u.email?.split("@")[0] || "A new squad member" })],
        );
      }
      return res.json({
        ok: true, joined: true,
        group: {
          id: group.id, name: group.name, joinCode: group.join_code,
          imageUrl: group.image_url, createdByUserId: group.created_by_user_id,
        },
      });
    }

    // POST /api/groups/active — switch which group is active
    if (path === "/groups/active" && method === "POST") {
      if (!email) return res.status(401).json({ error: "Not authenticated" });
      const groupId = Number((req.body as any)?.groupId);
      if (!groupId) return res.status(400).json({ error: "groupId required" });
      const row = await getOrCreate(pool, email);
      const m = await pool.query(
        "SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2",
        [groupId, row.id],
      );
      if (m.rows.length === 0) return res.status(403).json({ error: "Not a member of that group" });
      const updated = await updateUser(pool, row.id, { activeGroupId: groupId });
      return res.json({ user: rowToUser(updated) });
    }

    // GET /api/groups/:id/members
    const membersMatch = path.match(/^\/groups\/(\d+)\/members$/);
    if (membersMatch && method === "GET") {
      if (!email) return res.status(401).json({ error: "Not authenticated" });
      const groupId = Number(membersMatch[1]);
      const row = await getOrCreate(pool, email);
      const m = await pool.query(
        "SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2",
        [groupId, row.id],
      );
      if (m.rows.length === 0) return res.status(403).json({ error: "Not a member" });
      const r = await pool.query(
        `SELECT u.id, u.name, u.profile_pic, u.level, u.tier, u.bananas, u.streak_days, u.last_session_date,
                gm.joined_at
         FROM group_members gm
         JOIN users u ON u.id = gm.user_id
         WHERE gm.group_id = $1
         ORDER BY gm.joined_at ASC`,
        [groupId],
      );
      return res.json({
        members: r.rows.map((mem: any) => ({
          id: mem.id, name: mem.name, profilePic: mem.profile_pic ?? null,
          level: mem.level, tier: mem.tier, bananas: mem.bananas,
          streakDays: mem.streak_days, lastSessionDate: mem.last_session_date ?? null,
          joinedAt: mem.joined_at,
        })),
      });
    }

    // GET /api/groups/:id/activity — paginated feed (newest first)
    const activityMatch = path.match(/^\/groups\/(\d+)\/activity$/);
    if (activityMatch && method === "GET") {
      if (!email) return res.status(401).json({ error: "Not authenticated" });
      const groupId = Number(activityMatch[1]);
      const row = await getOrCreate(pool, email);
      const m = await pool.query(
        "SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2",
        [groupId, row.id],
      );
      if (m.rows.length === 0) return res.status(403).json({ error: "Not a member" });
      const limitRaw = Number((req.query as any)?.limit) || 20;
      const limit = Math.min(Math.max(limitRaw, 1), 50);
      const before = (req.query as any)?.before as string | undefined;
      let sql = `SELECT ga.id, ga.user_id, ga.activity_type, ga.payload, ga.bananas_earned, ga.created_at,
                        u.name AS user_name, u.profile_pic AS user_profile_pic
                 FROM group_activity ga
                 JOIN users u ON u.id = ga.user_id
                 WHERE ga.group_id = $1`;
      const params: any[] = [groupId];
      if (before) {
        sql += " AND ga.created_at < $2";
        params.push(before);
      }
      sql += ` ORDER BY ga.created_at DESC LIMIT ${limit}`;
      const r = await pool.query(sql, params);
      const ids = r.rows.map((row: any) => row.id);
      // Fetch all reactions for the returned activities in one round trip
      let reactionsByActivity = new Map<number, Array<{ icon: string; userId: number; count: number; mine: boolean }>>();
      const currentUserId = row.id;
      if (ids.length > 0) {
        const rx = await pool.query(
          `SELECT activity_id, icon, user_id FROM activity_reactions WHERE activity_id = ANY($1::int[])`,
          [ids],
        );
        for (const rxRow of rx.rows) {
          const list = reactionsByActivity.get(rxRow.activity_id) || [];
          list.push({ icon: rxRow.icon, userId: rxRow.user_id, count: 1, mine: rxRow.user_id === currentUserId });
          reactionsByActivity.set(rxRow.activity_id, list);
        }
      }
      return res.json({
        items: r.rows.map((a: any) => {
          // Aggregate raw reaction rows into { icon, count, mine } groups for the client.
          const raw = reactionsByActivity.get(a.id) || [];
          const agg = new Map<string, { icon: string; count: number; mine: boolean }>();
          for (const rxn of raw) {
            const entry = agg.get(rxn.icon) || { icon: rxn.icon, count: 0, mine: false };
            entry.count += 1;
            if (rxn.mine) entry.mine = true;
            agg.set(rxn.icon, entry);
          }
          return {
            id: a.id, userId: a.user_id, userName: a.user_name,
            userProfilePic: a.user_profile_pic ?? null,
            type: a.activity_type, payload: a.payload, bananasEarned: a.bananas_earned,
            createdAt: a.created_at,
            reactions: Array.from(agg.values()).sort((x, y) => y.count - x.count),
          };
        }),
      });
    }

    // GET /api/groups/:id/energy — tribe energy score, trend, friendly label
    const energyMatch = path.match(/^\/groups\/(\d+)\/energy$/);
    if (energyMatch && method === "GET") {
      if (!email) return res.status(401).json({ error: "Not authenticated" });
      const groupId = Number(energyMatch[1]);
      const row = await getOrCreate(pool, email);
      const m = await pool.query(
        "SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2",
        [groupId, row.id],
      );
      if (m.rows.length === 0) return res.status(403).json({ error: "Not a member" });
      const r = await pool.query(
        `SELECT u.last_session_date, u.streak_days
         FROM group_members gm JOIN users u ON u.id = gm.user_id
         WHERE gm.group_id = $1`,
        [groupId],
      );
      const today = new Date();
      const todayStr = today.toISOString().split("T")[0];
      const yesterday = new Date(today.getTime() - 86400000).toISOString().split("T")[0];
      let total = 0;
      for (const u of r.rows) {
        let score = 0;
        const last = u.last_session_date as string | null;
        if (!last) {
          score -= 25;
        } else {
          const lastDate = new Date(last);
          const daysSince = Math.floor((today.getTime() - lastDate.getTime()) / 86400000);
          if (last === todayStr) score += 10;
          else if (last === yesterday) score += 0;
          else if (daysSince <= 3) score -= 10;
          else if (daysSince <= 7) score -= 25;
          else score -= 50;
        }
        if (u.streak_days >= 7) score += 20;
        else if (u.streak_days >= 3) score += 10;
        total += score;
      }
      const avg = r.rows.length > 0 ? total / r.rows.length : 0;
      let energy = Math.max(0, Math.min(100, Math.round(50 + avg)));
      // Solo tribes (just the creator) always start at 50% — no one to compare against yet.
      if (r.rows.length <= 1) energy = 50;
      const weekAgo = new Date(today.getTime() - 7 * 86400000).toISOString();
      const twoWeekAgo = new Date(today.getTime() - 14 * 86400000).toISOString();
      const recentAct = await pool.query(
        "SELECT COUNT(*)::int AS c FROM group_activity WHERE group_id = $1 AND created_at > $2",
        [groupId, weekAgo],
      );
      const prevAct = await pool.query(
        "SELECT COUNT(*)::int AS c FROM group_activity WHERE group_id = $1 AND created_at BETWEEN $2 AND $3",
        [groupId, twoWeekAgo, weekAgo],
      );
      const recent = recentAct.rows[0].c;
      const prev = prevAct.rows[0].c;
      const trend = recent > prev ? "up" : recent < prev ? "down" : "flat";
      let label = "Quiet Tribe";
      if (energy >= 80) label = "Radiant Tribe";
      else if (energy >= 60) label = "Collective Calm";
      else if (energy >= 40) label = "Steady Tribe";
      else if (energy >= 20) label = "Drifting Tribe";
      return res.json({ energy, trend, label, memberCount: r.rows.length });
    }

    // GET /api/groups/lookup/:code — PUBLIC info for the join landing page
    // POST /api/groups/:gid/activity/:aid/reactions — add a reaction (toggle by re-sending same icon)
    // DELETE same path with ?icon=...   — remove a reaction
    const reactMatch = path.match(/^\/groups\/(\d+)\/activity\/(\d+)\/reactions$/);
    if (reactMatch && (method === "POST" || method === "DELETE")) {
      if (!email) return res.status(401).json({ error: "Not authenticated" });
      const groupId = Number(reactMatch[1]);
      const activityId = Number(reactMatch[2]);
      const rxUser = await getOrCreate(pool, email);
      // Must be a member of this group
      const m = await pool.query(
        "SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2",
        [groupId, rxUser.id],
      );
      if (m.rows.length === 0) return res.status(403).json({ error: "Not a member" });
      // Activity must belong to this group
      const a = await pool.query(
        "SELECT 1 FROM group_activity WHERE id = $1 AND group_id = $2",
        [activityId, groupId],
      );
      if (a.rows.length === 0) return res.status(404).json({ error: "Activity not found" });

      const icon = (method === "POST"
        ? (req.body?.icon as string)
        : ((req.query as any)?.icon as string)
      ) || "";
      // Whitelist guard — keep payload tiny and resist abuse
      if (!icon || icon.length > 16) return res.status(400).json({ error: "Invalid icon" });

      if (method === "POST") {
        // Toggle: if this exact (user, activity, icon) row exists, remove it; otherwise insert.
        const existing = await pool.query(
          "SELECT id FROM activity_reactions WHERE activity_id = $1 AND user_id = $2 AND icon = $3",
          [activityId, rxUser.id, icon],
        );
        if (existing.rows.length > 0) {
          await pool.query("DELETE FROM activity_reactions WHERE id = $1", [existing.rows[0].id]);
          return res.json({ ok: true, removed: true });
        }
        await pool.query(
          "INSERT INTO activity_reactions (activity_id, user_id, icon) VALUES ($1, $2, $3)",
          [activityId, rxUser.id, icon],
        );
        // Emit a notification for the activity owner — but never notify yourself.
        try {
          const owner = await pool.query(
            "SELECT user_id, activity_type FROM group_activity WHERE id = $1",
            [activityId],
          );
          const ownerId = owner.rows[0]?.user_id;
          if (ownerId && ownerId !== rxUser.id) {
            await pool.query(
              `INSERT INTO notifications (recipient_user_id, sender_user_id, type, payload)
               VALUES ($1, $2, 'reaction', $3::jsonb)`,
              [
                ownerId,
                rxUser.id,
                JSON.stringify({
                  icon,
                  activityId,
                  groupId,
                  senderName: rxUser.name,
                  activityType: owner.rows[0]?.activity_type ?? null,
                }),
              ],
            );
          }
        } catch (e) {
          // Notification failures shouldn't break reaction send.
          console.error("notif insert failed", e);
        }
        return res.json({ ok: true, added: true });
      } else {
        await pool.query(
          "DELETE FROM activity_reactions WHERE activity_id = $1 AND user_id = $2 AND icon = $3",
          [activityId, rxUser.id, icon],
        );
        return res.json({ ok: true });
      }
    }

        const lookupMatch = path.match(/^\/groups\/lookup\/([A-Z0-9]+)$/);
    if (lookupMatch && method === "GET") {
      const code = lookupMatch[1].toUpperCase();
      const gr = await pool.query(
        `SELECT g.id, g.name, g.image_url, u.name AS inviter_name
         FROM groups g LEFT JOIN users u ON u.id = g.created_by_user_id
         WHERE g.join_code = $1`,
        [code],
      );
      if (gr.rows.length === 0) return res.status(404).json({ error: "Invalid code" });
      const g = gr.rows[0];
      return res.json({
        name: g.name, imageUrl: g.image_url, inviterName: g.inviter_name || "Someone",
      });
    }

    // ============ END GROUPS ================================================

    return res.status(404).json({ error: "Route not found", path, method });

  } catch (e: any) {
    console.error("API error:", path, e.message);
    return res.status(500).json({ error: e.message });
  } finally {
    await pool.end().catch(() => {});
  }
}
