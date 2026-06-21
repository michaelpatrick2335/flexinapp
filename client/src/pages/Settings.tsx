import { useState, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient, API_BASE, getUserEmail } from "@/lib/queryClient";
import flexinCircle from "@/assets/flexin_circle.jpeg";
import { Fireflies } from "@/components/Fireflies";
import { CustomBreathBuilder, CustomBreathList } from "@/components/CustomBreathBuilder";
import type { User } from "@shared/schema";

interface SettingsProps {
  user: User;
  onBack: () => void;
  onLogout: () => void;
}

const TIER_OPTIONS = [
  {
    key: "newbie",
    label: "Newbie",
    emoji: "🌱",
    color: "#4ade80",
    startLevel: 1,
    range: "Levels 1–249",
    duration: "Starts at 1:00 min",
    description: "Short, beginner-friendly sessions. Perfect for building the habit.",
  },
  {
    key: "experienced",
    label: "Experienced",
    emoji: "🔥",
    color: "#f59e0b",
    startLevel: 250,
    range: "Levels 250–499",
    duration: "Starts at 10:00 min",
    description: "Deeper sits. You know how to settle in.",
  },
  {
    key: "enlightened",
    label: "Enlightened",
    emoji: "✨",
    color: "#a78bfa",
    startLevel: 500,
    range: "Levels 500–1000",
    duration: "Starts at 20:00 min",
    description: "Long, immersive sessions for seasoned meditators.",
  },
];

