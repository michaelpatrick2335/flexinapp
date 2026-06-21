import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Pool } from "pg";

const TEST_ACCOUNTS = ["mdore06@gmail.com", "michaelpatrick2335@gmail.com", "appreview@flexinapp.com"];

function getPool() {
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
  `);
}

function rowToUser(row: any) {
  return {
    id: row.id, email: row.email ?? null, name: row.name, tier: row.tier,
    level: row.level, bananas: row.bananas, totalSessions: row.total_sessions,
    totalSecondsMediated: row.total_seconds_meditated, streakDays: row.streak_days,
    lastSessionDate: row.last_session_date ?? null, isPremium: row.is_premium,
    freeSessionsUsed: row.free_sessions_used, profilePic: row.profile_pic ?? null,
    activeMusicTrack: row.active_music_track ?? null,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-user-email");
  if (req.method === "OPTIONS") return res.status(200).end();

  const pool = getPool();
  try {
    await ensureTables(pool);

    // POST /api/login — get or create user, mark isPremium for test accounts
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const { email } = req.body as { email?: string };
    if (!email) return res.status(400).json({ error: "Email required" });

    const isPremiumOverride = TEST_ACCOUNTS.includes(email.toLowerCase().trim());
    
    // Upsert user
    const result = await pool.query(
      `INSERT INTO users (email, is_premium)
       VALUES ($1, $2)
       ON CONFLICT (email) DO UPDATE
       SET is_premium = CASE WHEN $2 THEN TRUE ELSE users.is_premium END
       RETURNING *`,
      [email.toLowerCase().trim(), isPremiumOverride]
    );

    const user = rowToUser(result.rows[0]);
    return res.json({ user, isPremium: user.isPremium });
  } catch (e: any) {
    console.error("login2 error:", e.message);
    return res.status(500).json({ error: e.message, stack: e.stack?.substring(0, 200) });
  } finally {
    await pool.end();
  }
}
