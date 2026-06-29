import React, { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Capacitor } from "@capacitor/core";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { useTheme } from "@/lib/ThemeProvider";
import { getQueryFn, API_BASE, getUserEmail } from "@/lib/queryClient";
import flexinLogo from "@/assets/flexin_logo.png";
// (silhouette PNGs removed — the user explicitly asked for an outline-only
//  pose guide instead of the blue-tinted silhouette guy. The new
//  PoseOutlineGuide SVG component below draws just the outline.)
import {
  SilhouetteSVG,
  DEFAULT_PARAMS_MALE,
  DEFAULT_PARAMS_FEMALE,
  type SilhouetteParams,
} from "@/components/SilhouetteSVG";

// ── Types matching /api/progress response ─────────────────────────────────
interface ProgressScan {
  id: number;
  date: string;
  dateLabel: string;
  isLatest: boolean;
  intensity: number;
  photoUrl: string | null;
  renderUrl: string | null;
  silhouetteParams: SilhouetteParams | null;
  muscleEmphasis: Record<string, number> | null;
  buildLabel: string | null;
  bodyFatPct: number | null;
  muscleMassPct: number | null;
}

interface ProgressPayload {
  user: { name: string; sex: string; isFemale: boolean };
  intro: { title: string; subtitle: string };
  scanHero: {
    title: string;
    body: string;
    ctaText: string;
    buttonLabel: string;
    photoUrl: string | null;
    renderUrl: string | null;
    silhouetteParams: SilhouetteParams | null;
    buildLabel: string | null;
    bodyFatPct: number | null;
    muscleMassPct: number | null;
  };
  steps: { number: number; title: string; blurb: string }[];
  recentScans: ProgressScan[];
  hasScan: boolean;
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
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<ProgressPayload>({
    queryKey: ["/api/progress"],
    queryFn: getQueryFn({ on401: "throw" }),
    staleTime: 30_000,
    // Poll every 3s while the latest scan render is still being generated.
    refetchInterval: (q) => {
      const d = q.state.data as ProgressPayload | undefined;
      if (!d?.hasScan) return false;
      return d.scanHero.renderUrl ? false : 3_000;
    },
  });

  // Upload state for the Take Progress Photo flow
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  // After Camera returns a dataUrl we show a Keep-It / Retake preview before
  // committing the upload. This stops accidental shots from polluting the
  // Recent Scans strip.
  const [pendingPhoto, setPendingPhoto] = useState<string | null>(null);
  // Ref the Recent Scans section so we can smooth-scroll there after a
  // successful upload — the user wants the new scan to be visible
  // immediately at the bottom strip, no manual scrolling.
  const recentScansRef = useRef<HTMLDivElement | null>(null);

