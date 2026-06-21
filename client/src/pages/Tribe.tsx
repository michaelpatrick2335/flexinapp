// Tribe (Groups) page — social accountability for Flexin meditation.
// Spec: GROUPS PAGE LAYOUT (mockup at ChatGPT-Image-Jun-19-2026-05_21_20-AM.jpg)
//   1. Header: Flexin logo + active group dropdown + "+" menu (Invite / Create)
//   2. Tribe Energy: 0-100 score with glowing breathing orb + trend badge
//   3. Live Activity feed (polls every 30s)
//   4. Wise Flexin AI teacher (static rule-based tips for v1.1)
// Bottom nav lives in <TabShell />, not here.

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Share } from "@capacitor/share";
import { Capacitor } from "@capacitor/core";
import { apiRequest, queryClient, getUserEmail } from "@/lib/queryClient";
import flexinFlexinOnly from "@/assets/flexin_circle.jpeg";
import wiseFlexinImg from "@/assets/wise-flexin.png";
import { Fireflies } from "@/components/Fireflies";
import type { User } from "@shared/schema";

interface Group {
  id: number;
  name: string;
  joinCode: string;
  imageUrl: string | null;
  createdByUserId: number;
  memberCount?: number;
  createdAt?: string;
}
interface Reaction {
  icon: string;
  count: number;
  mine: boolean;
}
interface Activity {
  id: number;
  userId: number;
  userName: string;
  userProfilePic: string | null;
  type: "session_complete" | "level_up" | "streak" | "challenge_complete" | "session_and_level";
  payload: Record<string, any>;
  bananasEarned: number;
  createdAt: string;
  reactions?: Reaction[];
}
interface Energy {
  energy: number;
  trend: "up" | "down" | "flat";
  label: string;
  memberCount: number;
}
interface Member {
  id: number;
  name: string;
  profilePic: string | null;
  level: number;
  tier: string;
  bananas: number;
  streakDays: number;
  lastSessionDate: string | null;
  joinedAt: string;
}

interface TribeProps {
  user: User;
}

const SHARE_BASE_URL = "https://www.flexinapp.com";

