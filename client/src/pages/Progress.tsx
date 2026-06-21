import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "@/lib/ThemeProvider";
import { getQueryFn } from "@/lib/queryClient";
import flexinLogo from "@/assets/flexin_logo.png";
import silhouetteMale from "@/assets/silhouette_male.png";
import silhouetteFemale from "@/assets/silhouette_female.png";
import progressPhotoMale from "@/assets/progress_photo_male.png";
import progressPhotoFemale from "@/assets/progress_photo_female.png";

// ── Types matching /api/progress response ─────────────────────────────────
interface ProgressScan {
  id: number;
  date: string;
  dateLabel: string;
  isLatest: boolean;
  intensity: number;
}

interface ProgressPayload {
  user: { name: string; sex: string; isFemale: boolean };
  intro: { title: string; subtitle: string };
  scanHero: { title: string; body: string; ctaText: string; buttonLabel: string };
  steps: { number: number; title: string; blurb: string }[];
  recentScans: ProgressScan[];
}

interface ProgressProps {
  onBack: () => void;
  onOpenFeed: () => void;
  onOpenSquad: () => void;
  onOpenLogWorkout: () => void;
  onOpenProfile: () => void;
}

export function Progress({ onOpenFeed, onOpenSquad, onOpenLogWorkout, onOpenProfile }: ProgressProps) {
  const t = useTheme();
  const isFemale = t.name === "pink";
  const silhouette = isFemale ? silhouetteFemale : silhouetteMale;
  const progressPhoto = isFemale ? progressPhotoFemale : progressPhotoMale;

  const { data, isLoading } = useQuery<ProgressPayload>({
    queryKey: ["/api/progress"],
    queryFn: getQueryFn({ on401: "throw" }),
    staleTime: 30_000,
  });

  if (isLoading || !data) {
    return (
      <div style={{ minHeight: "100vh", background: t.bg, color: t.text, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ opacity: 0.5 }}>Loading progress…</div>
      </div>
    );
  }

  // For the pink (light) theme, the silhouette PNG needs 'multiply' to show.
  // For the blue (dark) theme, 'screen' lets the neon glow show through.
  const silhouetteBlend: React.CSSProperties["mixBlendMode"] = isFemale ? "multiply" : "screen";

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
          <button
            aria-label="What is Progress"
            style={{
              width: 36, height: 36, borderRadius: 18,
              background: "transparent",
              border: `1.5px solid ${t.accent}`,
              color: t.accent,
              display: "grid", placeItems: "center",
              fontSize: 18, fontWeight: 800, fontFamily: "Georgia, serif",
              cursor: "pointer",
              boxShadow: `0 0 10px ${t.accentGlow}`,
            }}
          >
            i
          </button>
        </div>

        <h1 style={{
          margin: "18px 0 6px", fontSize: 34, lineHeight: 1.05, fontWeight: 800,
          color: t.text, letterSpacing: -0.5,
        }}>
          {data.intro.title}
        </h1>
        <div style={{ fontSize: 15, color: t.textMuted, lineHeight: 1.45, maxWidth: 320 }}>
          {data.intro.subtitle}
        </div>
      </div>

      {/* ═════════════════════ SCAN HERO ═════════════════════ */}
      <div style={{ padding: "20px 14px 0" }}>
        <div style={{
          background: t.bgElevated,
          border: `1px solid ${t.border}`,
          borderRadius: 22,
          padding: 16,
        }}>
          {/* Photo + arrow + silhouette */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 8, alignItems: "center", marginBottom: 18 }}>
            {/* Real photo tile */}
            <div style={{
              borderRadius: 14,
              overflow: "hidden",
              aspectRatio: "3 / 4",
              background: "#0a0a0a",
              border: `1px solid ${t.border}`,
            }}>
              <img
                src={progressPhoto}
                alt="Your photo"
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            </div>

            {/* Arrow */}
            <div style={{
              width: 32, height: 32, borderRadius: 16,
              background: `${t.accent}26`,
              display: "grid", placeItems: "center",
              boxShadow: `0 0 10px ${t.accentGlow}`,
            }}>
              <ArrowRightIcon color={t.accent} />
            </div>

            {/* Silhouette tile (grid lines + glow) */}
            <div style={{
              borderRadius: 14,
              overflow: "hidden",
              aspectRatio: "3 / 4",
              background: isFemale
                ? `linear-gradient(180deg, ${t.bgInput}, ${t.bgElevated})`
                : "#020412",
              border: `1px solid ${t.border}`,
              position: "relative",
              display: "grid", placeItems: "center",
            }}>
              {/* Subtle grid overlay */}
              <div style={{
                position: "absolute", inset: 0,
                backgroundImage: `
                  linear-gradient(to right, ${t.accent}1a 1px, transparent 1px),
                  linear-gradient(to bottom, ${t.accent}1a 1px, transparent 1px)
                `,
                backgroundSize: "32px 32px",
                pointerEvents: "none",
              }} />
              <img
                src={silhouette}
                alt="Flexin silhouette"
                style={{
                  width: "82%", height: "100%", objectFit: "contain",
                  mixBlendMode: silhouetteBlend,
                  position: "relative",
                  filter: `drop-shadow(0 0 14px ${t.accentGlow})`,
                }}
              />
            </div>
          </div>

          <div style={{
            textAlign: "center", fontSize: 20, fontWeight: 800,
            color: t.text, marginBottom: 8,
          }}>
            {data.scanHero.title}
          </div>
          <div style={{
            textAlign: "center", fontSize: 14, color: t.textMuted, lineHeight: 1.5,
            padding: "0 6px", marginBottom: 16,
          }}>
            <span style={{ color: t.accent, fontWeight: 700 }}>{data.scanHero.ctaText}</span>{" "}
            {data.scanHero.body}
          </div>

          {/* Big CTA */}
          <button
            onClick={() => {/* upload coming soon */}}
            style={{
              width: "100%",
              background: `linear-gradient(135deg, ${t.gradientFrom}, ${t.gradientTo})`,
              color: t.accentText, border: "none",
              borderRadius: 22, padding: "16px 18px",
              fontSize: 15, fontWeight: 800, letterSpacing: 0.4,
              cursor: "pointer",
              boxShadow: `0 8px 28px ${t.accentGlow}`,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            }}
          >
            <CameraIcon color={t.accentText} />
            {data.scanHero.buttonLabel}
          </button>
        </div>
      </div>

      {/* ═════════════════════ 3-STEP PROCESS ═════════════════════ */}
      <div style={{ padding: "16px 14px 0" }}>
        <div style={{
          background: t.bgElevated,
          border: `1px solid ${t.border}`,
          borderRadius: 22,
          padding: 18,
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
        }}>
          {data.steps.map((step, i) => (
            <React.Fragment key={step.number}>
              {i > 0 && (
                <div style={{
                  width: 1, background: t.border, alignSelf: "stretch", marginInline: 6,
                  display: "none", // dividers are visually integrated in mockup; using gap instead
                }} />
              )}
              <StepCard t={t} step={step} />
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* ═════════════════════ RECENT SCANS ═════════════════════ */}
      <div style={{ padding: "20px 14px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, padding: "0 4px" }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: t.text }}>Recent Scans</div>
          <button
            style={{
              background: "none", border: "none", color: t.accent,
              fontSize: 14, fontWeight: 700, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 4,
            }}
          >
            View All <ChevronRightIcon color={t.accent} size={14} />
          </button>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 8,
        }}>
          {data.recentScans.map((scan) => (
            <ScanTile
              key={scan.id}
              t={t}
              scan={scan}
              silhouette={silhouette}
              silhouetteBlend={silhouetteBlend}
              isFemale={isFemale}
            />
          ))}
        </div>
      </div>

      {/* ═════════════════════ BOTTOM NAV ═════════════════════ */}
      <BottomNav
        t={t}
        onOpenFeed={onOpenFeed}
        onOpenSquad={onOpenSquad}
        onOpenLogWorkout={onOpenLogWorkout}
        onOpenProfile={onOpenProfile}
        active="progress"
      />
    </div>
  );
}

