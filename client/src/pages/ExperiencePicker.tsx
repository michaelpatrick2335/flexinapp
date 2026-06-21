import { useState } from "react";
import { apiRequest, markExperiencePicked, queryClient } from "@/lib/queryClient";
import flexinCircle from "@/assets/flexin_circle.jpeg";
import { Fireflies } from "@/components/Fireflies";

interface ExperiencePickerProps {
  onComplete: () => void;
}

const OPTIONS = [
  {
    tier: "newbie" as const,
    level: 1,
    emoji: "🌱",
    label: "Beginner",
    sub: "New to meditation",
    desc: "Start fresh at Level 1. Short sessions, simple breathwork.",
    duration: "1 min sessions",
    color: "#4ade80",
    glow: "rgba(74,222,128,0.25)",
  },
  {
    tier: "experienced" as const,
    level: 250,
    emoji: "🔥",
    label: "Intermediate",
    sub: "I meditate regularly",
    desc: "Jump in at Level 250. 10-minute sessions, deeper practice.",
    duration: "10 min sessions",
    color: "#f59e0b",
    glow: "rgba(245,158,11,0.25)",
  },
  {
    tier: "enlightened" as const,
    level: 500,
    emoji: "✨",
    label: "Advanced",
    sub: "Experienced meditator",
    desc: "Begin at Level 500. 20-minute sessions, full practice.",
    duration: "20 min sessions",
    color: "#a78bfa",
    glow: "rgba(167,139,250,0.25)",
  },
];

export function ExperiencePicker({ onComplete }: ExperiencePickerProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (selected === null) return;
    const opt = OPTIONS[selected];
    setLoading(true);
    // Mark picked immediately so even if API fails we never get stuck
    markExperiencePicked();
    // Optimistically update the cache so App.tsx re-renders straight to Dashboard
    // without a loading flash or re-fetch
    queryClient.setQueryData(["/api/user"], (old: any) => ({
      ...old,
      tier: opt.tier,
      level: opt.level,
    }));
    // Fire-and-forget the API save — don't await it
    apiRequest("PATCH", "/api/user", { tier: opt.tier, level: opt.level }).catch(() => {});
    onComplete();
  };

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "#0d0f1a",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 20px 48px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background glow */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse 70% 50% at 50% 20%, rgba(245,200,66,0.06) 0%, transparent 70%)",
      }} />
      <Fireflies />

      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 400 }}>
        {/* Flexin */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
          <img
            src={flexinCircle}
            alt="Flexin"
            style={{
              width: 72, height: 72, borderRadius: "50%", objectFit: "cover",
              border: "2.5px solid rgba(245,200,66,0.5)",
              boxShadow: "0 0 28px rgba(245,200,66,0.2)",
            }}
          />
        </div>

        {/* Heading */}
        <h1 style={{
          fontSize: "1.7rem", fontWeight: 900, textAlign: "center",
          color: "#ffffff", letterSpacing: "-0.5px", marginBottom: 8,
        }}>
          Where are you on<br />your journey?
        </h1>
        <p style={{
          fontSize: "14px", color: "rgba(255,255,255,0.45)", textAlign: "center",
          marginBottom: 32, lineHeight: 1.5,
        }}>
          Pick your experience level to start at the right place.
        </p>

        {/* Cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 28 }}>
          {OPTIONS.map((opt, i) => {
            const isSelected = selected === i;
            return (
              <button
                key={opt.tier}
                onClick={() => setSelected(i)}
                style={{
                  width: "100%",
                  background: isSelected
                    ? `rgba(${opt.color.replace("#","").match(/.{2}/g)!.map(h=>parseInt(h,16)).join(",")}, 0.12)`
                    : "rgba(255,255,255,0.04)",
                  border: `2px solid ${isSelected ? opt.color : "rgba(255,255,255,0.08)"}`,
                  borderRadius: 18,
                  padding: "18px 20px",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.18s",
                  boxShadow: isSelected ? `0 0 24px ${opt.glow}` : "none",
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                }}
              >
                {/* Emoji circle */}
                <div style={{
                  width: 48, height: 48, borderRadius: "50%", flexShrink: 0,
                  background: `${opt.color}20`,
                  border: `1.5px solid ${opt.color}40`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 22,
                }}>
                  {opt.emoji}
                </div>

                {/* Text */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                    <span style={{ fontSize: "16px", fontWeight: 800, color: "#ffffff" }}>
                      {opt.label}
                    </span>
                    <span style={{
                      fontSize: "11px", fontWeight: 600, color: opt.color,
                      background: `${opt.color}18`, border: `1px solid ${opt.color}35`,
                      padding: "2px 8px", borderRadius: 99,
                    }}>
                      {opt.duration}
                    </span>
                  </div>
                  <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.45)", lineHeight: 1.4 }}>
                    {opt.desc}
                  </div>
                </div>

                {/* Check */}
                {isSelected && (
                  <div style={{
                    width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                    background: opt.color, display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="#0d0f1a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Confirm button */}
        <button
          onClick={handleConfirm}
          disabled={selected === null || loading}
          style={{
            width: "100%", padding: "17px", borderRadius: 16,
            background: selected !== null
              ? "linear-gradient(135deg, #f5c842, #e8952a)"
              : "rgba(255,255,255,0.08)",
            color: selected !== null ? "#1a0a00" : "rgba(255,255,255,0.25)",
            fontSize: "17px", fontWeight: 800, border: "none", cursor: selected !== null ? "pointer" : "not-allowed",
            transition: "all 0.2s",
            boxShadow: selected !== null ? "0 6px 24px rgba(245,200,66,0.3)" : "none",
          }}
        >
          {loading ? "Entering temple..." : "Start My Journey →"}
        </button>
      </div>
    </div>
  );
}
