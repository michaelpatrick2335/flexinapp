import React, { useState } from "react";
import { useTheme } from "@/lib/ThemeProvider";
import { avatarsForSex, type AvatarOption } from "@/lib/avatars";
import { apiRequest, queryClient } from "@/lib/queryClient";

// ─────────────────────────────────────────────────────────────────────────────
// GoalBodyTypeModal
//
// Fullscreen modal shown right after the user lands on Home for the first
// time. Prompts "What is your goal body type?" and lets the user pick a
// target avatar that mirrors the AvatarSelect grid. On selection we PATCH
// the user record with `goalAvatarBodyType` and dismiss.
//
// Triggered from Home.tsx when the dashboard user has no goalAvatarBodyType.
// ─────────────────────────────────────────────────────────────────────────────

interface GoalBodyTypeModalProps {
  sex: "male" | "female" | string;
  initialGoal?: string | null;
  onSaved: (goalAvatarBodyType: string) => void;
  onDismiss?: () => void;
}

export function GoalBodyTypeModal({ sex, initialGoal, onSaved, onDismiss }: GoalBodyTypeModalProps) {
  const t = useTheme();
  const [selectedId, setSelectedId] = useState<string | null>(initialGoal ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedSex: "male" | "female" =
    (sex || "").toLowerCase() === "female" ? "female" : "male";
  const avatars = avatarsForSex(normalizedSex);
  const canSave = !!selectedId && !saving;

  async function handleSave() {
    if (!selectedId) return;
    setSaving(true);
    setError(null);
    try {
      await apiRequest("PATCH", "/api/user", { goalAvatarBodyType: selectedId });
      // Invalidate user + dashboard so the rest of the app picks up the goal
      await queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      onSaved(selectedId);
    } catch (e: any) {
      setError(e?.message || "Couldn't save. Try again.");
      setSaving(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="What is your goal body type?"
      style={{
        position: "fixed",
        inset: 0,
        background: t.bg,
        color: t.text,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        paddingTop: "max(24px, env(safe-area-inset-top))",
        paddingBottom: "max(24px, env(safe-area-inset-bottom))",
        overflowY: "auto",
      }}
    >
      {/* Close (skip) button */}
      {onDismiss && (
        <button
          onClick={onDismiss}
          aria-label="Skip"
          data-testid="goal-modal-skip"
          style={{
            position: "absolute", top: "max(18px, env(safe-area-inset-top))", right: 18,
            width: 36, height: 36, borderRadius: 18,
            background: t.bgElevated, color: t.text, border: `1px solid ${t.border}`,
            display: "grid", placeItems: "center", cursor: "pointer", padding: 0,
            fontSize: 18, fontWeight: 700,
          }}
        >×</button>
      )}

      <div style={{ padding: "0 18px 6px", textAlign: "center" }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 2,
            color: t.textMuted,
            marginBottom: 6,
          }}
        >
          ONE LAST THING
        </div>
        <h1
          style={{
            fontSize: "1.6rem",
            fontWeight: 800,
            lineHeight: 1.15,
            margin: "0 0 8px",
          }}
        >
          What is your goal body type?
        </h1>
        <p
          style={{
            fontSize: 14,
            color: t.textMuted,
            margin: "0 0 14px",
            lineHeight: 1.35,
          }}
        >
          Pick the build you're working toward. We'll tune your plan and progress visuals around it.
        </p>
      </div>

      {/* Avatar grid */}
      <div
        style={{
          padding: "0 14px",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
        }}
      >
        {avatars.map((a: AvatarOption, idx: number) => {
          const isSelected = selectedId === a.id;
          return (
            <button
              key={a.id}
              type="button"
              data-testid={`goal-avatar-${a.id}`}
              onClick={() => setSelectedId(a.id)}
              style={{
                background: isSelected
                  ? `linear-gradient(135deg, ${t.gradientFrom}, ${t.gradientTo})`
                  : t.bgElevated,
                border: isSelected ? "none" : `1px solid ${t.border}`,
                borderRadius: 16,
                padding: "10px 8px 12px",
                color: t.text,
                cursor: "pointer",
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
                transition: "transform 0.12s ease, background 0.12s ease",
                transform: isSelected ? "scale(1.02)" : "scale(1)",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  opacity: 0.85,
                  letterSpacing: 1,
                }}
              >
                {idx + 1}
              </div>
              {/* Avatar fills the card. We use aspectRatio 3/4 (matches the
                  AvatarSelect grid) and objectFit: cover so the silhouette
                  fills the box edge-to-edge, like the on-boarding screen. */}
              <div
                style={{
                  width: "100%",
                  aspectRatio: "3 / 4",
                  background: "#000",
                  borderRadius: 12,
                  overflow: "hidden",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <img
                  src={a.image}
                  alt={a.label}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                    filter: isSelected ? "drop-shadow(0 4px 10px rgba(0,0,0,0.35))" : "none",
                  }}
                />
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, marginTop: 4 }}>{a.label}</div>
              <div
                style={{
                  fontSize: 11,
                  opacity: 0.75,
                  marginTop: 2,
                  lineHeight: 1.2,
                }}
              >
                {a.sublabel}
              </div>
            </button>
          );
        })}
      </div>

      {error && (
        <div
          style={{
            margin: "10px 18px 0",
            padding: "10px 12px",
            borderRadius: 10,
            background: "rgba(255,80,80,0.12)",
            color: "#ff8080",
            fontSize: 13,
            textAlign: "center",
          }}
        >
          {error}
        </div>
      )}

      {/* Sticky save bar */}
      <div
        style={{
          position: "sticky",
          bottom: 0,
          marginTop: 18,
          padding: "14px 18px max(14px, env(safe-area-inset-bottom))",
          background: `linear-gradient(180deg, rgba(0,0,0,0) 0%, ${t.bg} 30%)`,
        }}
      >
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          data-testid="goal-avatar-save"
          style={{
            width: "100%",
            padding: "16px 18px",
            borderRadius: 16,
            border: "none",
            background: canSave
              ? `linear-gradient(135deg, ${t.gradientFrom}, ${t.gradientTo})`
              : t.bgElevated,
            color: canSave ? "#fff" : t.textMuted,
            fontSize: 16,
            fontWeight: 800,
            letterSpacing: 1,
            cursor: canSave ? "pointer" : "not-allowed",
            opacity: canSave ? 1 : 0.7,
            boxShadow: canSave ? "0 8px 22px rgba(59,130,246,0.35)" : "none",
          }}
        >
          {saving ? "Saving…" : "Set my goal"}
        </button>
      </div>
    </div>
  );
}