// ════════════════════════════ STEP CARD ════════════════════════════
function StepCard({ t, step }: { t: any; step: { number: number; title: string; blurb: string } }) {
  const Icon = step.number === 1 ? CameraIcon : step.number === 2 ? PersonOutlineIcon : TrendUpIcon;
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
      padding: "4px 6px", textAlign: "center",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
        <div style={{
          width: 22, height: 22, borderRadius: 11,
          background: t.accent, color: t.accentText,
          display: "grid", placeItems: "center",
          fontSize: 12, fontWeight: 800,
          boxShadow: `0 0 10px ${t.accentGlow}`,
        }}>{step.number}</div>
        <Icon color={t.accent} size={26} />
      </div>
      <div style={{ fontSize: 14, fontWeight: 800, color: t.text, marginTop: 4 }}>{step.title}</div>
      <div style={{ fontSize: 11, color: t.textMuted, lineHeight: 1.4 }}>{step.blurb}</div>
    </div>
  );
}

// ════════════════════════════ SCAN TILE ════════════════════════════
function ScanTile({ t, scan, silhouette, silhouetteBlend, isFemale }: {
  t: any; scan: ProgressScan; silhouette: string;
  silhouetteBlend: React.CSSProperties["mixBlendMode"]; isFemale: boolean;
}) {
  const latest = scan.isLatest;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "stretch", gap: 6 }}>
      <div style={{
        position: "relative",
        aspectRatio: "3 / 4",
        borderRadius: 12,
        overflow: "hidden",
        background: isFemale
          ? `linear-gradient(180deg, ${t.bgInput}, ${t.bgElevated})`
          : "#020412",
        border: latest ? `2px solid ${t.accent}` : `1px solid ${t.border}`,
        boxShadow: latest ? `0 0 14px ${t.accentGlow}` : "none",
        display: "grid", placeItems: "center",
      }}>
        {latest && (
          <div style={{
            position: "absolute", top: 4, left: 4,
            background: t.accent, color: t.accentText,
            fontSize: 9, fontWeight: 800, letterSpacing: 0.5,
            padding: "3px 6px", borderRadius: 6,
            boxShadow: `0 0 8px ${t.accentGlow}`,
            zIndex: 2,
          }}>Latest</div>
        )}
        <img
          src={silhouette}
          alt={scan.dateLabel}
          style={{
            width: "80%", height: "100%", objectFit: "contain",
            mixBlendMode: silhouetteBlend,
            position: "relative",
            opacity: latest ? 1 : 0.55 + scan.intensity * 0.2,
            filter: latest
              ? `drop-shadow(0 0 10px ${t.accentGlow})`
              : isFemale ? "grayscale(0.3)" : "grayscale(0.3) brightness(0.8)",
          }}
        />
      </div>
      <div style={{
        fontSize: 11, fontWeight: 700,
        color: latest ? t.accent : t.textMuted,
        textAlign: "center",
      }}>{scan.dateLabel}</div>
    </div>
  );
}