  // Push the bytes (as JSON base64) up to the API. The endpoint runs the
  // photo through Gemini and returns { photoUrl, renderUrl, status }.
  async function uploadDataUrl(dataUrl: string) {
    setUploadError(null);
    setUploading(true);
    try {
      const email = getUserEmail();
      const resp = await fetch(`${API_BASE}/api/progress/scan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(email ? { "x-user-email": email } : {}),
        },
        body: JSON.stringify({ photoDataUrl: dataUrl }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Upload failed" }));
        throw new Error(err.error || `Upload failed (${resp.status})`);
      }
      const result = await resp.json().catch(() => ({} as any));

      // Splice the photo + render straight into the Progress query cache so
      // the user sees their photo + AI render right away — we don't yet
      // persist scans server-side, so a refetch would lose them.
      qc.setQueryData(["/api/progress"], (prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          hasScan: true,
          scanHero: {
            ...prev.scanHero,
            title: "Your latest scan",
            body: "Photo saved. Take another next week to see your progress in the Evolution card below.",
            buttonLabel: "Take Another Photo",
            photoUrl: result?.photoUrl ?? dataUrl,
            // We no longer show the AI render — explicitly clear it.
            renderUrl: null,
          },
          recentScans: [
            {
              id: result?.scanId || Date.now(),
              date: new Date().toISOString().slice(0, 10),
              dateLabel: "Just now",
              isLatest: true,
              intensity: 0.7,
              photoUrl: result?.photoUrl ?? dataUrl,
            },
            ...((prev.recentScans || []).map((s: any) => ({ ...s, isLatest: false }))),
          ],
        };
      });

      // Also refresh the dashboard for muscle bars etc.
      await qc.invalidateQueries({ queryKey: ["/api/dashboard"] });
      // Refetch the persisted progress payload so the new scan replaces the
      // optimistic client-cache entry with the real row (including the
      // server-assigned id and createdAt). This is what fixes the bug where
      // the photo "disappeared" — previously refetch reset state to empty
      // because the server didn't persist. Now it stays.
      await qc.invalidateQueries({ queryKey: ["/api/progress"] });

      // No render-status banners anymore — we just save the photo and move on.
    } catch (e: any) {
      setUploadError(e?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  // Convert a File (web) to data URL so the upload path is identical to native
  async function fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error);
      reader.onload = () => resolve(String(reader.result || ""));
      reader.readAsDataURL(file);
    });
  }

  async function handlePhotoSelected(file: File) {
    try {
      const dataUrl = await fileToDataUrl(file);
      await uploadDataUrl(dataUrl);
    } catch (e: any) {
      setUploadError(e?.message || "Couldn't read photo");
    }
  }

  // Native (iOS) capture path — uses the Capacitor Camera plugin so the
  // OS-native action sheet (Take Photo / Choose from Library) appears with
  // proper permission prompts.
  async function handleTakePhoto() {
    if (!Capacitor.isNativePlatform()) {
      fileInputRef.current?.click();
      return;
    }
    setUploadError(null);
    try {
      const result = await Camera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Prompt, // shows Take Photo / Choose from Photos sheet
        saveToGallery: false,
        promptLabelHeader: "Progress Photo",
        promptLabelPhoto: "Choose from Photos",
        promptLabelPicture: "Take Photo",
      });
      const dataUrl = result?.dataUrl;
      if (!dataUrl) {
        setUploadError("No photo returned");
        return;
      }
      // Stage the photo as pending so the user can review BEFORE we upload.
      // The user explicitly asked for a "Keep it?" confirmation after
      // shooting a progress photo so accidental snaps don't fill up Recent
      // Scans.
      setPendingPhoto(dataUrl);
    } catch (e: any) {
      // User cancel returns an error with message like 'User cancelled photos app'
      const msg = String(e?.message || e || "");
      if (/cancel/i.test(msg)) return; // silent cancel
      setUploadError(msg || "Couldn't open camera");
    }
  }

  // Web path also stages a pending preview now — wired below at the file
  // input handler.
  async function handleFileChosen(file: File) {
    try {
      const dataUrl = await fileToDataUrl(file);
      setPendingPhoto(dataUrl);
    } catch (e: any) {
      setUploadError(e?.message || "Couldn't read photo");
    }
  }

  async function confirmPendingPhoto() {
    if (!pendingPhoto) return;
    const dataUrl = pendingPhoto;
    setPendingPhoto(null);
    await uploadDataUrl(dataUrl);
    // Smooth scroll to Recent Scans so the new photo is visible right away.
    requestAnimationFrame(() => {
      recentScansRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    });
  }

  if (isLoading || !data) {
    return (
      <div style={{ minHeight: "100vh", background: t.bg, color: t.text, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ opacity: 0.5 }}>Loading progress…</div>
      </div>
    );
  }

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
          {/* Centered full-body photo */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
            <div style={{
              width: "100%",
              maxWidth: 320,
              borderRadius: 16,
              overflow: "hidden",
              aspectRatio: "3 / 4",
              background: isFemale ? `linear-gradient(180deg, ${t.bgInput}, ${t.bgElevated})` : "#0a0a0a",
              border: `1px solid ${t.border}`,
              display: "grid", placeItems: "center",
              color: t.textDim, position: "relative",
              boxShadow: data.scanHero.photoUrl ? `0 8px 28px ${t.accentGlow}` : "none",
            }}>
              {data.scanHero.photoUrl ? (
                <img
                  src={data.scanHero.photoUrl}
                  alt="Your latest photo"
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
              ) : (
                <div style={{ textAlign: "center", padding: 16, fontSize: 13, lineHeight: 1.4, position: "relative", width: "100%", height: "100%", display: "grid", placeItems: "center" }}>
                  {/* Outline-only pose guide — just the silhouette shape (no
                      light-blue filled "guy") so the user sees a clean frame
                      to stand inside. Drawn as an inline SVG so it inherits
                      the theme accent color and stays crisp at any size. */}
                  <PoseOutlineGuide accent={t.accent} female={isFemale} />
                  <div style={{ position: "relative", zIndex: 1 }}>
                    <CameraIcon color={t.textMuted} size={40} />
                    <div style={{ marginTop: 10, color: t.textMuted, fontWeight: 700, fontSize: 14 }}>No photo yet</div>
                    <div style={{ color: t.textDim, marginTop: 4 }}>Stand in the outline. Take a full-body photo to begin tracking.</div>
                  </div>
                </div>
              )}
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
            padding: "0 6px", marginBottom: data.hasScan ? 10 : 16,
          }}>
            {!data.hasScan && (
              <>
                <span style={{ color: t.accent, fontWeight: 700 }}>{data.scanHero.ctaText}</span>{" "}
              </>
            )}
            {data.scanHero.body}
          </div>

          {/* Body comp summary (if we have a scan) */}
          {data.hasScan && (
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8,
              padding: "10px 0 14px",
              borderTop: `1px solid ${t.border}`,
              marginBottom: 10,
            }}>
              <StatPill t={t} label="Build" value={(data.scanHero.buildLabel || "—").toUpperCase()} />
              <StatPill t={t} label="Body Fat" value={fmtPct(data.scanHero.bodyFatPct)} />
              <StatPill t={t} label="Muscle" value={fmtScore(data.scanHero.muscleMassPct)} />
            </div>
          )}

          {/* Big CTA */}
          <button
            onClick={() => handleTakePhoto()}
            disabled={uploading}
            style={{
              width: "100%",
              background: `linear-gradient(135deg, ${t.gradientFrom}, ${t.gradientTo})`,
              color: t.accentText, border: "none",
              borderRadius: 22, padding: "16px 18px",
              fontSize: 15, fontWeight: 800, letterSpacing: 0.4,
              cursor: uploading ? "wait" : "pointer",
              opacity: uploading ? 0.7 : 1,
              boxShadow: `0 8px 28px ${t.accentGlow}`,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            }}
          >
            {uploading ? (
              <>
                <Spinner color={t.accentText} />
                Analyzing your photo…
              </>
            ) : (
              <>
                <CameraIcon color={t.accentText} />
                {data.scanHero.buttonLabel}
              </>
            )}
          </button>

          {/* Hidden file input \u2014 camera capture on mobile, file picker on desktop */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFileChosen(f);
              e.target.value = ""; // reset so picking the same file again still fires
            }}
          />

          {uploadError && (
            <div style={{
              marginTop: 10, fontSize: 12, color: "#ff6b6b",
              textAlign: "center", fontWeight: 600,
            }}>
              {uploadError}
            </div>
          )}
        </div>
      </div>

      {/* ═════════════════════ EVOLUTION COMPARE ═════════════════════ */}
      <EvolutionCompare t={t} scans={data.recentScans} />

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
          {data.steps.map((step) => (
            <StepCard key={step.number} t={t} step={step} />
          ))}
        </div>
      </div>

      {/* ═════════════════════ KEEP-IT PREVIEW ═════════════════════ */}
      {pendingPhoto && (
        <div
          onClick={() => setPendingPhoto(null)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)",
            zIndex: 9999, display: "grid", placeItems: "center", padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: t.bgElevated, borderRadius: 22, padding: 16,
              border: `1px solid ${t.border}`, maxWidth: 380, width: "100%",
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 800, color: t.text, textAlign: "center", marginBottom: 12 }}>
              Keep this photo?
            </div>
            <div style={{ width: "100%", aspectRatio: "3 / 4", borderRadius: 14, overflow: "hidden", background: "#000" }}>
              <img src={pendingPhoto} alt="Pending progress photo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button
                onClick={() => setPendingPhoto(null)}
                style={{
                  flex: 1, padding: "14px 16px", borderRadius: 14,
                  background: t.bgInput, color: t.text,
                  border: `1px solid ${t.border}`,
                  fontSize: 13, fontWeight: 800, letterSpacing: 1, cursor: "pointer",
                }}
              >
                RETAKE
              </button>
              <button
                onClick={confirmPendingPhoto}
                disabled={uploading}
                style={{
                  flex: 1, padding: "14px 16px", borderRadius: 14,
                  background: `linear-gradient(135deg, ${t.gradientFrom}, ${t.gradientTo})`,
                  color: t.accentText, border: "none",
                  fontSize: 13, fontWeight: 800, letterSpacing: 1,
                  cursor: uploading ? "wait" : "pointer",
                  boxShadow: `0 8px 26px ${t.accentGlow}`,
                }}
              >
                {uploading ? "SAVING…" : "KEEP IT"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════ RECENT SCANS ═════════════════════ */}
      <div ref={recentScansRef} style={{ padding: "20px 14px 0" }}>
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

        {data.recentScans.length === 0 ? (
          <div style={{
            background: t.bgElevated, border: `1px dashed ${t.border}`,
            borderRadius: 16, padding: "22px 16px", textAlign: "center",
            color: t.textMuted, fontSize: 13, lineHeight: 1.5,
          }}>
            Your scans will appear here. Take your first photo above to start tracking.
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: `repeat(${Math.max(data.recentScans.length, 4)}, 1fr)`,
            gap: 8,
          }}>
            {data.recentScans.map((scan) => (
              <ScanTile key={scan.id} t={t} scan={scan} isFemale={isFemale} />
            ))}
            {/* Pad empty slots so the row stays 4-wide while we don't have 4 scans yet */}
            {Array.from({ length: Math.max(0, 4 - data.recentScans.length) }).map((_, i) => (
              <EmptyScanSlot key={`empty-${i}`} t={t} />
            ))}
          </div>
        )}
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

// ════════════════════════════ EVOLUTION COMPARE ════════════════════════════
function EvolutionCompare({ t, scans }: { t: any; scans: ProgressScan[] }) {
  const photos = (scans || []).filter((s) => !!s.photoUrl);
  if (photos.length < 2) return null;
  const sorted = [...photos].sort((a, b) => a.date.localeCompare(b.date));
  const first = sorted[0];
  const latest = sorted[sorted.length - 1];

  // Gap label
  let gapLabel = "";
  try {
    const d1 = new Date(first.date).getTime();
    const d2 = new Date(latest.date).getTime();
    const days = Math.max(0, Math.round((d2 - d1) / 86400000));
    if (days < 14) gapLabel = `${days} day${days === 1 ? "" : "s"} apart`;
    else if (days < 60) gapLabel = `${Math.round(days / 7)} weeks apart`;
    else gapLabel = `${Math.round(days / 30)} months apart`;
  } catch {
    gapLabel = "";
  }

  return (
    <div style={{ padding: "16px 14px 0" }}>
      <div style={{
        background: t.bgElevated,
        border: `1px solid ${t.border}`,
        borderRadius: 22,
        padding: 16,
      }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 12,
        }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: t.text }}>Evolution</div>
          {gapLabel && (
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: 0.4,
              color: t.accent,
              background: `${t.accent}1a`,
              padding: "4px 10px", borderRadius: 999,
            }}>
              {gapLabel.toUpperCase()}
            </div>
          )}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <ComparePhoto t={t} label="FIRST" dateLabel={first.dateLabel} photoUrl={first.photoUrl!} />
          <ComparePhoto t={t} label="LATEST" dateLabel={latest.dateLabel} photoUrl={latest.photoUrl!} isLatest />
        </div>
        <div style={{
          marginTop: 12, textAlign: "center",
          fontSize: 12, color: t.textMuted, lineHeight: 1.5,
        }}>
          Keep taking weekly photos to track your transformation.
        </div>
      </div>
    </div>
  );
}

function ComparePhoto({
  t, label, dateLabel, photoUrl, isLatest,
}: { t: any; label: string; dateLabel: string; photoUrl: string; isLatest?: boolean }) {
  return (
    <div style={{
      borderRadius: 14,
      overflow: "hidden",
      aspectRatio: "3 / 4",
      background: "#0a0a0a",
      border: `1px solid ${isLatest ? t.accent : t.border}`,
      position: "relative",
      boxShadow: isLatest ? `0 0 14px ${t.accentGlow}` : "none",
    }}>
      <img
        src={photoUrl}
        alt={label}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />
      <div style={{
        position: "absolute", top: 8, left: 8,
        background: isLatest ? t.accent : "rgba(0,0,0,0.65)",
        color: isLatest ? t.accentText : "#fff",
        fontSize: 10, fontWeight: 800, letterSpacing: 0.6,
        padding: "4px 8px", borderRadius: 6,
        backdropFilter: "blur(4px)",
      }}>
        {label}
      </div>
      <div style={{
        position: "absolute", bottom: 8, left: 8, right: 8,
        background: "rgba(0,0,0,0.55)",
        color: "#fff",
        fontSize: 10, fontWeight: 700,
        padding: "4px 8px", borderRadius: 6,
        textAlign: "center",
        backdropFilter: "blur(4px)",
      }}>
        {dateLabel}
      </div>
    </div>
  );
}

// ════════════════════════════ STAT PILL ════════════════════════════
function StatPill({ t, label, value }: { t: any; label: string; value: string }) {
  return (
    <div style={{
      textAlign: "center", padding: "6px 4px",
    }}>
      <div style={{ fontSize: 10, color: t.textDim, fontWeight: 700, letterSpacing: 0.8 }}>{label.toUpperCase()}</div>
      <div style={{ fontSize: 14, color: t.text, fontWeight: 800, marginTop: 2 }}>{value}</div>
    </div>
  );
}

function fmtPct(n: number | null) {
  if (n == null || isNaN(n)) return "—";
  return `${Math.round(n)}%`;
}
function fmtScore(n: number | null) {
  if (n == null || isNaN(n)) return "—";
  return `${Math.round(n)}`;
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
function ScanTile({ t, scan, isFemale }: { t: any; scan: ProgressScan; isFemale: boolean }) {
  const latest = scan.isLatest;
  const params = scan.silhouetteParams || (isFemale ? DEFAULT_PARAMS_FEMALE : DEFAULT_PARAMS_MALE);

  // Past scans render dimmer
  const dim = latest ? 1 : 0.55 + scan.intensity * 0.2;

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
        {scan.photoUrl ? (
          <img
            src={scan.photoUrl}
            alt={scan.dateLabel}
            style={{
              width: "100%", height: "100%", objectFit: "cover",
              opacity: dim,
              filter: latest ? `drop-shadow(0 0 10px ${t.accentGlow})` : "none",
            }}
          />
        ) : (
          <SilhouetteSVG
            params={params}
            isFemale={isFemale}
            accent={t.accent}
            style={{
              width: "90%", height: "100%",
              opacity: dim,
              filter: latest ? `drop-shadow(0 0 10px ${t.accentGlow})` : "none",
            }}
          />
        )}
      </div>
      <div style={{
        fontSize: 11, fontWeight: 700,
        color: latest ? t.accent : t.textMuted,
        textAlign: "center",
      }}>{scan.dateLabel}</div>
    </div>
  );
}

function EmptyScanSlot({ t }: { t: any }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "stretch", gap: 6 }}>
      <div style={{
        aspectRatio: "3 / 4",
        borderRadius: 12,
        border: `1px dashed ${t.border}`,
        background: "transparent",
        display: "grid", placeItems: "center",
        color: t.textDim, fontSize: 18, fontWeight: 800,
      }}>+</div>
      <div style={{ fontSize: 11, color: t.textDim, textAlign: "center" }}>Empty</div>
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
        <NavBtn t={t} label="Workout"  onClick={onOpenLogWorkout} icon={<DumbbellGlyph color={t.textMuted} size={22} />} active={false} />
        <NavBtn t={t} label="Squad"    onClick={onOpenSquad}   icon={<SquadIcon    color={active === "squad" ? t.accent : t.textMuted} />} active={active === "squad"} />
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
// Pose outline guide — a stylized full-body figure rendered as a stroke-only
// SVG so the user sees a clean outline to stand inside, with no filled
// "blue guy" inside the frame. The proportions roughly follow standard
// figure-drawing guidelines (~7.5 heads tall, slight male/female hip-shoulder
// ratio difference). Stroke uses the active theme accent at low opacity so
// it's a guide, not a focal point.
function PoseOutlineGuide({ accent, female }: { accent: string; female: boolean }) {
  // Female: narrower shoulders, wider hips. Male: wider shoulders, narrower hips.
  const shoulderX = female ? 30 : 36;
  const hipX = female ? 28 : 22;
  return (
    <svg
      viewBox="0 0 100 220"
      aria-hidden="true"
      style={{
        position: "absolute", top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        height: "92%", width: "auto",
        pointerEvents: "none", opacity: 0.30,
      }}
      preserveAspectRatio="xMidYMid meet"
    >
      <g
        fill="none"
        stroke={accent}
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Head */}
        <ellipse cx="50" cy="18" rx="10" ry="12" />
        {/* Neck */}
        <path d={`M44,30 L${50 - shoulderX / 2 + 4},42 M56,30 L${50 + shoulderX / 2 - 4},42`} />
        {/* Torso: shoulders → waist → hips (front silhouette) */}
        <path
          d={`
            M${50 - shoulderX},42
            Q${50 - shoulderX + 4},75 ${50 - 14},95
            Q${50 - hipX},112 ${50 - hipX},120
            L${50 - hipX + 6},122
          `}
        />
        <path
          d={`
            M${50 + shoulderX},42
            Q${50 + shoulderX - 4},75 ${50 + 14},95
            Q${50 + hipX},112 ${50 + hipX},120
            L${50 + hipX - 6},122
          `}
        />
        {/* Arms — slightly out, palms forward (matches the framing prompt) */}
        <path d={`M${50 - shoulderX},42 Q${50 - shoulderX - 6},75 ${50 - shoulderX - 8},108`} />
        <path d={`M${50 + shoulderX},42 Q${50 + shoulderX + 6},75 ${50 + shoulderX + 8},108`} />
        {/* Hands (small ovals at end of arms) */}
        <ellipse cx={50 - shoulderX - 8} cy="114" rx="3.2" ry="5" />
        <ellipse cx={50 + shoulderX + 8} cy="114" rx="3.2" ry="5" />
        {/* Legs — inner + outer lines for each leg, slight stance */}
        <path d={`M${50 - hipX + 6},122 Q${50 - 14},160 ${50 - 12},205`} />
        <path d={`M${50 - 4},122 Q${50 - 6},160 ${50 - 6},205`} />
        <path d={`M${50 + hipX - 6},122 Q${50 + 14},160 ${50 + 12},205`} />
        <path d={`M${50 + 4},122 Q${50 + 6},160 ${50 + 6},205`} />
        {/* Feet */}
        <path d={`M${50 - 12},205 L${50 - 16},210 L${50 - 4},210 Z`} />
        <path d={`M${50 + 4},210 L${50 + 16},210 L${50 + 12},205 Z`} />
        {/* Centerline tick at waist — helps users center themselves */}
        <path d="M50,95 L50,105" strokeDasharray="2 3" opacity="0.7" />
      </g>
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
function PersonIcon({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="4" stroke={color} strokeWidth="1.8" />
      <path d="M4 21c0-4 4-7 8-7s8 3 8 7" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function Spinner({ color }: { color: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2.4" strokeOpacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke={color} strokeWidth="2.4" strokeLinecap="round">
        <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.9s" repeatCount="indefinite" />
      </path>
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
