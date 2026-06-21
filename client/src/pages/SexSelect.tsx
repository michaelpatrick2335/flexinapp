import React, { useState } from "react";
import { useTheme, useThemeControls } from "@/lib/ThemeProvider";

// ────────────────────────────────────────────────────────────────────────────
// Screen 4: Sex Select
//
// User picks Male (blue) or Female (pink). The theme flips immediately on
// selection so subsequent screens render in the chosen color.
//
// "Prefer not to answer" small text below opens a sub-prompt where the user
// picks their preferred color (blue or pink) — stored as themeOverride.
//
// On a normal pick, auto-advance after a short beat to feel snappy.
// ────────────────────────────────────────────────────────────────────────────

type Pick = "male" | "female" | null;

interface SexSelectProps {
  onContinue: (data: {
    sex: "male" | "female" | "unspecified";
    themeOverride: "blue" | "pink" | null;
  }) => void;
  onBack: () => void;
}

export function SexSelect({ onContinue, onBack }: SexSelectProps) {
  const t = useTheme();
  const { setUserPreference } = useThemeControls();
  const [picked, setPicked] = useState<Pick>(null);
  const [askColor, setAskColor] = useState(false);

  const handlePick = (pick: "male" | "female") => {
    setPicked(pick);
    setUserPreference({ sex: pick, override: null });
    // Auto-advance after a brief moment so the user sees the selection state
    window.setTimeout(() => {
      onContinue({ sex: pick, themeOverride: null });
    }, 350);
  };

  const handlePreferNot = () => {
    setAskColor(true);
  };

  const handlePickColor = (color: "blue" | "pink") => {
    setUserPreference({ sex: "unspecified", override: color });
    window.setTimeout(() => {
      onContinue({ sex: "unspecified", themeOverride: color });
    }, 250);
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
      <div className="theme-arc" aria-hidden />

      {/* Back */}
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
      <div style={{ marginTop: "11vh", marginBottom: 36, zIndex: 1, textAlign: "center" }}>
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
          Select your sex
        </h1>
        <p
          style={{
            fontSize: "0.95rem",
            color: t.textMuted,
            margin: 0,
            lineHeight: 1.4,
            maxWidth: 320,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          Used to personalize your dashboard, workouts, and squad theme.
        </p>
      </div>

      {/* Two large cards (Male / Female) */}
      {!askColor && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 14,
              zIndex: 1,
              marginBottom: 28,
            }}
          >
            <SexCard
              kind="male"
              selected={picked === "male"}
              onClick={() => handlePick("male")}
              dimmed={picked !== null && picked !== "male"}
              labelColor={t.text}
            />
            <SexCard
              kind="female"
              selected={picked === "female"}
              onClick={() => handlePick("female")}
              dimmed={picked !== null && picked !== "female"}
              labelColor={t.text}
            />
          </div>

          {/* "Prefer not to answer" */}
          <div style={{ textAlign: "center", marginTop: 6, zIndex: 1 }}>
            <button
              onClick={handlePreferNot}
              data-testid="button-prefer-not"
              style={{
                background: "transparent",
                border: "none",
                color: t.textMuted,
                fontSize: "0.9rem",
                cursor: "pointer",
                padding: 8,
                textDecoration: "underline",
                textUnderlineOffset: 4,
              }}
            >
              Prefer not to answer
            </button>
          </div>
        </>
      )}

      {/* Color sub-prompt (Prefer not → pick a color) */}
      {askColor && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 14,
            zIndex: 1,
            marginBottom: 16,
          }}
        >
          <p
            style={{
              textAlign: "center",
              color: t.textMuted,
              fontSize: "0.95rem",
              marginBottom: 6,
            }}
          >
            Pick your color theme.
          </p>

          <button
            onClick={() => handlePickColor("blue")}
            data-testid="button-color-blue"
            style={{
              background: "linear-gradient(180deg, #3a7bff, #0d3fb8)",
              border: "1px solid #1E5FFF",
              borderRadius: 16,
              padding: "22px 20px",
              color: "#fff",
              fontWeight: 700,
              fontSize: "1.05rem",
              cursor: "pointer",
              boxShadow: "0 0 24px rgba(30, 95, 255, 0.35)",
            }}
          >
            Blue
          </button>

          <button
            onClick={() => handlePickColor("pink")}
            data-testid="button-color-pink"
            style={{
              background: "linear-gradient(180deg, #ff6ba3, #e63d7a)",
              border: "1px solid #FF4D8F",
              borderRadius: 16,
              padding: "22px 20px",
              color: "#fff",
              fontWeight: 700,
              fontSize: "1.05rem",
              cursor: "pointer",
              boxShadow: "0 0 24px rgba(255, 77, 143, 0.35)",
            }}
          >
            Pink
          </button>

          <button
            onClick={() => setAskColor(false)}
            style={{
              background: "transparent",
              border: "none",
              color: t.textMuted,
              fontSize: "0.85rem",
              cursor: "pointer",
              padding: 8,
              marginTop: 4,
              textDecoration: "underline",
              textUnderlineOffset: 4,
            }}
          >
            ← Back to sex select
          </button>
        </div>
      )}
    </div>
  );
}

// ── Sub-component: large sex card ───────────────────────────────────────────
function SexCard({
  kind,
  selected,
  dimmed,
  onClick,
  labelColor,
}: {
  kind: "male" | "female";
  selected: boolean;
  dimmed: boolean;
  onClick: () => void;
  labelColor: string;
}) {
  // Hard-coded theme colors per card so the LEFT card is always blue and the
  // RIGHT card is always pink, regardless of the currently-active theme.
  const isMale = kind === "male";
  const accent = isMale ? "#1E5FFF" : "#FF4D8F";
  const gradient = isMale
    ? "linear-gradient(180deg, rgba(58,123,255,0.18), rgba(13,63,184,0.10))"
    : "linear-gradient(180deg, rgba(255,107,163,0.18), rgba(230,61,122,0.10))";
  const glow = isMale ? "rgba(30, 95, 255, 0.35)" : "rgba(255, 77, 143, 0.35)";
  const label = isMale ? "Male" : "Female";
  const symbol = isMale ? "♂" : "♀";

  return (
    <button
      onClick={onClick}
      data-testid={`button-sex-${kind}`}
      style={{
        background: gradient,
        border: `2px solid ${selected ? accent : "rgba(127,127,127,0.18)"}`,
        borderRadius: 20,
        padding: "30px 16px 26px 16px",
        color: labelColor,
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 14,
        minHeight: 210,
        boxShadow: selected ? `0 0 28px ${glow}` : "none",
        opacity: dimmed ? 0.45 : 1,
        transition: "all 200ms ease",
        position: "relative",
      }}
    >
      <div
        style={{
          fontSize: "3.4rem",
          fontWeight: 400,
          color: accent,
          lineHeight: 1,
          filter: `drop-shadow(0 0 10px ${glow})`,
        }}
        aria-hidden
      >
        {symbol}
      </div>
      <div
        style={{
          fontSize: "1.15rem",
          fontWeight: 700,
          letterSpacing: "0.02em",
          color: labelColor,
        }}
      >
        {label}
      </div>
    </button>
  );
}
