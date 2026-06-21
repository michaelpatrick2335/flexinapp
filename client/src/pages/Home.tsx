import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "@/lib/ThemeProvider";
import { getQueryFn } from "@/lib/queryClient";
import silhouetteMale from "@/assets/silhouette_male.png";
import silhouetteFemale from "@/assets/silhouette_female.png";
import flexinLogo from "@/assets/flexin_logo.png";
import { avatarImageFor } from "@/lib/avatars";

// ── Types matching /api/dashboard response ────────────────────────────────
interface DashboardPayload {
  user: {
    id: number; name: string; sex: string;
    formLevel: number; formRank: string;
    isPremium: boolean;
    xp: number; xpToNext: number; streakDays: number;
    avatarBodyType?: string | null;
  };
  muscleGroups: { key: string; label: string; progress: number; streakDays: number }[];
  bodyDeltas: { key: string; label: string; delta: number; isOverall?: boolean }[];
  energy: { percent: number; message: string };
  weeklyScanDaysLeft: number;
  monthStats: {
    trainingDays: number; totalWorkouts: number; caloriesBurned: number;
    avgFormScore: number; unreadAlerts: number;
  };
  activeSquad: {
    id: number; name: string; energy: number; memberCount: number;
    mvp: { userId: number; name: string; contribution: number };
  };
  squadFeed: {
    id: number; userName: string; message: string; kind: string;
    energyDelta: number; reactions: Record<string, number>; minutesAgo: number;
  }[];
  evolution: { day: string; workouts: number; energy: number }[];
  evolutionTimeline: { key: string; label: string; intensity: number }[];
  coachMessage: string;
  generatedAt: string;
}

interface HomeProps {
  onOpenLogWorkout: () => void;
  onOpenSquad: () => void;
  onOpenProfile: () => void;
  onOpenFeed: () => void;
  onOpenProgress?: () => void;
}

