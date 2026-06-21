// ────────────────────────────────────────────────────────────────────────────
// Fitness progression
//
// Computes a user's "fitness score" from their workout history and uses it
// to:
//   • Bump formLevel (1–20) → drives formRank (AWAKENING → MAX) on Home
//   • Auto-upgrade avatarBodyType as the user gets in better shape
//
// Designed to run cheaply on every workout-log + every dashboard fetch.
// ────────────────────────────────────────────────────────────────────────────

import { db } from "./storage";
import * as schema from "@shared/schema";
import { eq, and, gte } from "drizzle-orm";

// ── Avatar progression ladders ─────────────────────────────────────────────
//
// Two parallel ladders — one per sex — ordered from "least fit" to "most fit".
// The user's current avatarBodyType is their rung; getting in better shape
// pushes them up the ladder, plateauing at the top tier.
//
// We never push someone DOWN the ladder automatically — that should be a
// manual choice from a future Profile edit screen.

const MALE_LADDER = [
  "male_9_outofshape",   // tier 0
  "male_8_overweight",   // tier 1
  "male_7_soft",         // tier 2
  "male_6_averagefit",   // tier 3
  "male_1_slim",         // tier 4 — lean but underbuilt
  "male_2_lean",         // tier 5
  "male_3_athletic",     // tier 6
  "male_4_muscular",     // tier 7
  "male_5_bodybuilder",  // tier 8 (peak)
] as const;

const FEMALE_LADDER = [
  "female_10_fuller",    // tier 0
  "female_9_overweight", // tier 1
  "female_8_plussize",   // tier 2
  "female_7_curvy",      // tier 3
  "female_6_average",    // tier 4
  "female_1_lean",       // tier 5
  "female_3_toned",      // tier 6
  "female_2_athletic",   // tier 7
  "female_4_fit",        // tier 8
  "female_5_muscular",   // tier 9 (peak)
] as const;

// "TRANSFORM" (male_10) is a meta-choice — user is starting fresh and wants
// the app to coach them through change. Treat it like tier 2 (soft) so they
// have room to climb.
const TIER_OVERRIDES: Record<string, number> = {
  male_10_transform: 2,
};

function ladderForSex(sex: string): readonly string[] {
  return sex === "female" ? FEMALE_LADDER : MALE_LADDER;
}

function tierForAvatar(avatarId: string | null | undefined, sex: string): number {
  if (!avatarId) return 3; // sensible mid-default for "no avatar set"
  if (avatarId in TIER_OVERRIDES) return TIER_OVERRIDES[avatarId];
  const ladder = ladderForSex(sex);
  const idx = ladder.indexOf(avatarId as any);
  // If the user's chosen avatar isn't on the ladder for their sex (shouldn't
  // happen, but be safe), return mid-tier so progression still works.
  return idx === -1 ? 3 : idx;
}

function avatarForTier(tier: number, sex: string): string {
  const ladder = ladderForSex(sex);
  const clamped = Math.max(0, Math.min(ladder.length - 1, tier));
  return ladder[clamped];
}

// ── Fitness score ──────────────────────────────────────────────────────────
//
// 0–100 score reflecting recent training consistency + volume.
//   • workouts in last 30 days (capped 25)
//   • distinct training days in last 30 (capped 25 days)
//   • total minutes in last 30 days (capped 1200 min ≈ 20h)
//
// Each component contributes up to ~33 points; sum is clamped to 0–100.

export interface FitnessSnapshot {
  score: number;          // 0–100
  workouts30d: number;
  trainingDays30d: number;
  totalMinutes30d: number;
  caloriesBurned30d: number;
}

export function computeFitness(userId: number): FitnessSnapshot {
  const cutoffMs = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const cutoffIso = new Date(cutoffMs).toISOString();

  const rows = db
    .select()
    .from(schema.workout)
    .where(
      and(
        eq(schema.workout.userId, userId),
        gte(schema.workout.startedAt, cutoffIso),
      ),
    )
    .all();

  const workouts30d = rows.length;
  const totalSeconds = rows.reduce((acc, r) => acc + (r.durationSeconds || 0), 0);
  const totalMinutes30d = Math.round(totalSeconds / 60);

  const dayKeys = new Set<string>();
  for (const r of rows) {
    const d = (r.startedAt || "").slice(0, 10);
    if (d) dayKeys.add(d);
  }
  const trainingDays30d = dayKeys.size;

  // Calorie heuristic: ~7 kcal/min strength training. Real value depends on
  // bodyweight/intensity — good enough until we add a per-exercise model.
  const caloriesBurned30d = Math.round(totalMinutes30d * 7);

  const wPart = Math.min(workouts30d, 25) * (33 / 25);
  const dPart = Math.min(trainingDays30d, 25) * (33 / 25);
  const mPart = Math.min(totalMinutes30d, 1200) * (34 / 1200);
  const score = Math.round(Math.max(0, Math.min(100, wPart + dPart + mPart)));

  return {
    score,
    workouts30d,
    trainingDays30d,
    totalMinutes30d,
    caloriesBurned30d,
  };
}

// ── formLevel mapping ──────────────────────────────────────────────────────
//
// formLevel is 1–20. Mapped from fitness score with a gentle floor so a
// brand-new user still has somewhere to climb from.

export function formLevelForScore(score: number): number {
  // score 0   → level 1
  // score 100 → level 20
  const level = 1 + Math.round((score / 100) * 19);
  return Math.max(1, Math.min(20, level));
}

// ── Avatar tier targeting ──────────────────────────────────────────────────
//
// Maps fitness score → target avatar tier. The user only moves UP the ladder
// (never down), so we take max(currentTier, targetTier).
//
// Thresholds picked so a moderately active user (~3 workouts/week for 4
// weeks) lands around tier 5 (lean/toned), and a hard-training user (~5
// workouts/week, 60min each) reaches tier 7+ (athletic/fit).

function targetTierForScore(score: number): number {
  if (score >= 85) return 8;  // bodybuilder / muscular
  if (score >= 72) return 7;  // muscular / athletic
  if (score >= 58) return 6;  // athletic / toned
  if (score >= 44) return 5;  // lean
  if (score >= 30) return 4;  // average-fit / slim
  return 3;                   // baseline (no downgrade)
}

export interface ProgressionResult {
  fitness: FitnessSnapshot;
  formLevel: number;
  avatarBodyType: string;     // new avatar (same as old if no upgrade)
  upgraded: boolean;          // true if avatar climbed at least one tier
}

export function evaluateProgression(
  userId: number,
  sex: string,
  currentAvatar: string | null,
): ProgressionResult {
  const fitness = computeFitness(userId);
  const formLevel = formLevelForScore(fitness.score);

  const currentTier = tierForAvatar(currentAvatar, sex);
  const targetTier = targetTierForScore(fitness.score);
  const nextTier = Math.max(currentTier, targetTier);

  const ladder = ladderForSex(sex);
  // Clamp the target to ladder length (female ladder is 10, male is 9).
  const clampedTier = Math.min(nextTier, ladder.length - 1);
  const newAvatar = avatarForTier(clampedTier, sex);

  return {
    fitness,
    formLevel,
    avatarBodyType: newAvatar,
    upgraded: clampedTier > currentTier,
  };
}
