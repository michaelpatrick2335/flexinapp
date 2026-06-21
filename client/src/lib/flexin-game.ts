// ============================================================
// Flexin Game Logic — Tiers, Levels, Bananas, Names, Duration
// ============================================================

export type Tier = "newbie" | "experienced" | "enlightened";

// Tier definitions
export const TIERS = {
  newbie: { label: "Newbie", startLevel: 1, color: "#4ade80", emoji: "🌱" },
  experienced: { label: "Experienced", startLevel: 250, color: "#f59e0b", emoji: "🔥" },
  enlightened: { label: "Enlightened", startLevel: 500, color: "#a78bfa", emoji: "✨" },
};

// Get current tier from level
export function getTierFromLevel(level: number): Tier {
  if (level >= 500) return "enlightened";
  if (level >= 250) return "experienced";
  return "newbie";
}

// Meditation duration in seconds based on level
//
// The progression is gentle — just a few seconds per level — so users
// barely notice it growing. That makes it feel natural, not punishing.
//
// Newbie (1–249):       Start at 60s. +3s per level → level 249 = ~9:06 (546s)
// Experienced (250–499): Start at 600s (10 min). +4s per level → level 499 = ~26:36 (1596s)
// Enlightened (500–1000): Start at 1200s (20 min). +3s per level → level 1000 = ~35:00 (2100s cap)
export function getMeditationDuration(level: number): number {
  if (level >= 500) {
    // Enlightened: 20 min base, +3s every level
    return Math.min(1200 + (level - 500) * 3, 2100); // cap at 35 min
  } else if (level >= 250) {
    // Experienced: 10 min base, +4s every level
    return Math.min(600 + (level - 250) * 4, 1596); // caps out naturally at 499
  } else {
    // Newbie: 60s base, +3s every level — so level 2 = 63s, level 10 = 87s, etc.
    return Math.min(60 + (level - 1) * 3, 546); // cap at ~9 min
  }
}

// Format seconds to MM:SS
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// 25 Monk rank names — one new name every 10 bananas
export const MONK_NAMES = [
  "Wandering Mind",      // 0–9 bananas
  "Still Breath",        // 10–19
  "Quiet Seeker",        // 20–29
  "Forest Sitter",       // 30–39
  "Dawn Watcher",        // 40–49
  "Calm Stone",          // 50–59
  "River Mind",          // 60–69
  "Temple Keeper",       // 70–79
  "Inner Light",         // 80–89
  "Lotus Keeper",        // 90–99
  "Mountain Mind",       // 100–109
  "Empty Cup",           // 110–119
  "Deep Roots",          // 120–129
  "Silent Bell",         // 130–139
  "Cloud Walker",        // 140–149
  "Moon Gazer",          // 150–159
  "Still Water",         // 160–169
  "Ancient Breath",      // 170–179
  "Starborn Mind",       // 180–189
  "Golden Silence",      // 190–199
  "Void Walker",         // 200–209
  "Eternal Flame",       // 210–219
  "Boundless Sky",       // 220–229
  "Diamond Mind",        // 230–239
  "THE MONK",            // 240–249+
];

export function getMonkName(bananas: number): string {
  const idx = Math.min(Math.floor(bananas / 10), MONK_NAMES.length - 1);
  return MONK_NAMES[idx];
}

export function getNextNameAt(bananas: number): number | null {
  const currentIdx = Math.min(Math.floor(bananas / 10), MONK_NAMES.length - 1);
  if (currentIdx >= MONK_NAMES.length - 1) return null;
  return (currentIdx + 1) * 10;
}

// SVG flexin face variants — changes every 10 bananas (25 variants mapped to hue rotation)
export function getFlexinHue(bananas: number): number {
  const stage = Math.min(Math.floor(bananas / 10), 24);
  // Hue rotates from yellow (50°) through gold, orange, red, purple, blue, teal, green
  const hues = [50, 45, 40, 35, 30, 25, 20, 15, 10, 5, 350, 340, 300, 270, 240, 210, 190, 170, 150, 130, 110, 90, 70, 60, 55];
  return hues[stage];
}

// Progress bar 0–100 for banana progress to next rank
export function getBananaProgress(bananas: number): number {
  const position = bananas % 10;
  return (position / 10) * 100;
}

// Level progress to next level (each session = 1 level)
export function getLevelProgress(level: number): number {
  // simple: each level is complete once you complete a session
  // Show as a fill bar within current set of 10 levels
  return ((level % 10) / 10) * 100;
}
