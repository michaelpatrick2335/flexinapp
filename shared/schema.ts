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

  // Form Level (1-25 ladder shown top-left of Home). Drives the rank label.
  formLevel: integer("form_level").notNull().default(1),
  // Human-readable rank label (AWAKENING | BUILDING | SURGING | FORGING | MAX)
  formRank: text("form_rank").notNull().default("AWAKENING"),
  // User's daily squad-energy contribution (0-100). Recomputed daily.
  squadEnergy: integer("squad_energy").notNull().default(0),
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

// ─── FLEXIN: Workouts / Exercises / Squads ───────────────────────────────────

// Exercise library. Hardcoded seeds + user customs (isCustom=true).
export const exercise = sqliteTable("exercise", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id"), // null for built-ins
  name: text("name").notNull(),
  muscleGroup: text("muscle_group").notNull(), // chest | back | legs | shoulders | arms | core | glutes
  category: text("category").notNull(),        // push | pull | legs | core | glutes | …
  sexTarget: text("sex_target").notNull().default("both"), // male | female | both
  isCustom: integer("is_custom", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
});
export const insertExerciseSchema = createInsertSchema(exercise).omit({ id: true });
export type InsertExercise = z.infer<typeof insertExerciseSchema>;
export type Exercise = typeof exercise.$inferSelect;

// Workout session.
export const workout = sqliteTable("workout", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  category: text("category").notNull(),
  startedAt: text("started_at").notNull(),
  completedAt: text("completed_at"),
  durationSeconds: integer("duration_seconds").notNull().default(0),
  notes: text("notes"),
  energyDelta: integer("energy_delta").notNull().default(0),
});
export const insertWorkoutSchema = createInsertSchema(workout).omit({ id: true });
export type InsertWorkout = z.infer<typeof insertWorkoutSchema>;
export type Workout = typeof workout.$inferSelect;

// Exercises performed within a workout (join + sets/reps/weight).
export const workoutExercise = sqliteTable("workout_exercise", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  workoutId: integer("workout_id").notNull(),
  exerciseId: integer("exercise_id").notNull(),
  sets: integer("sets").notNull().default(0),
  reps: integer("reps").notNull().default(0),
  weightLbs: real("weight_lbs").notNull().default(0),
  orderIdx: integer("order_idx").notNull().default(0),
});
export const insertWorkoutExerciseSchema = createInsertSchema(workoutExercise).omit({ id: true });
export type InsertWorkoutExercise = z.infer<typeof insertWorkoutExerciseSchema>;
export type WorkoutExercise = typeof workoutExercise.$inferSelect;

// Squads (accountability groups).
export const squad = sqliteTable("squad", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  ownerId: integer("owner_id").notNull(),
  inviteCode: text("invite_code").notNull(),
  energy: integer("energy").notNull().default(0), // 0-100 collective, recomputed daily
  mvpUserId: integer("mvp_user_id"),
  createdAt: text("created_at").notNull(),
});
export const insertSquadSchema = createInsertSchema(squad).omit({ id: true });
export type InsertSquad = z.infer<typeof insertSquadSchema>;
export type Squad = typeof squad.$inferSelect;

export const squadMember = sqliteTable("squad_member", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  squadId: integer("squad_id").notNull(),
  userId: integer("user_id").notNull(),
  role: text("role").notNull().default("member"), // owner | member
  energyToday: integer("energy_today").notNull().default(0),
  isGhost: integer("is_ghost", { mode: "boolean" }).notNull().default(false),
  joinedAt: text("joined_at").notNull(),
});
export const insertSquadMemberSchema = createInsertSchema(squadMember).omit({ id: true });
export type InsertSquadMember = z.infer<typeof insertSquadMemberSchema>;
export type SquadMember = typeof squadMember.$inferSelect;

// Squad activity feed (workouts, milestones, MVP awards, joins).
export const squadActivity = sqliteTable("squad_activity", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  squadId: integer("squad_id").notNull(),
  userId: integer("user_id").notNull(),
  kind: text("kind").notNull(), // workout | milestone | mvp | join
  message: text("message").notNull(),
  energyDelta: integer("energy_delta").notNull().default(0),
  reactions: text("reactions").notNull().default("{}"), // JSON
  createdAt: text("created_at").notNull(),
});
export const insertSquadActivitySchema = createInsertSchema(squadActivity).omit({ id: true });
export type InsertSquadActivity = z.infer<typeof insertSquadActivitySchema>;
export type SquadActivity = typeof squadActivity.$inferSelect;
