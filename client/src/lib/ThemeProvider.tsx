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

function readInitial(): Theme {
  if (typeof window === "undefined") return BLUE_THEME;
  try {
    const sex = (localStorage.getItem(LS_SEX) || "unspecified") as Sex;
    const override = localStorage.getItem(LS_OVERRIDE) as ThemeName | null;
    return themeFor(sex, override);
  } catch {
    return BLUE_THEME;
  }
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
