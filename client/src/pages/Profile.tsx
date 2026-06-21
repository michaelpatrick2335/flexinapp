import React, { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "@/lib/ThemeProvider";
import { getQueryFn } from "@/lib/queryClient";
import flexinLogo from "@/assets/flexin_logo.png";

// ── Types ──────────────────────────────────────────────────────────────────
// We reuse the user slice from /api/dashboard, which already returns name,
// email, sex, isPremium, formLevel, formRank, etc.
interface DashboardUser {
  id: number;
  name: string;
  email: string;
  sex: string;
  formLevel: number;
  formRank: string;
  isPremium: boolean;
  age: number | null;
  weightLbs: number | null;
  xp: number;
  xpToNext: number;
  streakDays: number;
  avatarUrl: string | null;
}

interface ProfileProps {
  onBack: () => void;
  onOpenFeed: () => void;
  onOpenSquad: () => void;
  onOpenLogWorkout: () => void;
  onOpenProgress?: () => void;
  onOpenNotificationSettings: () => void;
  onOpenPrivacySettings: () => void;
  onLogOut: () => void;
}

export function Profile({
  onOpenFeed,
  onOpenSquad,
  onOpenLogWorkout,
  onOpenProgress,
  onOpenNotificationSettings,
  onOpenPrivacySettings,
  onLogOut,
}: ProfileProps) {
  const t = useTheme();
  const isFemale = t.name === "pink";

  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ user: DashboardUser }>({
    queryKey: ["/api/dashboard"],
    queryFn: getQueryFn({ on401: "throw" }),
    staleTime: 30_000,
  });

  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  // If the avatar image fails to load (404, stale URL), fall back to initial.
  const [avatarImgFailed, setAvatarImgFailed] = useState(false);

  const userEmail = typeof window !== "undefined"
    ? (localStorage.getItem("flexin_user_email") || "").trim()
    : "";

  async function handleAvatarSelected(file: File) {
    setAvatarError(null);
    setUploadingAvatar(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const resp = await fetch("/api/profile-pic", {
        method: "POST",
        body: fd,
        headers: userEmail ? { "x-user-email": userEmail } : undefined,
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Upload failed" }));
        throw new Error(err.error || `Upload failed (${resp.status})`);
      }
      await qc.invalidateQueries({ queryKey: ["/api/dashboard"] });
    } catch (e: any) {
      setAvatarError(e?.message || "Upload failed");
    } finally {
      setUploadingAvatar(false);
    }
  }

  if (isLoading || !data) {
    return (
      <div style={{ minHeight: "100vh", background: t.bg, color: t.text, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ opacity: 0.5 }}>Loading profile…</div>
      </div>
    );
  }

  const user = data.user;
  const initial = (user.name || "?").trim().charAt(0).toUpperCase();

  // Lightly-tinted accent circle, same idiom as the Members-box Avatar.
  const avatarBg = `${t.accent}22`;

  return (
    <div style={{ minHeight: "100vh", background: t.bg, color: t.text, paddingBottom: 110, overflowX: "hidden" }}>

      {/* ═════════════════════ HEADER ═════════════════════ */}
      <div style={{ paddingTop: "max(env(safe-area-inset-top), 14px)", padding: "14px 18px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <img
            src={flexinLogo}
            alt="flexin"
            style={{
              height: 22, width: "auto",
              filter: isFemale
                ? `drop-shadow(0 0 10px ${t.accentGlow}) brightness(0) saturate(100%) invert(38%) sepia(91%) saturate(2200%) hue-rotate(316deg) brightness(101%) contrast(101%)`
                : `drop-shadow(0 0 10px ${t.accentGlow})`,
            }}
          />
        </div>

        <h1 style={{
          margin: "18px 0 0", fontSize: 34, lineHeight: 1.05, fontWeight: 800,
          color: t.text, letterSpacing: -0.5,
        }}>
          Profile
        </h1>
      </div>

      {/* ═════════════════════ AVATAR + NAME + STATUS ═════════════════════ */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "28px 18px 8px" }}>
        <div style={{ position: "relative", width: 168, height: 168 }}>
          {/* Glowing ring */}
          <div style={{
            position: "absolute", inset: 0,
            borderRadius: 84,
            border: `2px solid ${t.accent}`,
            boxShadow: `0 0 26px ${t.accentGlow}, inset 0 0 16px ${t.accentGlow}`,
          }} />
          {/* Avatar circle */}
          <div style={{
            position: "absolute", inset: 6,
            borderRadius: 78,
            background: user.avatarUrl ? "transparent" : avatarBg,
            display: "grid", placeItems: "center",
            overflow: "hidden",
          }}>
            {user.avatarUrl && !avatarImgFailed ? (
              <img
                src={user.avatarUrl}
                alt=""
                onError={() => setAvatarImgFailed(true)}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <span style={{
                fontSize: 78, fontWeight: 800, color: t.accent,
                lineHeight: 1, letterSpacing: -2,
              }}>{initial}</span>
            )}
          </div>
          {/* Hidden file input */}
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleAvatarSelected(f);
              if (e.target) e.target.value = "";
            }}
          />
          {/* Edit pencil */}
          <button
            aria-label="Change profile picture"
            onClick={() => avatarInputRef.current?.click()}
            disabled={uploadingAvatar}
            style={{
              position: "absolute", right: 6, bottom: 6,
              width: 44, height: 44, borderRadius: 22,
              background: t.bgElevated,
              border: `2px solid ${t.accent}`,
              display: "grid", placeItems: "center",
              cursor: uploadingAvatar ? "wait" : "pointer",
              boxShadow: `0 0 10px ${t.accentGlow}`,
              opacity: uploadingAvatar ? 0.6 : 1,
            }}
          >
            <PencilIcon color={t.accent} />
          </button>
          {/* Uploading overlay */}
          {uploadingAvatar && (
            <div style={{
              position: "absolute", inset: 6, borderRadius: 78,
              background: "rgba(0,0,0,0.55)",
              display: "grid", placeItems: "center",
              color: t.text, fontSize: 12, fontWeight: 700,
            }}>Uploading…</div>
          )}
        </div>

        <div style={{ marginTop: 18, fontSize: 32, fontWeight: 800, color: t.text, letterSpacing: -0.5 }}>
          {user.name}
        </div>

        {user.isPremium && (
          <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, color: t.accent, fontWeight: 700, fontSize: 16 }}>
            <CrownIcon color={t.accent} />
            <span>Premium Member</span>
            <BoltIcon color={t.accent} />
          </div>
        )}

        <div style={{ marginTop: 6, fontSize: 15, color: t.textMuted }}>
          Level {user.formLevel}
        </div>
      </div>

      {/* ═════════════════════ EMAIL CARD ═════════════════════ */}
      <div style={{ padding: "20px 18px 0" }}>
        <RowCard t={t}>
          <Row t={t} icon={<MailIcon color={t.accent} />} label="Email" value={user.email} onClick={() => {/* read-only for now */}} />
        </RowCard>
      </div>

      {/* ═════════════════════ STATS CARD ═════════════════════ */}
      <div style={{ padding: "16px 18px 0" }}>
        <RowCard t={t}>
          <Row
            t={t}
            icon={<CakeIcon color={t.accent} />}
            label="Age"
            value={user.age != null ? `${user.age}` : "—"}
            onClick={() => {/* edit coming soon */}}
          />
          <Divider t={t} />
          <Row
            t={t}
            icon={<ScaleIcon color={t.accent} />}
            label="Weight"
            value={user.weightLbs != null ? `${user.weightLbs} lbs` : "—"}
            onClick={() => {/* edit coming soon */}}
          />
        </RowCard>
      </div>

      {/* ═════════════════════ SETTINGS CARD ═════════════════════ */}
      <div style={{ padding: "16px 18px 0" }}>
        <RowCard t={t}>
          <Row
            t={t}
            icon={<PersonIcon color={t.accent} />}
            label="Change Profile Picture"
            onClick={() => {/* upload coming soon */}}
          />
          <Divider t={t} />
          <Row
            t={t}
            icon={<ShieldCheckIcon color={t.accent} />}
            label="Privacy Settings"
            onClick={onOpenPrivacySettings}
          />
          <Divider t={t} />
          <Row
            t={t}
            icon={<BellIcon color={t.accent} />}
            label="Notification Settings"
            onClick={onOpenNotificationSettings}
          />
        </RowCard>
      </div>

      {/* ═════════════════════ LOG OUT ═════════════════════ */}
      <div style={{ padding: "20px 18px 0" }}>
        <button
          onClick={onLogOut}
          style={{
            width: "100%",
            background: "transparent",
            color: t.text,
            border: `1px solid ${t.border}`,
            borderRadius: 16,
            padding: "16px 18px",
            fontSize: 16, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
            cursor: "pointer",
          }}
        >
          <LogOutIcon color={t.accent} />
          Log Out
        </button>
      </div>

      {/* ═════════════════════ DEACTIVATE ═════════════════════ */}
      <div style={{ padding: "20px 18px 0", display: "flex", justifyContent: "center" }}>
        <button
          onClick={() => setDeactivateOpen(true)}
          style={{
            background: "transparent",
            color: "#FF4D4D",
            border: "none",
            padding: "12px 18px",
            fontSize: 16, fontWeight: 700,
            display: "flex", alignItems: "center", gap: 10,
            cursor: "pointer",
          }}
        >
          <TrashIcon color="#FF4D4D" />
          Deactivate Account
        </button>
      </div>

      {/* Deactivate confirm sheet */}
      {deactivateOpen && (
        <DeactivateSheet t={t} onClose={() => setDeactivateOpen(false)} onConfirm={() => setDeactivateOpen(false)} />
      )}

      {/* ═════════════════════ BOTTOM NAV ═════════════════════ */}
      <BottomNav
        t={t}
        onOpenFeed={onOpenFeed}
        onOpenSquad={onOpenSquad}
        onOpenLogWorkout={onOpenLogWorkout}
        onOpenProgress={onOpenProgress}
        active="profile"
      />
    </div>
  );
}

