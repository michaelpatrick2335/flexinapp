import React from "react";
import { useTheme } from "@/lib/ThemeProvider";
import flexinLogo from "@/assets/flexin_logo.png";

// ── Feature icons (match mockup: stylized glowing accent-color line art) ──
function GroupIcon({ color }: { color: string }) {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="11" cy="10" r="4" fill={color} />
      <circle cx="21" cy="10" r="4" fill={color} />
      <path d="M4 26c0-4 3-7 7-7s7 3 7 7" stroke={color} strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <path d="M14 26c0-4 3-7 7-7s7 3 7 7" stroke={color} strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </svg>
  );
}

function ProgressIcon({ color }: { color: string }) {
  // Clean "progress photo" glyph: a camera viewfinder bracket with an
  // upward-trending bar-chart inside. Reads instantly as "track your progress
  // visually" without the abstract DNA helix the previous icon used.
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Viewfinder corner brackets (top-left, top-right, bottom-left, bottom-right) */}
      <path d="M5 11V7a2 2 0 0 1 2-2h4" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M27 11V7a2 2 0 0 0-2-2h-4" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M5 21v4a2 2 0 0 0 2 2h4" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M27 21v4a2 2 0 0 1-2 2h-4" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
      {/* Ascending bars inside (3 bars, increasing height) */}
      <rect x="10" y="19" width="3" height="5" rx="0.8" fill={color} />
      <rect x="14.5" y="15" width="3" height="9" rx="0.8" fill={color} />
      <rect x="19" y="11" width="3" height="13" rx="0.8" fill={color} />
    </svg>
  );
}

function BicepIcon({ color }: { color: string }) {
  // Dumbbell icon — universally recognized for muscle/strength training
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* End cap left (outer) */}
      <rect x="2" y="11" width="3" height="10" rx="1" fill={color} />
      {/* End cap left (inner, smaller) */}
      <rect x="5.5" y="9" width="3.5" height="14" rx="1" fill={color} />
      {/* Bar */}
      <rect x="9" y="14" width="14" height="4" fill={color} />
      {/* End cap right (inner) */}
      <rect x="23" y="9" width="3.5" height="14" rx="1" fill={color} />
      {/* End cap right (outer) */}
      <rect x="27" y="11" width="3" height="10" rx="1" fill={color} />
    </svg>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Screen 1: Welcome
//
// First screen anyone sees. Pre-login, so we don't yet know sex — defaults
// to blue theme. Three CTAs:
//   • Get Started   → standard signup (Screen 2: Create Account)
//   • Log In        → existing-user login
//   • Trainer       → Trainer signup path ($99.99/mo, unlimited squads/members)
// ────────────────────────────────────────────────────────────────────────────

interface WelcomeProps {
  onGetStarted: () => void;
  onLogIn: () => void;
  onTrainerSignup: () => void;
}

export function Welcome({ onGetStarted, onLogIn, onTrainerSignup }: WelcomeProps) {
  const t = useTheme();

  // TestFlight requirement: always render this screen starting at the top.
  // iOS WKWebView remembers scroll position across navigations, so the
  // welcome page sometimes mounted with the trainer CTA already in view.
  // We force the window (and html/body) back to (0,0) on mount and lock
  // body scroll while this screen is visible so a stray drag can't bump
  // the page mid-render.
  React.useEffect(() => {
    try {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    } catch {}
  }, []);

  return (
    <div
      style={{
        position: "relative",
        minHeight: "100dvh",
        background: t.bg,
        color: t.text,
        padding: "max(20px, env(safe-area-inset-top)) 20px max(20px, env(safe-area-inset-bottom)) 20px",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Decorative arc lines top-right */}
      <div className="theme-arc" aria-hidden />

      {/* Logo (centered, glowing) */}
      <div style={{ flex: "0 0 auto", textAlign: "center", marginTop: "8vh", marginBottom: "5vh", zIndex: 1 }}>
        <img
          src={flexinLogo}
          alt="Flexin"
          style={{
            width: "min(70vw, 320px)",
            height: "auto",
            display: "inline-block",
            // Logo is a transparent-PNG white wordmark. On the pink theme we
            // tint it to the accent color so it doesn't get lost on the light
            // background. On dark themes the white wordmark stands on its own.
            filter:
              t.name === "pink"
                ? `drop-shadow(0 0 18px ${t.accentGlow}) brightness(0) saturate(100%) invert(38%) sepia(91%) saturate(2200%) hue-rotate(316deg) brightness(101%) contrast(101%)`
                : `drop-shadow(0 0 18px ${t.accentGlow})`,
          }}
        />
      </div>

      {/* CTA buttons */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14, zIndex: 1, marginBottom: 28 }}>
        <button
          onClick={onGetStarted}
          className="btn-primary-theme"
          data-testid="button-get-started"
          style={{ fontSize: "1.05rem", fontWeight: 600 }}
        >
          Get Started
        </button>
        <button
          onClick={onLogIn}
          className="btn-outlined-theme"
          data-testid="button-log-in"
          style={{ fontSize: "1.05rem", fontWeight: 600 }}
        >
          Log In
        </button>
      </div>

      {/* Three feature cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 10,
          zIndex: 1,
          marginBottom: 20,
        }}
      >
        <FeatureCard
          title="Accountability Groups"
          body="Real people. Real support. Stay consistent together."
          icon={<GroupIcon color={t.accent} />}
          theme={t}
        />
        <FeatureCard
          title="Progress Photos"
          body="Snap weekly photos. See real side-by-side change."
          icon={<ProgressIcon color={t.accent} />}
          theme={t}
        />
        <FeatureCard
          title="Advance Muscle Tracker"
          body="Track every muscle. See real progress."
          icon={<BicepIcon color={t.accent} />}
          theme={t}
        />
      </div>

      {/* Trainer CTA — secondary path at the bottom */}
      <div
        style={{
          marginTop: "auto",
          textAlign: "center",
          paddingTop: 18,
          paddingBottom: 8,
          borderTop: `1px solid ${t.border}`,
          zIndex: 1,
        }}
      >
        <p style={{ color: t.textMuted, fontSize: "0.85rem", marginBottom: 8 }}>
          Are you a fitness trainer?
        </p>
        <button
          onClick={onTrainerSignup}
          data-testid="button-trainer-signup"
          style={{
            background: "transparent",
            color: t.accent,
            border: "none",
            fontSize: "0.95rem",
            fontWeight: 600,
            cursor: "pointer",
            padding: "6px 12px",
            textDecoration: "underline",
            textUnderlineOffset: 4,
          }}
        >
          Trainer Sign Up
        </button>
      </div>
    </div>
  );
}

// ── Sub-component: feature card ─────────────────────────────────────────────
function FeatureCard({
  title,
  body,
  icon,
  theme,
}: {
  title: string;
  body: string;
  icon: React.ReactNode;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <div
      style={{
        background: theme.bgElevated,
        border: `1px solid ${theme.border}`,
        borderRadius: 14,
        padding: "14px 10px",
        textAlign: "center",
        boxShadow: `0 0 24px ${theme.accentSoft}`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
      }}
    >
      <div style={{ filter: `drop-shadow(0 0 8px ${theme.accentGlow})`, lineHeight: 0 }}>
        {icon}
      </div>
      <div
        style={{
          color: theme.text,
          fontWeight: 700,
          fontSize: "0.78rem",
          lineHeight: 1.15,
        }}
      >
        {title}
      </div>
      <div
        style={{
          color: theme.textMuted,
          fontSize: "0.65rem",
          lineHeight: 1.3,
        }}
      >
        {body}
      </div>
    </div>
  );
}