export function Tribe({ user }: TribeProps) {
  // ── Group list + active group ──────────────────────────────────────────
  const groupsQ = useQuery<{ activeGroupId: number | null; groups: Group[] }>({
    queryKey: ["/api/groups"],
    refetchOnWindowFocus: false,
  });
  const groups = groupsQ.data?.groups ?? [];
  const activeGroupId =
    user.activeGroupId ?? groupsQ.data?.activeGroupId ?? groups[0]?.id ?? null;
  const activeGroup = groups.find((g) => g.id === activeGroupId) ?? null;

  // ── Plus menu (Invite / Create) ────────────────────────────────────────
  const [menuOpen, setMenuOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  // Notifications (reactions). Polls every 30s so new claps show up.
  const notifQ = useQuery<{ unreadCount: number; items: Array<any> }>({
    queryKey: ["/api/notifications"],
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
  const unreadCount = notifQ.data?.unreadCount ?? 0;

  const markReadMut = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/notifications/mark-read", {}).then((r) => r.json());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }),
  });

  function openNotifDrawer() {
    setNotifOpen(true);
    if (unreadCount > 0) markReadMut.mutate();
  }

  const [groupSwitcherOpen, setGroupSwitcherOpen] = useState(false);
  const [welcomeOpen, setWelcomeOpen] = useState(false);

  // ── Active group's data ────────────────────────────────────────────────
  const energyQ = useQuery<Energy>({
    queryKey: activeGroupId ? [`/api/groups/${activeGroupId}/energy`] : ["energy-disabled"],
    enabled: !!activeGroupId,
    refetchInterval: 60_000,
  });
  const feedQ = useQuery<{ items: Activity[] }>({
    queryKey: activeGroupId ? [`/api/groups/${activeGroupId}/activity`] : ["feed-disabled"],
    enabled: !!activeGroupId,
    refetchInterval: 15_000,
  });
  const membersQ = useQuery<{ members: Member[] }>({
    queryKey: activeGroupId ? [`/api/groups/${activeGroupId}/members`] : ["members-disabled"],
    enabled: !!activeGroupId,
    refetchInterval: 30_000,
  });

  // ── First-visit welcome: solo tribe → prompt to invite ─────────────────
  useEffect(() => {
    const members = membersQ.data?.members;
    if (!activeGroupId || !members) return;
    if (members.length !== 1) return;
    const key = `flexin:welcomeShown:${activeGroupId}`;
    if (typeof window !== "undefined" && !localStorage.getItem(key)) {
      setWelcomeOpen(true);
      localStorage.setItem(key, "1");
    }
  }, [activeGroupId, membersQ.data]);

  // ── Switch active group ────────────────────────────────────────────────
  const switchMut = useMutation({
    mutationFn: (groupId: number) =>
      apiRequest("POST", "/api/groups/active", { groupId }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      setGroupSwitcherOpen(false);
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "auto" });
      }
    },
  });

  // ── Create group ───────────────────────────────────────────────────────
  const [newGroupName, setNewGroupName] = useState("");
  const [creating, setCreating] = useState(false);
  async function handleCreateGroup() {
    const name = newGroupName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const created = await apiRequest("POST", "/api/groups", { name }).then((r) => r.json());
      const newId = created?.group?.id as number | undefined;
      // Always switch to the newly created group so the user lands in it
      if (newId) {
        try {
          await apiRequest("POST", "/api/groups/active", { groupId: newId });
        } catch {
          // non-fatal — server may have auto-set it for first-ever group
        }
      }
      setNewGroupName("");
      setCreateOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      // Land at the top of the freshly-loaded tribe page
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "auto" });
      }
    } catch (e: any) {
      alert(`Could not create group: ${e?.message || "unknown"}`);
    } finally {
      setCreating(false);
    }
  }

  // ── Invite via iOS Share Sheet ─────────────────────────────────────────
  async function handleInvite() {
    if (!activeGroup) return;
    const inviterName = user.name || "A friend";
    const url = `${SHARE_BASE_URL}/join/${activeGroup.joinCode}`;
    const text = `${inviterName} has invited you to join their Flexin tribe. Join their meditation tribe and grow together.`;
    try {
      if (Capacitor.isNativePlatform()) {
        await Share.share({
          title: "Join my Flexin meditation tribe",
          text,
          url,
          dialogTitle: "Invite to Tribe",
        });
      } else {
        // Web fallback: try Web Share API, else copy
        if ((navigator as any).share) {
          await (navigator as any).share({ title: "Join my Flexin tribe", text, url });
        } else {
          await navigator.clipboard.writeText(`${text}\n${url}`);
          alert("Invite link copied to clipboard");
        }
      }
    } catch (e) {
      // User cancelled share — silent.
    } finally {
      setMenuOpen(false);
    }
  }

  // ── Empty state: no groups yet ─────────────────────────────────────────
  if (groupsQ.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center stars-bg">
        <div className="text-muted-foreground">Loading your tribe…</div>
      </div>
    );
  }
  // Shared create modal — rendered for both empty state and full Tribe.
  const createModal = createOpen && (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={() => !creating && setCreateOpen(false)}
    >
      <div
        className="glass-card rounded-t-3xl sm:rounded-3xl p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="font-display text-gold text-2xl mb-2">Name your tribe</div>
        <div className="text-sm text-muted-foreground mb-4">You can invite people right after.</div>
        <input
          autoFocus
          value={newGroupName}
          onChange={(e) => setNewGroupName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreateGroup()}
          placeholder="Family Group"
          maxLength={60}
          className="w-full px-4 py-3 rounded-xl mb-4"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(245,200,66,0.25)",
            color: "var(--foreground)",
            fontSize: 16,
          }}
        />
        <div className="flex gap-2">
          <button
            onClick={() => !creating && setCreateOpen(false)}
            className="flex-1 py-3 rounded-xl"
            style={{ background: "rgba(255,255,255,0.05)" }}
          >
            Cancel
          </button>
          <button
            onClick={handleCreateGroup}
            disabled={creating || !newGroupName.trim()}
            className="flex-1 py-3 rounded-xl font-semibold"
            style={{
              background: "linear-gradient(180deg, #f5c842 0%, #e8952a 100%)",
              color: "#0d0f1a",
              opacity: creating || !newGroupName.trim() ? 0.5 : 1,
            }}
          >
            {creating ? "Creating\u2026" : "Enter"}
          </button>
        </div>
      </div>
    </div>
  );

  // ── First-time welcome modal: "Let's invite your first tribe member" ─────
  const welcomeModal = welcomeOpen && activeGroup && (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-5"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" }}
      onClick={() => setWelcomeOpen(false)}
    >
      <div
        className="rounded-3xl p-6 w-full max-w-sm relative overflow-hidden"
        style={{
          background: "linear-gradient(160deg, rgba(245,200,66,0.18) 0%, rgba(232,149,42,0.10) 50%, rgba(13,15,26,0.85) 100%)",
          border: "1px solid rgba(245,200,66,0.35)",
          boxShadow: "0 20px 60px rgba(245,200,66,0.18), 0 0 30px rgba(245,200,66,0.10)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          aria-hidden
          style={{
            position: "absolute", top: -40, right: -40, width: 140, height: 140,
            background: "radial-gradient(circle, rgba(245,200,66,0.35) 0%, transparent 70%)",
            filter: "blur(20px)", pointerEvents: "none",
          }}
        />
        <div className="font-display text-gold text-2xl text-center mb-2 leading-tight mt-1">
          Welcome to {activeGroup.name}
        </div>
        <div className="text-sm text-foreground/85 text-center mb-5 leading-relaxed">
          Let’s invite your first tribe member — meditation grows stronger together.
        </div>
        <button
          onClick={() => {
            setWelcomeOpen(false);
            handleInvite();
          }}
          className="w-full py-3.5 rounded-2xl font-semibold mb-2"
          style={{
            background: "linear-gradient(180deg, #f5c842 0%, #e8952a 100%)",
            color: "#0d0f1a",
            boxShadow: "0 8px 24px rgba(245,200,66,0.35)",
            fontSize: 16,
          }}
        >
          Invite
        </button>
        <button
          onClick={() => setWelcomeOpen(false)}
          className="w-full py-2 rounded-xl text-sm"
          style={{ color: "rgba(255,255,255,0.6)" }}
        >
          Maybe later
        </button>
      </div>
    </div>
  );

  if (groups.length === 0) {
    return (
      <>
        <EmptyTribe onCreate={() => setCreateOpen(true)} />
        {createModal}
        {welcomeModal}
      </>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center px-5 pt-6 pb-28 stars-bg relative overflow-hidden">
      <Fireflies />

      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <header className="w-full max-w-md flex items-start justify-between mb-5 relative z-10">
        <div className="flex items-start gap-3">
          <div
            className="rounded-full flex-shrink-0"
            style={{
              width: 56,
              height: 56,
              background: "#0d1520",
              boxShadow: "0 0 0 2px rgba(245,200,66,0.35), 0 0 24px rgba(245,200,66,0.25)",
              overflow: "hidden",
            }}
          >
            <img src={flexinFlexinOnly} alt="Flexin" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
          <div>
            <button
              onClick={() => groups.length > 1 && setGroupSwitcherOpen(true)}
              className="flex items-center gap-1.5 text-foreground/95"
              style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.1 }}
            >
              <span className="font-display text-gold">{activeGroup?.name ?? "No tribe"}</span>
              {groups.length > 1 && <span style={{ fontSize: 14, opacity: 0.7 }}>▾</span>}
            </button>
            <div className="text-xs text-gold/70 mt-1" style={{ letterSpacing: 0.3 }}>
              Stronger minds. Together.
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Bell with unread badge */}
          <button
            onClick={openNotifDrawer}
            className="rounded-full flex items-center justify-center relative"
            style={{
              width: 44,
              height: 44,
              background: "rgba(245,200,66,0.08)",
              border: "1px solid rgba(245,200,66,0.35)",
              color: "var(--color-gold)",
            }}
            aria-label="Notifications"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            {unreadCount > 0 && (
              <span
                className="absolute text-[10px] font-bold rounded-full flex items-center justify-center"
                style={{
                  top: -2,
                  right: -2,
                  minWidth: 18,
                  height: 18,
                  padding: "0 4px",
                  background: "#ef4444",
                  color: "white",
                  border: "1.5px solid #0b0d12",
                  boxShadow: "0 0 8px rgba(239,68,68,0.5)",
                }}
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {/* Plus / add menu */}
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="rounded-full flex items-center justify-center"
            style={{
              width: 44,
              height: 44,
              background: "rgba(245,200,66,0.08)",
              border: "1px solid rgba(245,200,66,0.35)",
              boxShadow: "0 0 18px rgba(245,200,66,0.15)",
              color: "var(--color-gold)",
              fontSize: 24,
              fontWeight: 300,
            }}
            aria-label="Add"
          >
            +
          </button>
        </div>
      </header>

      {/* Notifications drawer */}
      {notifOpen && (
        <div className="fixed inset-0 z-50" onClick={() => setNotifOpen(false)} style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute right-3 top-3 glass-card rounded-2xl p-4"
            style={{
              width: "min(360px, calc(100vw - 24px))",
              maxHeight: "70vh",
              overflowY: "auto",
              border: "1px solid rgba(245,200,66,0.35)",
              boxShadow: "0 16px 40px rgba(0,0,0,0.6)",
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm uppercase tracking-widest font-semibold text-gold">Notifications</div>
              <button
                onClick={() => setNotifOpen(false)}
                className="text-muted-foreground text-xl leading-none"
                aria-label="Close"
              >×</button>
            </div>

            {(notifQ.data?.items?.length ?? 0) === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center">
                No notifications yet. When tribemates send you energy, it'll show up here.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {(notifQ.data?.items ?? []).map((n: any) => (
                  <NotificationRow key={n.id} n={n} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Plus menu */}
      {menuOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)}>
          <div
            className="absolute glass-card rounded-2xl p-2"
            style={{ top: 80, right: 20, minWidth: 240 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={handleInvite}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/5 text-left"
            >
              <span style={{ fontSize: 20 }}>📱</span>
              <span className="text-sm">Invite to Tribe</span>
              <span className="ml-auto text-gold/60" style={{ fontSize: 14 }}>›</span>
            </button>
            <button
              onClick={() => {
                setMenuOpen(false);
                setCreateOpen(true);
              }}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/5 text-left"
            >
              <span style={{ fontSize: 20 }}>👥</span>
              <span className="text-sm">Create New Group</span>
            </button>
          </div>
        </div>
      )}

      {/* Group switcher — centered, not bottom-sheet */}
      {groupSwitcherOpen && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center px-5"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => setGroupSwitcherOpen(false)}
        >
          <div
            className="glass-card rounded-3xl p-5 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
            style={{ maxHeight: "70vh", overflowY: "auto" }}
          >
            <div className="text-sm uppercase tracking-widest text-muted-foreground mb-3">Switch tribe</div>
            {groups.map((g) => (
              <button
                key={g.id}
                onClick={() => switchMut.mutate(g.id)}
                disabled={switchMut.isPending}
                className="w-full flex items-center justify-between px-3 py-3 rounded-xl hover:bg-white/5 text-left"
              >
                <span className="font-medium">{g.name}</span>
                {g.id === activeGroupId && <span className="text-gold text-xs">● Active</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {createModal}
      {welcomeModal}

      {/* ── TRIBE ENERGY ────────────────────────────────────────────────── */}
      <EnergyCard data={energyQ.data} />

      {/* ── LIVE ACTIVITY FEED ──────────────────────────────────────────── */}
      <FeedCard items={feedQ.data?.items ?? []} loading={feedQ.isLoading} groupId={activeGroupId} currentUserId={user.id} />

      {/* ── TRIBE MEMBERS ───────────────────────────────────────────────── */}
      <MembersCard members={membersQ.data?.members ?? []} currentUserId={user.id} onInvite={handleInvite} />

      {/* ── FLOATING WISE FLEXIN (anchored ─ doesn't take feed space) ─────── */}
      <FloatingWiseFlexin
        energy={energyQ.data}
        feedItems={feedQ.data?.items ?? []}
        members={membersQ.data?.members ?? []}
        currentUserId={user.id}
      />
    </div>
  );
}

// ── Empty state when user has no groups ────────────────────────────────────
function EmptyTribe({ onCreate }: { onCreate: () => void }) {
  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleJoin() {
    const clean = code.trim().toUpperCase();
    if (!clean) return;
    setJoining(true);
    setError(null);
    try {
      await apiRequest("POST", "/api/groups/join", { code: clean }).then((r) => r.json());
      setCode("");
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    } catch (e: any) {
      setError(e?.message || "Invalid code");
    } finally {
      setJoining(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 pb-28 stars-bg relative overflow-hidden">
      <Fireflies />
      <div className="relative z-10 text-center max-w-sm">
        <div className="text-6xl mb-4">🐒</div>
        <div className="font-display text-gold text-3xl mb-3">Find your tribe</div>
        <div className="text-muted-foreground mb-8 leading-relaxed">
          Meditation grows stronger together. Create a tribe with your family, friends, or coworkers — or join one you've been invited to.
        </div>
        <button
          onClick={onCreate}
          className="w-full py-4 rounded-2xl font-semibold mb-3"
          style={{
            background: "linear-gradient(180deg, #f5c842 0%, #e8952a 100%)",
            color: "#0d0f1a",
            boxShadow: "0 8px 32px rgba(245,200,66,0.35)",
          }}
        >
          Create a tribe
        </button>
        <div className="text-xs text-muted-foreground my-3">or join with a code</div>
        <div className="flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="ABC123"
            maxLength={10}
            className="flex-1 px-4 py-3 rounded-xl text-center uppercase tracking-widest"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(245,200,66,0.25)",
              color: "var(--foreground)",
            }}
          />
          <button
            onClick={handleJoin}
            disabled={joining || !code.trim()}
            className="px-5 rounded-xl font-semibold"
            style={{
              background: "rgba(245,200,66,0.15)",
              border: "1px solid rgba(245,200,66,0.45)",
              color: "var(--color-gold)",
              opacity: joining || !code.trim() ? 0.5 : 1,
            }}
          >
            {joining ? "…" : "Join"}
          </button>
        </div>
        {error && <div className="text-red-400 text-sm mt-3">{error}</div>}
      </div>
    </div>
  );
}

// ── ENERGY CARD ────────────────────────────────────────────────────────────
function EnergyCard({ data }: { data?: Energy }) {
  const energy = data?.energy ?? 50;
  const trend = data?.trend ?? "flat";
  const label = data?.label ?? "Quiet Tribe";
  const subtitle = useMemo(() => {
    if (energy >= 80) return "Radiant. Your tribe is on fire.";
    if (energy >= 60) return "High energy! Let's keep it up.";
    if (energy >= 40) return "Steady. A little spark would help.";
    if (energy >= 20) return "Drifting. Bring your people back.";
    return "Quiet. Time to reignite the tribe.";
  }, [energy]);

  // Pulse intensity scales with energy.
  const glowIntensity = 0.25 + (energy / 100) * 0.55;
  const pulseSpeed = Math.max(2, 5 - (energy / 100) * 3); // higher energy = faster pulse

  return (
    <div className="glass-card rounded-3xl p-5 w-full max-w-md mb-5 relative overflow-hidden z-10">
      <div className="flex items-center gap-2 mb-3">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Tribe Energy</div>
        <span style={{ fontSize: 14 }}>🌿</span>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex-shrink-0">
          <div className="font-display text-gold" style={{ fontSize: 52, lineHeight: 1, fontWeight: 700 }}>
            {energy}%
          </div>
          <div className="font-semibold text-gold mt-1" style={{ fontSize: 16 }}>{label}</div>
          <div className="text-xs text-muted-foreground mt-1">{subtitle}</div>
          <div
            className="font-semibold mt-2"
            style={{
              color: trend === "up" ? "#86efac" : trend === "down" ? "#fca5a5" : "var(--color-gold)",
              fontSize: 12,
              letterSpacing: 0.5,
            }}
          >
            {trend === "up" ? "UP ↗" : trend === "down" ? "DOWN ↘" : "FLAT —"}
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center" style={{ minHeight: 110 }}>
          <EnergyOrb intensity={glowIntensity} speed={pulseSpeed} energy={energy} />
        </div>
      </div>
    </div>
  );
}

// Energy icon scales with %. Higher energy = more upbeat / explosive.
function energyIcon(energy: number): string {
  if (energy >= 90) return "⚡";      // lightning — radiant
  if (energy >= 80) return "🔥";      // fire
  if (energy >= 70) return "🌟";      // glowing star
  if (energy >= 60) return "✨";      // sparkles
  if (energy >= 50) return "🙏";      // prayer / gratitude
  if (energy >= 40) return "🧘";      // meditating
  if (energy >= 30) return "🌱";      // sprouting
  if (energy >= 20) return "😴";      // sleeping
  if (energy >= 10) return "🥱";      // yawning
  return "💤";                       // dormant
}

// ── ENERGY ORB ──────────────────────────────────────────────────────────────
function EnergyOrb({ intensity, speed, energy }: { intensity: number; speed: number; energy: number }) {
  const icon = energyIcon(energy);
  return (
    <div
      style={{
        width: 110,
        height: 110,
        borderRadius: "50%",
        position: "relative",
        animation: `orbPulse ${speed}s ease-in-out infinite`,
        boxShadow: `0 0 ${36 * intensity}px ${12 * intensity}px rgba(245,200,66,${intensity})`,
        background: `radial-gradient(circle, rgba(245,200,66,${0.45 * intensity}) 0%, rgba(232,149,42,${0.18 * intensity}) 60%, transparent 100%)`,
        border: `1.5px solid rgba(245,200,66,${0.6 * intensity})`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div style={{ fontSize: 52, filter: `drop-shadow(0 0 10px rgba(245,200,66,${intensity}))` }}>{icon}</div>
      <style>{`
        @keyframes orbPulse {
          0%, 100% { transform: scale(1); opacity: 0.95; }
          50%      { transform: scale(1.07); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ── FEED CARD ──────────────────────────────────────────────────────────────
// Combine adjacent level_up + session_complete from the same user (within ~10 min)
// into a single "completed session AND reached level X" row so the feed feels coherent.
function collapseLevelAndSession(items: Activity[]): Activity[] {
  const out: Activity[] = [];
  const consumed = new Set<number>();
  for (let i = 0; i < items.length; i++) {
    if (consumed.has(items[i].id)) continue;
    const a = items[i];
    if (a.type === "session_complete" || a.type === "level_up") {
      const aTime = new Date(a.createdAt).getTime();
      const wantType = a.type === "session_complete" ? "level_up" : "session_complete";
      const partnerIdx = items.findIndex(
        (b, j) =>
          j !== i &&
          !consumed.has(b.id) &&
          b.userId === a.userId &&
          b.type === wantType &&
          Math.abs(new Date(b.createdAt).getTime() - aTime) < 10 * 60 * 1000,
      );
      if (partnerIdx >= 0) {
        const partner = items[partnerIdx];
        const session = a.type === "session_complete" ? a : partner;
        const levelUp = a.type === "level_up" ? a : partner;
        consumed.add(a.id);
        consumed.add(partner.id);
        out.push({
          ...session,
          type: "session_and_level" as any,
          payload: {
            ...(session.payload || {}),
            level: (levelUp.payload as any)?.level ?? (session.payload as any)?.level,
            tier: (levelUp.payload as any)?.tier ?? (session.payload as any)?.tier,
          },
          bananasEarned: (session.bananasEarned || 0) + (levelUp.bananasEarned || 0),
        });
        continue;
      }
    }
    out.push(a);
  }
  return out;
}

function FeedCard({ items, loading, groupId, currentUserId }: { items: Activity[]; loading: boolean; groupId: number | null; currentUserId: number }) {
  const merged = useMemo(() => collapseLevelAndSession(items), [items]);
  return (
    <div className="glass-card rounded-3xl p-5 w-full max-w-md mb-5 relative z-10">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="text-sm uppercase tracking-widest font-semibold">Live Activity</div>
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{
              background: "rgba(245,200,66,0.15)",
              color: "var(--color-gold)",
              border: "1px solid rgba(245,200,66,0.4)",
            }}
          >
            LIVE
          </span>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground py-6 text-center">Listening for activity…</div>
      ) : items.length === 0 ? (
        <div className="text-sm text-muted-foreground py-6 text-center leading-relaxed">
          No activity yet. <br />
          Complete a meditation and watch the tribe come alive.
        </div>
      ) : (
        <div
          className="flex flex-col"
          style={{
            // ~5 visible rows; beyond that, scrolls inside the card
            maxHeight: 332,
            overflowY: "auto",
            scrollbarWidth: "thin",
            scrollbarColor: "rgba(245,200,66,0.35) transparent",
          }}
        >
          {merged.slice(0, 20).map((a) => (
            <FeedRow key={a.id} a={a} groupId={groupId} currentUserId={currentUserId} />
          ))}
        </div>
      )}
    </div>
  );
}

// 15 meditation/energy icons sent as reactions to celebrate a tribemate's activity.
const REACTION_ICONS = [
  "\u{1F64F}",         // gratitude / namaste
  "\u{1F525}",         // fire / streak hype
  "\u{2728}",          // sparkles
  "\u{1F4AB}",         // dizzy
  "\u{1F31F}",         // glowing star
  "\u{1F49B}",         // yellow heart
  "\u{1FAF6}",         // heart hands
  "\u{1F44F}",         // clap
  "\u{1F4AA}",         // strength
  "\u{1F33F}",         // herb / grounding
  "\u{1F341}",         // leaf
  "\u{262E}\u{FE0F}", // peace
  "\u{2638}\u{FE0F}", // dharma wheel
  "\u{1F5FF}",         // moai / stillness
  "\u{1F305}",         // sunrise
];

function FeedRow({ a, groupId, currentUserId }: { a: Activity; groupId: number | null; currentUserId: number }) {
  const { icon, text } = activityCopy(a);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerPos, setPickerPos] = useState<{ left: number; top: number; flipped: boolean } | null>(null);
  const heartBtnRef = useRef<HTMLButtonElement | null>(null);
  const qc = useQueryClient();

  // Compute fixed-viewport coords for the picker so it can escape clip-containers (scrollable cards).
  function openPicker() {
    const el = heartBtnRef.current;
    if (!el) { setPickerOpen(true); return; }
    const rect = el.getBoundingClientRect();
    const pickerW = 220;            // ~ 5 cols * (32+gap) + padding
    const pickerH = 138;            // ~ 3 rows * 36 + padding
    const margin = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // Prefer below; flip up if it would overflow the viewport bottom.
    let top = rect.bottom + 6;
    let flipped = false;
    if (top + pickerH + margin > vh) {
      top = rect.top - pickerH - 6;
      flipped = true;
    }
    let left = rect.left;
    if (left + pickerW + margin > vw) left = vw - pickerW - margin;
    if (left < margin) left = margin;
    setPickerPos({ left, top, flipped });
    setPickerOpen(true);
  }

  const reactMut = useMutation({
    mutationFn: async (rxIcon: string) => {
      if (!groupId) throw new Error("No tribe selected");
      const res = await apiRequest("POST", `/api/groups/${groupId}/activity/${a.id}/reactions`, { icon: rxIcon });
      return await res.json();
    },
    onSuccess: () => {
      if (groupId) qc.invalidateQueries({ queryKey: [`/api/groups/${groupId}/activity`] });
      setPickerOpen(false);
    },
    onError: (err: any) => {
      console.error("Reaction failed", err);
      alert(`Couldn't send reaction: ${err?.message ?? "unknown error"}`);
    },
  });

  const reactions = a.reactions ?? [];
  // Heart shows on every row — every member can be celebrated, you included.
  const canReact = !!groupId;

  return (
    <div className="flex flex-col gap-1.5 py-2.5 border-b last:border-b-0" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
      <div className="flex items-center gap-3">
        <div
          className="rounded-full flex-shrink-0"
          style={{
            width: 38,
            height: 38,
            background: "#0d1520",
            overflow: "hidden",
            border: "1.5px solid rgba(245,200,66,0.3)",
          }}
        >
          {a.userProfilePic ? (
            <img src={a.userProfilePic} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <img src={flexinFlexinOnly} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 20%" }} />
          )}
        </div>

        {/* Shaded heart sits right next to the profile pic. Tap to open a fixed-position picker. */}
        {canReact && (
          <button
            ref={heartBtnRef}
            onClick={() => (pickerOpen ? setPickerOpen(false) : openPicker())}
            className="rounded-full flex items-center justify-center transition-all active:scale-90 flex-shrink-0"
            style={{
              width: 32,
              height: 32,
              background: pickerOpen ? "rgba(245,82,82,0.18)" : "rgba(255,255,255,0.05)",
              border: `1px solid ${pickerOpen ? "rgba(245,82,82,0.45)" : "rgba(255,255,255,0.14)"}`,
              color: pickerOpen ? "#ff8a8a" : "rgba(255,255,255,0.55)",
            }}
            aria-label="Send a celebration"
            title="Send a celebration"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill={pickerOpen ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
          </button>
        )}
        {pickerOpen && pickerPos && createPortal(
          <>
            <div
              className="fixed inset-0 z-[100]"
              onClick={() => setPickerOpen(false)}
              style={{ background: "rgba(0,0,0,0.25)" }}
            />
            <div
              className="fixed z-[101] rounded-2xl p-2 grid grid-cols-5 gap-1"
              style={{
                left: pickerPos.left,
                top: pickerPos.top,
                width: 220,
                background: "rgba(13,21,32,0.97)",
                backdropFilter: "blur(14px)",
                border: "1px solid rgba(245,200,66,0.35)",
                boxShadow: "0 18px 44px rgba(0,0,0,0.65)",
              }}
            >
              {REACTION_ICONS.map((ic) => (
                <button
                  key={ic}
                  type="button"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!reactMut.isPending) reactMut.mutate(ic);
                  }}
                  disabled={reactMut.isPending}
                  className="rounded-lg p-1.5 text-xl active:scale-95"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    touchAction: "manipulation",
                    WebkitTapHighlightColor: "transparent",
                  }}
                >
                  {ic}
                </button>
              ))}
            </div>
          </>,
          document.body
        )}

        <div className="flex-1 min-w-0">
          <div className="text-sm leading-snug" style={{ color: "rgba(255,255,255,0.95)" }}>
            <span className="font-semibold">{a.userName}</span>{" "}
            <span dangerouslySetInnerHTML={{ __html: text }} />
          </div>
        </div>
        <div className="text-xs text-muted-foreground flex-shrink-0">{timeAgo(a.createdAt)}</div>
      </div>

      {/* Reactions row: shaded heart opens picker; existing reaction chips show below */}
      <div className="flex items-center gap-1.5 pl-[50px] flex-wrap">
        {reactions.map((r) => (
          <button
            key={r.icon}
            onClick={() => canReact && reactMut.mutate(r.icon)}
            disabled={!canReact || reactMut.isPending}
            className="rounded-full px-2 py-0.5 flex items-center gap-1 text-xs transition-all active:scale-90"
            style={{
              background: r.mine ? "rgba(245,200,66,0.18)" : "rgba(255,255,255,0.06)",
              border: `1px solid ${r.mine ? "rgba(245,200,66,0.45)" : "rgba(255,255,255,0.12)"}`,
              color: r.mine ? "var(--color-gold)" : "rgba(255,255,255,0.85)",
              opacity: canReact ? 1 : 0.85,
              cursor: canReact ? "pointer" : "default",
            }}
            title={r.mine ? "You reacted — tap to remove" : `Send ${r.icon}`}
          >
            <span>{r.icon}</span>
            <span className="font-semibold">{r.count}</span>
          </button>
        ))}

      </div>
    </div>
  );
}

// ── MEMBERS CARD ───────────────────────────────────────────────────────────
function MembersCard({ members, currentUserId, onInvite }: { members: Member[]; currentUserId: number; onInvite: () => void }) {
  // Sort: current user first, then by level desc, then bananas desc
  const sorted = useMemo(() => {
    return [...members].sort((a, b) => {
      if (a.id === currentUserId) return -1;
      if (b.id === currentUserId) return 1;
      if (b.level !== a.level) return b.level - a.level;
      return b.bananas - a.bananas;
    });
  }, [members, currentUserId]);

  return (
    <div className="glass-card rounded-3xl p-5 w-full max-w-md mb-5 relative z-10">
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm uppercase tracking-widest font-semibold">
          Tribe Members
        </div>
        <div className="flex items-center gap-2">
          <div className="text-xs text-muted-foreground">{sorted.length} {sorted.length === 1 ? "member" : "members"}</div>
          <button
            onClick={onInvite}
            className="rounded-full flex items-center justify-center transition-all active:scale-90"
            style={{
              width: 30,
              height: 30,
              background: "rgba(245,200,66,0.10)",
              border: "1px solid rgba(245,200,66,0.40)",
              color: "var(--color-gold)",
              boxShadow: "0 0 12px rgba(245,200,66,0.20)",
              fontSize: 20,
              fontWeight: 300,
              lineHeight: 1,
            }}
            aria-label="Invite to tribe"
            title="Invite to tribe"
          >+</button>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="text-sm text-muted-foreground py-4 text-center">Loading members…</div>
      ) : (
        <div className="flex flex-col">
          {sorted.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-3 py-2.5 border-b last:border-b-0"
              style={{ borderColor: "rgba(255,255,255,0.06)" }}
            >
              {/* Profile pic */}
              <div
                className="rounded-full flex-shrink-0"
                style={{
                  width: 40,
                  height: 40,
                  background: "#0d1520",
                  overflow: "hidden",
                  border: "1.5px solid rgba(245,200,66,0.3)",
                }}
              >
                {m.profilePic ? (
                  <img src={m.profilePic} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <img src={flexinFlexinOnly} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 20%" }} />
                )}
              </div>

              {/* Name */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate" style={{ color: "rgba(255,255,255,0.95)" }}>
                  {m.name}{m.id === currentUserId && <span className="text-xs text-gold/70 font-normal ml-1.5">(you)</span>}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">{tierLabel(m.tier)}</div>
              </div>

              {/* Level pill */}
              <div
                className="text-xs font-semibold rounded-full px-2.5 py-1"
                style={{
                  background: "rgba(245,200,66,0.10)",
                  border: "1px solid rgba(245,200,66,0.30)",
                  color: "var(--color-gold)",
                }}
              >
                Lv {m.level}
              </div>

              {/* Streak — days in a row */}
              <div
                className="flex items-center gap-1 text-xs font-semibold"
                style={{ color: m.streakDays > 0 ? "#FF8A3D" : "rgba(255,255,255,0.4)" }}
                title={`${m.streakDays}-day streak`}
              >
                <span>🔥</span>
                <span>{m.streakDays}</span>
              </div>

              {/* Bananas */}
              <div className="flex items-center gap-1 text-xs font-semibold" style={{ color: "var(--color-gold)" }}>
                <span>🍌</span>
                <span>{m.bananas}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── NOTIFICATION ROW ────────────────────────────────────────────────────────
function NotificationRow({ n }: { n: any }) {
  const { senderName, senderProfilePic, type, payload, readAt, createdAt } = n;
  if (type !== "reaction") return null;
  const icon = payload?.icon ?? "💛";
  return (
    <div
      className="flex items-center gap-3 p-2.5 rounded-xl"
      style={{
        background: readAt ? "rgba(255,255,255,0.03)" : "rgba(245,200,66,0.08)",
        border: `1px solid ${readAt ? "rgba(255,255,255,0.06)" : "rgba(245,200,66,0.25)"}`,
      }}
    >
      <div
        className="rounded-full flex-shrink-0 relative"
        style={{
          width: 40,
          height: 40,
          background: "#0d1520",
          overflow: "hidden",
          border: "1.5px solid rgba(245,200,66,0.3)",
        }}
      >
        {senderProfilePic ? (
          <img src={senderProfilePic} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <img src={flexinFlexinOnly} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 20%" }} />
        )}
        <span
          className="absolute flex items-center justify-center rounded-full"
          style={{
            right: -4,
            bottom: -4,
            width: 22,
            height: 22,
            background: "#0b0d12",
            border: "1.5px solid rgba(245,200,66,0.45)",
            fontSize: 12,
          }}
        >
          {icon}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm" style={{ color: "rgba(255,255,255,0.95)" }}>
          <span className="font-semibold">{senderName ?? "Someone"}</span>{" "}
          <span className="text-muted-foreground">sent you</span>{" "}
          <span>{icon}</span>
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">{timeAgo(createdAt)}</div>
      </div>
    </div>
  );
}

function activityCopy(a: Activity): { icon: string; text: string; accent: string } {
  const gold = "var(--color-gold)";
  switch (a.type as any) {
    case "session_and_level":
      return {
        icon: "\u{1F3C6}",
        text: `completed a session and reached <span style="color:${gold}">Level ${a.payload?.level ?? "?"}</span>`,
        accent: gold,
      };
    case "session_complete":
      return {
        icon: "⚡",
        text: `completed a <span style="color:${gold}">${tierLabel(a.payload?.tier)} session</span>`,
        accent: gold,
      };
    case "level_up":
      return {
        icon: "🏆",
        text: `reached <span style="color:${gold}">Level ${a.payload?.level ?? "?"}</span>`,
        accent: gold,
      };
    case "streak":
      return {
        icon: "🔥",
        text: `is on a <span style="color:${gold}">${a.payload?.days ?? "?"}-day streak</span>`,
        accent: gold,
      };
    case "challenge_complete":
      return {
        icon: "💫",
        text: `completed a breathing challenge`,
        accent: gold,
      };
    default:
      return { icon: "✨", text: "did something mindful", accent: gold };
  }
}
function tierLabel(tier: any): string {
  if (tier === "experienced") return "Experienced";
  if (tier === "enlightened") return "Advanced";
  return "Beginner";
}
function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

// ── WISE FLEXIN (static tip engine for v1.1) ────────────────────────────────
function FloatingWiseFlexin({ energy, feedItems, members, currentUserId }: {
  energy?: Energy;
  feedItems: Activity[];
  members: Member[];
  currentUserId: number;
}) {
  // Contextual playlist of lines.
  const lineQueue = useMemo(
    () => buildFlexinLines(energy, feedItems, members, currentUserId),
    [energy, feedItems, members, currentUserId],
  );
  const [idx, setIdx] = useState(0);
  const [bubbleOpen, setBubbleOpen] = useState(true);

  // Rotate every 12s.
  useEffect(() => {
    if (lineQueue.length <= 1) return;
    const t = setInterval(() => {
      setIdx((i) => (i + 1) % lineQueue.length);
      setBubbleOpen(true);
    }, 12000);
    return () => clearInterval(t);
  }, [lineQueue.length]);

  const line = lineQueue[idx] || "";

  // ── Drag state ────────────────────────────────────────────────────────────
  // pos is the top-left of the wrapper in viewport coords; null = use default anchor.
  const [pos, setPos] = useState<{ x: number; y: number } | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem("flexin:teacherPos");
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (typeof parsed?.x === "number" && typeof parsed?.y === "number") return parsed;
    } catch {}
    return null;
  });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{
    startX: number; startY: number;
    origX: number; origY: number;
    moved: boolean;
    pointerId: number;
  } | null>(null);
  // Width/height of the flexin tile (must match the rendered size below).
  const TILE_W = 72;
  const TILE_H = 88;
  const MARGIN = 10;

  function clampToViewport(x: number, y: number) {
    if (typeof window === "undefined") return { x, y };
    const maxX = window.innerWidth - TILE_W - MARGIN;
    const maxY = window.innerHeight - TILE_H - MARGIN;
    return {
      x: Math.max(MARGIN, Math.min(maxX, x)),
      y: Math.max(MARGIN, Math.min(maxY, y)),
    };
  }

  function onPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    // Measure current visual position from the rendered element.
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: rect.left,
      origY: rect.top,
      moved: false,
      pointerId: e.pointerId,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(true);
  }
  function onPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) > 5) d.moved = true;
    const next = clampToViewport(d.origX + dx, d.origY + dy);
    setPos(next);
  }
  function onPointerUp(e: React.PointerEvent<HTMLButtonElement>) {
    const d = dragRef.current;
    if (d && (e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    }
    setDragging(false);
    if (d && !d.moved) {
      // Treat as a tap: cycle line.
      setIdx((i) => (i + 1) % Math.max(lineQueue.length, 1));
      setBubbleOpen(true);
    } else if (d && d.moved && pos) {
      try { localStorage.setItem("flexin:teacherPos", JSON.stringify(pos)); } catch {}
    }
    dragRef.current = null;
  }

  // Decide which side of Flexin the bubble should pop from, based on viewport position.
  const bubbleOnLeft = pos ? pos.x > (typeof window !== "undefined" ? window.innerWidth / 2 : 999) : true;

  // Style for the wrapper: anchored to default when pos === null, otherwise absolute pixels.
  const wrapperStyle: React.CSSProperties = pos
    ? {
        position: "fixed",
        left: pos.x,
        top: pos.y,
        zIndex: 45,
        pointerEvents: "none",
      }
    : {
        position: "fixed",
        bottom: "calc(96px + env(safe-area-inset-bottom, 0px))",
        right: 14,
        zIndex: 45,
        pointerEvents: "none",
      };

  return (
    <>
      <style>{`
        @keyframes flexinFloat {
          0%   { transform: translate3d(0, 0, 0) rotate(-2deg); }
          50%  { transform: translate3d(-6px, -10px, 0) rotate(2deg); }
          100% { transform: translate3d(0, 0, 0) rotate(-2deg); }
        }
        @keyframes flexinBubbleIn {
          from { opacity: 0; transform: translateY(6px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      <div style={wrapperStyle}>
        <div
          style={{
            display: "flex",
            flexDirection: bubbleOnLeft ? "row" : "row-reverse",
            alignItems: "flex-end",
            gap: 8,
            maxWidth: "min(86vw, 380px)",
          }}
        >
          {/* Speech bubble — hide while actively dragging to reduce visual noise */}
          {bubbleOpen && line && !dragging && (
            <div
              style={{
                pointerEvents: "auto",
                flex: 1,
                minWidth: 0,
                maxWidth: 260,
                padding: "10px 14px",
                borderRadius: 18,
                background: "rgba(13,21,32,0.94)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(245,200,66,0.35)",
                boxShadow: "0 10px 28px rgba(0,0,0,0.55)",
                color: "rgba(255,255,255,0.94)",
                fontSize: 13,
                lineHeight: 1.35,
                animation: "flexinBubbleIn 0.32s ease-out",
                position: "relative",
              }}
            >
              <button
                onClick={() => setBubbleOpen(false)}
                aria-label="Dismiss"
                style={{
                  position: "absolute",
                  top: -8,
                  right: -8,
                  width: 22,
                  height: 22,
                  borderRadius: 999,
                  background: "rgba(13,21,32,0.95)",
                  border: "1px solid rgba(245,200,66,0.5)",
                  color: "var(--color-gold)",
                  fontSize: 12,
                  lineHeight: "20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ×
              </button>
              {line}
              {/* Tail */}
              <div
                style={{
                  position: "absolute",
                  bottom: 10,
                  ...(bubbleOnLeft
                    ? { right: -7, borderLeft: "8px solid rgba(13,21,32,0.94)" }
                    : { left: -7, borderRight: "8px solid rgba(13,21,32,0.94)" }),
                  width: 0,
                  height: 0,
                  borderTop: "6px solid transparent",
                  borderBottom: "6px solid transparent",
                }}
              />
            </div>
          )}

          {/* Draggable Flexin himself */}
          <button
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            style={{
              pointerEvents: "auto",
              background: "transparent",
              border: "none",
              padding: 0,
              cursor: dragging ? "grabbing" : "grab",
              touchAction: "none",          // prevents scroll-while-dragging on mobile
              userSelect: "none",
              WebkitUserSelect: "none",
              animation: dragging ? "none" : "flexinFloat 6s ease-in-out infinite",
              filter: "drop-shadow(0 0 18px rgba(245,200,66,0.45))",
            }}
            aria-label="Meditation Teacher (drag to move)"
          >
            <div
              style={{
                width: TILE_W,
                height: TILE_H,
                borderRadius: 18,
                overflow: "hidden",
                background: "#0d1520",
                border: `1.5px solid ${dragging ? "rgba(245,200,66,0.8)" : "rgba(245,200,66,0.45)"}`,
                boxShadow: dragging
                  ? "0 0 28px rgba(245,200,66,0.55)"
                  : "0 0 22px rgba(245,200,66,0.30)",
                transform: dragging ? "scale(1.04)" : "scale(1)",
                transition: "border-color 0.15s, box-shadow 0.15s, transform 0.15s",
              }}
            >
              <img
                src={wiseFlexinImg}
                alt="Meditation Teacher"
                draggable={false}
                style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }}
              />
            </div>
          </button>
        </div>
      </div>
    </>
  );
}


// Build the rotating line set: prioritize callouts → celebrations → wisdom.
function buildFlexinLines(
  energy: Energy | undefined,
  feed: Activity[],
  members: Member[],
  currentUserId: number,
): string[] {
  const lines: string[] = [];

  // 0) Welcome any new tribe members from the last 24 hours — highest priority.
  const ONE_DAY_MS = 86_400_000;
  const nowMs = Date.now();
  const recentJoins = feed.filter((f) => {
    if (f.type !== ("member_joined" as any)) return false;
    const t = new Date(f.createdAt).getTime();
    return !Number.isNaN(t) && (nowMs - t) < ONE_DAY_MS;
  });
  for (const a of recentJoins) {
    if (a.userId === currentUserId) {
      lines.push(`Welcome, ${a.userName}. The cushion has been waiting for you. Take three deep breaths — your tribe is here.`);
    } else {
      lines.push(`${a.userName} just joined the tribe. Welcome them with a session of your own — the path is brighter when walked together.`);
    }
  }

  // 1) Celebrate the freshest meaningful activity from a *teammate* (not you).
  const recent = feed.filter((f) => f.userId !== currentUserId).slice(0, 4);
  for (const a of recent) {
    if (a.type === ("session_and_level" as any)) {
      lines.push(`${a.userName} just leveled up and completed a session. Honor that rise — match it with your own breath today.`);
    } else if (a.type === "level_up") {
      lines.push(`${a.userName} reached Level ${a.payload?.level ?? "?"}. Bow to their discipline.`);
    } else if (a.type === "streak" && (a.payload?.days ?? 0) >= 3) {
      lines.push(`${a.userName} is on a ${a.payload?.days}-day streak. The path widens when one of you keeps walking it.`);
    } else if (a.type === "session_complete") {
      lines.push(`${a.userName} completed a session. Send them a sign of energy — celebrate the return to stillness.`);
    }
  }

  // 2) Self callout — current user inactive 2+ days
  const me = members.find((m) => m.id === currentUserId);
  if (me) {
    const myDays = daysSince(me.lastSessionDate);
    if (myDays === null) {
      lines.push(`${me.name}, the cushion is waiting. Begin today — even one breath counts.`);
    } else if (myDays >= 7) {
      lines.push(`${me.name}, it has been ${myDays} days since you sat. No guilt — just come back. The breath remembers.`);
    } else if (myDays >= 2) {
      lines.push(`${me.name}, your tribe feels your absence. ${myDays} days away. Return to the cushion today.`);
    }
  }

  // 3) Other members inactive 2+ days
  const inactiveOthers = members
    .filter((m) => m.id !== currentUserId)
    .map((m) => ({ m, days: daysSince(m.lastSessionDate) }))
    .filter((x) => x.days === null || (x.days as number) >= 2)
    .sort((a, b) => {
      const ad = a.days === null ? 9999 : (a.days as number);
      const bd = b.days === null ? 9999 : (b.days as number);
      return bd - ad;
    });
  for (const x of inactiveOthers.slice(0, 2)) {
    if (x.days === null) {
      lines.push(`${x.m.name} has not begun yet. Reach out — invite them to sit.`);
    } else if ((x.days as number) >= 7) {
      lines.push(`${x.m.name} has been quiet for ${x.days} days. Send love — meditation is harder alone.`);
    } else {
      lines.push(`${x.m.name} has not meditated in ${x.days} days. A gentle nudge from the tribe restores the flame.`);
    }
  }

  // 4) Tribe-wide energy signals
  if (energy) {
    if (energy.energy >= 80) lines.push("Your tribe is radiant. Keep this momentum — invite one more soul into the practice.");
    else if (energy.energy <= 30) lines.push("Energy has dropped. Bring your people back into stillness — even three breaths together rebuilds the bond.");
    if (energy.trend === "down") lines.push("Energy is slipping this week. Sit together tonight — shared breath steadies the flame.");
    if (energy.trend === "up") lines.push("Energy is rising. Keep showing up. Consistency is the truest meditation.");
  }

  // 5) Wisdom rotation as the always-available baseline
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now.getTime() - start.getTime()) / 86_400_000);
  // Add 3 different rotating wisdom lines so he doesn't repeat himself within a session.
  for (let k = 0; k < 3; k++) {
    lines.push(MEDITATION_ADVICE[(dayOfYear + k) % MEDITATION_ADVICE.length]);
  }

  // Dedupe while preserving order; cap to 8 so rotation stays fresh.
  const seen = new Set<string>();
  const out: string[] = [];
  for (const l of lines) {
    if (seen.has(l)) continue;
    seen.add(l);
    out.push(l);
    if (out.length >= 8) break;
  }
  return out;
}


const MEDITATION_ADVICE: string[] = [
  "Sit tall. Crown lifted, shoulders soft, hands resting. Posture is the first prayer.",
  "Inhale slowly. Exhale even slower. A longer out-breath calms the body faster than any thought can.",
  "When a thought arrives, don't fight it. Notice it, name it 'thinking,' and return to the breath. Returning is the practice.",
  "Daily practice beats long, rare sessions. Small, consistent stillness rewires the nervous system.",
  "Meditate at the same time each day. Habit removes the negotiation, and the cushion starts to call you.",
  "Count breaths from one to ten. If you lose count, start over without judgment. Beginning again is the whole path.",
  "End every session with one breath of gratitude. Gratitude seals the practice into the rest of your day.",
  "Meditation is not about a quiet mind — it's about a kind one. Be gentle with the wandering.",
  "Scan from head to toes slowly. Notice tension without trying to fix it. Awareness alone softens the body.",
  "Your breath is always here. Even on the busiest day, three conscious breaths can bring you home.",
];

function daysSince(iso?: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86_400_000);
}

function pickTip(
  energy: Energy | undefined,
  feed: Activity[],
  members: Member[],
  currentUserId: number
): string {
  // 1. Self callout — current user inactive
  const me = members.find((m) => m.id === currentUserId);
  if (me) {
    const myDays = daysSince(me.lastSessionDate);
    if (myDays === null) {
      return `${me.name}, the cushion is waiting. Sit for a few breaths today — that's how every practice begins.`;
    }
    if (myDays >= 7) {
      return `${me.name}, it's been ${myDays} days since you last sat. No guilt — just come back. One breath, right now, is enough.`;
    }
    if (myDays >= 2) {
      return `${me.name}, you've been away from the cushion for ${myDays} days. Your tribe feels it. Return to your breath today.`;
    }
  }

  // 2. Tribe member callout — other members inactive
  const inactiveOthers = members
    .filter((m) => m.id !== currentUserId)
    .map((m) => ({ m, days: daysSince(m.lastSessionDate) }))
    .filter((x) => x.days === null || x.days >= 2)
    .sort((a, b) => {
      const ad = a.days === null ? 9999 : a.days;
      const bd = b.days === null ? 9999 : b.days;
      return bd - ad;
    });

  if (inactiveOthers.length > 0) {
    const worst = inactiveOthers[0];
    if (inactiveOthers.length >= 2) {
      const names = inactiveOthers.slice(0, 2).map((x) => x.m.name).join(" and ");
      return `${names} have drifted from the practice. Send them love — invite them back to sit with the tribe.`;
    }
    if (worst.days === null) {
      return `${worst.m.name} hasn't sat yet. Reach out — sometimes a tribe member is what gets us to the cushion.`;
    }
    if (worst.days >= 7) {
      return `${worst.m.name} has been quiet for ${worst.days} days. Check in on them — meditation is harder alone.`;
    }
    return `${worst.m.name} hasn't meditated in ${worst.days} days. A gentle nudge from a tribemate goes a long way.`;
  }

  // 3. Tribe-wide energy signals
  if (energy) {
    if (energy.energy >= 80) {
      return "Your tribe is radiant. Keep this momentum — invite one more soul into the practice.";
    }
    if (energy.energy <= 30) {
      return "Your tribe energy has dropped. Bring your people back into stillness — even three breaths together rebuilds the bond.";
    }
    const recentStreak = feed.find((f) => f.type === "streak" && (f.payload?.days ?? 0) >= 7);
    if (recentStreak) {
      return `${recentStreak.userName} is anchoring the tribe with a ${recentStreak.payload?.days}-day streak. Match their discipline today.`;
    }
    const recentLevelUp = feed.find((f) => f.type === "level_up");
    if (recentLevelUp) {
      return `${recentLevelUp.userName} just leveled up. Celebrate them and tend your own growth.`;
    }
    if (energy.trend === "down") {
      return "Energy is slipping this week. Sit together tonight — shared breath steadies the flame.";
    }
    if (energy.trend === "up") {
      return "Energy is rising. Keep showing up. Consistency is the truest meditation.";
    }
  }

  // 4. Default: rotate meditation advice deterministically by day of year
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now.getTime() - start.getTime()) / 86_400_000);
  return MEDITATION_ADVICE[dayOfYear % MEDITATION_ADVICE.length];
}