// ════════════════════════════ ROW PRIMITIVES ════════════════════════════
function RowCard({ t, children }: { t: any; children: React.ReactNode }) {
  return (
    <div style={{
      background: t.bgElevated,
      border: `1px solid ${t.border}`,
      borderRadius: 18,
      overflow: "hidden",
    }}>
      {children}
    </div>
  );
}

function Row({
  t, icon, label, value, onClick,
}: {
  t: any; icon: React.ReactNode; label: string; value?: string; onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        background: "transparent",
        border: "none",
        padding: "16px 16px",
        display: "flex", alignItems: "center", gap: 14,
        cursor: onClick ? "pointer" : "default",
        textAlign: "left",
      }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: 18,
        background: `${t.accent}1a`,
        display: "grid", placeItems: "center",
        flexShrink: 0,
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>{label}</div>
        {value && <div style={{ fontSize: 13, color: t.textMuted, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</div>}
      </div>
      <ChevronRightIcon color={t.textMuted} />
    </button>
  );
}

function Divider({ t }: { t: any }) {
  return <div style={{ height: 1, background: t.border, marginLeft: 64 }} />;
}

// ════════════════════════════ DEACTIVATE SHEET ════════════════════════════
function DeactivateSheet({ t, onClose, onConfirm }: { t: any; onClose: () => void; onConfirm: () => void }) {
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
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 480,
          background: t.bgElevated,
          borderTopLeftRadius: 24, borderTopRightRadius: 24,
          border: `1px solid ${t.border}`, borderBottom: "none",
          padding: 22, paddingBottom: "calc(env(safe-area-inset-bottom) + 22px)",
        }}
      >
        <div style={{ width: 40, height: 4, background: t.border, borderRadius: 2, margin: "0 auto 14px" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <TrashIcon color="#FF4D4D" />
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: t.text }}>Deactivate Account?</h2>
        </div>
        <div style={{ fontSize: 14, color: t.textMuted, marginBottom: 18, lineHeight: 1.45 }}>
          You'll lose your streak, your squad will see you leave, and your data will be archived. You can re-activate within 30 days.
        </div>

        <button
          onClick={onConfirm}
          style={{
            width: "100%",
            background: "#FF4D4D",
            color: "#fff",
            border: "none",
            borderRadius: 22,
            padding: "14px 18px",
            fontSize: 14, fontWeight: 800, letterSpacing: 0.6,
            cursor: "pointer",
            marginBottom: 10,
          }}
        >
          Yes, deactivate
        </button>
        <button
          onClick={onClose}
          style={{
            width: "100%",
            background: "transparent",
            color: t.textMuted,
            border: `1px solid ${t.border}`,
            borderRadius: 22,
            padding: "12px 18px",
            fontSize: 14, fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════ BOTTOM NAV ════════════════════════════
function BottomNav({
  t, onOpenFeed, onOpenSquad, onOpenLogWorkout, onOpenProgress, active,
}: {
  t: any;
  onOpenFeed: () => void;
  onOpenSquad: () => void;
  onOpenLogWorkout: () => void;
  onOpenProgress?: () => void;
  active: "feed" | "squad" | "progress" | "profile";
}) {
  return (
    <div style={{
      position: "fixed", left: 0, right: 0, bottom: 0,
      paddingBottom: "calc(env(safe-area-inset-bottom) + 14px)",
      paddingTop: 14,
      background: `linear-gradient(180deg, ${t.bg}00 0%, ${t.bg}E6 35%, ${t.bg}F5 100%)`,
    }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", alignItems: "center", padding: "0 8px" }}>
        <NavBtn t={t} label="Workout"  onClick={onOpenLogWorkout} icon={<DumbbellGlyph color={t.textMuted} size={22} />} active={false} />
        <NavBtn t={t} label="Squad"    onClick={onOpenSquad}   icon={<SquadIcon   color={active === "squad" ? t.accent : t.textMuted} />} active={active === "squad"} />
        <div style={{ display: "grid", placeItems: "center" }}>
          <button
            onClick={onOpenFeed}
            aria-label="Home"
            style={{
              width: 54, height: 54, borderRadius: 27,
              background: `linear-gradient(135deg, ${t.gradientFrom}, ${t.gradientTo})`,
              border: "none", cursor: "pointer",
              display: "grid", placeItems: "center",
              boxShadow: `0 8px 24px ${t.accentGlow}`,
              color: t.accentText,
            }}
          ><HomeIcon color={t.accentText} size={26} /></button>
        </div>
        <NavBtn t={t} label="Progress" onClick={() => onOpenProgress?.()} icon={<ChartIcon color={active === "progress" ? t.accent : t.textMuted} />} active={active === "progress"} />
        <NavBtn t={t} label="Profile"  onClick={() => {}}                 icon={<PersonIcon color={active === "profile" ? t.accent : t.textMuted} />} active={active === "profile"} />
      </div>
    </div>
  );
}

function NavBtn({ t, label, onClick, icon, active }: { t: any; label: string; onClick: () => void; icon: React.ReactNode; active: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "transparent", border: "none", cursor: "pointer",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
        padding: "6px 0",
      }}
    >
      {icon}
      <span style={{ fontSize: 11, fontWeight: 700, color: active ? t.accent : t.textMuted }}>{label}</span>
    </button>
  );
}

// ════════════════════════════ ICONS ════════════════════════════
function PencilIcon({ color }: { color: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M14.06 6.19l3.75 3.75M3 21l3.5-1 12.4-12.4-2.5-2.5L4 17.5 3 21z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function CrownIcon({ color }: { color: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M3 7l4 4 5-7 5 7 4-4-2 12H5L3 7z" stroke={color} strokeWidth="1.8" strokeLinejoin="round" fill={color} fillOpacity="0.18" />
    </svg>
  );
}
function BoltIcon({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" fill={color} stroke={color} strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}
function CakeIcon({ color }: { color: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M12 3v3" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="2.6" r="1" fill={color} />
      <rect x="4" y="10" width="16" height="10" rx="2" stroke={color} strokeWidth="1.8" />
      <path d="M4 14c2 2 4 2 6 0s4-2 6 0 2 2 4 0" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function ScaleIcon({ color }: { color: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="5" width="18" height="14" rx="3" stroke={color} strokeWidth="1.8" />
      <path d="M12 8a2.4 2.4 0 100 4.8A2.4 2.4 0 0012 8z" stroke={color} strokeWidth="1.8" />
      <path d="M10.5 9.2L13 11" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function MailIcon({ color }: { color: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="5" width="18" height="14" rx="2" stroke={color} strokeWidth="1.8" />
      <path d="M3 7l9 7 9-7" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}
function PersonIcon({ color }: { color: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="4" stroke={color} strokeWidth="1.8" />
      <path d="M4 21c0-4 4-7 8-7s8 3 8 7" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function ShieldCheckIcon({ color }: { color: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9 12l2 2 4-4" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function BellIcon({ color }: { color: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M6 8a6 6 0 0112 0c0 7 3 8 3 8H3s3-1 3-8z" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M10 19a2 2 0 004 0" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function ChevronRightIcon({ color }: { color: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M9 6l6 6-6 6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function LogOutIcon({ color }: { color: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M15 4h3a2 2 0 012 2v12a2 2 0 01-2 2h-3" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M10 17l5-5-5-5M15 12H3" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function TrashIcon({ color }: { color: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function SparkleIcon({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6L12 3z" fill={color} stroke={color} strokeWidth="1" strokeLinejoin="round" />
    </svg>
  );
}
function HomeIcon({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-9z" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}
function SquadIcon({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="8" cy="8" r="3" stroke={color} strokeWidth="1.6" />
      <circle cx="16" cy="9" r="2.4" stroke={color} strokeWidth="1.6" />
      <path d="M2 19c0-3 3-5 6-5s6 2 6 5" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M14 17c1-2 3-3 5-3s3 1 3 3" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function ChartIcon({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
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
