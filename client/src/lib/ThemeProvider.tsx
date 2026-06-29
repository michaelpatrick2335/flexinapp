import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { BLUE_THEME, applyThemeToDocument, themeFor, type Sex, type Theme, type ThemeName } from "./theme";

// ────────────────────────────────────────────────────────────────────────────
// ThemeProvider
//
// Pre-login (or before sex is known) the app falls back to the blue theme.
// Once the user signs in / picks their sex, the parent should call
// `setUserPreference({ sex, override })` to switch the active theme.
//
// Most components consume the theme via `useTheme()`:
//
//   const t = useTheme();
//   <button style={{ background: t.accent, color: t.accentText }}>Go</button>
//
// or via CSS variables already wired up:
//
//   <button className="bg-[var(--theme-accent)] text-[var(--theme-accent-text)]">Go</button>
// ────────────────────────────────────────────────────────────────────────────

interface ThemeContextValue {
  theme: Theme;
  setUserPreference: (opts: { sex: Sex; override?: ThemeName | null }) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: BLUE_THEME,
  setUserPreference: () => {},
});

// LocalStorage keys (let theme persist across reloads before we have a user)
const LS_SEX = "flexin_sex";
const LS_OVERRIDE = "flexin_theme_override";
const LS_ONBOARDED = "flexin_onboarding_complete";

// Pre-login screens (Welcome / Login / Create Account / Name & Email) are
// hard-locked to the blue theme. We only honor saved sex/override
// preferences once the user has a live session — App.tsx calls
// `setUserPreference` after /api/user comes back with a real account.
// On every fresh launch we boot blue so a previous pink session never
// bleeds into a fresh login screen for a different user.
function readInitial(): Theme {
  return BLUE_THEME;
}

// Public helper so App.tsx can force the login flow back to blue when the
// user logs out or the session is cleared at boot.
export function resetThemeToBlue() {
  try {
    localStorage.removeItem(LS_SEX);
    localStorage.removeItem(LS_OVERRIDE);
    localStorage.removeItem(LS_ONBOARDED);
  } catch {}
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => readInitial());

  // Apply CSS variables on every theme change
  useEffect(() => {
    applyThemeToDocument(theme);
  }, [theme]);

  const setUserPreference = useMemo(
    () => (opts: { sex: Sex; override?: ThemeName | null }) => {
      const next = themeFor(opts.sex, opts.override ?? null);
      try {
        localStorage.setItem(LS_SEX, opts.sex);
        if (opts.override) localStorage.setItem(LS_OVERRIDE, opts.override);
        else localStorage.removeItem(LS_OVERRIDE);
        // Sex Select is the gate — once a user calls this, onboarding is
        // considered far enough along that we should honor the picked theme
        // on subsequent app launches.
        localStorage.setItem(LS_ONBOARDED, "1");
      } catch {}
      setTheme(next);
    },
    []
  );

  const value = useMemo(() => ({ theme, setUserPreference }), [theme, setUserPreference]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext).theme;
}

export function useThemeControls(): ThemeContextValue {
  return useContext(ThemeContext);
}