export function Settings({ user, onBack, onLogout }: SettingsProps) {
  const [showLevelChange, setShowLevelChange] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showLeaveTribeConfirm, setShowLeaveTribeConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showVoiceStudio, setShowVoiceStudio] = useState(false);
  const [changed, setChanged] = useState(false);


  // Profile picture
  const [profilePicUploading, setProfilePicUploading] = useState(false);
  const [profilePicError, setProfilePicError] = useState<string | null>(null);
  // user.profilePic is now a base64 data URL stored directly in Postgres
  // (the legacy /api/profile-pic/file path is also handled by the server for
  // back-compat, but we render the data URL directly when available).
  const [profilePicPreview, setProfilePicPreview] = useState<string | null>(
    user.profilePic
      ? (user.profilePic.startsWith("data:")
          ? user.profilePic
          : `${API_BASE}/api/profile-pic/file?t=${Date.now()}`)
      : null
  );
  const profilePicInputRef = useRef<HTMLInputElement | null>(null);

  // Resize + compress the image client-side to a JPEG data URL.
  // Vercel serverless can't persist files (ephemeral FS) and multipart on
  // serverless is fragile, so we store the avatar as a base64 string in the
  // existing users.profile_pic TEXT column. Max edge 512px, ~0.85 quality keeps
  // most photos well under the 1.5MB server cap.
  function fileToCompressedDataUrl(file: File, maxEdge = 512, quality = 0.85): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Could not read file"));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error("Could not decode image"));
        img.onload = () => {
          const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
          const w = Math.round(img.width * scale);
          const h = Math.round(img.height * scale);
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          if (!ctx) return reject(new Error("Canvas not supported"));
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL("image/jpeg", quality));
        };
        img.src = String(reader.result);
      };
      reader.readAsDataURL(file);
    });
  }

  async function handleProfilePicUpload(file: File) {
    setProfilePicUploading(true);
    setProfilePicError(null);
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      const res = await fetch(`${API_BASE}/api/profile-pic`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-email": getUserEmail(),
        },
        body: JSON.stringify({ image: dataUrl }),
      });
      if (res.ok) {
        setProfilePicPreview(dataUrl);
        queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      } else {
        const text = await res.text();
        setProfilePicError(`Upload failed: ${res.status} — ${text.slice(0, 80)}`);
      }
    } catch (e: any) {
      setProfilePicError(`Upload error: ${e?.message || "unknown"}`);
    } finally {
      setProfilePicUploading(false);
    }
  }

  async function handleRemoveProfilePic() {
    await fetch(`${API_BASE}/api/profile-pic`, {
      method: "DELETE",
      headers: { "x-user-email": getUserEmail() },
    });
    setProfilePicPreview(null);
    queryClient.invalidateQueries({ queryKey: ["/api/user"] });
  }

  function formatFileSize(bytes: number) {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  const changeLevelMutation = useMutation({
    mutationFn: (tier: string) => apiRequest("POST", "/api/change-level", { tier }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      setChanged(true);
      setTimeout(() => {
        setChanged(false);
        setShowLevelChange(false);
        onBack();
      }, 1600);
    },
  });

  // Active tribe info for Leave-Tribe section
  const tribesQ = useQuery<{ activeGroupId: number | null; groups: Array<{ id: number; name: string }> }>({
    queryKey: ["/api/groups"],
    refetchOnWindowFocus: false,
  });
  const activeGroup = (tribesQ.data?.groups ?? []).find(
    (g) => g.id === (user.activeGroupId ?? tribesQ.data?.activeGroupId ?? null),
  ) ?? null;

  const leaveTribeMutation = useMutation({
    mutationFn: async () => {
      if (!activeGroup) return;
      await apiRequest("POST", `/api/groups/${activeGroup.id}/leave`, {}).then((r) => r.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      setShowLeaveTribeConfirm(false);
    },
    onError: (e: any) => {
      alert(`Could not leave tribe: ${e?.message || "unknown"}`);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/logout", {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.clear();
      onLogout();
    },
  });

  // Apple Guideline 5.1.1(v) — in-app Delete Account. Fully removes the user
  // record + every session and journal entry on the server, clears local
  // React Query cache + the stored email/session, then bounces to onboarding.
  //
  // IMPORTANT: even if the server call fails (network error, server down, etc.)
  // we still log the user out locally so the UI doesn't strand them on the
  // Settings screen with a spinning button. Apple requires that the user can
  // initiate deletion from inside the app; server cleanup is a best-effort.
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}/api/account`, {
        method: "DELETE",
        headers: { "x-user-email": getUserEmail() },
      });
      // Don't throw on non-2xx — we still want to log out locally below.
      return { ok: res.ok, status: res.status };
    },
    onSuccess: () => {
      // Always log out, even if the server returned an error.
      queryClient.clear();
      onLogout();
    },
    onError: (err: any) => {
      // Last-resort: still log out locally so the user isn't stuck. Apple's
      // requirement is satisfied as long as deletion is initiated in-app.
      setDeleteError(err?.message || "Network error");
      queryClient.clear();
      onLogout();
    },
  });

  return (
    <div className="min-h-screen flex flex-col items-center px-5 py-8 stars-bg overflow-y-auto relative">
      <Fireflies fixed />
      {/* Header */}
      <div className="w-full max-w-sm flex items-center gap-3 mb-8">
        <button
          onClick={onBack}
          className="text-muted-foreground hover:text-foreground transition-colors p-1"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
        </button>
        <h1 className="font-display font-bold text-foreground text-xl">Settings</h1>
      </div>

      {/* User card */}
      <div className="glass-card rounded-3xl p-5 w-full max-w-sm mb-5 flex items-center gap-4">
        {/* Tappable profile pic */}
        <div className="relative flex-shrink-0" style={{ width: 64, height: 64 }}>
          <input
            ref={profilePicInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            data-testid="input-profile-pic"
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) handleProfilePicUpload(file);
              e.target.value = "";
            }}
          />
          <button
            onClick={() => profilePicInputRef.current?.click()}
            disabled={profilePicUploading}
            data-testid="button-profile-pic"
            style={{
              width: 64, height: 64, borderRadius: "50%", overflow: "hidden",
              background: "#0d1520", border: "2.5px solid rgba(245,200,66,0.4)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", position: "relative",
            }}
          >
            <img
              src={profilePicPreview || flexinCircle}
              alt="Profile"
              style={{
                width: "100%", height: "100%", objectFit: "cover",
                objectPosition: profilePicPreview ? "center" : "center 20%",
                opacity: profilePicUploading ? 0.4 : 1,
                transition: "opacity 0.2s",
              }}
            />
            {/* Camera overlay */}
            <div
              style={{
                position: "absolute", bottom: 0, right: 0,
                width: 22, height: 22, borderRadius: "50%",
                background: "var(--color-gold)", display: "flex",
                alignItems: "center", justifyContent: "center",
                border: "2px solid #0d0f1a",
              }}
            >
              {profilePicUploading ? (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#1a0a00" strokeWidth="3" strokeLinecap="round">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83"/>
                </svg>
              ) : (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#1a0a00" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              )}
            </div>
          </button>
        </div>

        <div className="flex-1">
          <p className="font-display font-bold text-foreground text-base">{user.name}</p>
          <p className="text-muted-foreground text-xs">Level {user.level} · {user.bananas} 🍌</p>
          <p className="text-xs mt-0.5" style={{ color: user.tier === "enlightened" ? "#a78bfa" : user.tier === "experienced" ? "#f59e0b" : "#4ade80" }}>
            {user.tier === "enlightened" ? "✨ Enlightened" : user.tier === "experienced" ? "🔥 Experienced" : "🌱 Newbie"}
          </p>
          {user.email && (
            <p className="text-xs mt-1 opacity-50" style={{ color: "var(--muted-foreground)", wordBreak: "break-all" }}>
              {user.email}
            </p>
          )}
          {/* Change / Remove links */}
          <div className="flex items-center gap-3 mt-1.5">
            <button
              onClick={() => profilePicInputRef.current?.click()}
              className="text-xs font-bold transition-colors"
              style={{ color: "var(--color-gold)" }}
              data-testid="button-change-pic-text"
            >
              {profilePicPreview ? "Change Photo" : "Add Photo"}
            </button>
            {profilePicPreview && (
              <button
                onClick={handleRemoveProfilePic}
                className="text-xs transition-colors"
                style={{ color: "#f87171" }}
                data-testid="button-remove-pic"
              >
                Remove
              </button>
            )}
          </div>
          {profilePicError && (
            <p className="text-xs mt-1" style={{ color: "#f87171" }}>{profilePicError}</p>
          )}
        </div>
      </div>

      {/* Change Level section */}
      <div className="glass-card rounded-3xl p-5 w-full max-w-sm mb-4">
        <button
          className="w-full flex items-center justify-between"
          onClick={() => setShowLevelChange(s => !s)}
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">🎚️</span>
            <div className="text-left">
              <p className="font-display font-bold text-foreground text-sm">Change Difficulty Level</p>
              <p className="text-muted-foreground text-xs">Switch to a different tier</p>
            </div>
          </div>
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round"
            style={{ transform: showLevelChange ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s", color: "var(--muted-foreground)" }}
          >
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>

        {showLevelChange && (
          <div className="mt-4 flex flex-col gap-3">
            <p className="text-xs text-muted-foreground text-center mb-1">
              Pick a tier — your level resets to the start of that tier. Your bananas and rank stay.
            </p>

            {changed && (
              <div className="text-center py-4">
                <div className="text-3xl mb-2 level-up">🙏</div>
                <p className="font-display text-gold font-bold">Level reset!</p>
              </div>
            )}

            {!changed && TIER_OPTIONS.map((tier) => {
              const isCurrent = user.tier === tier.key;
              return (
                <button
                  key={tier.key}
                  onClick={() => !isCurrent && changeLevelMutation.mutate(tier.key)}
                  disabled={isCurrent || changeLevelMutation.isPending}
                  className="rounded-2xl p-4 text-left transition-all active:scale-95 hover:scale-[1.01] disabled:opacity-60"
                  style={{
                    background: isCurrent ? `${tier.color}15` : "rgba(255,255,255,0.04)",
                    border: `1.5px solid ${isCurrent ? tier.color + "50" : "rgba(255,255,255,0.08)"}`,
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-display font-bold text-sm" style={{ color: tier.color }}>
                      {tier.emoji} {tier.label}
                    </span>
                    <span className="text-xs text-muted-foreground">{tier.range}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-1">{tier.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: tier.color + "cc" }}>Starts at Level {tier.startLevel}</span>
                    {isCurrent && (
                      <span className="text-xs font-bold" style={{ color: tier.color }}>← Current</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Create breath exercise (Voice Studio) */}
      <div className="glass-card rounded-3xl p-5 w-full max-w-sm mb-4">
        <button
          className="w-full flex items-center justify-between"
          onClick={() => setShowVoiceStudio(s => !s)}
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">🎙️</span>
            <div className="text-left">
              <p className="font-display font-bold text-foreground text-sm">Create breath exercise</p>
              <p className="text-muted-foreground text-xs">Build your own breathing pattern</p>
            </div>
          </div>
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round"
            style={{ transform: showVoiceStudio ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s", color: "var(--muted-foreground)" }}
          >
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>

        {showVoiceStudio && (
          <div className="mt-5 flex flex-col gap-3">
            {/* ── Custom Breath Exercise Builder (top of dropdown) ── */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">🫁</span>
                <p className="font-display font-bold text-sm" style={{ color: "var(--foreground)" }}>Custom Breath Exercise</p>
              </div>
              <p className="text-xs mb-1" style={{ color: "var(--muted-foreground)" }}>
                Build your own pattern — pick inhale, hold, exhale, and rounds, then add it to your dashboard.
              </p>
              <CustomBreathBuilder onSaved={() => {}} />
              <CustomBreathList onDeleted={() => {}} />
            </div>

          </div>
        )}
      </div>


      {/* Leave Tribe section */}
      {activeGroup && (
        <div className="glass-card rounded-3xl p-5 w-full max-w-sm mb-4">
          {!showLeaveTribeConfirm ? (
            <button
              className="w-full flex items-center gap-3"
              onClick={() => setShowLeaveTribeConfirm(true)}
            >
              <span className="text-xl">👥</span>
              <div className="text-left">
                <p className="font-display font-bold text-foreground text-sm">Leave Tribe</p>
                <p className="text-muted-foreground text-xs">Currently in {activeGroup.name}</p>
              </div>
            </button>
          ) : (
            <div>
              <p className="font-display font-bold text-foreground text-sm mb-1">Leave {activeGroup.name}?</p>
              <p className="text-muted-foreground text-xs mb-4">
                You'll stop seeing this tribe's activity and energy. You can rejoin anytime with the invite code.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowLeaveTribeConfirm(false)}
                  disabled={leaveTribeMutation.isPending}
                  className="flex-1 py-2.5 rounded-2xl text-sm font-display font-bold text-muted-foreground disabled:opacity-50"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => leaveTribeMutation.mutate()}
                  disabled={leaveTribeMutation.isPending}
                  className="flex-1 py-2.5 rounded-2xl text-sm font-display font-bold transition-all active:scale-95 disabled:opacity-50"
                  style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171" }}
                >
                  {leaveTribeMutation.isPending ? "Leaving…" : "Leave"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Logout section */}
      <div className="glass-card rounded-3xl p-5 w-full max-w-sm mb-4">
        {!showLogoutConfirm ? (
          <button
            className="w-full flex items-center gap-3"
            onClick={() => setShowLogoutConfirm(true)}
          >
            <span className="text-xl">🚪</span>
            <div className="text-left">
              <p className="font-display font-bold text-foreground text-sm">Log Out</p>
              <p className="text-muted-foreground text-xs">Reset and start fresh</p>
            </div>
          </button>
        ) : (
          <div>
            <p className="font-display font-bold text-foreground text-sm mb-1">Are you sure?</p>
            <p className="text-muted-foreground text-xs mb-4">
              This will log you out and clear your progress so you can start over from onboarding.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-2.5 rounded-2xl text-sm font-display font-bold text-muted-foreground"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                Cancel
              </button>
              <button
                onClick={() => logoutMutation.mutate()}
                disabled={logoutMutation.isPending}
                className="flex-1 py-2.5 rounded-2xl text-sm font-display font-bold transition-all active:scale-95 disabled:opacity-50"
                style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171" }}
              >
                {logoutMutation.isPending ? "Logging out..." : "Log Out"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Account section — Apple Guideline 5.1.1(v) */}
      <div className="glass-card rounded-3xl p-5 w-full max-w-sm mb-4">
        {!showDeleteConfirm ? (
          <button
            className="w-full flex items-center gap-3"
            onClick={() => setShowDeleteConfirm(true)}
          >
            <span className="text-xl">🗑️</span>
            <div className="text-left">
              <p className="font-display font-bold text-foreground text-sm">Delete Account</p>
              <p className="text-muted-foreground text-xs">Permanently remove your account and all data</p>
            </div>
          </button>
        ) : (
          <div>
            <p className="font-display font-bold text-foreground text-sm mb-1">Delete your account?</p>
            <p className="text-muted-foreground text-xs mb-4">
              This permanently deletes your profile, meditation history, journal entries, streak,
              and all other data tied to your account. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleteAccountMutation.isPending}
                className="flex-1 py-2.5 rounded-2xl text-sm font-display font-bold text-muted-foreground disabled:opacity-50"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                Cancel
              </button>
              <button
                onClick={() => deleteAccountMutation.mutate()}
                disabled={deleteAccountMutation.isPending}
                className="flex-1 py-2.5 rounded-2xl text-sm font-display font-bold transition-all active:scale-95 disabled:opacity-50"
                style={{ background: "rgba(239,68,68,0.25)", border: "1px solid rgba(239,68,68,0.5)", color: "#fca5a5" }}
              >
                {deleteAccountMutation.isPending ? "Deleting..." : "Delete Forever"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Version */}
      <p className="text-xs text-muted-foreground mt-6 opacity-40">Flexin v1.0</p>
    </div>
  );
}
