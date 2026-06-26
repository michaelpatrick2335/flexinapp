// Per-exercise muscle contribution percentages derived from published EMG
// research. Values sum to ~100 per exercise. Full source data lives at
// client/src/data/muscleContribution.json and is documented in MUSCLE_MODEL.md.
// IMPORTANT: shown in-app as estimates — see the Disclaimers screen.

export const MUSCLE_MAP: Record<string, Record<string, number>> = {
  bench_press: { chest: 55, shoulders: 20, triceps: 22, core_abs: 3 },
  incline_bench_press: { chest: 45, shoulders: 28, triceps: 22, core_abs: 5 },
  push_up: { chest: 50, shoulders: 18, triceps: 22, core_abs: 10 },
  overhead_press: { shoulders: 55, triceps: 25, chest: 8, back: 7, core_abs: 5 },
  dumbbell_shoulder_press: { shoulders: 58, triceps: 22, chest: 8, core_abs: 7, back: 5 },
  lateral_raise: { shoulders: 85, back: 10, triceps: 5 },
  pull_up: { back: 55, biceps: 25, shoulders: 10, core_abs: 7, forearms: 3 },
  lat_pulldown: { back: 55, biceps: 22, shoulders: 12, core_abs: 6, forearms: 5 },
  barbell_row: { back: 60, biceps: 20, shoulders: 10, core_abs: 7, forearms: 3 },
  dumbbell_row: { back: 58, biceps: 22, shoulders: 10, core_abs: 7, forearms: 3 },
  face_pull: { shoulders: 55, back: 35, biceps: 8, forearms: 2 },
  biceps_curl: { biceps: 75, forearms: 15, shoulders: 10 },
  hammer_curl: { biceps: 45, forearms: 40, shoulders: 15 },
  triceps_pushdown: { triceps: 85, forearms: 10, shoulders: 5 },
  triceps_extension: { triceps: 88, shoulders: 7, forearms: 5 },
  dips: { triceps: 40, chest: 35, shoulders: 20, core_abs: 5 },
  back_squat: { quads: 45, glutes: 28, hamstrings: 10, core_abs: 10, back: 5, calves: 2 },
  front_squat: { quads: 50, glutes: 24, hamstrings: 8, core_abs: 10, back: 6, calves: 2 },
  leg_press: { quads: 55, glutes: 25, hamstrings: 8, calves: 7, core_abs: 5 },
  lunge: { quads: 42, glutes: 28, hamstrings: 12, core_abs: 10, calves: 5, back: 3 },
  bulgarian_split_squat: { quads: 44, glutes: 28, hamstrings: 12, core_abs: 10, calves: 4, back: 2 },
  conventional_deadlift: { back: 28, glutes: 22, hamstrings: 20, quads: 18, core_abs: 7, forearms: 5 },
  romanian_deadlift: { hamstrings: 38, glutes: 28, back: 22, core_abs: 7, forearms: 5 },
  hip_thrust: { glutes: 60, hamstrings: 22, quads: 12, core_abs: 6 },
  glute_bridge: { glutes: 55, hamstrings: 25, quads: 12, core_abs: 8 },
  hamstring_curl: { hamstrings: 80, calves: 12, glutes: 8 },
  leg_extension: { quads: 92, core_abs: 5, calves: 3 },
  calf_raise: { calves: 92, core_abs: 5, hamstrings: 3 },
  plank: { core_abs: 80, back: 12, shoulders: 5, quads: 3 },
  hanging_leg_raise: { core_abs: 70, back: 10, forearms: 10, shoulders: 5, quads: 5 },
  cable_crunch: { core_abs: 82, back: 10, shoulders: 5, forearms: 3 },
  russian_twist: { core_abs: 80, back: 12, shoulders: 5, forearms: 3 },
};

export const MUSCLE_GROUP_AGG: Record<string, string> = {
  chest: "chest", back: "back", shoulders: "shoulders",
  biceps: "arms", triceps: "arms", forearms: "arms",
  quads: "legs", glutes: "legs", hamstrings: "legs", calves: "legs",
  core_abs: "core",
};

export function normalizeExerciseKey(name: string): string | null {
  const k = (name || "").toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!k) return null;
  if (MUSCLE_MAP[k]) return k;
  const stripped = k.replace(/^(barbell|dumbbell|machine|cable|bb|db)_/, "");
  if (MUSCLE_MAP[stripped]) return stripped;
  for (const key of Object.keys(MUSCLE_MAP)) {
    if (k.includes(key) || key.includes(k)) return key;
  }
  return null;
}

const GROUPS = [
  { key: "chest",     label: "Chest" },
  { key: "back",      label: "Back" },
  { key: "legs",      label: "Legs" },
  { key: "shoulders", label: "Shoulders" },
  { key: "arms",      label: "Arms" },
  { key: "core",      label: "Core" },
];

const WEEKLY_TARGET = 200;

export async function computeMuscleGroups(pool: any, userId: number) {
  try {
    const r = await pool.query(
      `SELECT exercise_names, completed_at
       FROM workouts
       WHERE user_id = $1
         AND completed_at >= NOW() - INTERVAL '7 days'`,
      [userId]
    );
    const totals: Record<string, number> = { chest: 0, back: 0, legs: 0, shoulders: 0, arms: 0, core: 0 };
    const lastSeen: Record<string, Date | null> = { chest: null, back: null, legs: null, shoulders: null, arms: null, core: null };
    for (const row of r.rows || []) {
      let names: string[] = [];
      try {
        names = typeof row.exercise_names === "string"
          ? JSON.parse(row.exercise_names)
          : (row.exercise_names || []);
      } catch { names = []; }
      const completedAt = row.completed_at ? new Date(row.completed_at) : null;
      for (const raw of names) {
        const key = normalizeExerciseKey(raw);
        if (!key) continue;
        const muscles = MUSCLE_MAP[key];
        for (const [muscle, pct] of Object.entries(muscles)) {
          const group = MUSCLE_GROUP_AGG[muscle];
          if (!group) continue;
          totals[group] = (totals[group] || 0) + (pct as number);
          if (completedAt && (!lastSeen[group] || completedAt > (lastSeen[group] as Date))) {
            lastSeen[group] = completedAt;
          }
        }
      }
    }
    const now = Date.now();
    return GROUPS.map((g) => {
      const progress = Math.max(0, Math.min(100, Math.round((totals[g.key] / WEEKLY_TARGET) * 100)));
      let streakDays = 0;
      const seen = lastSeen[g.key];
      if (seen) {
        const days = Math.floor((now - seen.getTime()) / (1000 * 60 * 60 * 24));
        streakDays = Math.max(0, 7 - days);
      }
      return { key: g.key, label: g.label, progress, streakDays };
    });
  } catch (e) {
    console.error("[computeMuscleGroups] failed", e);
    return GROUPS.map((g) => ({ key: g.key, label: g.label, progress: 0, streakDays: 0 }));
  }
}
