import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "@/lib/ThemeProvider";
import { getQueryFn } from "@/lib/queryClient";
import flexinLogo from "@/assets/flexin_logo.png";

// ── Types ─────────────────────────────────────────────────────────────────
interface FeedPost {
  id: number;
  userName: string;
  initials: string;
  color: string;
  kind: "workout" | "milestone" | "mvp" | "scan" | "pr";
  title: string;
  body: string;
  energyDelta: number;
  minutesAgo: number;
  reactions: Record<string, number>;
  comments: number;
}

interface FeedPayload {
  summary: {
    squadName: string;
    squadEnergyToday: number;
    squadEnergyTarget: number;
    activeMembers: number;
    memberCount: number;
  };
  posts: FeedPost[];
}

interface FeedProps {
  onBack: () => void;
  onOpenSquad: () => void;
  onOpenProgress: () => void;
  onOpenLogWorkout: () => void;
  onOpenProfile: () => void;
}

const KIND_LABELS: Record<string, string> = {
  workout: "WORKOUT",
  milestone: "MILESTONE",
  mvp: "MVP",
  scan: "NEW SCAN",
  pr: "PR",
};

function formatAgo(min: number): string {
  if (min < 60) return `${min}m ago`;
  if (min < 60 * 24) return `${Math.round(min / 60)}h ago`;
  return `${Math.round(min / (60 * 24))}d ago`;
}

function reactionEmoji(key: string): string {
  switch (key) {
    case "fire": return "🔥";
    case "flex": return "💪";
    case "heart": return "❤️";
    case "bolt": return "⚡";
    default: return "👏";
  }
}

