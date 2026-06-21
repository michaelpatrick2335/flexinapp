import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import * as schema from "@shared/schema";

const sqlite = new Database("data.db");
export const db = drizzle(sqlite, { schema });

// Auto-create tables
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS user (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL DEFAULT 'Seeker',
    tier TEXT NOT NULL DEFAULT 'newbie',
    level INTEGER NOT NULL DEFAULT 1,
    bananas INTEGER NOT NULL DEFAULT 0,
    total_sessions INTEGER NOT NULL DEFAULT 0,
    total_seconds_meditated INTEGER NOT NULL DEFAULT 0,
    streak_days INTEGER NOT NULL DEFAULT 0,
    last_session_date TEXT,
    is_premium INTEGER NOT NULL DEFAULT 0,
    free_sessions_used INTEGER NOT NULL DEFAULT 0,
    profile_pic TEXT,
    active_music_track TEXT,
    email TEXT
  );
  CREATE TABLE IF NOT EXISTS meditation_session (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    level INTEGER NOT NULL,
    tier TEXT NOT NULL,
    duration_seconds INTEGER NOT NULL,
    completed_at TEXT NOT NULL,
    bananas_earned INTEGER NOT NULL DEFAULT 1
  );
`);

// ── Idempotent lazy migrations ──────────────────────────────────────
// Better-sqlite3 doesn't natively support `ALTER TABLE ... ADD COLUMN IF NOT
// EXISTS`. We inspect the columns and add what's missing so the app survives
// schema bumps without a destructive reset.
function ensureColumn(table: string, name: string, ddl: string) {
  const cols = sqlite.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some(c => c.name === name)) {
    sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}

// Columns added in earlier Flexin commits + this session
ensureColumn("user", "sex",             "sex TEXT NOT NULL DEFAULT 'unspecified'");
ensureColumn("user", "theme_override",  "theme_override TEXT");
ensureColumn("user", "is_trainer",      "is_trainer INTEGER NOT NULL DEFAULT 0");
ensureColumn("user", "active_group_id", "active_group_id INTEGER");
ensureColumn("user", "pending_join_code","pending_join_code TEXT");
ensureColumn("user", "form_level",      "form_level INTEGER NOT NULL DEFAULT 1");
ensureColumn("user", "form_rank",       "form_rank TEXT NOT NULL DEFAULT 'AWAKENING'");
ensureColumn("user", "squad_energy",    "squad_energy INTEGER NOT NULL DEFAULT 0");

// Flexin v1 tables (exercise / workout / squads). Created lazily so a fresh
// DB and an upgraded DB end up with the same shape.
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS exercise (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    name TEXT NOT NULL,
    muscle_group TEXT NOT NULL,
    category TEXT NOT NULL,
    sex_target TEXT NOT NULL DEFAULT 'both',
    is_custom INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS workout (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    category TEXT NOT NULL,
    started_at TEXT NOT NULL,
    completed_at TEXT,
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    energy_delta INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS workout_exercise (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workout_id INTEGER NOT NULL,
    exercise_id INTEGER NOT NULL,
    sets INTEGER NOT NULL DEFAULT 0,
    reps INTEGER NOT NULL DEFAULT 0,
    weight_lbs REAL NOT NULL DEFAULT 0,
    order_idx INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS squad (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    owner_id INTEGER NOT NULL,
    invite_code TEXT NOT NULL,
    energy INTEGER NOT NULL DEFAULT 0,
    mvp_user_id INTEGER,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS squad_member (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    squad_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    energy_today INTEGER NOT NULL DEFAULT 0,
    is_ghost INTEGER NOT NULL DEFAULT 0,
    joined_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS squad_activity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    squad_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    kind TEXT NOT NULL,
    message TEXT NOT NULL,
    energy_delta INTEGER NOT NULL DEFAULT 0,
    reactions TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
  );
`);

export interface IStorage {
  getUser(id: number): schema.User | undefined;
  getOrCreateUser(email?: string): schema.User;
  updateUser(id: number, data: Partial<schema.User>): schema.User;
  getUserByEmail(email: string): schema.User | undefined;
  restoreUser(source: schema.User): schema.User;
  createSession(data: schema.InsertSession): schema.MeditationSession;
  getSessions(userId: number): schema.MeditationSession[];
}

export class Storage implements IStorage {
  getUser(id: number): schema.User | undefined {
    return db.select().from(schema.user).where(eq(schema.user.id, id)).get();
  }

  getOrCreateUser(email?: string): schema.User {
    // If email provided, get or create that specific user
    if (email) {
      const existing = this.getUserByEmail(email);
      if (existing) return existing;
      return db.insert(schema.user).values({ name: "Seeker", tier: "newbie", level: 1, bananas: 0, totalSessions: 0, totalSecondsMediated: 0, streakDays: 0, email: email.toLowerCase() }).returning().get();
    }
    // Fallback: get first user or create one
    const existing = db.select().from(schema.user).get();
    if (existing) return existing;
    return db.insert(schema.user).values({ name: "Seeker", tier: "newbie", level: 1, bananas: 0, totalSessions: 0, totalSecondsMediated: 0, streakDays: 0 }).returning().get();
  }

  updateUser(id: number, data: Partial<schema.User>): schema.User {
    return db.update(schema.user).set(data).where(eq(schema.user.id, id)).returning().get();
  }

  getUserByEmail(email: string): schema.User | undefined {
    // Case-insensitive match — email stored lowercase
    return db.select().from(schema.user)
      .where(eq(schema.user.email, email.toLowerCase()))
      .get();
  }

  // Single-user app: "restore" means copy all progress fields from the found user onto id=1
  restoreUser(source: schema.User): schema.User {
    const current = this.getOrCreateUser();
    const { id: _id, ...rest } = source;
    return db.update(schema.user)
      .set({ ...rest, email: rest.email ?? null })
      .where(eq(schema.user.id, current.id))
      .returning().get();
  }

  createSession(data: schema.InsertSession): schema.MeditationSession {
    return db.insert(schema.meditationSession).values(data).returning().get();
  }

  getSessions(userId: number): schema.MeditationSession[] {
    return db.select().from(schema.meditationSession).where(eq(schema.meditationSession.userId, userId)).all();
  }
}

export const storage = new Storage();