export function Home({ onOpenLogWorkout, onOpenSquad, onOpenProfile, onOpenFeed, onOpenProgress }: HomeProps) {
  const t = useTheme();
  const isFemale = t.name === "pink";
  const defaultSilhouette = isFemale ? silhouetteFemale : silhouetteMale;

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

  const { user, bodyDeltas, energy, weeklyScanDaysLeft, monthStats, squadFeed, evolutionTimeline } = data;
  const xpPct = Math.min(100, Math.round((user.xp / user.xpToNext) * 100));
  // Resolve the chosen body-type avatar; fall back to legacy silhouette if unset.
  const silhouette = user.avatarBodyType
    ? avatarImageFor(user.avatarBodyType, (user.sex === "female" ? "female" : "male"))
    : defaultSilhouette;

  return (
    <div style={{ minHeight: "100vh", background: t.bg, color: t.text, paddingBottom: 110, overflowX: "hidden" }}>

      {/* ═════════════════════ HERO ═════════════════════ */}
      <HeroSection
        t={t}
        userName={user.name || "Athlete"}
        streakDays={user.streakDays}
        formLevel={user.formLevel}
        formRank={user.formRank}
        xp={user.xp}
        xpToNext={user.xpToNext}
        xpPct={xpPct}
        energy={energy}
        bodyDeltas={bodyDeltas}
        weeklyScanDaysLeft={weeklyScanDaysLeft}
        unreadAlerts={monthStats.unreadAlerts}
        isPremium={user.isPremium}
        silhouette={silhouette}
        isFemale={isFemale}
        onOpenProfile={onOpenProfile}
      />

      {/* ═════════════════════ SQUAD FEED + EVOLUTION (side by side) ═════════════════════ */}
      <div style={{ padding: "18px 14px 0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <SquadFeedCard t={t} feed={squadFeed} onOpenFeed={onOpenFeed} />
        <EvolutionCard t={t} timeline={evolutionTimeline} silhouette={silhouette} isFemale={isFemale} onOpenProgress={onOpenProgress} />
      </div>

      {/* ═════════════════════ MONTH STATS ═════════════════════ */}
      <MonthStatsCard t={t} stats={monthStats} />

      {/* ═════════════════════ BOTTOM NAV ═════════════════════ */}
      <BottomNav
        t={t}
        onOpenFeed={onOpenFeed}
        onOpenSquad={onOpenSquad}
        onOpenLogWorkout={onOpenLogWorkout}
        onOpenProgress={onOpenProgress}
        onOpenProfile={onOpenProfile}
      />
    </div>
  );
}

// ════════════════════════════ HERO ════════════════════════════
function HeroSection({
  t, userName, streakDays, formLevel, formRank, xp, xpToNext, xpPct,
  energy, bodyDeltas, weeklyScanDaysLeft, unreadAlerts, isPremium, silhouette, isFemale, onOpenProfile,
}: {
  t: any; userName: string; streakDays: number; formLevel: number; formRank: string;
  xp: number; xpToNext: number; xpPct: number;
  energy: { percent: number; message: string };
  bodyDeltas: DashboardPayload["bodyDeltas"];
  weeklyScanDaysLeft: number; unreadAlerts: number; isPremium: boolean;
  silhouette: string; isFemale: boolean; onOpenProfile: () => void;
}) {
  return (
    <div style={{ position: "relative", paddingTop: "max(env(safe-area-inset-top), 14px)", paddingBottom: 18, minHeight: 580, overflow: "hidden" }}>

      {/* Background silhouette, centered, large.
          - Male (dark theme): PNG has navy bg → 'screen' turns dark transparent, blue glow shows.
          - Female (pink theme): PNG has light pink bg → 'multiply' turns light transparent, pink muscle lines show on light page. */}
      <div style={{ position: "absolute", inset: 0, display: "flex", justifyContent: "center", alignItems: "flex-start", pointerEvents: "none" }}>
        <img
          src={silhouette}
          alt={isFemale ? "Female muscle map" : "Male muscle map"}
          style={{
            height: 460, marginTop: 60, objectFit: "contain",
            mixBlendMode: isFemale ? "multiply" : "screen",
            opacity: isFemale ? 1 : 0.95,
          }}
        />
      </div>

      {/* Top row: flexin+ wordmark / bell + profile */}
      <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 18px" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
          <img
            src={flexinLogo}
            alt="flexin"
            style={{
              height: 26, width: "auto", display: "block",
              filter:
                t.name === "pink"
                  ? `drop-shadow(0 0 10px ${t.accentGlow}) brightness(0) saturate(100%) invert(38%) sepia(91%) saturate(2200%) hue-rotate(316deg) brightness(101%) contrast(101%)`
                  : `drop-shadow(0 0 10px ${t.accentGlow})`,
            }}
          />
          <span style={{ fontSize: 22, fontWeight: 700, color: t.accent, lineHeight: 1, textShadow: `0 0 10px ${t.accentGlow}`, marginLeft: 2 }}>+</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button
            aria-label="Notifications"
            style={{
              position: "relative", width: 38, height: 38, borderRadius: 19,
              background: "transparent", border: `1px solid ${t.border}`,
              display: "grid", placeItems: "center", cursor: "pointer",
            }}
          >
            <BellIcon color={t.text} />
            {unreadAlerts > 0 && (
              <span style={{
                position: "absolute", top: -4, right: -4,
                background: t.accent, color: t.accentText,
                fontSize: 10, fontWeight: 800, borderRadius: 10,
                minWidth: 18, height: 18, padding: "0 5px",
                display: "grid", placeItems: "center",
                boxShadow: `0 0 8px ${t.accentGlow}`,
              }}>{unreadAlerts}</span>
            )}
          </button>
          <button
            onClick={onOpenProfile}
            aria-label="Profile"
            style={{
              width: 38, height: 38, borderRadius: 19,
              background: "transparent", border: `1px solid ${t.border}`,
              display: "grid", placeItems: "center", cursor: "pointer",
            }}
          >
            <ProfileIcon color={t.text} />
          </button>
        </div>
      </div>

      {/* Left column overlay: name / streak / form level / energy */}
      <div style={{ position: "relative", padding: "12px 18px 0", display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 12 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 180 }}>
          {/* YOUR FORM */}
          <div>
            <div style={{ fontSize: 11, color: t.textMuted, letterSpacing: 1, fontWeight: 600 }}>YOUR FORM</div>
            <div style={{ fontSize: 34, fontWeight: 800, lineHeight: 1.05, marginTop: 2, color: t.text }}>
              {userName}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
              <span style={{ fontSize: 14 }}>🔥</span>
              <span style={{ fontSize: 13, color: t.text, fontWeight: 600 }}>{streakDays} day streak</span>
            </div>
            <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>Keep showing up.</div>
          </div>

          {/* FORM LEVEL */}
          <div>
            <div style={{ fontSize: 11, color: t.textMuted, letterSpacing: 1, fontWeight: 600 }}>FORM LEVEL</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 2 }}>
              <span style={{ fontSize: 44, fontWeight: 800, color: t.accent, lineHeight: 1, textShadow: `0 0 18px ${t.accentGlow}` }}>{formLevel}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, color: t.accent, fontWeight: 700, letterSpacing: 0.6 }}>
                {formRank} <BoltIcon color={t.accent} size={12} />
              </span>
            </div>
            <div style={{ fontSize: 11, color: t.textMuted, marginTop: 4 }}>{xp.toLocaleString()} / {xpToNext.toLocaleString()} XP</div>
            <div style={{ height: 4, background: t.bgInput, borderRadius: 2, overflow: "hidden", marginTop: 6, width: 150 }}>
              <div style={{
                width: `${xpPct}%`, height: "100%",
                background: `linear-gradient(90deg, ${t.gradientFrom}, ${t.gradientTo})`,
                boxShadow: `0 0 8px ${t.accentGlow}`,
              }} />
            </div>
          </div>

          {/* ENERGY */}
          <div style={{ background: t.bgElevated, border: `1px solid ${t.border}`, borderRadius: 12, padding: "10px 12px", marginTop: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 10, color: t.textMuted, letterSpacing: 1, fontWeight: 600 }}>ENERGY</span>
              <BoltIcon color={t.accent} size={10} />
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: t.text, marginTop: 2, lineHeight: 1 }}>{energy.percent}%</div>
            <div style={{ height: 3, background: t.bgInput, borderRadius: 2, overflow: "hidden", marginTop: 6 }}>
              <div style={{
                width: `${energy.percent}%`, height: "100%",
                background: `linear-gradient(90deg, ${t.gradientFrom}, ${t.gradientTo})`,
              }} />
            </div>
            <div style={{ fontSize: 10, color: t.textMuted, marginTop: 5 }}>{energy.message}</div>
          </div>
        </div>

        {/* RIGHT column: weekly scan + body deltas */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 18 }}>
          {/* Weekly Scan card */}
          <div style={{
            background: t.bgElevated, border: `1px solid ${t.border}`, borderRadius: 12,
            padding: "8px 12px", display: "flex", alignItems: "center", gap: 8,
          }}>
            <CalendarIcon color={t.accent} />
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 11, color: t.text, fontWeight: 600 }}>Weekly Scan</span>
              <span style={{ fontSize: 11, color: t.textMuted }}>{weeklyScanDaysLeft}d left</span>
            </div>
          </div>

          {/* Body Deltas */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-end", paddingRight: 2 }}>
            {bodyDeltas.map((d) => (
              <div key={d.key} style={{ textAlign: "right" }}>
                <div style={{
                  fontSize: 10, color: t.textMuted, letterSpacing: 1, fontWeight: 600,
                }}>{d.label}</div>
                <div style={{
                  fontSize: d.isOverall ? 18 : 16, fontWeight: 800, color: t.accent,
                  lineHeight: 1.1, textShadow: `0 0 10px ${t.accentGlow}`,
                }}>
                  +{d.delta}%
                </div>
                {d.isOverall && (
                  <div style={{ fontSize: 9, color: t.textMuted, marginTop: 1 }}>vs last scan</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════ SQUAD FEED ════════════════════════════
function SquadFeedCard({ t, feed, onOpenFeed }: { t: any; feed: DashboardPayload["squadFeed"]; onOpenFeed: () => void }) {
  return (
    <div style={{ background: t.bgElevated, border: `1px solid ${t.border}`, borderRadius: 16, padding: "12px 12px 10px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: 0.5 }}>SQUAD FEED</span>
        <button onClick={onOpenFeed} style={{ background: "none", border: "none", color: t.accent, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
          View all
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {feed.slice(0, 4).map((f) => (
          <div key={f.id} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <div style={{
              width: 28, height: 28, borderRadius: 14,
              background: `linear-gradient(135deg, ${t.gradientFrom}, ${t.gradientTo})`,
              display: "grid", placeItems: "center", color: t.accentText, fontWeight: 800, fontSize: 12,
              flexShrink: 0,
            }}>{f.userName.charAt(0).toUpperCase()}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, lineHeight: 1.3 }}>
                <span style={{ fontWeight: 700, color: t.text }}>{f.userName}</span>
                <span style={{ color: t.textMuted }}> {f.message}</span>
              </div>
              <div style={{ fontSize: 10, color: t.textDim, marginTop: 2 }}>{fmtAgo(f.minutesAgo)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ════════════════════════════ EVOLUTION CARD ════════════════════════════
function EvolutionCard({ t, timeline, silhouette, isFemale, onOpenProgress }: {
  t: any; timeline: DashboardPayload["evolutionTimeline"]; silhouette: string; isFemale: boolean; onOpenProgress?: () => void;
}) {
  return (
    <div style={{ background: t.bgElevated, border: `1px solid ${t.border}`, borderRadius: 16, padding: "12px 12px 14px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.5 }}>EVOLUTION</span>
        <button onClick={onOpenProgress} style={{ background: "none", border: "none", color: t.accent, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
          View all
        </button>
      </div>

      {/* Labels row */}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${timeline.length}, 1fr)`, gap: 2, marginBottom: 4 }}>
        {timeline.map((w, i) => (
          <div key={w.key} style={{
            fontSize: 8.5, textAlign: "center",
            color: i === timeline.length - 1 ? t.accent : t.textMuted,
            fontWeight: i === timeline.length - 1 ? 700 : 500,
            letterSpacing: 0.3,
          }}>{w.label}</div>
        ))}
      </div>

      {/* Silhouette row */}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${timeline.length}, 1fr)`, gap: 2, alignItems: "end", height: 80 }}>
        {timeline.map((w, i) => {
          const isCurrent = i === timeline.length - 1;
          return (
            <div key={w.key} style={{ display: "flex", justifyContent: "center", alignItems: "flex-end", height: "100%" }}>
              <img
                src={silhouette}
                alt={w.label}
                style={{
                  maxHeight: "100%",
                  maxWidth: "100%",
                  objectFit: "contain",
                  mixBlendMode: isFemale ? "multiply" : "screen",
                  opacity: isCurrent ? 1 : 0.18 + w.intensity * 0.18,
                  filter: isCurrent
                    ? "none"
                    : isFemale ? "grayscale(0.4) opacity(0.6)" : "grayscale(0.4) brightness(0.75)",
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Dots progress */}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${timeline.length}, 1fr)`, gap: 2, marginTop: 8, position: "relative" }}>
        <div style={{
          position: "absolute", left: "10%", right: "10%", top: "50%",
          height: 1, background: t.border, transform: "translateY(-50%)",
        }} />
        {timeline.map((w, i) => {
          const isCurrent = i === timeline.length - 1;
          return (
            <div key={w.key} style={{ display: "grid", placeItems: "center", position: "relative" }}>
              <div style={{
                width: isCurrent ? 8 : 6, height: isCurrent ? 8 : 6, borderRadius: 4,
                background: isCurrent ? t.accent : t.border,
                boxShadow: isCurrent ? `0 0 6px ${t.accentGlow}` : "none",
              }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ════════════════════════════ MONTH STATS ════════════════════════════
function MonthStatsCard({ t, stats }: { t: any; stats: DashboardPayload["monthStats"] }) {
  const items = [
    { icon: <CalendarIcon color={t.accent} size={20} />, label: "TRAINING DAYS",  value: stats.trainingDays.toString(),  sub: "This month" },
    { icon: <DumbbellIcon color={t.accent} size={20} />, label: "TOTAL WORKOUTS", value: stats.totalWorkouts.toString(), sub: "This month" },
  ];
  return (
    <div style={{ padding: "12px 14px 0" }}>
      <div style={{
        background: t.bgElevated, border: `1px solid ${t.border}`, borderRadius: 16,
        padding: "16px 8px",
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4,
      }}>
        {items.map((it, i) => (
          <div key={i} style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
            borderRight: i < items.length - 1 ? `1px solid ${t.border}` : "none",
            padding: "0 8px",
          }}>
            {it.icon}
            <div style={{ fontSize: 10, color: t.textMuted, letterSpacing: 0.6, fontWeight: 600, textAlign: "center" }}>{it.label}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: t.text, lineHeight: 1 }}>{it.value}</div>
            <div style={{ fontSize: 10, color: t.textMuted }}>{it.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ════════════════════════════ BOTTOM NAV ════════════════════════════
function BottomNav({ t, onOpenFeed, onOpenSquad, onOpenLogWorkout, onOpenProgress, onOpenProfile }: {
  t: any; onOpenFeed: () => void; onOpenSquad: () => void; onOpenLogWorkout: () => void;
  onOpenProgress?: () => void; onOpenProfile: () => void;
}) {
  return (
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
        <NavBtn t={t} label="Home"     onClick={onOpenFeed}                icon={<HomeIcon     color={t.accent} />}     active={true} />
        <NavBtn t={t} label="Squad"    onClick={onOpenSquad}               icon={<SquadIcon    color={t.textMuted} />} active={false} />
        <button
          onClick={onOpenLogWorkout}
          aria-label="Log workout"
          style={{
            width: 60, height: 60, borderRadius: 30, border: "none",
            background: `linear-gradient(135deg, ${t.gradientFrom}, ${t.gradientTo})`,
            color: t.accentText, fontSize: 30, fontWeight: 700, lineHeight: 1,
            boxShadow: `0 12px 36px ${t.accentGlow}`, cursor: "pointer",
            display: "grid", placeItems: "center", marginTop: -18,
          }}
        >+</button>
        <NavBtn t={t} label="Progress" onClick={() => onOpenProgress?.()} icon={<ChartIcon    color={t.textMuted} />} active={false} />
        <NavBtn t={t} label="Profile"  onClick={onOpenProfile}             icon={<ProfileIcon  color={t.textMuted} />} active={false} />
      </div>
    </nav>
  );
}

function NavBtn({ t, label, onClick, icon, active }: { t: any; label: string; onClick: () => void; icon: React.ReactNode; active: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "transparent", border: "none", cursor: "pointer",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
        color: active ? t.accent : t.textMuted, padding: "6px 10px",
        minWidth: 56,
      }}
    >
      {icon}
      <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.4 }}>{label}</span>
    </button>
  );
}

// ════════════════════════════ UTILS ════════════════════════════
function fmtAgo(min: number) {
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ════════════════════════════ ICONS ════════════════════════════
function BellIcon({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M6 8a6 6 0 0 1 12 0v4l1.5 3h-15L6 12V8z" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M10 18a2 2 0 0 0 4 0" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function ProfileIcon({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="3.5" stroke={color} strokeWidth="1.6" />
      <path d="M4 20c0-3.5 3.5-6.5 8-6.5s8 3 8 6.5" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function CalendarIcon({ color, size = 16 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="5" width="18" height="16" rx="2" stroke={color} strokeWidth="1.6" />
      <path d="M3 9h18M8 3v4M16 3v4" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function BoltIcon({ color, size = 14 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" />
    </svg>
  );
}
function DumbbellIcon({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="9" width="3" height="6" rx="1" stroke={color} strokeWidth="1.6" />
      <rect x="19" y="9" width="3" height="6" rx="1" stroke={color} strokeWidth="1.6" />
      <path d="M5 12h2M17 12h2M7 10h10v4H7z" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}
function FlameIcon({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 3s4 4 4 8a4 4 0 0 1-8 0c0-1.5.5-2.5 1-3 0 2 1 3 2 3 0-2-1-3-1-5 0-2 2-3 2-3z" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}
function ChartIcon({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H4" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function SparkleIcon({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}
function HomeIcon({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-9z" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}
function SquadIcon({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="9" cy="8" r="3" stroke={color} strokeWidth="1.8" />
      <circle cx="17" cy="9" r="2.5" stroke={color} strokeWidth="1.8" />
      <path d="M3 19c0-3 2.7-5.5 6-5.5s6 2.5 6 5.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M14 19c0-2.2 1.8-4 4-4s4 1.8 4 4" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
