import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "@/lib/ThemeProvider";
import { getQueryFn, getUserEmail, queryClient } from "@/lib/queryClient";
import { pushFeedEvent, getFeed, minutesAgo, type LocalFeedEvent } from "@/lib/feed";
import { Capacitor } from "@capacitor/core";

// Native iOS must hit the absolute origin — a bare '/api/...' resolves to
// capacitor://localhost and silently 404s. Mirrors App.tsx / Profile.tsx.
const SQUAD_API_BASE = Capacitor.isNativePlatform() ? "https://www.flexinfitapp.com" : "";
import flexinLogo from "@/assets/flexin_logo.png";
import maxMale from "@/assets/max_male.png";
import maxFemale from "@/assets/max_female.png";

// ── Types matching /api/squad response ─────────────────────────────────────
interface SquadActivityItem {
  id: number;
  member: string;
  kind: "workout" | "pr" | "progress" | "live" | "ghost";
  text: string;
  highlight: string;
  time: string;
  reactionIcon: "fire" | "clap" | "eyes" | "ghost";
  reactionCount: number;
  weight?: string;
  weightDelta?: string;
  weekScan?: string;
  lastLifted?: string;
}

interface SquadMember {
  name: string;
  initials: string;
  bg: string;
  avatarUrl?: string | null;
  lastActiveAgo?: string;
}

interface SquadPayload {
  squad: {
    id: number; name: string; memberCount: number; streakDays: number;
    energy: { percent: number; message: string; trend: number[]; direction: "up" | "down" };
    members: SquadMember[];
  };
  coach: { name: string; sex: "male" | "female"; message: string; cta: string };
  activity: SquadActivityItem[];
  reactions: string[];
  aiInsight: { message: string; cta: string; inactiveMembers: { name: string; lastLifted: string; energyImpact: number }[] };
  ghostMode: { members: { name: string; lastLifted: string; energyImpact: number }[]; message: string; cta: string };
  mvp: { name: string; workouts: number; prs: number; evolutionDelta: number };
  unreadNotifications: number;
}

interface SquadProps {
  onBack?: () => void;
  onOpenFeed: () => void;
  onOpenSquad: () => void;
  onOpenLogWorkout: () => void;
  onOpenProgress?: () => void;
  onOpenProfile: () => void;
}

