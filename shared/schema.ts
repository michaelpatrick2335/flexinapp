import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User profile — single user app (local), stores progress
export const user = sqliteTable("user", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().default("Flexer"),
  email: text("email"), // used for login lookup
  tier: text("tier").notNull().default("newbie"), // newbie | experienced | enlightened
  level: integer("level").notNull().default(1),
  bananas: integer("bananas").notNull().default(0),
  totalSessions: integer("total_sessions").notNull().default(0),
  totalSecondsMediated: integer("total_seconds_meditated").notNull().default(0),
  streakDays: integer("streak_days").notNull().default(0),
  lastSessionDate: text("last_session_date"), // ISO date string
  isPremium: integer("is_premium", { mode: "boolean" }).notNull().default(false),
  freeSessionsUsed: integer("free_sessions_used").notNull().default(0),
  profilePic: text("profile_pic"), // path to uploaded profile image
  activeMusicTrack: text("active_music_track"), // id of selected music track (null = use synth)
  activeGroupId: integer("active_group_id"), // currently selected Tribe (null if none)
  pendingJoinCode: text("pending_join_code"), // tribe code stashed at web signup; consumed on first app login

  // ── Flexin-specific fields ────────────────────────────────────────────
  // Sex selected during onboarding. Drives default theme, workout/exercise
  // library, and Form Level labels. "unspecified" = user picked "Prefer not
  // to answer" and the app uses `themeOverride` instead.
  sex: text("sex").notNull().default("unspecified"), // "male" | "female" | "unspecified"

  // When sex = "unspecified", which color theme the user picked manually.
  // When sex is "male" or "female", this is ignored (theme follows sex).
  themeOverride: text("theme_override"), // "blue" | "pink" | null

  // Trainer tier ($99.99/mo). Unlimited squads + unlimited members. Set via
  // Stripe webhook when the user buys the Trainer plan.
  isTrainer: integer("is_trainer", { mode: "boolean" }).notNull().default(false),
});

export const insertUserSchema = createInsertSchema(user).omit({ id: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof user.$inferSelect;

// Meditation sessions log
export const meditationSession = sqliteTable("meditation_session", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  level: integer("level").notNull(),
  tier: text("tier").notNull(),
  durationSeconds: integer("duration_seconds").notNull(),
  completedAt: text("completed_at").notNull(), // ISO datetime string
  bananasEarned: integer("bananas_earned").notNull().default(1),
});

export const insertSessionSchema = createInsertSchema(meditationSession).omit({ id: true });
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type MeditationSession = typeof meditationSession.$inferSelect;

// Meditation journal — one entry per completed level
export const journalEntry = sqliteTable("journal_entry", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  level: integer("level").notNull(),
  tier: text("tier").notNull(),
  entry: text("entry").notNull(),
  createdAt: text("created_at").notNull(),
});

export const insertJournalSchema = createInsertSchema(journalEntry).omit({ id: true });
export type InsertJournal = z.infer<typeof insertJournalSchema>;
export type JournalEntry = typeof journalEntry.$inferSelect;
