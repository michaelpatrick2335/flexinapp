// ─── Breathing Challenges Library ───────────────────────────────────────────
// Each challenge has phases that cycle, a script read in sequence,
// and a total rounds count.

export type BreathPhase = {
  label: string;          // "Inhale" | "Hold" | "Exhale" | "Hold Empty"
  count: number;          // seconds for this phase
  cue: string;            // what the display shows (short)
  color: string;          // accent color for the ring animation
};

export type BreathChallenge = {
  id: string;
  name: string;
  subtitle: string;
  emoji: string;
  bananaReward: number;
  totalRounds: number;    // how many full cycles
  phases: BreathPhase[];
  script: string[];       // narration lines shown sequentially, one per ~8s
  completionMessage: string;
};

export const BREATH_CHALLENGES: BreathChallenge[] = [
  // ── 1. Box Breath ──────────────────────────────────────────────────────────
  {
    id: "box-breath",
    name: "Box Breath",
    subtitle: "The warrior's square — 6 counts of calm",
    emoji: "⬜",
    bananaReward: 4,
    totalRounds: 6,
    phases: [
      { label: "Inhale",     count: 6, cue: "Breathe in…",      color: "#4ade80" },
      { label: "Hold",       count: 6, cue: "Hold…",             color: "#f5c842" },
      { label: "Exhale",     count: 6, cue: "Release…",          color: "#60a5fa" },
      { label: "Hold Empty", count: 6, cue: "Rest empty…",       color: "#a78bfa" },
    ],
    script: [
      "Now begin.",
      "Inhale through your nose… filling your lungs gently…",
      "Hold… feeling calm and steady…",
      "Exhale slowly… releasing all tension…",
      "Hold empty… resting in stillness…",
      "Imagine tracing the four sides of a square with your breath — up, across, down, across.",
      "Each inhale brings focus.",
      "Each hold builds steadiness.",
      "Each exhale releases stress.",
      "Each pause creates space.",
      "There is nowhere else you need to be.",
      "Nothing else you need to do.",
      "Just this breath. Just this moment.",
      "Continue… maintaining the same gentle count.",
    ],
    completionMessage: "Notice the calm you've created. Your nervous system has reset.",
  },

  // ── 2. 4-7-8 Calm ──────────────────────────────────────────────────────────
  {
    id: "478-calm",
    name: "4-7-8 Calm",
    subtitle: "Dr. Weil's natural tranquilizer",
    emoji: "🌊",
    bananaReward: 4,
    totalRounds: 4,
    phases: [
      { label: "Inhale",     count: 4, cue: "In through nose…",  color: "#4ade80" },
      { label: "Hold",       count: 7, cue: "Hold…",             color: "#f5c842" },
      { label: "Exhale",     count: 8, cue: "Out through mouth…",color: "#60a5fa" },
    ],
    script: [
      "Place your tongue gently behind your upper front teeth.",
      "Inhale quietly through your nose for 4 counts…",
      "Hold your breath completely for 7 counts…",
      "Exhale fully through your mouth for 8 counts… let it go…",
      "This pattern activates your parasympathetic nervous system.",
      "The extended exhale is the key — it tells your brain you are safe.",
      "Feel your heart rate slow with each cycle.",
      "Your body knows how to find peace. You are guiding it there.",
      "Each round takes you deeper into calm.",
    ],
    completionMessage: "Your body's natural tranquilizer has been activated. Feel the stillness.",
  },

  // ── 3. Warrior Energize ────────────────────────────────────────────────────
  {
    id: "warrior-energize",
    name: "Warrior Breath",
    subtitle: "Kapalabhati — ignite your inner fire",
    emoji: "🔥",
    bananaReward: 5,
    totalRounds: 3,
    phases: [
      { label: "Pump",       count: 2, cue: "Sharp exhale!",     color: "#f97316" },
      { label: "Inhale",     count: 3, cue: "Passive inhale…",   color: "#4ade80" },
      { label: "Full Hold",  count: 5, cue: "Hold… feel it…",    color: "#f5c842" },
      { label: "Release",    count: 4, cue: "Breathe out…",      color: "#60a5fa" },
    ],
    script: [
      "Sit tall. This breath will energize every cell.",
      "Sharp, powerful exhales from the belly — let the inhale be passive.",
      "Each pump clears stale air and awakens your energy.",
      "Feel the heat building in your core.",
      "After the pumps, take one deep full breath and hold…",
      "Retain that energy. Feel it radiating outward.",
      "This is Kapalabhati — the skull-shining breath.",
      "Ancient yogis used this to ignite clarity and power.",
      "You are lighting your inner fire.",
    ],
    completionMessage: "Your energy channels are open. Carry this fire into your day.",
  },

  // ── 4. Deep Mountain ───────────────────────────────────────────────────────
  {
    id: "deep-mountain",
    name: "Deep Mountain",
    subtitle: "8-count diaphragmatic with body scan",
    emoji: "🏔️",
    bananaReward: 4,
    totalRounds: 5,
    phases: [
      { label: "Inhale",    count: 8, cue: "Rise like a mountain…", color: "#4ade80" },
      { label: "Hold",      count: 4, cue: "Summit stillness…",     color: "#f5c842" },
      { label: "Exhale",    count: 8, cue: "Descend slowly…",       color: "#60a5fa" },
    ],
    script: [
      "Close your eyes. Imagine you are a mountain — still, ancient, unshakeable.",
      "Breathe deep into your belly first… then your chest… filling completely…",
      "Hold at the summit — everything is quiet up here.",
      "Exhale all the way down… slowly… completely…",
      "Scan your body as you breathe. Soften your jaw… your shoulders…",
      "Release your hands. Let your belly be soft.",
      "With each exhale, release any tension you find.",
      "You are rooted. You cannot be moved by the storms of the mind.",
      "Mountains do not hurry. Neither do you.",
      "Breathe your way to stillness.",
    ],
    completionMessage: "You are the mountain. Unshakeable. Present. At peace.",
  },

  // ── 5. Triangle Breath ─────────────────────────────────────────────────────
  {
    id: "triangle-breath",
    name: "Triangle Breath",
    subtitle: "5-5-5 — balance, clarity, presence",
    emoji: "🔺",
    bananaReward: 4,
    totalRounds: 6,
    phases: [
      { label: "Inhale",  count: 5, cue: "Rise…",    color: "#4ade80" },
      { label: "Hold",    count: 5, cue: "Balance…", color: "#f5c842" },
      { label: "Exhale",  count: 5, cue: "Release…", color: "#60a5fa" },
    ],
    script: [
      "Three equal sides. Three equal counts. Perfect balance.",
      "Inhale… drawing energy upward through the triangle…",
      "Hold at the peak… resting in complete awareness…",
      "Exhale… flowing down the other side… releasing everything…",
      "The triangle is one of nature's most stable shapes. So is your breath.",
      "Inhale presence. Hold clarity. Exhale what no longer serves you.",
      "Feel your mind becoming clear like still water.",
      "Each triangle you complete builds a foundation of calm.",
      "You are finding your center.",
      "Right here. Right now. In perfect balance.",
    ],
    completionMessage: "Three sides. Three breaths. One centered mind. Well done.",
  },
];

// Pick a random challenge (weighted — skip warrior for first challenge)
export function getRandomChallenge(totalSessions: number): BreathChallenge {
  const pool = totalSessions <= 3
    ? BREATH_CHALLENGES.filter(c => c.id !== "warrior-energize")
    : BREATH_CHALLENGES;
  return pool[Math.floor(Math.random() * pool.length)];
}

// Returns true when a challenge should be offered (every 3 sessions)
export function shouldShowChallenge(totalSessions: number): boolean {
  return totalSessions > 0 && totalSessions % 3 === 0;
}
