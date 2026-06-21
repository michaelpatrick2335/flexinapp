import React, { useState } from "react";
import { useTheme } from "@/lib/ThemeProvider";

// ────────────────────────────────────────────────────────────────────────────
// Screen 3: Name & Email
//
// Collects the user's display name (shown to their squad) and email.
// Continue is disabled until both fields are non-empty and email looks valid.
// On submit → Screen 4 (Sex Select).
// ────────────────────────────────────────────────────────────────────────────

interface NameEmailProps {
  initialName?: string;
  initialEmail?: string;
  onContinue: (data: { name: string; email: string }) => void;
  onBack: () => void;
}

export function NameEmail({
  initialName = "",
  initialEmail = "",
  onContinue,
  onBack,
}: NameEmailProps) {
  const t = useTheme();
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);

  const trimmedName = name.trim();
  const trimmedEmail = email.trim();
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail);
  const canContinue = trimmedName.length >= 1 && emailValid;

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!canContinue) return;
    onContinue({ name: trimmedName, email: trimmedEmail });
  };

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

      {/* Heading */}
      <div style={{ marginTop: "12vh", marginBottom: 36, zIndex: 1 }}>
        <h1
          style={{
            fontSize: "1.9rem",
            fontWeight: 700,
            margin: "0 0 10px 0",
            letterSpacing: "-0.01em",
            color: t.text,
            lineHeight: 1.15,
          }}
        >
          Let's get to know you.
        </h1>
        <p
          style={{
            fontSize: "1rem",
            color: t.textMuted,
            margin: 0,
            lineHeight: 1.4,
          }}
        >
          This is how your squad will know you.
        </p>
      </div>

      {/* Form */}
      <form
        onSubmit={handleSubmit}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 18,
          zIndex: 1,
        }}
      >
        <FieldLabel theme={t} htmlFor="signup-name">
          Name
        </FieldLabel>
        <input
          id="signup-name"
          data-testid="input-name"
          type="text"
          autoComplete="given-name"
          autoCapitalize="words"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          style={inputStyle(t)}
        />

        <div style={{ height: 4 }} />

        <FieldLabel theme={t} htmlFor="signup-email">
          Email
        </FieldLabel>
        <input
          id="signup-email"
          data-testid="input-email"
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          style={inputStyle(t)}
        />

        <button
          type="submit"
          disabled={!canContinue}
          data-testid="button-continue"
          className={canContinue ? "btn-primary-theme" : ""}
          style={{
            marginTop: 28,
            fontSize: "1.05rem",
            fontWeight: 600,
            opacity: canContinue ? 1 : 0.45,
            cursor: canContinue ? "pointer" : "not-allowed",
            // when disabled, override the gradient with a flat muted background
            ...(canContinue
              ? {}
              : {
                  background: t.bgElevated,
                  color: t.textMuted,
                  border: `1px solid ${t.border}`,
                  borderRadius: 999,
                  padding: "14px 20px",
                  width: "100%",
                  minHeight: 52,
                }),
          }}
        >
          Continue
        </button>
      </form>
    </div>
  );
}

// ── helpers ─────────────────────────────────────────────────────────────────
function FieldLabel({
  theme,
  htmlFor,
  children,
}: {
  theme: ReturnType<typeof useTheme>;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      style={{
        fontSize: "0.85rem",
        fontWeight: 600,
        color: theme.textMuted,
        marginBottom: -10,
        letterSpacing: "0.02em",
      }}
    >
      {children}
    </label>
  );
}

function inputStyle(theme: ReturnType<typeof useTheme>): React.CSSProperties {
  return {
    background: theme.bgElevated,
    border: `1px solid ${theme.border}`,
    borderRadius: 14,
    padding: "14px 16px",
    fontSize: "1rem",
    color: theme.text,
    outline: "none",
    width: "100%",
    fontFamily: "inherit",
    minHeight: 52,
    boxSizing: "border-box",
  };
}
