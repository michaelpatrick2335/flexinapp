import React, { useEffect, useRef, useState } from "react";
import { useTheme } from "@/lib/ThemeProvider";
import { avatarsForSex, type AvatarOption } from "@/lib/avatars";

// ────────────────────────────────────────────────────────────────────────────
// Screen 5: Choose Your Avatar
//
// Shown right after SexSelect. User picks the silhouette that best matches
// their current build. The chosen avatar id is stored on the user record
// (user.avatarBodyType) and used as the Home dashboard hero image.
//
// Grid: 2 columns × 5 rows. Each card shows a numbered silhouette + label.
// Continue is disabled until a card is selected.
// ────────────────────────────────────────────────────────────────────────────

interface AvatarSelectProps {
  sex: "male" | "female";
  initialAvatarId?: string | null;
  onContinue: (avatarId: string) => void;
  onBack: () => void;
}

export function AvatarSelect({
  sex,
  initialAvatarId,
  onContinue,
  onBack,
}: AvatarSelectProps) {
  const t = useTheme();
  const [selectedId, setSelectedId] = useState<string | null>(
    initialAvatarId ?? null
  );

  const avatars = avatarsForSex(sex);
  const canContinue = !!selectedId;

  // When the user picks an avatar, smoothly scroll the Continue button into
  // view so it's obvious where to tap next. Without this, on smaller phones
  // the bottom button can be off-screen below the grid.
  const continueRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (selectedId && continueRef.current) {
      try {
        continueRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
      } catch {
        continueRef.current.scrollIntoView(false);
      }
    }
  }, [selectedId]);

  return (
    <div
      style={{
        position: "relative",
        minHeight: "100dvh",
        background: t.bg,
        color: t.text,
        padding:
          "max(20px, env(safe-area-inset-top)) 16px max(20px, env(safe-area-inset-bottom)) 16px",
        display: "flex",
        flexDirection: "column",
        overflowX: "hidden",
      }}
    >
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
      <div style={{ marginTop: 36, marginBottom: 14, zIndex: 1, padding: "0 8px" }}>
        <h1
          style={{
            fontSize: "1.75rem",
            fontWeight: 800,
            margin: "0 0 8px 0",
            letterSpacing: "0.01em",
            color: t.text,
            lineHeight: 1.15,
            textAlign: "center",
          }}
        >
          CHOOSE YOUR <span style={{ color: t.accent }}>AVATAR</span>
        </h1>

      </div>

      {/* 2-column grid of avatar cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
          padding: "0 4px 24px",
          zIndex: 1,
        }}
      >
        {avatars.map((opt, idx) => (
          <AvatarCard
            key={opt.id}
            opt={opt}
            index={idx + 1}
            selected={selectedId === opt.id}
            accent={t.accent}
            border={t.border}
            bgElevated={t.bgElevated}
            text={t.text}
            textMuted={t.textMuted}
            onClick={() => setSelectedId(opt.id)}
          />
        ))}
      </div>

      {/* Sticky-ish continue at bottom */}
      <div
        ref={continueRef}
        style={{
          position: "sticky",
          bottom: 0,
          paddingTop: 8,
          paddingBottom: "max(8px, env(safe-area-inset-bottom))",
          background: `linear-gradient(180deg, transparent 0%, ${t.bg} 30%)`,
          zIndex: 2,
        }}
      >
        <button
          onClick={() => canContinue && onContinue(selectedId!)}
          disabled={!canContinue}
          data-testid="button-continue"
          className={canContinue ? "btn-primary-theme" : ""}
          style={{
            fontSize: "1.05rem",
            fontWeight: 600,
            opacity: canContinue ? 1 : 0.45,
            cursor: canContinue ? "pointer" : "not-allowed",
            width: "100%",
            ...(canContinue
              ? {}
              : {
                  background: t.bgElevated,
                  color: t.textMuted,
                  border: `1px solid ${t.border}`,
                  borderRadius: 999,
                  padding: "14px 20px",
                  minHeight: 52,
                }),
          }}
        >
          Continue
        </button>
      </div>
    </div>
  );
}

// ── card ───────────────────────────────────────────────────────────────────
function AvatarCard({
  opt,
  index,
  selected,
  accent,
  border,
  bgElevated,
  text,
  textMuted,
  onClick,
}: {
  opt: AvatarOption;
  index: number;
  selected: boolean;
  accent: string;
  border: string;
  bgElevated: string;
  text: string;
  textMuted: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      data-testid={`avatar-card-${opt.id}`}
      aria-pressed={selected}
      style={{
        position: "relative",
        background: bgElevated,
        border: `2px solid ${selected ? accent : border}`,
        borderRadius: 16,
        padding: 8,
        cursor: "pointer",
        textAlign: "left",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        boxShadow: selected ? `0 0 0 3px ${accent}33, 0 8px 24px ${accent}33` : "none",
        transition: "border-color 120ms, box-shadow 200ms",
        overflow: "hidden",
        minHeight: 230,
      }}
    >
      {/* Index badge */}
      <span
        style={{
          position: "absolute",
          top: 8,
          left: 10,
          fontSize: "0.95rem",
          fontWeight: 700,
          color: accent,
          letterSpacing: "0.02em",
          zIndex: 2,
          textShadow: "0 1px 2px rgba(0,0,0,0.6)",
        }}
      >
        {index}
      </span>

      {/* Silhouette image */}
      <div
        style={{
          width: "100%",
          aspectRatio: "3 / 4",
          background: "#000",
          borderRadius: 10,
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <img
          src={opt.image}
          alt={opt.label}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
          loading="lazy"
        />
      </div>

      {/* Labels */}
      <div style={{ padding: "0 4px 2px" }}>
        <div
          style={{
            fontSize: "0.95rem",
            fontWeight: 700,
            color: text,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          {opt.label}
        </div>
        <div
          style={{
            fontSize: "0.72rem",
            color: textMuted,
            marginTop: 2,
            lineHeight: 1.25,
          }}
        >
          {opt.sublabel}
        </div>
      </div>

      {/* Selected check */}
      {selected && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            width: 26,
            height: 26,
            borderRadius: 999,
            background: accent,
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 800,
            fontSize: "0.95rem",
            boxShadow: `0 0 12px ${accent}99`,
            zIndex: 2,
          }}
        >
          ✓
        </span>
      )}
    </button>
  );
}
