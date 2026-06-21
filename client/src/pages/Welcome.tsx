import { useTheme } from "@/lib/ThemeProvider";
import flexinLogo from "@/assets/flexin_logo.jpeg";

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
          className="flexin-logo-tint"
          style={{
            width: "min(70vw, 320px)",
            height: "auto",
            display: "inline-block",
            // Make the white logo blend onto the dark/light bg by using
            // mix-blend-mode + theme-tinted glow.
            mixBlendMode: t.name === "blue" ? "screen" : "multiply",
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
          icon="👥"
          theme={t}
        />
        <FeatureCard
          title="Scan Body Metrics"
          body="Advanced AI scans. Track what matters."
          icon="🧬"
          theme={t}
        />
        <FeatureCard
          title="Advance Muscle Tracker"
          body="Track every muscle. See real progress."
          icon="💪"
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
  icon: string;
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
      <div style={{ fontSize: "1.6rem", filter: `drop-shadow(0 0 8px ${theme.accentGlow})` }}>
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
