// Shared helpers for Vercel serverless functions
// Each function creates its own pool (Vercel functions are isolated processes)

import { Pool } from "pg";

export const TEST_ACCOUNTS = ["mdore06@gmail.com", "michaelpatrick2335@gmail.com"];

export function makePool() {
  return new Pool({
    connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false },
    max: 3,
  });
}

export async function ensureTables(pool: Pool) {
  await pool.query(`
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
      user_id INTEGER NOT NULL,
      level INTEGER NOT NULL,
      tier TEXT NOT NULL,
      duration_seconds INTEGER NOT NULL,
      completed_at TEXT NOT NULL,
      bananas_earned INTEGER NOT NULL DEFAULT 1
    );
  `);
}

export function rowToUser(row: any) {
  return {
    id: row.id,
    email: row.email ?? null,
    name: row.name,
    tier: row.tier,
    level: row.level,
    bananas: row.bananas,
    totalSessions: row.total_sessions,
    totalSecondsMediated: row.total_seconds_meditated,
    streakDays: row.streak_days,
    lastSessionDate: row.last_session_date ?? null,
    isPremium: row.is_premium,
    freeSessionsUsed: row.free_sessions_used,
    profilePic: row.profile_pic ?? null,
    activeMusicTrack: row.active_music_track ?? null,
  };
}

export function getEmail(headers: Record<string, string | string[] | undefined>): string | null {
  const raw = headers["x-user-email"];
  const val = Array.isArray(raw) ? raw[0] : raw;
  return val ? val.trim().toLowerCase() : null;
}

export async function getOrCreateUser(pool: Pool, email: string | null) {
  if (email) {
    const existing = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (existing.rows.length > 0) {
      const user = existing.rows[0];
      if (TEST_ACCOUNTS.includes(email) && !user.is_premium) {
        const upd = await pool.query("UPDATE users SET is_premium = TRUE WHERE id = $1 RETURNING *", [user.id]);
        return upd.rows[0];
      }
      return user;
    }
    const isPremium = TEST_ACCOUNTS.includes(email);
    const r = await pool.query(
      `INSERT INTO users (email, is_premium) VALUES ($1, $2) ON CONFLICT (email) DO UPDATE SET email=EXCLUDED.email RETURNING *`,
      [email, isPremium]
    );
    return r.rows[0];
  }
  // Anonymous
  const r = await pool.query("SELECT * FROM users WHERE email IS NULL ORDER BY id LIMIT 1");
  if (r.rows.length > 0) return r.rows[0];
  const r2 = await pool.query("INSERT INTO users DEFAULT VALUES RETURNING *");
  return r2.rows[0];
}

export const COL_MAP: Record<string, string> = {
  name: "name", tier: "tier", level: "level", bananas: "bananas",
  totalSessions: "total_sessions", totalSecondsMediated: "total_seconds_meditated",
  streakDays: "streak_days", lastSessionDate: "last_session_date",
  isPremium: "is_premium", freeSessionsUsed: "free_sessions_used",
  profilePic: "profile_pic", activeMusicTrack: "active_music_track", email: "email",
};

export async function updateUser(pool: Pool, id: number, fields: Record<string, any>) {
  const sets: string[] = [];
  const vals: any[] = [];
  let idx = 1;
  for (const [k, v] of Object.entries(fields)) {
    if (COL_MAP[k]) { sets.push(`${COL_MAP[k]} = $${idx++}`); vals.push(v); }
  }
  if (sets.length === 0) {
    const r = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
    return r.rows[0];
  }
  vals.push(id);
  const r = await pool.query(`UPDATE users SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`, vals);
  return r.rows[0];
}

export function cors(res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-user-email");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
}
