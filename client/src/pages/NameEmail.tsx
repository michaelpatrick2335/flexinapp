import React, { useState } from "react";
import { useTheme } from "@/lib/ThemeProvider";

// ────────────────────────────────────────────────────────────────────────────
// Screen 3: Name, Email, Age & Weight
//
// Collects the user's display name (shown to their squad), email, age, and
// body weight. Age + weight personalize the Home dashboard (calories,
// protein target, default exercise weights). Continue is disabled until all
// four fields are valid. On submit → Screen 4 (Sex Select).
// ────────────────────────────────────────────────────────────────────────────

interface NameEmailProps {
  initialName?: string;
  initialEmail?: string;
  initialAge?: string;
  initialWeight?: string;
  onContinue: (data: {
    name: string;
    email: string;
    age: number;
    weightLbs: number;
  }) => void;
  onBack: () => void;
}

export function NameEmail({
  initialName = "",
  initialEmail = "",
  initialAge = "",
  initialWeight = "",
  onContinue,
  onBack,
}: NameEmailProps) {
  const t = useTheme();
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [age, setAge] = useState(initialAge);
  const [weight, setWeight] = useState(initialWeight);

  const trimmedName = name.trim();
  const trimmedEmail = email.trim();
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail);
  const ageNum = parseInt(age, 10);
  const ageValid = Number.isFinite(ageNum) && ageNum >= 13 && ageNum <= 100;
  const weightNum = parseFloat(weight);
  const weightValid =
    Number.isFinite(weightNum) && weightNum >= 50 && weightNum <= 700;
  const canContinue =
    trimmedName.length >= 1 && emailValid && ageValid && weightValid;

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!canContinue) return;
    onContinue({
      name: trimmedName,
      email: trimmedEmail,
      age: ageNum,
      weightLbs: Math.round(weightNum * 10) / 10,
    });
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
      <div style={{ marginTop: "8vh", marginBottom: 24, zIndex: 1 }}>
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
          We'll use this to dial in your stats.
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

        <div style={{ height: 4 }} />

        {/* Age + Weight on one row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <FieldLabel theme={t} htmlFor="signup-age">
              Age
            </FieldLabel>
            <input
              id="signup-age"
              data-testid="input-age"
              type="number"
              inputMode="numeric"
              min={13}
              max={100}
              value={age}
              onChange={(e) => setAge(e.target.value.replace(/[^\d]/g, ""))}
              placeholder="28"
              style={inputStyle(t)}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <FieldLabel theme={t} htmlFor="signup-weight">
              Weight (lbs)
            </FieldLabel>
            <input
              id="signup-weight"
              data-testid="input-weight"
              type="number"
              inputMode="decimal"
              min={50}
              max={700}
              step={0.1}
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="165"
              style={inputStyle(t)}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={!canContinue}
          data-testid="button-continue"
          className={canContinue ? "btn-primary-theme" : ""}
          style={{
            marginTop: 20,
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
