// ────────────────────────────────────────────────────────────────────────────
// Flexin Theme System
//
// Two themes, keyed off the user's onboarding selection:
//
//   • "blue"  → default for male sex selection (dark bg, electric blue accents)
//   • "pink"  → default for female sex selection (light blush bg, magenta accents)
//
// If the user picked "Prefer not to answer" during onboarding, sex is stored
// as "unspecified" and they chose a color theme manually via themeOverride.
//
// Theme values are exposed both as:
//   1. Plain object exports (use in inline styles for any color)
//   2. CSS variables (set on <html> by ThemeProvider) so Tailwind/CSS can
//      use them via `var(--theme-accent)` etc.
// ────────────────────────────────────────────────────────────────────────────

export type ThemeName = "blue" | "pink";
export type Sex = "male" | "female" | "unspecified";

export interface Theme {
  name: ThemeName;
  // Backgrounds
  bg: string;             // page background
  bgElevated: string;     // card / surface background
  bgInput: string;        // input field bg
  // Foreground / text
  text: string;           // primary text
  textMuted: string;      // secondary / muted text
  textDim: string;        // tertiary / dim text
  // Accent (the brand color — blue or pink)
  accent: string;         // primary brand color
  accentSoft: string;     // washed-out accent for borders/glows
  accentText: string;     // text color on top of accent buttons
  accentGlow: string;     // box-shadow / glow color (rgba)
  // Outline / borders
  border: string;
  borderStrong: string;
  // Status
  success: string;
  warning: string;
  danger: string;
  // Gradient pair (for primary buttons)
  gradientFrom: string;
  gradientTo: string;
}

// ── Theme: Blue (default for male) ─────────────────────────────────────────
export const BLUE_THEME: Theme = {
  name: "blue",
  bg: "#05070f",
  bgElevated: "#0c1020",
  bgInput: "#0a0f1f",
  text: "#ffffff",
  textMuted: "#8b94a8",
  textDim: "#5a6378",
  accent: "#1E5FFF",
  accentSoft: "rgba(30, 95, 255, 0.18)",
  accentText: "#ffffff",
  accentGlow: "rgba(30, 95, 255, 0.45)",
  border: "rgba(30, 95, 255, 0.25)",
  borderStrong: "rgba(30, 95, 255, 0.5)",
  success: "#22c55e",
  warning: "#f59e0b",
  danger: "#ef4444",
  gradientFrom: "#3a7bff",
  gradientTo: "#0d3fb8",
};

// ── Theme: Pink (default for female) ───────────────────────────────────────
export const PINK_THEME: Theme = {
  name: "pink",
  bg: "#fdf2f7",
  bgElevated: "#ffffff",
  bgInput: "#fff5fa",
  text: "#1a0a14",
  textMuted: "#7a5a6a",
  textDim: "#a88a98",
  accent: "#FF4D8F",
  accentSoft: "rgba(255, 77, 143, 0.15)",
  accentText: "#ffffff",
  accentGlow: "rgba(255, 77, 143, 0.4)",
  border: "rgba(255, 77, 143, 0.22)",
  borderStrong: "rgba(255, 77, 143, 0.5)",
  success: "#10b981",
  warning: "#f59e0b",
  danger: "#dc2626",
  gradientFrom: "#ff6ba3",
  gradientTo: "#e63d7a",
};

// ── Resolve which theme to use given the user's sex + override ─────────────
export function themeFor(sex: Sex, override: ThemeName | null | undefined): Theme {
  if (sex === "male") return BLUE_THEME;
  if (sex === "female") return PINK_THEME;
  // unspecified → use override, default to blue if not set yet
  return override === "pink" ? PINK_THEME : BLUE_THEME;
}

// ── Apply theme to document root as CSS variables ──────────────────────────
// Lets Tailwind / static CSS use `var(--theme-accent)` etc. and react to the
// active theme without having to inline every color in JS.
export function applyThemeToDocument(theme: Theme): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty("--theme-bg", theme.bg);
  root.style.setProperty("--theme-bg-elevated", theme.bgElevated);
  root.style.setProperty("--theme-bg-input", theme.bgInput);
  root.style.setProperty("--theme-text", theme.text);
  root.style.setProperty("--theme-text-muted", theme.textMuted);
  root.style.setProperty("--theme-text-dim", theme.textDim);
  root.style.setProperty("--theme-accent", theme.accent);
  root.style.setProperty("--theme-accent-soft", theme.accentSoft);
  root.style.setProperty("--theme-accent-text", theme.accentText);
  root.style.setProperty("--theme-accent-glow", theme.accentGlow);
  root.style.setProperty("--theme-border", theme.border);
  root.style.setProperty("--theme-border-strong", theme.borderStrong);
  root.style.setProperty("--theme-success", theme.success);
  root.style.setProperty("--theme-warning", theme.warning);
  root.style.setProperty("--theme-danger", theme.danger);
  root.style.setProperty("--theme-gradient-from", theme.gradientFrom);
  root.style.setProperty("--theme-gradient-to", theme.gradientTo);
  // Sync iOS status-bar / body bg
  document.body.style.backgroundColor = theme.bg;
  document.body.style.color = theme.text;
  // data-theme attr for any CSS that wants to scope rules per-theme
  root.setAttribute("data-theme", theme.name);
}
