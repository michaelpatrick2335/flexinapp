import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "@/lib/ThemeProvider";
import { getQueryFn, queryClient, API_BASE } from "@/lib/queryClient";
import silhouetteMale from "@/assets/silhouette_male.png";
import silhouetteFemale from "@/assets/silhouette_female.png";
import flexinLogo from "@/assets/flexin_logo.png";
import { avatarImageFor } from "@/lib/avatars";
import { GoalBodyTypeModal } from "@/components/GoalBodyTypeModal";
import { getUserEmail } from "@/lib/queryClient";
import { getFeed, minutesAgo, pushFeedEvent } from "@/lib/feed";

// ── Types matching /api/dashboard response ────────────────────────────────
interface DashboardPayload {
  user: {
    id: number; name: string; sex: string;
    formLevel: number; formRank: string;
    isPremium: boolean;
    xp: number; xpToNext: number; streakDays: number;
    avatarBodyType?: string | null;
    goalAvatarBodyType?: string | null;
    avatarUrl?: string | null;
  };
  muscleGroups: { key: string; label: string; progress: number; streakDays: number }[];
  bodyDeltas: { key: string; label: string; delta: number; isOverall?: boolean; lastLiftedDay?: string | null }[];
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

  // Lifted up so the HERO 'USE PROGRESS PHOTO' picker modal can list the
  // user's existing progress scans without forcing the user to navigate to
  // the Progress page first. EvolutionCard still calls useQuery on the same
  // key — react-query dedupes automatically.
  const { data: progressData } = useQuery<ProgressPayloadLite>({
    queryKey: ["/api/progress"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    staleTime: 60_000,
  });

  // Home photo picker (new): opens an overlay sheet of the user's recent
  // progress scans + native Take Photo / Choose Library actions. On select,
  // we POST the data URL to /api/home-photo so it becomes the user's hero
  // photo on the dashboard. Profile head shot stays untouched.
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [pickerUploading, setPickerUploading] = useState(false);
  // PR stats popup is opened by tapping the top-right Weekly Scan pill on the
  // hero. Surfaces the user's logged PRs in one place per the v7 spec.
  const [prStatsOpen, setPrStatsOpen] = useState(false);

  // First-login goal body type prompt. Dismissal is keyed by user email
  // in localStorage so the modal only ever shows once per user on this
  // device — never re-pops when the user taps Home from the bottom nav.
  const dismissKey = `flexin.goalDismissed:${getUserEmail() || "anon"}`;
  const [goalDismissed, setGoalDismissed] = useState<boolean>(() => {
    try { return localStorage.getItem(dismissKey) === "1"; } catch { return false; }
  });
  function dismissGoalModal() {
    try { localStorage.setItem(dismissKey, "1"); } catch {}
    setGoalDismissed(true);
  }

  // Merge any client-side feed events (squad creation, workout logs) onto
  // the server feed so the dashboard's SQUAD FEED card actually populates.
  // Today the server returns []; once a feed table lands we can flip this
  // to server-only and delete the merge.
  //
  // IMPORTANT: this hook MUST run on every render, BEFORE the isLoading/!data
  // early return below — otherwise React's hook-order invariant breaks the
  // moment the dashboard query resolves and we render a blank screen.
  const squadFeedFromData = data?.squadFeed;
  const mergedFeed = React.useMemo(() => {
    let local: any[] = [];
    try {
      local = getFeed(getUserEmail() || "anon").map((e) => ({
        id: e.id,
        userName: e.userName,
        avatarUrl: e.avatarUrl ?? null,
        message: e.message,
        kind: e.kind,
        energyDelta: e.energyDelta,
        reactions: e.reactions,
        minutesAgo: minutesAgo(e.createdAt),
      }));
    } catch {
      local = [];
    }
    return [...local, ...(squadFeedFromData ?? [])];
  }, [squadFeedFromData]);

  if (isLoading || !data) {
    return (
      <div style={{ minHeight: "100vh", background: t.bg, color: t.text, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: t.textMuted, fontSize: 14 }}>Loading…</div>
      </div>
    );
  }

  const { user, bodyDeltas, energy, weeklyScanDaysLeft, monthStats, evolutionTimeline } = data;

  // ── Home photo picker helpers ────────────────────────────────────────
  // The picker can pass us either a fresh data URL (from <input type=file>
  // or @capacitor/camera) OR a regular http(s) URL pointing at a previously
  // uploaded progress-scan photo. The /api/home-photo endpoint only accepts
  // `data:image/...;base64,...` payloads, so we normalize first.
  async function urlToDataUrl(src: string): Promise<string> {
    if (src.startsWith("data:")) return src;
    const blob = await fetch(src).then((r) => {
      if (!r.ok) throw new Error(`Could not load photo (${r.status})`);
      return r.blob();
    });
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Could not read photo"));
      reader.readAsDataURL(blob);
    });
  }

  async function uploadHomePhoto(srcUrl: string) {
    setPickerUploading(true);
    setPickerError(null);
    try {
      const dataUrl = await urlToDataUrl(srcUrl);
      const email = getUserEmail();
      const resp = await fetch(`${API_BASE}/api/home-photo`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(email ? { "x-user-email": email } : {}),
        },
        body: JSON.stringify({ image: dataUrl }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Upload failed" }));
        throw new Error(err.error || `Upload failed (${resp.status})`);
      }
      await queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      setPickerOpen(false);
    } catch (e: any) {
      setPickerError(e?.message || "Couldn't set photo");
    } finally {
      setPickerUploading(false);
    }
  }

  const pickerScans = (progressData?.recentScans || []).filter((s) => !!s.photoUrl);
  const xpPct = Math.min(100, Math.round((user.xp / user.xpToNext) * 100));
  // Resolve the chosen body-type avatar; fall back to legacy silhouette if unset.
  const silhouette = user.avatarBodyType
    ? avatarImageFor(user.avatarBodyType, (user.sex === "female" ? "female" : "male"))
    : defaultSilhouette;
  // If the user uploaded a real photo, prefer it over the silhouette/avatar.
  const heroPhoto = (user.avatarUrl && user.avatarUrl.length > 0) ? user.avatarUrl : null;

  const showGoalModal = !goalDismissed && !user.goalAvatarBodyType;

  return (
    <div style={{ minHeight: "100vh", background: t.bg, color: t.text, paddingBottom: 110, overflowX: "hidden" }}>
      {showGoalModal && (
        <GoalBodyTypeModal
          sex={user.sex === "female" ? "female" : "male"}
          initialGoal={user.goalAvatarBodyType ?? null}
          onSaved={() => dismissGoalModal()}
          onDismiss={() => dismissGoalModal()}
        />
      )}

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
        heroPhoto={heroPhoto}
        isFemale={isFemale}
        onOpenProfile={onOpenProfile}
        onOpenPhotoPicker={() => { setPickerError(null); setPickerOpen(true); }}
        onOpenPRStats={() => setPrStatsOpen(true)}
      />

      {prStatsOpen && (
        <PRStatsModal
          t={t}
          userName={user.name || "You"}
          avatarUrl={user.avatarUrl || null}
          onClose={() => setPrStatsOpen(false)}
        />
      )}

      {/* ═════════════════════ HOME PHOTO PICKER MODAL ═════════════════════ */}
      {pickerOpen && (
        <HomePhotoPicker
          t={t}
          scans={pickerScans}
          uploading={pickerUploading}
          error={pickerError}
          onClose={() => setPickerOpen(false)}
          onSelectExisting={(url) => uploadHomePhoto(url)}
        />
      )}

      {/* ═════════════════════ SQUAD FEED + EVOLUTION (right under the avatar) ═════════════════════ */}
      <div style={{ padding: "6px 14px 0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <SquadFeedCard t={t} feed={mergedFeed} onOpenFeed={onOpenFeed} onOpenSquad={onOpenSquad} />
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
  energy, bodyDeltas, weeklyScanDaysLeft, unreadAlerts, isPremium, silhouette, heroPhoto, isFemale, onOpenProfile, onOpenPhotoPicker, onOpenPRStats,
}: {
  t: any; userName: string; streakDays: number; formLevel: number; formRank: string;
  xp: number; xpToNext: number; xpPct: number;
  energy: { percent: number; message: string };
  bodyDeltas: DashboardPayload["bodyDeltas"];
  weeklyScanDaysLeft: number; unreadAlerts: number; isPremium: boolean;
  silhouette: string; heroPhoto: string | null; isFemale: boolean;
  onOpenProfile: () => void; onOpenPhotoPicker: () => void;
  onOpenPRStats: () => void;
}) {
  return (
    <div style={{ position: "relative", paddingTop: "max(env(safe-area-inset-top), 14px)", paddingBottom: 8, minHeight: 520, overflow: "hidden" }}>

      {/* Background avatar:
          - If the user uploaded a real photo → show it inside a rounded card.
          - Otherwise fall back to the legacy muscle-map silhouette. */}
      <div style={{ position: "absolute", inset: 0, display: "flex", justifyContent: "center", alignItems: "flex-start", pointerEvents: "none" }}>
        {heroPhoto ? (
          <div style={{
            marginTop: 70,
            width: 240, height: 320, borderRadius: 24,
            overflow: "hidden",
            border: `2px solid ${t.accent}`,
            boxShadow: `0 0 28px ${t.accentGlow}`,
            background: t.bgElevated,
          }}>
            <img
              src={heroPhoto}
              alt="Your photo"
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          </div>
        ) : (
          <img
            src={silhouette}
            alt={isFemale ? "Female muscle map" : "Male muscle map"}
            style={{
              height: 420, marginTop: 60, objectFit: "contain",
              mixBlendMode: isFemale ? "multiply" : "screen",
              opacity: isFemale ? 1 : 0.95,
            }}
          />
        )}
      </div>

      {/* "USE PROGRESS PHOTO" button — opens an in-app picker showing the
          user's existing progress scans + Take Photo / Choose Library so
          they can pick a hero image without leaving Home. (Per user: this
          must NOT navigate to the Progress page.) */}
      <button
        onClick={onOpenPhotoPicker}
        data-testid="home-use-progress-photo"
        style={{
          position: "absolute", left: "50%", bottom: 12, transform: "translateX(-50%)",
          background: `${t.bgElevated}EE`,
          color: t.accent, border: `1px solid ${t.accent}80`,
          borderRadius: 18, padding: "8px 14px",
          fontSize: 11, fontWeight: 800, letterSpacing: 1,
          cursor: "pointer", whiteSpace: "nowrap",
          boxShadow: `0 0 12px ${t.accentGlow}`,
          zIndex: 2,
        }}
      >
        ↑ USE PROGRESS PHOTO
      </button>

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
          {/* Tap to open the PR Stats popup where the user can review and
              log new personal records. Single-line label per v8 spec. */}
          <button
            onClick={onOpenPRStats}
            aria-label="Log a PR stat"
            style={{
              background: t.bgElevated, border: `1px solid ${t.border}`, borderRadius: 12,
              padding: "10px 14px", display: "flex", alignItems: "center", gap: 8,
              cursor: "pointer", color: t.text, textAlign: "left",
            }}
          >
            <BoltIcon color={t.accent} size={14} />
            <span style={{ fontSize: 11, color: t.text, fontWeight: 800, letterSpacing: 1.2 }}>
              LOG STAT
            </span>
          </button>

          {/* Body Deltas */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-end", paddingRight: 2 }}>
            {bodyDeltas.filter((d) => !d.isOverall).map((d) => (
              <div key={d.key} style={{ textAlign: "right" }}>
                <div style={{
                  fontSize: 10, color: t.textMuted, letterSpacing: 1, fontWeight: 600,
                }}>{d.label}</div>
                <div style={{
                  fontSize: 13, fontWeight: 700, color: d.lastLiftedDay ? t.accent : t.textMuted,
                  lineHeight: 1.1,
                  textShadow: d.lastLiftedDay ? `0 0 8px ${t.accentGlow}` : "none",
                }}>
                  {d.lastLiftedDay || "—"}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════ HOME PHOTO PICKER ════════════════════════
function HomePhotoPicker({
  t, scans, uploading, error, onClose, onSelectExisting,
}: {
  t: any;
  scans: ProgressScanLite[];
  uploading: boolean;
  error: string | null;
  onClose: () => void;
  onSelectExisting: (url: string) => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 90,
        background: "rgba(0,0,0,0.78)",
        backdropFilter: "blur(6px)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 520,
          background: t.bg, color: t.text,
          borderTopLeftRadius: 24, borderTopRightRadius: 24,
          padding: "18px 16px max(env(safe-area-inset-bottom), 20px)",
          border: `1px solid ${t.border}`,
          maxHeight: "82vh", overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: 1 }}>USE PROGRESS PHOTO</div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "transparent", border: "none", cursor: "pointer",
              color: t.textMuted, padding: 6, fontSize: 18, fontWeight: 700,
            }}
          >✕</button>
        </div>

        {error && (
          <div style={{
            background: "#3a0f0f", color: "#ffb3b3", padding: "8px 12px",
            borderRadius: 10, fontSize: 12, marginBottom: 10,
          }}>{error}</div>
        )}

        {/* Per user: the Home photo picker is ONLY for choosing an existing
            progress scan — no Take Photo / Choose Library buttons here.
            Users who don't have a scan yet take one from the Progress page. */}
        <div style={{ fontSize: 10, color: t.textMuted, fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>
          PICK FROM YOUR PROGRESS SCANS
        </div>

        {scans.length === 0 ? (
          <div style={{
            padding: "24px 12px", textAlign: "center",
            color: t.textMuted, fontSize: 12, lineHeight: 1.5,
            border: `1px dashed ${t.border}`, borderRadius: 12,
          }}>
            No progress photos yet.<br />Take one from the Progress page first.
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            {scans.map((s) => (
              <button
                key={s.id}
                disabled={uploading}
                onClick={() => s.photoUrl && onSelectExisting(s.photoUrl)}
                style={{
                  aspectRatio: "3 / 4", borderRadius: 12, overflow: "hidden",
                  border: `1px solid ${t.border}`, padding: 0,
                  cursor: uploading ? "not-allowed" : "pointer",
                  background: "#0a0a0a",
                  opacity: uploading ? 0.5 : 1,
                }}
                aria-label={`Use scan from ${s.dateLabel}`}
              >
                <img
                  src={s.photoUrl!}
                  alt={s.dateLabel}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
              </button>
            ))}
          </div>
        )}

        {uploading && (
          <div style={{ textAlign: "center", marginTop: 12, fontSize: 11, color: t.textMuted }}>
            Saving…
          </div>
        )}

        {/* Cancel — explicit way out if the user doesn't want to set a photo. */}
        <button
          onClick={onClose}
          disabled={uploading}
          style={{
            marginTop: 16, width: "100%",
            padding: "14px 10px", borderRadius: 14,
            background: t.bgElevated, color: t.text,
            border: `1px solid ${t.border}`,
            fontSize: 12, fontWeight: 800, letterSpacing: 1,
            cursor: uploading ? "not-allowed" : "pointer",
            opacity: uploading ? 0.5 : 1,
          }}
        >CANCEL</button>
      </div>
    </div>
  );
}

// ════════════════════════════ SQUAD FEED ════════════════════════════
function SquadFeedCard({ t, feed, onOpenFeed, onOpenSquad }: { t: any; feed: any[]; onOpenFeed: () => void; onOpenSquad: () => void }) {
  return (
    <div
      onClick={onOpenSquad}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenSquad(); } }}
      style={{ background: t.bgElevated, border: `1px solid ${t.border}`, borderRadius: 16, padding: "12px 12px 10px", cursor: "pointer" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: 0.5 }}>SQUAD FEED</span>
        <button onClick={(e) => { e.stopPropagation(); onOpenSquad(); }} style={{ background: "none", border: "none", color: t.accent, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
          View all
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {feed.length === 0 && (
          <div style={{ color: t.textMuted, fontSize: 11, lineHeight: 1.4 }}>
            No activity yet. Tap to name your squad and log your first workout.
          </div>
        )}
        {feed.slice(0, 4).map((f) => (
          <div key={f.id} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            {f.avatarUrl ? (
              <img
                src={f.avatarUrl}
                alt={f.userName}
                style={{
                  width: 28, height: 28, borderRadius: 14, objectFit: "cover",
                  flexShrink: 0, border: `1px solid ${t.border}`,
                }}
              />
            ) : (
              <div style={{
                width: 28, height: 28, borderRadius: 14,
                background: `linear-gradient(135deg, ${t.gradientFrom}, ${t.gradientTo})`,
                display: "grid", placeItems: "center", color: t.accentText, fontWeight: 800, fontSize: 12,
                flexShrink: 0,
              }}>{(f.userName || "?").charAt(0).toUpperCase()}</div>
            )}
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
// FIRST progress photo on the left, LATEST on the right, labeled by week.
// Falls back to the legacy silhouette timeline when the user doesn't have
// at least 2 real photos yet so the card never goes blank.
interface ProgressScanLite {
  id: number;
  date: string;
  dateLabel: string;
  isLatest?: boolean;
  photoUrl: string | null;
}
interface ProgressPayloadLite {
  recentScans?: ProgressScanLite[];
}
function EvolutionCard({ t, timeline, silhouette, isFemale, onOpenProgress }: {
  t: any; timeline: DashboardPayload["evolutionTimeline"]; silhouette: string; isFemale: boolean; onOpenProgress?: () => void;
}) {
  const openProgress = () => onOpenProgress?.();
  const { data: progressData } = useQuery<ProgressPayloadLite>({
    queryKey: ["/api/progress"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    staleTime: 60_000,
  });
  const photos = (progressData?.recentScans || []).filter((s) => !!s.photoUrl);
  let firstPhoto: ProgressScanLite | null = null;
  let latestPhoto: ProgressScanLite | null = null;
  let latestWeekLabel = "LATEST";
  if (photos.length >= 2) {
    const sorted = [...photos].sort((a, b) => a.date.localeCompare(b.date));
    firstPhoto = sorted[0];
    latestPhoto = sorted[sorted.length - 1];
    try {
      const d1 = new Date(firstPhoto.date).getTime();
      const d2 = new Date(latestPhoto.date).getTime();
      const days = Math.max(0, Math.round((d2 - d1) / 86400000));
      const weekNum = Math.max(2, Math.round(days / 7) + 1);
      latestWeekLabel = `WEEK ${weekNum}`;
    } catch {}
  }
  const showPhotos = !!(firstPhoto && latestPhoto);

  return (
    <div
      onClick={openProgress}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openProgress(); } }}
      style={{ background: t.bgElevated, border: `1px solid ${t.border}`, borderRadius: 16, padding: "12px 12px 14px", cursor: "pointer" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.5 }}>EVOLUTION</span>
        <button onClick={(e) => { e.stopPropagation(); openProgress(); }} style={{ background: "none", border: "none", color: t.accent, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
          View all
        </button>
      </div>

      {showPhotos ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 4 }}>
            <div style={{ fontSize: 9, textAlign: "center", color: t.textMuted, fontWeight: 700, letterSpacing: 0.4 }}>WEEK 1</div>
            <div style={{ fontSize: 9, textAlign: "center", color: t.accent, fontWeight: 800, letterSpacing: 0.4 }}>{latestWeekLabel}</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <div style={{ aspectRatio: "3 / 4", borderRadius: 10, overflow: "hidden", border: `1px solid ${t.border}`, background: "#0a0a0a" }}>
              <img src={firstPhoto!.photoUrl!} alt="First scan" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
            <div style={{ aspectRatio: "3 / 4", borderRadius: 10, overflow: "hidden", border: `2px solid ${t.accent}`, boxShadow: `0 0 10px ${t.accentGlow}`, background: "#0a0a0a" }}>
              <img src={latestPhoto!.photoUrl!} alt="Latest scan" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
          </div>
        </>
      ) : (
        <>
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
        </>
      )}
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
        <NavBtn t={t} label="Workout"  onClick={onOpenLogWorkout}          icon={<DumbbellGlyph color={t.textMuted} size={22} />} active={false} />
        <NavBtn t={t} label="Squad"    onClick={onOpenSquad}               icon={<SquadIcon    color={t.textMuted} />} active={false} />
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
// ════════════════════════════ PR STATS MODAL ════════════════════════════
// Reads PR feed events (kind === "pr") from local feed storage and shows
// a quick summary keyed by exercise name. Replaces the old Weekly Scan
// pill's no-op behavior. PRs are stored locally via pushFeedEvent so this
// works offline and does not need a backend round-trip.
function PRStatsModal({ t, userName, avatarUrl, onClose }: { t: any; userName: string; avatarUrl: string | null; onClose: () => void }) {
  const email = (getUserEmail() || "anon").toLowerCase();
  // Local refresh tick so newly logged PRs appear immediately.
  const [tick, setTick] = useState(0);
  // Inline "Log a PR" form
  const [showForm, setShowForm] = useState(false);
  const [liftName, setLiftName] = useState("");
  const [liftWeight, setLiftWeight] = useState("");
  const [liftReps, setLiftReps] = useState("");
  const [liftSets, setLiftSets] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  function submitPR() {
    const name = liftName.trim();
    const wt = liftWeight.trim();
    if (!name) { setFormError("Lift name required"); return; }
    if (!wt) { setFormError("Weight required"); return; }
    try {
      pushFeedEvent(email, {
        userName,
        avatarUrl,
        message: `${name} — ${wt} lbs${liftReps ? ` x ${liftReps}` : ""}${liftSets ? ` x ${liftSets} sets` : ""}`,
        kind: "pr",
      });
    } catch {}
    setLiftName(""); setLiftWeight(""); setLiftReps(""); setLiftSets("");
    setFormError(null);
    setShowForm(false);
    setTick((n) => n + 1);
  }

  // Aggregate PRs across global + scoped feed buckets.
  const all = React.useMemo(() => {
    try { return getFeed(email, null).filter((e) => e?.kind === "pr"); }
    catch { return [] as any[]; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, tick]);
  // Group by message-derived lift name (best-effort: take the first token
  // before " — " or full message). Each entry shows the most recent.
  const groups = new Map<string, { message: string; createdAt: number; count: number }>();
  for (const evt of all) {
    const m = String(evt.message || "PR");
    const key = m.split(" — ")[0].split(" – ")[0].slice(0, 64);
    const prev = groups.get(key);
    if (!prev || evt.createdAt > prev.createdAt) {
      groups.set(key, { message: m, createdAt: evt.createdAt, count: (prev?.count || 0) + 1 });
    } else {
      prev.count += 1;
    }
  }
  const items = Array.from(groups.values()).sort((a, b) => b.createdAt - a.createdAt);
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
        zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center",
        padding: 18,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 380, maxHeight: "80vh", overflow: "auto",
          background: t.bgElevated, border: `1px solid ${t.border}`,
          borderRadius: 18, padding: 18, color: t.text,
          boxShadow: `0 12px 40px rgba(0,0,0,0.5)`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <BoltIcon color={t.accent} size={18} />
            <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: 1.5 }}>PR STATS</span>
          </div>
          <button
            onClick={onClose}
            style={{ background: "transparent", border: "none", color: t.textMuted, fontSize: 22, cursor: "pointer", lineHeight: 1 }}
            aria-label="Close"
          >×</button>
        </div>

        {/* Log a new PR — either a CTA button or the inline form. */}
        {!showForm ? (
          <button
            onClick={() => setShowForm(true)}
            style={{
              width: "100%", padding: "12px 14px", borderRadius: 12,
              background: `linear-gradient(135deg, ${t.gradientFrom}, ${t.gradientTo})`,
              color: t.accentText, border: "none", fontSize: 13, fontWeight: 800,
              letterSpacing: 1.2, cursor: "pointer", marginBottom: 14,
              boxShadow: `0 8px 22px ${t.accentGlow}`,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            <BoltIcon color={t.accentText} size={14} />
            LOG A PR
          </button>
        ) : (
          <div style={{
            background: t.bgInput, border: `1px solid ${t.accent}40`,
            borderRadius: 14, padding: 12, marginBottom: 14,
          }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.5, color: t.accent, marginBottom: 8 }}>
              NEW PR
            </div>
            <input
              value={liftName}
              onChange={(e) => setLiftName(e.target.value)}
              placeholder="Lift name (e.g. Bench Press)"
              style={{
                width: "100%", boxSizing: "border-box",
                background: t.bg, border: `1px solid ${t.border}`, borderRadius: 10,
                padding: "10px 12px", color: t.text, fontSize: 13, outline: "none",
                marginBottom: 8,
              }}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 8 }}>
              <PRMiniInput t={t} value={liftWeight} onChange={setLiftWeight} placeholder="Weight" suffix="lbs" />
              <PRMiniInput t={t} value={liftReps}   onChange={setLiftReps}   placeholder="Reps" />
              <PRMiniInput t={t} value={liftSets}   onChange={setLiftSets}   placeholder="Sets" />
            </div>
            {formError && (
              <div style={{ fontSize: 11, color: "#ef4444", marginBottom: 8 }}>{formError}</div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={submitPR}
                style={{
                  flex: 1, padding: "10px 12px", borderRadius: 10, border: "none",
                  background: `linear-gradient(135deg, ${t.gradientFrom}, ${t.gradientTo})`,
                  color: t.accentText, fontSize: 12, fontWeight: 800, letterSpacing: 1, cursor: "pointer",
                }}
              >SAVE PR</button>
              <button
                onClick={() => { setShowForm(false); setFormError(null); }}
                style={{
                  padding: "10px 14px", borderRadius: 10,
                  background: "transparent", border: `1px solid ${t.border}`,
                  color: t.textMuted, fontSize: 12, fontWeight: 700, cursor: "pointer",
                }}
              >CANCEL</button>
            </div>
          </div>
        )}

        {items.length === 0 ? (
          <div style={{ color: t.textMuted, fontSize: 13, lineHeight: 1.5, padding: "12px 4px" }}>
            No PRs logged yet. Hit a personal record on any lift and it'll show up here.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {items.map((it, i) => (
              <div key={i} style={{
                background: t.bgInput, border: `1px solid ${t.border}`, borderRadius: 12,
                padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {it.message}
                  </div>
                  <div style={{ fontSize: 10, color: t.textMuted, marginTop: 2 }}>
                    {new Date(it.createdAt).toLocaleDateString()} • {it.count} PR{it.count === 1 ? "" : "s"}
                  </div>
                </div>
                <BoltIcon color={t.accent} size={14} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Small numeric input used inside PRStatsModal's "Log a PR" form.
function PRMiniInput({
  t, value, onChange, placeholder, suffix,
}: {
  t: any; value: string; onChange: (v: string) => void; placeholder: string; suffix?: string;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center",
      background: t.bg, border: `1px solid ${t.border}`, borderRadius: 10,
      padding: "8px 10px",
    }}>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))}
        placeholder={placeholder}
        inputMode="numeric"
        style={{
          flex: 1, minWidth: 0, background: "transparent", border: "none",
          color: t.text, fontSize: 13, fontWeight: 700, outline: "none",
        }}
      />
      {suffix && (
        <span style={{ fontSize: 10, color: t.textMuted, marginLeft: 4 }}>{suffix}</span>
      )}
    </div>
  );
}

function BoltIcon({ color, size = 14 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" />
    </svg>
  );
}
// Matches the bold dumbbell used on the workout page (LogWorkout `upper`).
function DumbbellIcon({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="7" width="3.5" height="10" rx="1" fill={color} />
      <rect x="5" y="5" width="2.5" height="14" rx="0.8" fill={color} />
      <rect x="7" y="10.5" width="10" height="3" fill={color} />
      <rect x="16.5" y="5" width="2.5" height="14" rx="0.8" fill={color} />
      <rect x="18.5" y="7" width="3.5" height="10" rx="1" fill={color} />
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
