// Custom user-created breath exercises — stored in localStorage, scoped per user email

import type { BreathChallenge } from "./breath-challenges";
import { getUserEmail } from "./queryClient";

// Legacy global key (pre-account-scoping). On first per-user load we migrate
// these into the current user's bucket and then delete the legacy key so we
// don't bleed exercises across accounts on the same device.
const LEGACY_KEY = "flexin_custom_breath_exercises";

function storageKey(): string {
  const email = (getUserEmail() || "").toLowerCase().trim();
  // When there's no signed-in user, fall back to an anonymous bucket so
  // pre-signup activity doesn't bleed into the next account that logs in.
  if (!email) return "flexin_custom_breath_exercises_anon";
  return `flexin_custom_breath_exercises_v2_${email}`;
}

// Run once per call to loadCustomExercises: if the legacy global key has data
// and the current per-user bucket is empty, move it over. Otherwise, drop the
// legacy data (it would otherwise be a cross-account leak).
function migrateLegacyIfNeeded(currentKey: string) {
  try {
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (!legacy) return;
    const existing = localStorage.getItem(currentKey);
    if (!existing) {
      // First load for this account — adopt the legacy items
      localStorage.setItem(currentKey, legacy);
    }
    // Always remove the legacy key after first run so other accounts on the
    // same device can't see it.
    localStorage.removeItem(LEGACY_KEY);
  } catch {}
}

export interface CustomBreathExercise {
  id: string;
  name: string;
  emoji: string;
  inhale: number;    // seconds
  holdIn: number;    // seconds (hold after inhale), 0 = skip
  exhale: number;    // seconds
  holdOut: number;   // seconds (hold after exhale), 0 = skip
  rounds: number;
  createdAt: number;
}

export function loadCustomExercises(): CustomBreathExercise[] {
  const key = storageKey();
  migrateLegacyIfNeeded(key);
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveCustomExercise(ex: Omit<CustomBreathExercise, "id" | "createdAt">): CustomBreathExercise {
  const exercises = loadCustomExercises();
  const newEx: CustomBreathExercise = {
    ...ex,
    id: `custom-${Date.now()}`,
    createdAt: Date.now(),
  };
  exercises.push(newEx);
  try { localStorage.setItem(storageKey(), JSON.stringify(exercises)); } catch {}
  return newEx;
}

export function updateCustomExercise(id: string, updates: Partial<Omit<CustomBreathExercise, "id" | "createdAt">>): void {
  const exercises = loadCustomExercises().map(e => e.id === id ? { ...e, ...updates } : e);
  try { localStorage.setItem(storageKey(), JSON.stringify(exercises)); } catch {}
}

export function deleteCustomExercise(id: string) {
  const exercises = loadCustomExercises().filter(e => e.id !== id);
  try { localStorage.setItem(storageKey(), JSON.stringify(exercises)); } catch {}
}

// Wipe the current user's custom exercises (used on account deletion / hard logout)
export function clearCustomExercisesForCurrentUser(): void {
  try {
    localStorage.removeItem(storageKey());
    // Also nuke the legacy global key and any stale voice recording keys from
    // older builds so they can't leak to the next account on this device.
    localStorage.removeItem(LEGACY_KEY);
    const toDelete: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("flexin_custom_voice_")) toDelete.push(k);
    }
    toDelete.forEach(k => { try { localStorage.removeItem(k); } catch {} });
  } catch {}
}

// Convert a CustomBreathExercise to a BreathChallenge so BreathChallengeScreen can run it
export function toBreathChallenge(ex: CustomBreathExercise): BreathChallenge {
  const phases = [];
  phases.push({ label: "Inhale", count: ex.inhale, cue: "Breathe in…", color: "#4ade80" });
  if (ex.holdIn > 0) phases.push({ label: "Hold", count: ex.holdIn, cue: "Hold…", color: "#f5c842" });
  phases.push({ label: "Exhale", count: ex.exhale, cue: "Breathe out…", color: "#60a5fa" });
  if (ex.holdOut > 0) phases.push({ label: "Hold Empty", count: ex.holdOut, cue: "Rest empty…", color: "#a78bfa" });

  const pattern = [ex.inhale, ex.holdIn, ex.exhale, ex.holdOut].filter(v => v > 0).join("-");

  return {
    id: ex.id,
    name: ex.name,
    subtitle: `Custom · ${pattern}s · ${ex.rounds} rounds`,
    emoji: ex.emoji,
    bananaReward: 3,
    totalRounds: ex.rounds,
    phases,
    script: [
      "This is your custom breathing exercise.",
      "Follow the rhythm you set.",
      "Breathe with intention.",
      "Stay focused on the count.",
      "Each breath is a choice to be present.",
      "You created this practice for yourself.",
      "Honor it fully.",
    ],
    completionMessage: "Your custom practice is complete. Well done.",
  };
}
