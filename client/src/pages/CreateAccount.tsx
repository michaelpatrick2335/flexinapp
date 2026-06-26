import React from "react";
import { useTheme } from "@/lib/ThemeProvider";
import flexinLogo from "@/assets/flexin_logo.png";

// ────────────────────────────────────────────────────────────────────────────
// Screen 2: Create Account
//
// Three signup paths:
//   • Continue with Apple   → native Sign in with Apple (iOS) / OAuth fallback
//   • Continue with Google  → Google OAuth
//   • Sign up with email    → goes to Screen 3 (Name & Email)
//
// Footer:
//   • Legal microcopy (Terms / Privacy)
//   • "Already have an account? Log in" → switches to login flow
// ────────────────────────────────────────────────────────────────────────────

interface CreateAccountProps {
  onApple: () => void;
  onGoogle: () => void;
  onEmail: () => void;
  onLogIn: () => void;
  onBack: () => void;
}

export function CreateAccount({
  onApple,
  onGoogle,
  onEmail,
  onLogIn,
  onBack,
}: CreateAccountProps) {
  const t = useTheme();

  return (
    <div
      style={{
        position: "relative",
        minHeight: "100dvh",
        background: t.bg,
        color: t.text,
        padding:
          "max(20px, env(safe-area-inset-top)) 24px max(20px, env(safe-area-inset-bottom)) 24px",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Decorative arc lines top-right */}
      <div className="theme-arc" aria-hidden />

      {/* Back button */}
      <button
        onClick={onBack}
        aria-label="Back"
        data-testid="button-back"
        style={{
          position: "absolute",
          top: "max(16px, env(safe-area-inset-top))",
          left: 16,
          background: "transparent",
          border: "none",
          color: t.text,
          fontSize: "1.6rem",
          cursor: "pointer",
          padding: 6,
          lineHeight: 1,
          zIndex: 2,
        }}
      >
        ‹
      </button>

      {/* Logo (small, top) */}
      <div
        style={{
          flex: "0 0 auto",
          textAlign: "center",
          marginTop: "10vh",
          marginBottom: "4vh",
          zIndex: 1,
        }}
      >
        <img
          src={flexinLogo}
          alt="Flexin"
          style={{
            width: "min(48vw, 220px)",
            height: "auto",
            display: "inline-block",
            filter:
              t.name === "pink"
                ? `drop-shadow(0 0 14px ${t.accentGlow}) brightness(0) saturate(100%) invert(38%) sepia(91%) saturate(2200%) hue-rotate(316deg) brightness(101%) contrast(101%)`
                : `drop-shadow(0 0 14px ${t.accentGlow})`,
          }}
        />
      </div>

      {/* Heading */}
      <div style={{ textAlign: "center", marginBottom: 32, zIndex: 1 }}>
        <h1
          style={{
            fontSize: "1.75rem",
            fontWeight: 700,
            margin: "0 0 10px 0",
            letterSpacing: "-0.01em",
            color: t.text,
          }}
        >
          Create Account
        </h1>
        <p
          style={{
            fontSize: "1rem",
            color: t.textMuted,
            margin: 0,
            lineHeight: 1.4,
          }}
        >
          Start your transformation journey today.
        </p>
      </div>

      {/* Auth buttons */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          zIndex: 1,
          marginBottom: 24,
        }}
      >
        <button
          onClick={onApple}
          data-testid="button-continue-apple"
          style={authButtonStyle("#ffffff", "#000000")}
        >
          <AppleLogo />
          <span>Continue with Apple</span>
        </button>

        <button
          onClick={onGoogle}
          data-testid="button-continue-google"
          style={authButtonStyle("#ffffff", "#1f1f1f")}
        >
          <GoogleLogo />
          <span>Continue with Google</span>
        </button>

        {/* "or" divider */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            margin: "8px 0",
            color: t.textMuted,
            fontSize: "0.85rem",
          }}
          aria-hidden
        >
          <div style={{ flex: 1, height: 1, background: t.border }} />
          <span>or</span>
          <div style={{ flex: 1, height: 1, background: t.border }} />
        </div>

        <button
          onClick={onEmail}
          className="btn-outlined-theme"
          data-testid="button-signup-email"
          style={{ fontSize: "1rem", fontWeight: 600 }}
        >
          Sign up with email
        </button>
      </div>

      {/* Footer: legal + log-in link */}
      <div
        style={{
          marginTop: "auto",
          textAlign: "center",
          paddingTop: 16,
          zIndex: 1,
        }}
      >
        <p
          style={{
            color: t.textMuted,
            fontSize: "0.72rem",
            lineHeight: 1.5,
            marginBottom: 14,
            maxWidth: 320,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          By continuing, you confirm you are 13 or older (16+ in the EU/UK), you accept the inherent risks of strength training, and you agree to our{" "}
          <a
            href="https://www.flexinfitapp.com/terms.html"
            target="_blank"
            rel="noreferrer"
            style={{ color: t.accent, textDecoration: "underline" }}
          >
            Terms
          </a>,{" "}
          <a
            href="https://www.flexinfitapp.com/privacy.html"
            target="_blank"
            rel="noreferrer"
            style={{ color: t.accent, textDecoration: "underline" }}
          >
            Privacy Policy
          </a>, and Medical &amp; Fitness Disclaimer.
        </p>
        <p style={{ color: t.textMuted, fontSize: "0.9rem", margin: 0 }}>
          Already have an account?{" "}
          <button
            onClick={onLogIn}
            data-testid="button-switch-login"
            style={{
              background: "transparent",
              border: "none",
              color: t.accent,
              fontWeight: 600,
              fontSize: "0.95rem",
              cursor: "pointer",
              padding: 0,
              textDecoration: "underline",
            }}
          >
            Log in
          </button>
        </p>
      </div>
    </div>
  );
}

// ── helpers ─────────────────────────────────────────────────────────────────
function authButtonStyle(bg: string, fg: string): React.CSSProperties {
  return {
    background: bg,
    color: fg,
    border: "none",
    borderRadius: 999,
    padding: "14px 20px",
    fontSize: "1rem",
    fontWeight: 600,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    width: "100%",
    minHeight: 52,
  };
}

function AppleLogo() {
  return (
    <svg
      width="18"
      height="20"
      viewBox="0 0 18 20"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path d="M14.5 10.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9s-2-.9-3.4-.9c-1.7 0-3.3 1-4.2 2.6-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.3 2.5 1.3-.1 1.8-.8 3.4-.8s2 .8 3.4.8c1.4 0 2.3-1.2 3.2-2.5.7-1 1.1-2 1.4-3-.1 0-2.7-1.1-2.7-3.9zM12 2.9c.7-.9 1.2-2.1 1.1-3.3-1 0-2.3.7-3 1.5-.7.8-1.3 2-1.1 3.2 1.2.1 2.3-.6 3-1.4z" />
    </svg>
  );
}

function GoogleLogo() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.81 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A8.99 8.99 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A8.99 8.99 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A8.99 8.99 0 0 0 9 0 8.99 8.99 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  );
}