// ════════════════════════════ BOTTOM NAV ════════════════════════════
function BottomNav({ t, onOpenFeed, onOpenSquad, onOpenLogWorkout, onOpenProfile, active }: {
  t: any;
  onOpenFeed: () => void;
  onOpenSquad: () => void;
  onOpenLogWorkout: () => void;
  onOpenProfile: () => void;
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
        <NavBtn t={t} label="Feed"     onClick={onOpenFeed}    icon={<SparkleIcon  color={active === "feed" ? t.accent : t.textMuted} />} active={active === "feed"} />
        <NavBtn t={t} label="Squad"    onClick={onOpenSquad}   icon={<SquadIcon    color={active === "squad" ? t.accent : t.textMuted} />} active={active === "squad"} />
        <div style={{ display: "grid", placeItems: "center" }}>
          <button
            onClick={onOpenLogWorkout}
            aria-label="Log workout"
            style={{
              width: 54, height: 54, borderRadius: 27,
              background: `linear-gradient(135deg, ${t.gradientFrom}, ${t.gradientTo})`,
              border: "none", cursor: "pointer",
              display: "grid", placeItems: "center",
              boxShadow: `0 8px 24px ${t.accentGlow}`,
              color: t.accentText, fontSize: 28, fontWeight: 800, lineHeight: 1,
            }}
          >+</button>
        </div>
        <NavBtn t={t} label="Progress" onClick={() => {}}     icon={<ChartIcon    color={active === "progress" ? t.accent : t.textMuted} />} active={active === "progress"} />
        <NavBtn t={t} label="Profile"  onClick={onOpenProfile} icon={<PersonIcon  color={active === "profile" ? t.accent : t.textMuted} />} active={active === "profile"} />
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
function ArrowRightIcon({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M5 12h14M13 6l6 6-6 6" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function CameraIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M3 8a2 2 0 012-2h2l1.5-2h7L17 6h2a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx="12" cy="13" r="3.6" stroke={color} strokeWidth="1.8" />
    </svg>
  );
}
function PersonOutlineIcon({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="7.5" r="3.2" stroke={color} strokeWidth="1.8" />
      <path d="M5 20c1.4-3.2 4-5 7-5s5.6 1.8 7 5" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function TrendUpIcon({ color, size = 24 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M4 17l5-5 4 4 7-8" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 8h6v6" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function ChevronRightIcon({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M9 6l6 6-6 6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
function PersonIcon({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="4" stroke={color} strokeWidth="1.8" />
      <path d="M4 21c0-4 4-7 8-7s8 3 8 7" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
