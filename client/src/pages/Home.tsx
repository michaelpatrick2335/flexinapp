import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Capacitor } from "@capacitor/core";
import { useTheme } from "@/lib/ThemeProvider";
import { getQueryFn } from "@/lib/queryClient";
import silhouetteMale from "@/assets/silhouette_male.png";
import silhouetteFemale from "@/assets/silhouette_female.png";

// ── Types matching /api/dashboard response ────────────────────────────────
interface DashboardPayload {
  user: { id: number; name: string; sex: string; formLevel: number; formRank: string };
  muscleGroups: { key: string; label: string; progress: number; streakDays: number }[];
  activeSquad: {
    id: number;
    name: string;
    energy: number;
    memberCount: number;
    mvp: { userId: number; name: string; contribution: number };
  };
  squadFeed: {
    id: number;
    userName: string;
    message: string;
    kind: string;
    energyDelta: number;
    reactions: Record<string, number>;
    minutesAgo: number;
  }[];
  evolution: { day: string; workouts: number; energy: number }[];
  coachMessage: string;
  generatedAt: string;
}

interface HomeProps {
  onOpenLogWorkout: () => void;
  onOpenSquad: () => void;
  onOpenProfile: () => void;
  onOpenFeed: () => void;
}

export function Home({ onOpenLogWorkout, onOpenSquad, onOpenProfile, onOpenFeed }: HomeProps) {
  const t = useTheme();
  const isFemale = t.name === "pink";
  const silhouette = isFemale ? silhouetteFemale : silhouetteMale;

  const { data, isLoading } = useQuery<DashboardPayload>({
    queryKey: ["/api/dashboard"],
    queryFn: getQueryFn({ on401: "throw" }),
    staleTime: 60_000,
  });

  if (isLoading || !data) {
    return (
      <div style={{ minHeight: "100vh", background: t.bg, color: t.text, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: t.textMuted, fontSize: 14 }}>Loading…</div>
      </div>
    );
  }

  const { user, muscleGroups, activeSquad, squadFeed, evolution, coachMessage } = data;
  const evolutionMax = Math.max(...evolution.map(e => e.energy), 1);

  return (
    <div style={{ minHeight: "100vh", background: t.bg, color: t.text, paddingBottom: 110 }}>
      {/* ── Top status bar: greeting + bell ──────────────────────────── */}
      <div style={{ padding: "max(env(safe-area-inset-top), 14px) 18px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 12, color: t.textMuted, letterSpacing: 0.6, textTransform: "uppercase" }}>Good morning</div>
          <div style={{ fontSize: 22, fontWeight: 700, marginTop: 2 }}>{user.name || "Athlete"}</div>
        </div>
        <button
          onClick={onOpenProfile}
          aria-label="Profile"
          style={{
            width: 40, height: 40, borderRadius: 20, border: `1.5px solid ${t.border}`, background: t.bgElevated,
            display: "grid", placeItems: "center", cursor: "pointer",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="8" r="3.5" stroke={t.accent} strokeWidth="1.8" />
            <path d="M4 20c0-3.5 3.5-6.5 8-6.5s8 3 8 6.5" stroke={t.accent} strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* ── Form Level + Squad Energy strip ───────────────────────────── */}
      <div style={{ padding: "18px 18px 0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <StatCard
          theme={t}
          label="Form Level"
          value={String(user.formLevel)}
          sub={user.formRank}
        />
        <StatCard
          theme={t}
          label="Squad Energy"
          value={`${activeSquad.energy}%`}
          sub={activeSquad.name}
          onClick={onOpenSquad}
        />
      </div>

      {/* ── Silhouette + muscle progress ──────────────────────────────── */}
      <div style={{ padding: "20px 18px 0", display: "grid", gridTemplateColumns: "auto 1fr", gap: 14, alignItems: "stretch" }}>
        <div
          style={{
            background: t.bgElevated, border: `1px solid ${t.border}`, borderRadius: 18,
            padding: 10, display: "flex", alignItems: "center", justifyContent: "center",
            width: 140, minHeight: 280,
          }}
        >
          <img
            src={silhouette}
            alt={isFemale ? "Female muscle map" : "Male muscle map"}
            style={{ maxWidth: "100%", maxHeight: 260, objectFit: "contain", filter: `drop-shadow(0 0 14px ${t.accentGlow})` }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {muscleGroups.slice(0, 6).map((m) => (
            <MuscleRow key={m.key} theme={t} label={m.label} progress={m.progress} streakDays={m.streakDays} />
          ))}
        </div>
      </div>

      {/* ── MAX Coach one-liner ─────────────────────────────────────── */}
      <div style={{ padding: "18px 18px 0" }}>
        <div
          style={{
            background: `linear-gradient(135deg, ${t.gradientFrom}, ${t.gradientTo})`,
            color: t.accentText, padding: "14px 16px", borderRadius: 14,
            display: "flex", alignItems: "center", gap: 12,
            boxShadow: `0 6px 24px ${t.accentGlow}`,
          }}
        >
          <div style={{
            width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.18)",
            display: "grid", placeItems: "center", fontWeight: 800, fontSize: 14, letterSpacing: 0.5,
          }}>MAX</div>
          <div style={{ flex: 1, fontSize: 14, fontWeight: 500, lineHeight: 1.3 }}>{coachMessage}</div>
        </div>
      </div>

      {/* ── Squad Feed ──────────────────────────────────────────────── */}
      <div style={{ padding: "22px 18px 0" }}>
        <SectionHeader theme={t} title="Squad Feed" right="See all" onRight={onOpenFeed} />
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
          {squadFeed.map((f) => (
            <FeedRow key={f.id} theme={t} item={f} />
          ))}
        </div>
      </div>

      {/* ── Evolution timeline ──────────────────────────────────────── */}
      <div style={{ padding: "22px 18px 0" }}>
        <SectionHeader theme={t} title="Evolution" right="This week" />
        <div
          style={{
            marginTop: 10, background: t.bgElevated, border: `1px solid ${t.border}`, borderRadius: 16,
            padding: "14px 12px", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 8, height: 130,
          }}
        >
          {evolution.map((d) => {
            const h = (d.energy / evolutionMax) * 80 + 10;
            return (
              <div key={d.day} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flex: 1 }}>
                <div
                  style={{
                    width: "70%", height: h, borderRadius: 6,
                    background: d.workouts > 0
                      ? `linear-gradient(180deg, ${t.gradientFrom}, ${t.gradientTo})`
                      : t.bgInput,
                    boxShadow: d.workouts > 0 ? `0 0 12px ${t.accentGlow}` : "none",
                  }}
                />
                <div style={{ fontSize: 10, color: t.textMuted, letterSpacing: 0.5 }}>{d.day}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Bottom nav (Feed / Squad / + / Profile) ─────────────────── */}
      <nav
        className="fixed left-0 right-0 z-40"
        style={{
          bottom: 0,
          paddingBottom: "max(env(safe-area-inset-bottom), 10px)",
          paddingTop: 8,
          background: `linear-gradient(180deg, ${t.bg}00 0%, ${t.bg}E6 35%, ${t.bg}F5 100%)`,
          backdropFilter: "blur(10px)",
        }}
      >
        <div style={{ maxWidth: 480, margin: "0 auto", padding: "8px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <NavBtn theme={t} label="Feed" onClick={onOpenFeed} icon={<FeedIcon color={t.textMuted} />} active={false} />
          <NavBtn theme={t} label="Squad" onClick={onOpenSquad} icon={<SquadIcon color={t.textMuted} />} active={false} />
          <button
            onClick={onOpenLogWorkout}
            aria-label="Log workout"
            style={{
              width: 56, height: 56, borderRadius: 28, border: "none",
              background: `linear-gradient(135deg, ${t.gradientFrom}, ${t.gradientTo})`,
              color: t.accentText, fontSize: 28, fontWeight: 700, lineHeight: 1,
              boxShadow: `0 10px 32px ${t.accentGlow}`, cursor: "pointer",
              display: "grid", placeItems: "center", marginTop: -16,
            }}
          >+</button>
          <NavBtn theme={t} label="Home" onClick={() => {}} icon={<HomeIcon color={t.accent} />} active={true} />
          <NavBtn theme={t} label="Profile" onClick={onOpenProfile} icon={<ProfileIcon color={t.textMuted} />} active={false} />
        </div>
      </nav>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function StatCard({ theme: t, label, value, sub, onClick }: { theme: any; label: string; value: string; sub: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: t.bgElevated, border: `1px solid ${t.border}`, borderRadius: 14,
        padding: "12px 14px", cursor: onClick ? "pointer" : "default",
        textAlign: "left", display: "flex", flexDirection: "column", gap: 2,
        color: t.text,
      }}
    >
      <div style={{ fontSize: 11, color: t.textMuted, letterSpacing: 0.5, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: t.accent, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 11, color: t.textMuted, fontWeight: 600, letterSpacing: 0.4, marginTop: 2 }}>{sub}</div>
    </button>
  );
}

function MuscleRow({ theme: t, label, progress, streakDays }: { theme: any; label: string; progress: number; streakDays: number }) {
  return (
    <div
      style={{
        background: t.bgElevated, border: `1px solid ${t.border}`, borderRadius: 12,
        padding: "10px 12px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 11, color: streakDays > 0 ? t.accent : t.textMuted, fontWeight: 700 }}>
          {streakDays > 0 ? `🔥 ${streakDays}d` : "—"}
        </span>
      </div>
      <div style={{ height: 6, background: t.bgInput, borderRadius: 3, overflow: "hidden" }}>
        <div
          style={{
            width: `${progress}%`, height: "100%",
            background: `linear-gradient(90deg, ${t.gradientFrom}, ${t.gradientTo})`,
            boxShadow: `0 0 8px ${t.accentGlow}`,
          }}
        />
      </div>
    </div>
  );
}

function SectionHeader({ theme: t, title, right, onRight }: { theme: any; title: string; right?: string; onRight?: () => void }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{title}</h3>
      {right && (
        <button
          onClick={onRight}
          style={{ background: "none", border: "none", color: t.accent, fontSize: 12, fontWeight: 600, cursor: onRight ? "pointer" : "default" }}
        >{right}</button>
      )}
    </div>
  );
}

function FeedRow({ theme: t, item }: { theme: any; item: DashboardPayload["squadFeed"][number] }) {
  const REACTIONS: Record<string, string> = { fire: "🔥", flex: "💪", bolt: "⚡", heart: "❤️", rat: "🐀" };
  const initial = item.userName.charAt(0).toUpperCase();
  return (
    <div
      style={{
        background: t.bgElevated, border: `1px solid ${t.border}`, borderRadius: 14,
        padding: "12px 14px", display: "flex", gap: 12, alignItems: "center",
      }}
    >
      <div style={{
        width: 38, height: 38, borderRadius: 19,
        background: `linear-gradient(135deg, ${t.gradientFrom}, ${t.gradientTo})`,
        display: "grid", placeItems: "center", color: t.accentText, fontWeight: 800, fontSize: 14,
        flexShrink: 0,
      }}>{initial}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>
          <span>{item.userName}</span>
          <span style={{ color: t.textMuted, fontWeight: 400 }}> {item.message}</span>
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 4, alignItems: "center" }}>
          {Object.entries(item.reactions).map(([k, v]) => (
            <span key={k} style={{ fontSize: 11, color: t.textMuted, background: t.bgInput, padding: "2px 6px", borderRadius: 10 }}>
              {REACTIONS[k] || "•"} {v}
            </span>
          ))}
          <span style={{ fontSize: 11, color: t.textDim, marginLeft: "auto" }}>{fmtAgo(item.minutesAgo)}</span>
        </div>
      </div>
    </div>
  );
}

function fmtAgo(min: number) {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

// ── Bottom nav helpers ─────────────────────────────────────────────────────

function NavBtn({ theme: t, label, onClick, icon, active }: { theme: any; label: string; onClick: () => void; icon: React.ReactNode; active: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "transparent", border: "none", cursor: "pointer",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
        color: active ? t.accent : t.textMuted, padding: "6px 10px",
        minWidth: 60,
      }}
    >
      {icon}
      <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.4 }}>{label}</span>
    </button>
  );
}

function FeedIcon({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M4 6h16M4 12h16M4 18h10" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function SquadIcon({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="9" cy="8" r="3" stroke={color} strokeWidth="1.8" />
      <circle cx="17" cy="9" r="2.5" stroke={color} strokeWidth="1.8" />
      <path d="M3 19c0-3 2.7-5.5 6-5.5s6 2.5 6 5.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M14 19c0-2.2 1.8-4 4-4s4 1.8 4 4" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function HomeIcon({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-9z" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}
function ProfileIcon({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="3.5" stroke={color} strokeWidth="1.8" />
      <path d="M4 20c0-3.5 3.5-6.5 8-6.5s8 3 8 6.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
