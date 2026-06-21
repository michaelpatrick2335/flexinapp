import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Pool } from "pg";

const TEST_ACCOUNTS = ["mdore06@gmail.com", "michaelpatrick2335@gmail.com"];

function getPool() {
  return new Pool({
    connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false },
  });
}

async function ensureTables(pool: Pool) {
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

function rowToUser(row: any) {
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-user-email");
  res.setHeader("Access-Control-Allow-Methods", "GET, PATCH, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  const pool = getPool();
  try {
    const rawEmail = req.headers["x-user-email"];
    const email = (Array.isArray(rawEmail) ? rawEmail[0] : rawEmail || "").trim().toLowerCase() || null;

    if (req.method === "GET") {
      // Only ensure tables on GET (login flow) — not on every PATCH
      await ensureTables(pool);
      // No email = not logged in → return null so app shows login screen
      if (!email) return res.status(401).json({ error: "Not authenticated" });

      const existing = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
      if (existing.rows.length === 0) return res.status(404).json({ error: "User not found" });

      let user = existing.rows[0];
      // Auto-upgrade test accounts
      if (TEST_ACCOUNTS.includes(email) && !user.is_premium) {
        const upd = await pool.query("UPDATE users SET is_premium = TRUE WHERE id = $1 RETURNING *", [user.id]);
        user = upd.rows[0];
      }
      return res.json(rowToUser(user));
    }

    if (req.method === "PATCH") {
      // Get user first
      let userRow;
      if (email) {
        const r = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
        if (r.rows.length === 0) return res.status(404).json({ error: "User not found" });
        userRow = r.rows[0];
      } else {
        const r = await pool.query("SELECT id FROM users WHERE email IS NULL ORDER BY id LIMIT 1");
        if (r.rows.length === 0) return res.status(404).json({ error: "User not found" });
        userRow = r.rows[0];
      }

      const body = req.body as Record<string, any>;
      const colMap: Record<string, string> = {
        name: "name", tier: "tier", level: "level", bananas: "bananas",
        totalSessions: "total_sessions", totalSecondsMediated: "total_seconds_meditated",
        streakDays: "streak_days", lastSessionDate: "last_session_date",
        isPremium: "is_premium", freeSessionsUsed: "free_sessions_used",
        profilePic: "profile_pic", activeMusicTrack: "active_music_track",
      };
      const sets: string[] = [];
      const vals: any[] = [];
      let idx = 1;
      for (const [k, v] of Object.entries(body)) {
        if (colMap[k]) { sets.push(`${colMap[k]} = $${idx++}`); vals.push(v); }
      }
      if (sets.length === 0) {
        const r = await pool.query("SELECT * FROM users WHERE id = $1", [userRow.id]);
        return res.json(rowToUser(r.rows[0]));
      }
      vals.push(userRow.id);
      const r = await pool.query(`UPDATE users SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`, vals);
      return res.json(rowToUser(r.rows[0]));
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e: any) {
    console.error("user handler error:", e);
    return res.status(500).json({ error: e.message, stack: e.stack?.substring(0, 200) });
  } finally {
    await pool.end();
  }
}
