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
