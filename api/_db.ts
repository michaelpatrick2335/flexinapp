// Shared Postgres DB client for Vercel serverless functions
// Works with Vercel Postgres (Neon), or any DATABASE_URL postgres connection

import { Pool } from "pg";

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL environment variable is not set. Add it in Vercel dashboard under Storage → Postgres.");
    }
    pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 10,
    });
  }
  return pool;
}

// Initialize DB tables on first run
let initialized = false;
export async function initDb(): Promise<void> {
  if (initialized) return;
  const db = getPool();
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE,
      name TEXT NOT NULL DEFAULT 'Seeker',
      tier TEXT NOT NULL DEFAULT 'newbie',
      level INTEGER NOT NULL DEFAULT 1,
      bananas INTEGER NOT NULL DEFAULT 0,
      total_sessions INTEGER NOT NULL DEFAULT 0,
      total_seconds_meditated INTEGER NOT NULL DEFAULT 0,
      streak_days INTEGER NOT NULL DEFAULT 0,
      last_session_date TEXT,
      is_premium BOOLEAN NOT NULL DEFAULT FALSE,
      free_sessions_used INTEGER NOT NULL DEFAULT 0,
      profile_pic TEXT,
      active_music_track TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS meditation_sessions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      level INTEGER NOT NULL,
      tier TEXT NOT NULL,
      duration_seconds INTEGER NOT NULL,
      completed_at TEXT NOT NULL,
      bananas_earned INTEGER NOT NULL DEFAULT 1
    );
  `);
  initialized = true;
}

export interface User {
  id: number;
  email: string | null;
  name: string;
  tier: string;
  level: number;
  bananas: number;
  totalSessions: number;
  totalSecondsMediated: number;
  streakDays: number;
  lastSessionDate: string | null;
  isPremium: boolean;
  freeSessionsUsed: number;
  profilePic: string | null;
  activeMusicTrack: string | null;
}

export interface Session {
  id: number;
  userId: number;
  level: number;
  tier: string;
  durationSeconds: number;
  completedAt: string;
  bananasEarned: number;
}

function rowToUser(row: any): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    tier: row.tier,
    level: row.level,
    bananas: row.bananas,
    totalSessions: row.total_sessions,
    totalSecondsMediated: row.total_seconds_meditated,
    streakDays: row.streak_days,
    lastSessionDate: row.last_session_date,
    isPremium: row.is_premium,
    freeSessionsUsed: row.free_sessions_used,
    profilePic: row.profile_pic,
    activeMusicTrack: row.active_music_track,
  };
}

const TEST_ACCOUNTS = ["mdore06@gmail.com", "michaelpatrick2335@gmail.com"];

export async function getOrCreateUser(email?: string): Promise<User> {
  const db = getPool();
  await initDb();

  if (email) {
    const emailLower = email.trim().toLowerCase();
    // Try to find existing user
    const existing = await db.query("SELECT * FROM users WHERE email = $1", [emailLower]);
    if (existing.rows.length > 0) {
      const user = rowToUser(existing.rows[0]);
      // Auto-upgrade test accounts
      if (TEST_ACCOUNTS.includes(emailLower) && !user.isPremium) {
        const updated = await db.query(
          "UPDATE users SET is_premium = TRUE WHERE email = $1 RETURNING *",
          [emailLower]
        );
        return rowToUser(updated.rows[0]);
      }
      return user;
    }
    // Create new user with this email
    const isPremium = TEST_ACCOUNTS.includes(emailLower);
    const created = await db.query(
      `INSERT INTO users (email, name, tier, level, bananas, total_sessions, total_seconds_meditated,
        streak_days, is_premium, free_sessions_used)
       VALUES ($1, 'Seeker', 'newbie', 1, 0, 0, 0, 0, $2, 0)
       RETURNING *`,
      [emailLower, isPremium]
    );
    return rowToUser(created.rows[0]);
  }

  // No email — return/create anonymous user (id=1 fallback)
  const first = await db.query("SELECT * FROM users WHERE email IS NULL ORDER BY id LIMIT 1");
  if (first.rows.length > 0) return rowToUser(first.rows[0]);
  const anon = await db.query(
    `INSERT INTO users (name, tier, level, bananas, total_sessions, total_seconds_meditated,
      streak_days, is_premium, free_sessions_used)
     VALUES ('Seeker', 'newbie', 1, 0, 0, 0, 0, FALSE, 0)
     RETURNING *`
  );
  return rowToUser(anon.rows[0]);
}

export async function updateUser(id: number, fields: Partial<User>): Promise<User> {
  const db = getPool();
  await initDb();
  const colMap: Record<string, string> = {
    name: "name",
    tier: "tier",
    level: "level",
    bananas: "bananas",
    totalSessions: "total_sessions",
    totalSecondsMediated: "total_seconds_meditated",
    streakDays: "streak_days",
    lastSessionDate: "last_session_date",
    isPremium: "is_premium",
    freeSessionsUsed: "free_sessions_used",
    profilePic: "profile_pic",
    activeMusicTrack: "active_music_track",
    email: "email",
  };
  const setClauses: string[] = [];
  const values: any[] = [];
  let idx = 1;
  for (const [key, val] of Object.entries(fields)) {
    const col = colMap[key];
    if (col) {
      setClauses.push(`${col} = $${idx++}`);
      values.push(val);
    }
  }
  if (setClauses.length === 0) {
    const cur = await db.query("SELECT * FROM users WHERE id = $1", [id]);
    return rowToUser(cur.rows[0]);
  }
  values.push(id);
  const result = await db.query(
    `UPDATE users SET ${setClauses.join(", ")} WHERE id = $${idx} RETURNING *`,
    values
  );
  return rowToUser(result.rows[0]);
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const db = getPool();
  await initDb();
  const result = await db.query("SELECT * FROM users WHERE email = $1", [email.trim().toLowerCase()]);
  return result.rows.length > 0 ? rowToUser(result.rows[0]) : null;
}

export async function createSession(data: Omit<Session, "id">): Promise<Session> {
  const db = getPool();
  await initDb();
  const result = await db.query(
    `INSERT INTO meditation_sessions (user_id, level, tier, duration_seconds, completed_at, bananas_earned)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [data.userId, data.level, data.tier, data.durationSeconds, data.completedAt, data.bananasEarned]
  );
  const row = result.rows[0];
  return {
    id: row.id,
    userId: row.user_id,
    level: row.level,
    tier: row.tier,
    durationSeconds: row.duration_seconds,
    completedAt: row.completed_at,
    bananasEarned: row.bananas_earned,
  };
}

export async function getSessions(userId: number): Promise<Session[]> {
  const db = getPool();
  await initDb();
  const result = await db.query(
    "SELECT * FROM meditation_sessions WHERE user_id = $1 ORDER BY completed_at DESC",
    [userId]
  );
  return result.rows.map((row: any) => ({
    id: row.id,
    userId: row.user_id,
    level: row.level,
    tier: row.tier,
    durationSeconds: row.duration_seconds,
    completedAt: row.completed_at,
    bananasEarned: row.bananas_earned,
  }));
}

export function getCurrentEmail(req: { headers: Record<string, string | string[] | undefined> }): string | undefined {
  const raw = req.headers["x-user-email"];
  const val = Array.isArray(raw) ? raw[0] : raw;
  return val ? val.trim().toLowerCase() : undefined;
}

export { TEST_ACCOUNTS };