export function Feed({
  onBack,
  onOpenSquad,
  onOpenProgress,
  onOpenLogWorkout,
  onOpenProfile,
}: FeedProps) {
  const t = useTheme();
  const { data, isLoading } = useQuery<FeedPayload>({
    queryKey: ["/api/feed"],
    queryFn: getQueryFn({ on401: "throw" }),
    staleTime: 30_000,
  });

  if (isLoading || !data) {
    return (
      <div style={{ minHeight: "100vh", background: t.bg, color: t.text, display: "grid", placeItems: "center" }}>
        <div style={{ opacity: 0.5 }}>Loading feed…</div>
      </div>
    );
  }

  const energyPct = Math.min(100, Math.round((data.summary.squadEnergyToday / data.summary.squadEnergyTarget) * 100));

  return (
    <div style={{
      minHeight: "100vh", background: t.bg, color: t.text,
      paddingBottom: "calc(env(safe-area-inset-bottom) + 92px)",
    }}>
      {/* ── Top bar ─────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 18px 8px",
      }}>
        <img src={flexinLogo} alt="Flexin" style={{ height: 22 }} />
        <button
          onClick={() => {/* notifications */}}
          aria-label="Info"
          style={{
            width: 36, height: 36, borderRadius: 18,
            border: `2px solid ${t.accent}`, background: "transparent",
            color: t.accent, fontWeight: 800, cursor: "pointer",
            display: "grid", placeItems: "center",
          }}
        >i</button>
      </div>

      <div style={{ padding: "8px 18px 4px" }}>
        <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: -0.5, color: t.text }}>Feed</div>
        <div style={{ fontSize: 14, color: t.textMuted, marginTop: 2 }}>What your squad's been up to.</div>
      </div>

      {/* ── Squad summary card ──────────────────────── */}
      <div style={{
        margin: "14px 18px",
        background: t.bgElevated,
        border: `1px solid ${t.border}`,
        borderRadius: 18,
        padding: 16,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: t.text }}>{data.summary.squadName}</div>
          <div style={{ fontSize: 12, color: t.textMuted, fontWeight: 700 }}>
            {data.summary.activeMembers}/{data.summary.memberCount} active
          </div>
        </div>
        <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 6, fontWeight: 700, letterSpacing: 0.4 }}>
          SQUAD ENERGY TODAY
        </div>
        <div style={{
          height: 10, borderRadius: 5,
          background: t.bgInput, overflow: "hidden",
          border: `1px solid ${t.border}`,
        }}>
          <div style={{
            width: `${energyPct}%`, height: "100%",
            background: `linear-gradient(90deg, ${t.gradientFrom}, ${t.gradientTo})`,
            boxShadow: `0 0 10px ${t.accentGlow}`,
            transition: "width 320ms ease",
          }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
          <div style={{ fontSize: 12, color: t.accent, fontWeight: 800 }}>{data.summary.squadEnergyToday}</div>
          <div style={{ fontSize: 12, color: t.textDim, fontWeight: 700 }}>Goal {data.summary.squadEnergyTarget}</div>
        </div>
      </div>

      {/* ── Posts list ──────────────────────────────── */}
      <div style={{ padding: "4px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
        {data.posts.map((p) => (
          <PostCard key={p.id} t={t} post={p} />
        ))}
      </div>

      <BottomNav
        t={t}
        active="feed"
        onOpenSquad={onOpenSquad}
        onOpenProgress={onOpenProgress}
        onOpenLogWorkout={onOpenLogWorkout}
        onOpenProfile={onOpenProfile}
      />
    </div>
  );
}

// ════════════════════════════ POST CARD ════════════════════════════
function PostCard({ t, post }: { t: any; post: FeedPost }) {
  const isHighlight = post.kind === "mvp" || post.kind === "pr";
  return (
    <div style={{
      background: isHighlight
        ? `linear-gradient(180deg, ${t.bgElevated}, ${t.bgInput})`
        : t.bgElevated,
      border: isHighlight ? `2px solid ${t.accent}` : `1px solid ${t.border}`,
      borderRadius: 16,
      padding: 14,
      boxShadow: isHighlight ? `0 0 14px ${t.accentGlow}` : "none",
    }}>
      {/* Header: avatar + name + kind chip + time */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 19,
          background: post.color, color: "#fff",
          display: "grid", placeItems: "center",
          fontSize: 16, fontWeight: 800,
        }}>{post.initials}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: t.text }}>{post.userName}</div>
            <div style={{
              fontSize: 9, fontWeight: 800, letterSpacing: 0.5,
              background: `${t.accent}22`, color: t.accent,
              padding: "3px 6px", borderRadius: 5,
            }}>{KIND_LABELS[post.kind] || post.kind.toUpperCase()}</div>
          </div>
          <div style={{ fontSize: 11, color: t.textDim, marginTop: 1 }}>{formatAgo(post.minutesAgo)}</div>
        </div>
        {post.energyDelta > 0 && (
          <div style={{
            background: `${t.accent}22`, color: t.accent,
            fontSize: 11, fontWeight: 800,
            padding: "5px 9px", borderRadius: 10,
            whiteSpace: "nowrap",
          }}>+{post.energyDelta} ⚡</div>
        )}
      </div>

      {/* Body */}
      <div style={{ fontSize: 15, fontWeight: 800, color: t.text, marginBottom: 4 }}>{post.title}</div>
      <div style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.4 }}>{post.body}</div>

      {/* Reactions row */}
      <div style={{
        display: "flex", alignItems: "center", gap: 14,
        marginTop: 12, paddingTop: 10,
        borderTop: `1px solid ${t.border}`,
      }}>
        {Object.entries(post.reactions).map(([k, count]) => (
          <button
            key={k}
            style={{
              background: "transparent", border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 4,
              color: t.textMuted, fontSize: 12, fontWeight: 700,
              padding: 0,
            }}
          >
            <span style={{ fontSize: 14 }}>{reactionEmoji(k)}</span>
            <span>{count}</span>
          </button>
        ))}
        <div style={{ marginLeft: "auto", fontSize: 12, color: t.textDim, fontWeight: 700 }}>
          {post.comments} comments
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════ BOTTOM NAV ════════════════════════════
function BottomNav({ t, active, onOpenSquad, onOpenProgress, onOpenLogWorkout, onOpenProfile }: {
  t: any;
  active: "feed" | "squad" | "progress" | "profile";
  onOpenSquad: () => void;
  onOpenProgress: () => void;
  onOpenLogWorkout: () => void;
  onOpenProfile: () => void;
}) {
  return (
    <div style={{
      position: "fixed", left: 0, right: 0, bottom: 0,
      paddingBottom: "calc(env(safe-area-inset-bottom) + 14px)",
      paddingTop: 14,
      background: `linear-gradient(180deg, ${t.bg}00 0%, ${t.bg}E6 35%, ${t.bg}F5 100%)`,
    }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", alignItems: "center", padding: "0 8px" }}>
        <NavBtn t={t} label="Feed"     onClick={() => {}}        active={active === "feed"}     icon={<SparkleIcon  color={active === "feed" ? t.accent : t.textMuted} />} />
        <NavBtn t={t} label="Squad"    onClick={onOpenSquad}      active={active === "squad"}    icon={<SquadIcon    color={active === "squad" ? t.accent : t.textMuted} />} />
        <div style={{ display: "grid", placeItems: "center" }}>
          <button onClick={onOpenLogWorkout} aria-label="Log workout" style={{
            width: 54, height: 54, borderRadius: 27,
            background: `linear-gradient(135deg, ${t.gradientFrom}, ${t.gradientTo})`,
            border: "none", cursor: "pointer",
            display: "grid", placeItems: "center",
            boxShadow: `0 8px 24px ${t.accentGlow}`,
            color: t.accentText, fontSize: 28, fontWeight: 800, lineHeight: 1,
          }}>+</button>
        </div>
        <NavBtn t={t} label="Progress" onClick={onOpenProgress}   active={active === "progress"} icon={<ChartIcon    color={active === "progress" ? t.accent : t.textMuted} />} />
        <NavBtn t={t} label="Profile"  onClick={onOpenProfile}    active={active === "profile"}  icon={<PersonIcon   color={active === "profile" ? t.accent : t.textMuted} />} />
      </div>
    </div>
  );
}

function NavBtn({ t, label, onClick, icon, active }: { t: any; label: string; onClick: () => void; icon: React.ReactNode; active: boolean }) {
  return (
    <button onClick={onClick} style={{
      background: "transparent", border: "none", cursor: "pointer",
      display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
      padding: "6px 0",
    }}>
      {icon}
      <span style={{ fontSize: 11, fontWeight: 700, color: active ? t.accent : t.textMuted }}>{label}</span>
    </button>
  );
}

function SparkleIcon({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M12 2l1.6 4.4L18 8l-4.4 1.6L12 14l-1.6-4.4L6 8l4.4-1.6L12 2zM18 14l1 2.6L22 18l-3 1L18 22l-1-3L14 18l3-1.4L18 14z" fill={color}/>
    </svg>
  );
}
function SquadIcon({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="9" cy="9" r="3" stroke={color} strokeWidth="1.8"/>
      <circle cx="17" cy="10" r="2.4" stroke={color} strokeWidth="1.8"/>
      <path d="M3 19c0-3 2.7-5 6-5s6 2 6 5" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M14 18c0-2 2-3.5 4-3.5s3 1.2 3 3" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
}
function ChartIcon({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M5 19V11M11 19V5M17 19v-6" stroke={color} strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}
function PersonIcon({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="3.4" stroke={color} strokeWidth="1.8"/>
      <path d="M4 20c0-3.6 3.6-6 8-6s8 2.4 8 6" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
}