export function Squad({ onOpenFeed, onOpenSquad, onOpenLogWorkout, onOpenProgress, onOpenProfile }: SquadProps) {
  const t = useTheme();
  const isFemale = t.name === "pink";
  const maxAvatar = isFemale ? maxFemale : maxMale;

  // Modal state: which energy picker is open.
  // "send"   = bottom-of-Live-Activity "Send energy" picker (member targets).
  // "invite" = members-box "+" invite sheet.
  const [modal, setModal] = useState<null | "send" | "invite">(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  // Local reaction counts — ticked up when the user taps a pill so they
  // get instant feedback. Resets on remount; backend sync TBD.
  const [reactionCounts, setReactionCounts] = useState<Record<string, number>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [showReactionMore, setShowReactionMore] = useState(false);

  // ── Multi-squad state ─────────────────────────────────────────────────────
  // Squads are tracked client-side keyed by user email. First-time users get
  // a "Name your squad" modal; afterwards they can switch between or create
  // additional squads from the header switcher.
  const squadsKey = `flexin.squads:${getUserEmail() || "anon"}`;
  const activeSquadKey = `flexin.activeSquad:${getUserEmail() || "anon"}`;
  const [squadList, setSquadList] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(squadsKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [];
  });
  const [activeSquadName, setActiveSquadName] = useState<string>(() => {
    try { return localStorage.getItem(activeSquadKey) || ""; } catch { return ""; }
  });
  const [showNameSquadModal, setShowNameSquadModal] = useState(false);
  const [showSquadSwitcher, setShowSquadSwitcher] = useState(false);
  const [newSquadName, setNewSquadName] = useState("");
  const [isCreatingAdditional, setIsCreatingAdditional] = useState(false);

  // Open name-your-squad modal on first visit when no squads exist yet.
  useEffect(() => {
    if (squadList.length === 0) {
      setShowNameSquadModal(true);
      setIsCreatingAdditional(false);
    }
  }, [squadList.length]);

  function persistSquads(list: string[], active: string) {
    try { localStorage.setItem(squadsKey, JSON.stringify(list)); } catch {}
    try { localStorage.setItem(activeSquadKey, active); } catch {}
  }

  function saveNewSquad() {
    const name = newSquadName.trim();
    if (!name) return;
    const isNew = !squadList.includes(name);
    const next = isNew ? [...squadList, name] : squadList;
    setSquadList(next);
    setActiveSquadName(name);
    persistSquads(next, name);
    setNewSquadName("");
    setShowNameSquadModal(false);
    setIsCreatingAdditional(false);
    // Seed the Home "Squad Feed" card so the user immediately sees activity
    // when they land back on the dashboard. Without this the feed card on
    // Home stays blank until something else (workout, scan) logs an event.
    if (isNew) {
      const email = getUserEmail() || "anon";
      const userLabel = (squad?.members?.[0]?.name as string | undefined) || "You";
      pushFeedEvent(email, {
        userName: userLabel,
        message: `started a new squad — ${name}`,
        kind: "squad_created",
      });
      // Refresh the dashboard so the new feed entry shows on Home next time.
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
    }
  }

  function switchSquad(name: string) {
    setActiveSquadName(name);
    persistSquads(squadList, name);
    setShowSquadSwitcher(false);
  }

  // The right-hand reaction strip broadcasts to the WHOLE squad's live
  // activity — not a single member. We bump the local count, fire a server
  // event, and push it into the local feed so it surfaces on Home + Squad.
  function bumpReaction(emoji: string) {
    setReactionCounts((prev) => ({ ...prev, [emoji]: (prev[emoji] || 0) + 1 }));
    setToast(`${emoji} sent to the squad`);
    window.setTimeout(() => setToast((cur) => (cur === `${emoji} sent to the squad` ? null : cur)), 1400);
    try {
      const email = getUserEmail() || "anon";
      pushFeedEvent(email, {
        userName: "You",
        message: `sent ${emoji} to the squad`,
        kind: "live",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
    } catch {}
    // Fire-and-forget to backend so the broadcast can fan out server-side
    // (group notification) once that endpoint is wired.
    try {
      fetch(`${SQUAD_API_BASE}/api/squad/react`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-email": getUserEmail() || "" },
        body: JSON.stringify({ kind: emoji, target: "__squad__" }),
      }).catch(() => {});
    } catch {}
  }

  // "Flex" button on YOUR OWN activity row — notifies the whole squad that
  // you just hit a lift. Pushes to local feed (so it shows in Home + Squad)
  // and pings the server to fan out a notification.
  function broadcastFlex(activityText: string) {
    setToast("💪 Flex sent to the squad");
    window.setTimeout(() => setToast((cur) => (cur === "💪 Flex sent to the squad" ? null : cur)), 1500);
    try {
      const email = getUserEmail() || "anon";
      pushFeedEvent(email, {
        userName: "You",
        message: `flexed on the squad — ${activityText}`,
        kind: "pr",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
    } catch {}
    try {
      fetch(`${SQUAD_API_BASE}/api/squad/flex`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-email": getUserEmail() || "" },
        body: JSON.stringify({ message: activityText }),
      }).catch(() => {});
    } catch {}
  }

  const { data, isLoading } = useQuery<SquadPayload>({
    queryKey: ["/api/squad"],
    queryFn: getQueryFn({ on401: "throw" }),
    staleTime: 30_000,
  });

  if (isLoading || !data) {
    return (
      <div style={{ minHeight: "100vh", background: t.bg, color: t.text, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: t.textMuted, fontSize: 14 }}>Loading…</div>
      </div>
    );
  }

  const { squad, coach, activity: serverActivity, reactions, aiInsight, ghostMode, mvp, unreadNotifications } = data;
  const memberByName = (name: string): SquadMember =>
    squad.members.find((m) => m.name === name) || { name, initials: name.slice(0, 1).toUpperCase(), bg: t.accent };

  // ── Live Activity is the SAME feed as the Home dashboard SQUAD FEED card.
  // We merge any local feed events (squad creation, workout logs) into the
  // server's activity list, mapping each LocalFeedEvent shape to a
  // SquadActivityItem so the row renderer is identical. Local events show
  // first so a fresh workout shows up here instantly, exactly like on Home.
  const localFeed: LocalFeedEvent[] = (() => {
    try { return getFeed(getUserEmail() || "anon"); } catch { return []; }
  })();
  const mappedLocal: SquadActivityItem[] = localFeed.map((e) => {
    const mins = minutesAgo(e.createdAt);
    const timeStr =
      mins < 1 ? "just now" :
      mins < 60 ? `${mins}m ago` :
      mins < 60 * 24 ? `${Math.round(mins / 60)}h ago` :
      `${Math.round(mins / (60 * 24))}d ago`;
    // Map our LocalFeedEvent.kind onto Squad activity kinds + reaction icons.
    const k: SquadActivityItem["kind"] =
      e.kind === "workout" ? "workout" :
      e.kind === "pr" ? "pr" :
      e.kind === "progress" ? "progress" :
      "live";
    const reactionIcon: SquadActivityItem["reactionIcon"] =
      e.kind === "pr" ? "clap" : e.kind === "progress" ? "eyes" : "fire";
    return {
      id: typeof e.id === "number" ? e.id : Math.abs(e.id.toString().split("").reduce((a, c) => a + c.charCodeAt(0), 0)),
      member: e.userName || "You",
      kind: k,
      text: e.message,
      highlight: "",
      time: timeStr,
      reactionIcon,
      reactionCount: 0,
    };
  });
  const activity: SquadActivityItem[] = [...mappedLocal, ...serverActivity];

  return (
    <div style={{ minHeight: "100vh", background: t.bg, color: t.text, paddingBottom: 110, overflowX: "hidden" }}>
      {/* ═════════════════════ HEADER ═════════════════════ */}
      <header style={{ padding: "18px 18px 4px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <img src={flexinLogo} alt="flexin" style={{ height: 28, width: "auto", objectFit: "contain" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button
            aria-label="Notifications"
            style={{ position: "relative", background: "transparent", border: "none", padding: 4, cursor: "pointer", color: t.text }}
          >
            <BellIcon color={t.text} size={22} />
            {unreadNotifications > 0 && (
              <span style={{
                position: "absolute", top: -2, right: -4, minWidth: 18, height: 18, borderRadius: 9,
                background: t.accent, color: t.accentText, fontSize: 10, fontWeight: 700,
                display: "grid", placeItems: "center", padding: "0 5px",
              }}>{unreadNotifications}</span>
            )}
          </button>
          <button
            aria-label="Invite friends"
            onClick={() => setModal("invite")}
            data-testid="squad-header-invite"
            style={{ background: "transparent", border: "none", padding: 4, cursor: "pointer", color: t.text }}
          >
            <AddPersonIcon color={t.text} size={22} />
          </button>
        </div>
      </header>

      {/* ═════════════════════ TITLE ROW ═════════════════════ */}
      <section style={{ padding: "12px 18px 0", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <button
            onClick={() => setShowSquadSwitcher(true)}
            data-testid="squad-name-switcher"
            style={{
              background: "transparent", border: "none", padding: 0, margin: 0,
              color: t.text, cursor: "pointer", textAlign: "left",
              display: "flex", alignItems: "center", gap: 8,
              fontSize: 26, fontWeight: 800, letterSpacing: 0.6,
            }}
          >
            <span>{activeSquadName || squad.name}</span>
            <BoltIcon color={t.accent} size={20} />
            <span style={{ color: t.textMuted, fontSize: 18, marginLeft: 2 }}>▾</span>
          </button>
          <div style={{ marginTop: 6, fontSize: 13, color: t.textMuted, display: "flex", alignItems: "center", gap: 8 }}>
            <FlameIcon color={t.accent} size={14} />
            <span>{squad.memberCount} members • {squad.streakDays} day streak</span>
          </div>
        </div>
      </section>

      {/* ═════════════════════ SQUAD ENERGY ═════════════════════ */}
      <section style={{ padding: "16px 18px 0" }}>
        <Card t={t}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ flex: "0 0 auto", minWidth: 0, width: 130 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.4, color: t.text, display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}>
                SQUAD ENERGY <BoltIcon color={t.accent} size={11} />
              </div>
              <div style={{ marginTop: 4, fontSize: 42, fontWeight: 800, color: t.accent, lineHeight: 1, letterSpacing: -1 }}>
                {squad.energy.percent}<span style={{ fontSize: 22, fontWeight: 700 }}>%</span>
              </div>
              <div style={{ marginTop: 4, fontSize: 11, color: t.textMuted, lineHeight: 1.3 }}>{squad.energy.message}</div>
            </div>
            <div style={{ flex: 1, height: 60, minWidth: 0 }}>
              <Sparkline points={squad.energy.trend} color={t.accent} glow={t.accentGlow} />
            </div>
            <TrendBadge t={t} direction={squad.energy.direction} />
          </div>
        </Card>
      </section>

      {/* ═════════════════════ MAX AI COACH ═════════════════════ */}
      <section style={{ padding: "12px 18px 0" }}>
        <Card t={t}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 78, height: 78, borderRadius: 39, overflow: "hidden", flexShrink: 0,
              border: `2px solid ${t.accent}`, boxShadow: `0 0 18px ${t.accentGlow}`,
              background: t.bgElevated,
            }}>
              <img src={maxAvatar} alt="MAX AI Coach" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ color: t.accent, fontSize: 12, fontWeight: 800, letterSpacing: 1.2 }}>MAX AI COACH</span>
                <span style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: 0.8,
                  color: t.accent, border: `1px solid ${t.accent}`,
                  borderRadius: 4, padding: "1px 5px",
                }}>AI</span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: t.text, lineHeight: 1.3 }}>
                {coach.message.split(".")[0]}.
              </div>
              <div style={{ fontSize: 12, color: t.textMuted, marginTop: 4, lineHeight: 1.4 }}>
                {coach.message.split(".").slice(1).join(".").trim()}
              </div>
            </div>
          </div>
          <button
            onClick={() => setModal("invite")}
            data-testid="squad-coach-invite"
            style={{
              marginTop: 12, width: "100%",
              background: `linear-gradient(135deg, ${t.gradientFrom}, ${t.gradientTo})`,
              color: t.accentText, border: "none", borderRadius: 24,
              padding: "12px 18px", fontSize: 14, fontWeight: 800, letterSpacing: 1.2,
              boxShadow: `0 8px 24px ${t.accentGlow}`, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            <FlameIcon color={t.accentText} size={16} />
            {coach.cta}
          </button>
        </Card>
      </section>

      {/* ═════════════════════ LIVE ACTIVITY ═════════════════════ */}
      <section style={{ padding: "16px 18px 0" }}>
        <Card t={t}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.5, color: t.text }}>LIVE ACTIVITY</span>
              <span style={{
                fontSize: 9, fontWeight: 800, letterSpacing: 1,
                color: t.accent, border: `1px solid ${t.accent}`,
                borderRadius: 4, padding: "2px 6px",
              }}>LIVE</span>
            </div>
            <button style={{ background: "transparent", border: "none", color: t.textMuted, fontSize: 12, cursor: "pointer" }}>
              View all
            </button>
          </div>

          {activity.map((a) => (
            <ActivityRow
              key={a.id}
              t={t}
              item={a}
              member={memberByName(a.member)}
              isSelf={a.member === "You"}
              onFlex={() => broadcastFlex(a.text || "a new lift")}
            />
          ))}

          {/* Reactions strip */}
          <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 6 }}>
            <button
              onClick={() => { setSentTo(null); setModal("send"); }}
              style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                background: "transparent", color: t.accent, border: `1px solid ${t.accent}40`,
                borderRadius: 18, padding: "9px 8px", fontSize: 11, fontWeight: 700, cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              <BoltIcon color={t.accent} size={13} />
              Send energy
            </button>
            <ReactionPill t={t} emoji="🔥" onTap={() => bumpReaction("🔥")} count={reactionCounts["🔥"] || 0} />
            <ReactionPill t={t} emoji="💪" onTap={() => bumpReaction("💪")} count={reactionCounts["💪"] || 0} />
            <ReactionPill t={t} emoji="⚡" onTap={() => bumpReaction("⚡")} count={reactionCounts["⚡"] || 0} />
            <ReactionPill t={t} emoji="🐀" onTap={() => bumpReaction("🐀")} count={reactionCounts["🐀"] || 0} />
            <ReactionPill t={t} emoji="•••" onTap={() => setShowReactionMore(true)} count={0} />
          </div>
        </Card>
      </section>

      {/* ═════════════════════ MAX AI INSIGHT ═════════════════════ */}
      <section style={{ padding: "12px 18px 0" }}>
        <Card t={t}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <SwordsIcon color={t.accent} size={18} />
            <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.5, color: t.text }}>MAX AI INSIGHT</span>
            <span style={{
              fontSize: 9, fontWeight: 800, letterSpacing: 1,
              color: t.accent, border: `1px solid ${t.accent}`,
              borderRadius: 4, padding: "2px 6px",
            }}>NEW</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: t.text, lineHeight: 1.3 }}>2 members inactive.</div>
              <div style={{ fontSize: 11, color: t.textMuted, marginTop: 3, lineHeight: 1.4 }}>Squad energy could drop if no one steps up.</div>
            </div>
            <div style={{ display: "flex", flexShrink: 0 }}>
              {aiInsight.inactiveMembers.slice(0, 2).map((m, i) => (
                <div key={m.name} style={{
                  marginLeft: i === 0 ? 0 : -10,
                  borderRadius: 16,
                  border: `2px solid ${t.accent}`, boxShadow: `0 0 8px ${t.accentGlow}`,
                  overflow: "hidden",
                }}>
                  <Avatar member={memberByName(m.name)} size={28} t={t} ringless />
                </div>
              ))}
            </div>
          </div>
          <button style={{
            marginTop: 10, width: "100%",
            background: "transparent", color: t.accent,
            border: `1px solid ${t.accent}50`,
            borderRadius: 18, padding: "9px 12px", fontSize: 11, fontWeight: 800, letterSpacing: 1,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer",
          }}>
            <BoltIcon color={t.accent} size={12} />
            MOTIVATE THEM
          </button>
        </Card>
      </section>

      {/* ═════════════════════ GHOST MODE ═════════════════════ */}
      <section style={{ padding: "12px 18px 0" }}>
        <Card t={t}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <GhostIcon color={t.accent} size={18} />
              <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.5, color: t.text }}>GHOST MODE</span>
            </div>
            <button style={{ background: "transparent", border: "none", color: t.textMuted, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
              {ghostMode.members.length} members
              <span style={{ fontSize: 14 }}>›</span>
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {ghostMode.members.map((m) => {
              const mp = memberByName(m.name);
              return (
                <div key={m.name} style={{
                  background: t.bgInput, borderRadius: 12, padding: 8,
                  display: "flex", alignItems: "center", gap: 8, minWidth: 0,
                }}>
                  <div style={{ opacity: 0.6, flexShrink: 0 }}>
                    <Avatar member={mp} size={32} t={t} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: t.text, display: "flex", alignItems: "center", gap: 3, whiteSpace: "nowrap" }}>
                      {m.name}
                      <span style={{ fontSize: 11 }}>👻</span>
                    </div>
                    <div style={{ fontSize: 9, color: t.textDim, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Last lifted {m.lastLifted}</div>
                    <div style={{ fontSize: 9, color: t.accent, marginTop: 2, whiteSpace: "nowrap" }}>Squad energy {m.energyImpact}%</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{
            marginTop: 10, border: `1px solid ${t.accent}30`, borderRadius: 14,
            padding: "10px 12px",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: t.accent, fontSize: 11, fontWeight: 700, lineHeight: 1.3, flex: 1, minWidth: 0 }}>
              <BoltIcon color={t.accent} size={13} />
              <span>Bring them back. Squad needs you!</span>
            </div>
            <button style={{
              background: "transparent", color: t.accent,
              border: `1px solid ${t.accent}80`,
              borderRadius: 16, padding: "7px 10px", fontSize: 10, fontWeight: 800, letterSpacing: 0.5,
              cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
            }}>
              {ghostMode.cta}
            </button>
          </div>
        </Card>
      </section>

      {/* ═════════════════════ MEMBERS ═════════════════════ */}
      <section style={{ padding: "12px 18px 0" }}>
        <Card t={t}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <SquadIcon color={t.accent} size={18} />
              <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.5, color: t.text }}>MEMBERS</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: t.textMuted }}>{squad.members.length}</span>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, justifyItems: "center" }}>
            {squad.members.map((m) => (
              <div key={m.name} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 0, width: "100%" }}>
                <Avatar member={m} size={56} t={t} />
                <div style={{
                  fontSize: 11, fontWeight: 700, color: t.text,
                  maxWidth: "100%", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textAlign: "center",
                }}>{m.name}</div>
              </div>
            ))}
            {/* + Invite tile */}
            <button
              onClick={() => setModal("invite")}
              aria-label="Invite member"
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                background: "transparent", border: "none", padding: 0, cursor: "pointer", width: "100%",
              }}
            >
              <div style={{
                width: 56, height: 56, borderRadius: 28,
                border: `2px dashed ${t.accent}80`, background: "transparent",
                display: "grid", placeItems: "center",
                color: t.accent, fontSize: 28, fontWeight: 300, lineHeight: 1,
              }}>+</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: t.accent }}>Invite</div>
            </button>
          </div>
        </Card>
      </section>

      {/* ═════════════════════ WEEKLY MVP ═════════════════════ */}
      <section style={{ padding: "12px 18px 0" }}>
        <Card t={t}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 16 }}>👑</span>
            <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.5, color: t.text }}>WEEKLY MVP</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {/* MVP avatar with crown */}
            <div style={{ position: "relative", flexShrink: 0 }}>
              <div style={{
                width: 80, height: 80, borderRadius: 40,
                border: `3px solid ${t.accent}`, boxShadow: `0 0 20px ${t.accentGlow}`,
                overflow: "hidden",
              }}>
                <Avatar member={memberByName(mvp.name)} size={74} t={t} ringless big />
              </div>
              <span style={{ position: "absolute", top: -16, left: "50%", transform: "translateX(-50%)", fontSize: 28 }}>👑</span>
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: t.text, display: "flex", alignItems: "center", gap: 6 }}>
                {mvp.name} <span style={{ fontSize: 16 }}>👑</span>
              </div>
              <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>Leading the squad this week!</div>

              <div style={{ marginTop: 10, display: "flex", gap: 12 }}>
                <Stat t={t} value={String(mvp.workouts)} label="WORKOUTS" />
                <Stat t={t} value={String(mvp.prs)} label="PRs" />
                <Stat t={t} value={`+${mvp.evolutionDelta}%`} label="EVOLUTION" />
              </div>
            </div>

            <TrophyIcon color={t.accent} glow={t.accentGlow} size={64} />
          </div>
        </Card>
      </section>

      {/* ═════════════════════ MODALS ═════════════════════ */}
      {modal === "send" && (
        <SendEnergyModal
          t={t}
          members={squad.members}
          activity={activity}
          sentTo={sentTo}
          onPick={async (memberName, emoji) => {
            setSentTo(`${emoji} → ${memberName}`);
            // fire-and-forget reaction so the no-op endpoint still gets a hit
            try {
              await fetch(`${SQUAD_API_BASE}/api/squad/react`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ kind: emoji, target: memberName }),
              });
            } catch {}
            setTimeout(() => { setModal(null); setSentTo(null); }, 1100);
          }}
          onClose={() => { setModal(null); setSentTo(null); }}
        />
      )}
      {modal === "invite" && (
        <InviteModal t={t} squadName={squad.name} onClose={() => setModal(null)} />
      )}

      {/* Reaction "more" picker — simple emoji grid */}
      {showReactionMore && (
        <div
          onClick={() => setShowReactionMore(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
            display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 60,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: t.bgElevated, color: t.text, width: "100%", maxWidth: 480,
              borderTopLeftRadius: 22, borderTopRightRadius: 22,
              padding: "18px 18px max(18px, env(safe-area-inset-bottom))",
              border: `1px solid ${t.border}`,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.5, color: t.textMuted, marginBottom: 10 }}>MORE REACTIONS</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8 }}>
              {["👏", "🙌", "😤", "👀", "🤯", "💀", "🚈", "✨", "🎯", "🏆", "❄️", "🚀"].map((e) => (
                <button
                  key={e}
                  onClick={() => { bumpReaction(e); setShowReactionMore(false); }}
                  style={{
                    aspectRatio: "1", borderRadius: 12, fontSize: 22,
                    background: t.bgInput, border: `1px solid ${t.border}`,
                    color: t.text, cursor: "pointer",
                  }}
                >{e}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Floating toast for reactions */}
      {toast && (
        <div
          aria-live="polite"
          style={{
            position: "fixed", left: "50%", bottom: 110, transform: "translateX(-50%)",
            background: t.bgElevated, color: t.text, border: `1px solid ${t.border}`,
            borderRadius: 999, padding: "8px 16px", fontSize: 13, fontWeight: 700,
            boxShadow: `0 8px 24px rgba(0,0,0,0.35)`, zIndex: 70,
            pointerEvents: "none",
          }}
        >{toast}</div>
      )}

      {/* ═════════════════════ NAME YOUR SQUAD MODAL ═════════════════════ */}
      {showNameSquadModal && (
        <div
          onClick={() => { if (squadList.length > 0) setShowNameSquadModal(false); }}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.78)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 80, padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%", maxWidth: 380,
              background: t.bgElevated, color: t.text,
              border: `1px solid ${t.border}`, borderRadius: 20,
              padding: 22, boxShadow: `0 16px 48px rgba(0,0,0,0.5)`,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <BoltIcon color={t.accent} size={20} />
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: t.text }}>
                {isCreatingAdditional ? "Create new squad" : "Name your squad"}
              </h2>
            </div>
            <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 14, lineHeight: 1.4 }}>
              {isCreatingAdditional
                ? "Give your new crew a name. You can switch between squads anytime."
                : "What do you want to call your crew? You can rename or add more squads later."}
            </div>
            <input
              type="text"
              autoFocus
              value={newSquadName}
              onChange={(e) => setNewSquadName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") saveNewSquad(); }}
              placeholder="e.g. Iron Bros, Glute Goals, The Bench Squad"
              maxLength={32}
              data-testid="squad-name-input"
              style={{
                width: "100%", boxSizing: "border-box",
                background: t.bgInput, color: t.text,
                border: `1px solid ${t.border}`, borderRadius: 12,
                padding: "12px 14px", fontSize: 15, fontWeight: 600,
                outline: "none", marginBottom: 14,
              }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              {isCreatingAdditional && squadList.length > 0 && (
                <button
                  onClick={() => { setShowNameSquadModal(false); setNewSquadName(""); setIsCreatingAdditional(false); }}
                  style={{
                    flex: 1, padding: "12px 14px", borderRadius: 14,
                    background: "transparent", color: t.text,
                    border: `1px solid ${t.border}`,
                    fontSize: 14, fontWeight: 700, cursor: "pointer",
                  }}
                >Cancel</button>
              )}
              <button
                onClick={saveNewSquad}
                disabled={!newSquadName.trim()}
                data-testid="squad-name-save"
                style={{
                  flex: 2, padding: "12px 14px", borderRadius: 14,
                  background: newSquadName.trim()
                    ? `linear-gradient(135deg, ${t.gradientFrom}, ${t.gradientTo})`
                    : t.bgInput,
                  color: newSquadName.trim() ? t.accentText : t.textMuted,
                  border: "none",
                  fontSize: 14, fontWeight: 800, letterSpacing: 1, cursor: newSquadName.trim() ? "pointer" : "default",
                  boxShadow: newSquadName.trim() ? `0 8px 24px ${t.accentGlow}` : "none",
                }}
              >
                {isCreatingAdditional ? "CREATE SQUAD" : "CREATE"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════ SQUAD SWITCHER ═════════════════════ */}
      {showSquadSwitcher && (
        <div
          onClick={() => setShowSquadSwitcher(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
            display: "flex", alignItems: "flex-end", justifyContent: "center",
            zIndex: 70,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: t.bgElevated, color: t.text, width: "100%", maxWidth: 480,
              borderTopLeftRadius: 22, borderTopRightRadius: 22,
              padding: "18px 18px max(18px, env(safe-area-inset-bottom))",
              border: `1px solid ${t.border}`,
            }}
          >
            <div style={{ width: 40, height: 4, background: t.border, borderRadius: 2, margin: "0 auto 14px" }} />
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.5, color: t.textMuted, marginBottom: 12 }}>
              YOUR SQUADS
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
              {squadList.map((name) => {
                const isActive = name === activeSquadName;
                return (
                  <button
                    key={name}
                    onClick={() => switchSquad(name)}
                    data-testid={`squad-switcher-${name}`}
                    style={{
                      width: "100%", textAlign: "left",
                      background: isActive ? `${t.accent}18` : t.bgInput,
                      color: t.text,
                      border: `1px solid ${isActive ? t.accent : t.border}`,
                      borderRadius: 14, padding: "12px 14px",
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      fontSize: 15, fontWeight: 700, cursor: "pointer",
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <BoltIcon color={isActive ? t.accent : t.textMuted} size={16} />
                      {name}
                    </span>
                    {isActive && (
                      <span style={{ color: t.accent, fontSize: 11, fontWeight: 800, letterSpacing: 1 }}>ACTIVE</span>
                    )}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => {
                setShowSquadSwitcher(false);
                setIsCreatingAdditional(true);
                setNewSquadName("");
                setShowNameSquadModal(true);
              }}
              data-testid="squad-switcher-create"
              style={{
                width: "100%",
                background: `linear-gradient(135deg, ${t.gradientFrom}, ${t.gradientTo})`,
                color: t.accentText, border: "none", borderRadius: 16,
                padding: "12px 14px", fontSize: 14, fontWeight: 800, letterSpacing: 1,
                cursor: "pointer", boxShadow: `0 8px 24px ${t.accentGlow}`,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              + CREATE NEW SQUAD
            </button>
          </div>
        </div>
      )}

      {/* ═════════════════════ BOTTOM NAV ═════════════════════ */}
      <BottomNav
        t={t}
        active="squad"
        onOpenFeed={onOpenFeed}
        onOpenSquad={onOpenSquad}
        onOpenLogWorkout={onOpenLogWorkout}
        onOpenProgress={onOpenProgress}
        onOpenProfile={onOpenProfile}
      />
    </div>
  );
}

// ═══════════════════════════════ COMPONENTS ═══════════════════════════════

// Avatar: shows the user's uploaded photo if available, otherwise falls back
// to a tinted circle with their initials. Profile-picture uploads happen on
// the Profile/Settings screen (next milestone) — once a user has uploaded
// one, the backend will start returning a non-null avatarUrl and this
// component will display it automatically with no UI change here.
function Avatar({ member, size, t, ringless = false, big = false }: {
  member: SquadMember; size: number; t: any; ringless?: boolean; big?: boolean;
}) {
  const hasPhoto = !!member.avatarUrl;
  const fontSize = big ? Math.round(size * 0.42) : Math.max(11, Math.round(size * 0.42));
  const common: React.CSSProperties = {
    width: size, height: size, borderRadius: size / 2,
    flexShrink: 0, overflow: "hidden",
    display: "grid", placeItems: "center",
  };
  if (hasPhoto) {
    return (
      <div style={{ ...common, background: t.bgElevated }}>
        <img
          src={member.avatarUrl as string}
          alt={member.name}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>
    );
  }
  return (
    <div style={{
      ...common,
      background: member.bg, color: "#fff",
      fontWeight: 800, fontSize,
      ...(ringless ? {} : {}),
    }}>{member.initials}</div>
  );
}

function Card({ t, children }: { t: any; children: React.ReactNode }) {
  return (
    <div style={{
      background: t.bgElevated, border: `1px solid ${t.border}`, borderRadius: 18,
      padding: 14,
    }}>{children}</div>
  );
}

function Stat({ t, value, label }: { t: any; value: string; label: string }) {
  return (
    <div>
      <div style={{ fontSize: 18, fontWeight: 800, color: t.accent, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: t.textMuted, marginTop: 3 }}>{label}</div>
    </div>
  );
}

function TrendBadge({ t, direction }: { t: any; direction: "up" | "down" }) {
  return (
    <div style={{
      width: 64, height: 64, borderRadius: 32, flexShrink: 0,
      border: `1.5px solid ${t.accent}80`,
      display: "grid", placeItems: "center",
      background: "transparent",
    }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
        <BoltIcon color={t.accent} size={20} />
        <div style={{ fontSize: 8, color: t.textMuted, letterSpacing: 1, fontWeight: 700 }}>TREND</div>
        <div style={{ fontSize: 10, color: t.accent, fontWeight: 800 }}>
          {direction === "up" ? "UP ↗" : "DOWN ↘"}
        </div>
      </div>
    </div>
  );
}

function Sparkline({ points, color, glow }: { points: number[]; color: string; glow: string }) {
  const w = 160, h = 60, pad = 4;
  const innerW = w - pad * 2, innerH = h - pad * 2;
  const path = points
    .map((p, i) => {
      const x = pad + (i / (points.length - 1)) * innerW;
      const y = pad + (1 - p) * innerH;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  const lastX = pad + innerW;
  const lastY = pad + (1 - points[points.length - 1]) * innerH;
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <defs>
        <filter id="sparkglow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path d={path} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" filter="url(#sparkglow)" />
      <circle cx={lastX} cy={lastY} r="3.5" fill={color} filter="url(#sparkglow)" />
      <circle cx={lastX} cy={lastY} r="6" fill="none" stroke={color} strokeOpacity="0.4" strokeWidth="1.2" />
    </svg>
  );
}

function ActivityRow({ t, item, member, isSelf, onFlex }: {
  t: any; item: SquadActivityItem; member: SquadMember;
  isSelf?: boolean; onFlex?: () => void;
}) {
  const icon = (() => {
    switch (item.kind) {
      case "workout":  return <DumbbellIcon color={t.accent} size={16} />;
      case "pr":       return <TrophyIcon color={t.accent} glow={t.accentGlow} size={18} compact />;
      case "progress": return <UpArrowIcon color={t.accent} size={16} />;
      case "live":     return <PlayIcon color={t.accent} size={16} />;
      case "ghost":    return <GhostIcon color={t.accent} size={16} />;
    }
  })();

  const reactionEmoji = (() => {
    switch (item.reactionIcon) {
      case "fire":  return "🔥";
      case "clap":  return "👏";
      case "eyes":  return "👀";
      case "ghost": return "💀";
    }
  })();

  return (
    <div style={{ padding: "8px 0", display: "flex", alignItems: "flex-start", gap: 10 }}>
      <Avatar member={member} size={34} t={t} />
      <div style={{ flexShrink: 0, marginTop: 6 }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: t.text, lineHeight: 1.35 }}>
          <span style={{ fontWeight: 800 }}>{item.member}</span>
          <span style={{ color: t.textMuted }}> {item.text.replace(item.highlight, "")}</span>
          <span style={{ color: t.accent, fontWeight: 700 }}>{item.highlight}</span>
        </div>
        {item.weight && (
          <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2, display: "flex", alignItems: "center", gap: 6 }}>
            {item.weight}
            <span style={{
              background: t.accent, color: t.accentText, fontSize: 9, fontWeight: 800,
              borderRadius: 4, padding: "2px 5px",
            }}>{item.weightDelta}</span>
          </div>
        )}
        {item.weekScan && (
          <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>
            Week Scan: <span style={{ color: t.accent, fontWeight: 700 }}>{item.weekScan}</span>
          </div>
        )}
        {item.kind === "live" && (
          <div style={{ fontSize: 11, color: t.accent, marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
            Live now <span style={{ width: 6, height: 6, borderRadius: 3, background: t.accent, display: "inline-block" }} />
          </div>
        )}
        {item.lastLifted && item.kind === "ghost" && (
          <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>Last lifted {item.lastLifted}</div>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
        <span style={{ fontSize: 11, color: t.textDim }}>{item.time}</span>
        {isSelf && (item.kind === "workout" || item.kind === "pr" || item.kind === "live") ? (
          <button
            onClick={(e) => { e.stopPropagation(); onFlex?.(); }}
            data-testid="flex-broadcast-button"
            style={{
              background: t.accent, color: t.accentText,
              border: "none", borderRadius: 12,
              padding: "4px 10px",
              display: "flex", alignItems: "center", gap: 4,
              fontSize: 11, fontWeight: 800, letterSpacing: 0.4,
              cursor: "pointer",
              boxShadow: `0 0 8px ${t.accentGlow}`,
            }}
            aria-label="Flex on the squad"
          >
            <span style={{ fontSize: 12 }}>💪</span>
            FLEX
          </button>
        ) : (
          <div style={{
            background: t.bgInput, border: `1px solid ${t.border}`,
            borderRadius: 12, padding: "3px 8px",
            display: "flex", alignItems: "center", gap: 4,
            fontSize: 11, color: t.text, fontWeight: 700,
          }}>
            <span>{reactionEmoji}</span>
            {item.reactionCount}
          </div>
        )}
      </div>
    </div>
  );
}

function ReactionPill({ t, emoji, onTap, count }: { t: any; emoji: string; onTap?: () => void; count?: number }) {
  return (
    <button
      onClick={onTap}
      data-testid={`reaction-${emoji}`}
      style={{
        width: 38, height: 38, borderRadius: 10,
        background: t.bgInput, border: `1px solid ${t.border}`,
        display: "grid", placeItems: "center", fontSize: 16, cursor: "pointer",
        color: t.text, padding: 0, position: "relative",
      }}
    >
      <span>{emoji}</span>
      {!!count && count > 0 && (
        <span style={{
          position: "absolute", top: -4, right: -4,
          minWidth: 16, height: 16, padding: "0 4px",
          borderRadius: 8, background: t.accent, color: t.accentText,
          fontSize: 9, fontWeight: 800, display: "grid", placeItems: "center",
        }}>{count}</span>
      )}
    </button>
  );
}

// =================== MODALS ===================
// Bottom-sheet style modal scrim used by Send-Energy and Invite.
function ModalScrim({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        background: "rgba(0,0,0,0.65)",
        backdropFilter: "blur(4px)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 480 }}>
        {children}
      </div>
    </div>
  );
}

// Full reaction palette — keep in sync with the strip + 'more' grid above.
const ALL_REACTIONS = ["🔥", "💪", "⚡", "👀", "👏", "🙌", "😤", "🤯", "💀", "✨", "🎯", "🏆", "❄️", "🚀"];

function SendEnergyModal({ t, members, activity, sentTo, onPick, onClose }: {
  t: any; members: SquadMember[]; activity: SquadActivityItem[]; sentTo: string | null;
  onPick: (name: string, emoji: string) => void; onClose: () => void;
}) {
  // Map each member to their most-recent activity row. Activity is already
  // newest-first (local feed + server combined), so the first match wins.
  const latestByMember = new Map<string, SquadActivityItem>();
  for (const a of activity) {
    if (!latestByMember.has(a.member)) latestByMember.set(a.member, a);
  }
  return (
    <ModalScrim onClose={onClose}>
      <div style={{
        background: t.bgElevated, borderTopLeftRadius: 24, borderTopRightRadius: 24,
        border: `1px solid ${t.border}`, borderBottom: "none",
        padding: 18, paddingBottom: "calc(env(safe-area-inset-bottom) + 18px)",
      }}>
        <div style={{ width: 40, height: 4, background: t.border, borderRadius: 2, margin: "0 auto 14px" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <BoltIcon color={t.accent} size={18} />
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: t.text }}>Send energy</h2>
        </div>
        <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 14 }}>
          Tap any reaction next to a member's latest activity.
        </div>

        {sentTo ? (
          <div style={{
            padding: "24px 16px", textAlign: "center",
            color: t.accent, fontSize: 18, fontWeight: 800,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}>
            <BoltIcon color={t.accent} size={20} />
            Energy sent {sentTo}!
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14, maxHeight: "58vh", overflowY: "auto" }}>
            {members.map((m) => {
              const latest = latestByMember.get(m.name);
              return (
                <div key={m.name} style={{
                  background: t.bgInput,
                  border: `1px solid ${t.border}`,
                  borderRadius: 16, padding: 12,
                  display: "flex", flexDirection: "column", gap: 10,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Avatar member={m} size={42} t={t} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: t.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {m.name}
                      </div>
                      <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {latest ? `${latest.text} · ${latest.time}` : (m.lastActiveAgo ? `Active ${m.lastActiveAgo}` : "No recent activity")}
                      </div>
                    </div>
                  </div>
                  <div style={{
                    display: "flex", gap: 6, overflowX: "auto",
                    paddingBottom: 2,
                    scrollbarWidth: "none",
                  } as any}>
                    {ALL_REACTIONS.map((e) => (
                      <button
                        key={e}
                        onClick={() => onPick(m.name, e)}
                        style={{
                          flex: "0 0 auto",
                          width: 38, height: 38, borderRadius: 19,
                          background: t.bgElevated, border: `1px solid ${t.border}`,
                          fontSize: 18, lineHeight: 1, cursor: "pointer",
                          display: "grid", placeItems: "center",
                          color: t.text,
                        }}
                      >{e}</button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <button
          onClick={onClose}
          style={{
            marginTop: 18, width: "100%",
            background: "transparent", color: t.textMuted,
            border: `1px solid ${t.border}`,
            borderRadius: 22, padding: "12px 16px", fontSize: 14, fontWeight: 600, cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
    </ModalScrim>
  );
}

function InviteModal({ t, squadName, onClose }: { t: any; squadName: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const inviteUrl = `https://www.flexinfitapp.com/join/FLEX-${(Math.random().toString(36).slice(2, 7) || "DEMO1").toUpperCase()}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }
  async function share() {
    if ((navigator as any).share) {
      try { await (navigator as any).share({ title: "Join my flexin squad", text: `Join ${squadName} on flexin.`, url: inviteUrl }); } catch {}
    } else {
      copy();
    }
  }

  return (
    <ModalScrim onClose={onClose}>
      <div style={{
        background: t.bgElevated, borderTopLeftRadius: 24, borderTopRightRadius: 24,
        border: `1px solid ${t.border}`, borderBottom: "none",
        padding: 18, paddingBottom: "calc(env(safe-area-inset-bottom) + 18px)",
      }}>
        <div style={{ width: 40, height: 4, background: t.border, borderRadius: 2, margin: "0 auto 14px" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <SquadIcon color={t.accent} size={20} />
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: t.text }}>Invite to {squadName}</h2>
        </div>
        <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 14 }}>
          Share this link. Whoever taps it joins your squad after they sign up.
        </div>

        <div style={{
          background: t.bgInput, border: `1px solid ${t.border}`,
          borderRadius: 12, padding: "12px 14px",
          fontSize: 13, color: t.text, fontFamily: "ui-monospace, monospace",
          wordBreak: "break-all",
        }}>{inviteUrl}</div>

        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <button
            onClick={copy}
            style={{
              flex: 1, background: "transparent", color: t.accent,
              border: `1px solid ${t.accent}80`,
              borderRadius: 22, padding: "12px 16px", fontSize: 13, fontWeight: 800, letterSpacing: 0.6, cursor: "pointer",
            }}
          >
            {copied ? "Copied" : "Copy link"}
          </button>
          <button
            onClick={share}
            style={{
              flex: 1,
              background: `linear-gradient(135deg, ${t.gradientFrom}, ${t.gradientTo})`,
              color: t.accentText, border: "none",
              borderRadius: 22, padding: "12px 16px", fontSize: 13, fontWeight: 800, letterSpacing: 0.6,
              boxShadow: `0 8px 24px ${t.accentGlow}`, cursor: "pointer",
            }}
          >
            Share
          </button>
        </div>

        <button
          onClick={onClose}
          style={{
            marginTop: 12, width: "100%",
            background: "transparent", color: t.textMuted,
            border: `1px solid ${t.border}`,
            borderRadius: 22, padding: "12px 16px", fontSize: 14, fontWeight: 600, cursor: "pointer",
          }}
        >
          Close
        </button>
      </div>
    </ModalScrim>
  );
}

// ═════════════════════ BOTTOM NAV (shared with Home) ═════════════════════
function BottomNav({ t, active, onOpenFeed, onOpenSquad, onOpenLogWorkout, onOpenProgress, onOpenProfile }: {
  t: any; active: "feed" | "squad" | "progress" | "profile";
  onOpenFeed: () => void; onOpenSquad: () => void; onOpenLogWorkout: () => void;
  onOpenProgress?: () => void; onOpenProfile: () => void;
}) {
  return (
    <nav className="fixed left-0 right-0 z-40" style={{
      bottom: 0, paddingBottom: "max(env(safe-area-inset-bottom), 10px)", paddingTop: 8,
      background: `linear-gradient(180deg, ${t.bg}00 0%, ${t.bg}E6 35%, ${t.bg}F5 100%)`,
      backdropFilter: "blur(10px)",
    }}>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "8px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <NavBtn t={t} label="Workout"  onClick={onOpenLogWorkout}       icon={<DumbbellGlyph color={t.textMuted} size={22} />} active={false} />
        <NavBtn t={t} label="Squad"    onClick={onOpenSquad}            icon={<SquadIcon   color={active === "squad" ? t.accent : t.textMuted} />} active={active === "squad"} />
        <button
          onClick={onOpenFeed}
          aria-label="Home"
          style={{
            width: 60, height: 60, borderRadius: 30, border: "none",
            background: `linear-gradient(135deg, ${t.gradientFrom}, ${t.gradientTo})`,
            color: t.accentText,
            boxShadow: `0 12px 36px ${t.accentGlow}`, cursor: "pointer",
            display: "grid", placeItems: "center", marginTop: -18,
          }}
        ><HomeIcon color={t.accentText} size={28} /></button>
        <NavBtn t={t} label="Progress" onClick={() => onOpenProgress?.()} icon={<ChartIcon color={active === "progress" ? t.accent : t.textMuted} />} active={active === "progress"} />
        <NavBtn t={t} label="Profile"  onClick={onOpenProfile}            icon={<ProfileIcon color={active === "profile" ? t.accent : t.textMuted} />} active={active === "profile"} />
      </div>
    </nav>
  );
}

function NavBtn({ t, label, onClick, icon, active }: { t: any; label: string; onClick: () => void; icon: React.ReactNode; active: boolean }) {
  return (
    <button onClick={onClick} style={{
      background: "transparent", border: "none", cursor: "pointer",
      display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
      color: active ? t.accent : t.textMuted, padding: "6px 10px", minWidth: 56,
    }}>
      {icon}
      <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.4 }}>{label}</span>
    </button>
  );
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
function AddPersonIcon({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="10" cy="8" r="3.5" stroke={color} strokeWidth="1.6" />
      <path d="M3 20c0-3.5 3.5-6 7-6s7 2.5 7 6" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M19 6v6M16 9h6" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function GearIcon({ color, size = 16 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="3" stroke={color} strokeWidth="1.6" />
      <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"
            stroke={color} strokeWidth="1.6" strokeLinecap="round" />
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
function FlameIcon({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 3s4 4 4 8a4 4 0 0 1-8 0c0-1.5.5-2.5 1-3 0 2 1 3 2 3 0-2-1-3-1-5 0-2 2-3 2-3z" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
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
function UpArrowIcon({ color, size = 16 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M4 18 12 9l4 4 6-6M16 7h6v6" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function PlayIcon({ color, size = 16 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}
function GhostIcon({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M5 10a7 7 0 0 1 14 0v9l-2.5-2-2 2-2-2-2 2-2-2L5 19v-9z" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="9.5" cy="11" r="1" fill={color} />
      <circle cx="14.5" cy="11" r="1" fill={color} />
    </svg>
  );
}
function SwordsIcon({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M3 21l8-8M3 21h4l1-3M3 21v-4l3-1M21 21l-8-8M21 21h-4l-1-3M21 21v-4l-3-1M14 3l7 7M3 3l7 7" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function ChartIcon({ color, size = 22 }: { color: string; size?: number }) {
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
function ProfileIcon({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="3.5" stroke={color} strokeWidth="1.6" />
      <path d="M4 20c0-3.5 3.5-6.5 8-6.5s8 3 8 6.5" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function TrophyIcon({ color, glow, size = 64, compact = false }: { color: string; glow: string; size?: number; compact?: boolean }) {
  // Compact = inline activity row trophy; otherwise large glowing trophy illustration.
  if (compact) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path d="M7 4h10v3a5 5 0 0 1-10 0V4z" stroke={color} strokeWidth="1.6" />
        <path d="M5 5h2M17 5h2M9 12v2c0 1.5 1.3 3 3 3s3-1.5 3-3v-2M10 18h4M9 21h6" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" style={{ filter: `drop-shadow(0 0 12px ${glow})` }}>
      <path d="M20 10h24v8a12 12 0 0 1-24 0v-8z" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      <path d="M14 12h6M44 12h6" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <path d="M10 14a6 6 0 0 0 6 6M54 14a6 6 0 0 1-6 6" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <path d="M26 30v6c0 3 2.5 6 6 6s6-3 6-6v-6" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <path d="M24 46h16M22 52h20" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <path d="M32 22l1.6 3.2 3.4.5-2.5 2.4.6 3.4L32 30l-3.1 1.6.6-3.4-2.5-2.4 3.4-.5L32 22z" stroke={color} strokeWidth="1.8" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

// Bold filled dumbbell for the centre FAB on the bottom nav.
function DumbbellGlyph({ color, size = 28 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      {/* Outer plates */}
      <rect x="1"  y="8"  width="4" height="16" rx="1.2" fill={color} />
      <rect x="27" y="8"  width="4" height="16" rx="1.2" fill={color} />
      {/* Inner plates */}
      <rect x="6"  y="6"  width="5" height="20" rx="1.2" fill={color} />
      <rect x="21" y="6"  width="5" height="20" rx="1.2" fill={color} />
      {/* Bar */}
      <rect x="11" y="14" width="10" height="4"  rx="0.8" fill={color} />
    </svg>
  );
}
