import React, { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTheme } from "@/lib/ThemeProvider";
import { getQueryFn, queryClient, apiRequest } from "@/lib/queryClient";

interface Category {
  key: string;
  name: string;
  summary: string;
  icon: string;
}

interface CategoriesPayload {
  sex: string;
  categories: Category[];
}

interface LogWorkoutProps {
  onBack: () => void;
  onSelectCategory: (cat: Category) => void;
}

export function LogWorkout({ onBack, onSelectCategory }: LogWorkoutProps) {
  const t = useTheme();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  // Ref on the Continue CTA so tapping a day auto-scrolls it into view.
  // The button lives below the day tiles, so on tall lists the user can't
  // see it without scrolling. Smooth-scroll on selection makes the next
  // action obvious.
  const ctaRef = useRef<HTMLButtonElement | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addDraft, setAddDraft] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  const { data, isLoading } = useQuery<CategoriesPayload>({
    queryKey: ["/api/workout-categories"],
    queryFn: getQueryFn({ on401: "throw" }),
    staleTime: 5 * 60_000,
  });

  // The server now returns both built-in tiles AND the user's saved custom
  // days. Built-ins always come first in the server response, so we just
  // render whatever the server sends in order.
  const categories = data?.categories || [];
  const selected = categories.find((c) => c.key === selectedKey) ?? categories[0];

  // One-time migration: if the previous build saved any custom days to
  // localStorage, POST them to the server then drop the local copy so they
  // survive uninstall/reinstall going forward.
  useEffect(() => {
    if (!data) return;
    try {
      const raw = localStorage.getItem("flexin.customDays");
      if (!raw) return;
      const legacy = JSON.parse(raw) as { name?: string }[];
      if (!Array.isArray(legacy) || legacy.length === 0) {
        localStorage.removeItem("flexin.customDays");
        return;
      }
      const knownNames = new Set((data.categories || []).map((c) => c.name.toLowerCase()));
      Promise.all(
        legacy
          .filter((d) => d && typeof d.name === "string" && d.name.trim() && !knownNames.has(d.name.trim().toLowerCase()))
          .map((d) => apiRequest("POST", "/api/custom-workout-day", { name: d.name!.trim() }).catch(() => null)),
      ).then(() => {
        try { localStorage.removeItem("flexin.customDays"); } catch {}
        queryClient.invalidateQueries({ queryKey: ["/api/workout-categories"] });
      });
    } catch {}
  }, [data]);

  const addMutation = useMutation({
    mutationFn: async (name: string) => {
      return apiRequest("POST", "/api/custom-workout-day", { name });
    },
    onSuccess: async (_resp, name) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/workout-categories"] });
      setAddDraft("");
      setAddError(null);
      setShowAddDialog(false);
      // Best-effort: select whichever new tile matches the name we just saved.
      try {
        const fresh = queryClient.getQueryData<CategoriesPayload>(["/api/workout-categories"]);
        const match = (fresh?.categories || []).find((c) => c.name.toLowerCase() === name.toLowerCase());
        if (match) setSelectedKey(match.key);
      } catch {}
    },
    onError: (e: any) => {
      setAddError(e?.message || "Couldn't save");
    },
  });

  function handleAddDay() {
    const v = addDraft.trim();
    if (!v) { setShowAddDialog(false); return; }
    if (addMutation.isPending) return;
    setAddError(null);
    addMutation.mutate(v);
  }

  return (
    <div style={{
      minHeight: "100vh", background: t.bg, color: t.text,
      paddingTop: "max(env(safe-area-inset-top), 18px)",
      paddingBottom: "max(env(safe-area-inset-bottom), 24px)",
      display: "flex", flexDirection: "column",
    }}>
      {/* Header: back + title + subtitle */}
      <div style={{ padding: "8px 18px 4px", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
        <button
          onClick={onBack}
          aria-label="Back"
          style={{
            position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
            background: "transparent", border: "none", padding: 8, cursor: "pointer",
            color: t.text,
          }}
        >
          <BackArrow color={t.text} />
        </button>
        <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: 2 }}>LOG WORKOUT</div>
      </div>
      <div style={{ textAlign: "center", color: t.textMuted, fontSize: 14, marginTop: 4, marginBottom: 14 }}>
        What are we training today?
      </div>

      {/* Category tiles. The server-provided list ends with "Custom Day",
          which doubles as the entry point for adding a user-named custom
          day — tapping it opens the rename dialog instead of just selecting
          a static category. Any saved custom days persisted to localStorage
          render below the server tiles. */}
      <div style={{ padding: "0 14px", display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
        {isLoading && categories.length === 0 && (
          <div style={{ color: t.textMuted, fontSize: 13, textAlign: "center", padding: 24 }}>
            Loading workouts…
          </div>
        )}
        {categories.map((cat) => {
          const isSelected = selected?.key === cat.key;
          const isCustomEntry = cat.key === "custom";
          return (
            <button
              key={cat.key}
              onClick={() => {
                if (isCustomEntry) {
                  // Custom Day tile -> open name dialog so the user can
                  // create a personalized workout day on the fly.
                  setAddDraft("");
                  setShowAddDialog(true);
                  return;
                }
                setSelectedKey(cat.key);
                // Scroll the CTA into view so the user immediately sees the
                // next step instead of having to hunt for it.
                requestAnimationFrame(() => {
                  ctaRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
                });
              }}
              style={{
                background: isSelected
                  ? `linear-gradient(135deg, ${t.gradientFrom}, ${t.gradientTo})`
                  : t.bgElevated,
                border: isSelected ? "none" : `1px solid ${t.border}`,
                borderRadius: 18,
                padding: "16px 18px",
                display: "flex", alignItems: "center", gap: 14,
                cursor: "pointer",
                color: isSelected ? t.accentText : t.text,
                boxShadow: isSelected ? `0 8px 26px ${t.accentGlow}` : "none",
                textAlign: "left",
                transition: "all 120ms ease",
              }}
            >
              {/* Per v7 spec: replace per-category SVG glyphs with a plain
                  white circle. Keeps the layout/size identical so tiles
                  don't jump, while giving every day a clean uniform mark. */}
              <div style={{
                width: 24, height: 24, display: "grid", placeItems: "center",
                flexShrink: 0,
              }}>
                <div style={{
                  width: 12, height: 12, borderRadius: "50%",
                  background: isSelected ? t.accentText : "#ffffff",
                  boxShadow: isSelected ? "none" : "0 0 0 1px rgba(255,255,255,0.15)",
                }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.1 }}>{cat.name}</div>
                <div style={{
                  fontSize: 12, marginTop: 4,
                  color: isSelected ? "rgba(255,255,255,0.85)" : t.textMuted,
                }}>{cat.summary}</div>
              </div>
              <ChevronRight color={isSelected ? t.accentText : t.textMuted} />
            </button>
          );
        })}
      </div>

      {/* CTA — proceeds to Select Exercises for the chosen category. The
          actual "Complete Workout" press lives on the next screen after the
          user checks which exercises they did. */}
      <div style={{ padding: "18px 14px 0" }}>
        <button
          ref={ctaRef}
          onClick={() => selected && onSelectCategory(selected)}
          disabled={!selected}
          style={{
            width: "100%", padding: "16px 20px", borderRadius: 30, border: "none",
            background: `linear-gradient(135deg, ${t.gradientFrom}, ${t.gradientTo})`,
            color: t.accentText, fontSize: 14, fontWeight: 800, letterSpacing: 1.5,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            cursor: selected ? "pointer" : "not-allowed",
            opacity: selected ? 1 : 0.5,
            boxShadow: `0 12px 32px ${t.accentGlow}`,
          }}
          data-testid="log-workout-continue"
        >
          <BoltIcon color={t.accentText} /> {selected ? `CONTINUE → ${selected.name.toUpperCase()}` : "SELECT A DAY"}
        </button>
      </div>

      {/* Add custom workout day dialog */}
      {showAddDialog && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 24, zIndex: 9999,
          }}
          onClick={() => setShowAddDialog(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: t.bgElevated, color: t.text, borderRadius: 18,
              padding: 20, width: "100%", maxWidth: 360,
              border: `1px solid ${t.border}`,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 2, color: t.textMuted, marginBottom: 6 }}>NEW WORKOUT DAY</div>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>Name your workout</div>
            <input
              value={addDraft}
              onChange={(e) => setAddDraft(e.target.value)}
              placeholder="e.g. Arms & Abs"
              autoFocus
              style={{
                width: "100%", padding: "12px 14px", borderRadius: 12,
                border: `1px solid ${t.border}`, background: t.bg, color: t.text,
                fontSize: 15, outline: "none", marginBottom: 14,
              }}
              onKeyDown={(e) => { if (e.key === "Enter") handleAddDay(); }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setShowAddDialog(false)}
                style={{
                  flex: 1, padding: "12px 14px", borderRadius: 12,
                  background: "transparent", border: `1px solid ${t.border}`, color: t.text,
                  fontSize: 14, fontWeight: 700, cursor: "pointer",
                }}
              >Cancel</button>
              <button
                onClick={handleAddDay}
                disabled={!addDraft.trim()}
                style={{
                  flex: 1, padding: "12px 14px", borderRadius: 12, border: "none",
                  background: `linear-gradient(135deg, ${t.gradientFrom}, ${t.gradientTo})`,
                  color: t.accentText, fontSize: 14, fontWeight: 800, cursor: "pointer",
                  opacity: addDraft.trim() ? 1 : 0.6,
                }}
              >Add</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PlusIcon({ color, size = 16 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 5v14M5 12h14" stroke={color} strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

// ─── Icons ──────────────────────────────────────────────────────────────
function BackArrow({ color, size = 24 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M19 12H5M5 12l6-6M5 12l6 6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function ChevronRight({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M9 6l6 6-6 6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function BoltIcon({ color, size = 16 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" />
    </svg>
  );
}

// Modern category glyphs — bold gym/fitness motifs (barbells, dumbbells, kettlebells)
// with thick strokes and filled accent shapes. Each icon uses viewBox 24x24.
function CategoryIcon({ icon, color, size = 24 }: { icon: string; color: string; size?: number }) {
  const sw = 2.4;
  switch (icon) {
    case "bolt":
      // Double lightning bolt — power / energy day
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path d="M11 2L4 13h5l-1 9 8-12h-5l1-8z" fill={color} />
          <path d="M19 2l-3 5h2l-2 5" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "pull":
      // Pull-up bar + flexed bicep — back / pull day
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path d="M3 5h18M5 3v4M19 3v4" stroke={color} strokeWidth={sw} strokeLinecap="round" />
          <path d="M9 5v3M15 5v3" stroke={color} strokeWidth={sw} strokeLinecap="round" />
          <path d="M7 10c2 3 4 4 5 4s3-1 5-4" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="12" cy="15" r="2.2" fill={color} />
          <path d="M12 17v5" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </svg>
      );
    case "legs":
      // Barbell squat — bar with plates on top, quad wedge below
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path d="M4 5h16" stroke={color} strokeWidth={sw} strokeLinecap="round" />
          <rect x="2" y="3" width="2.5" height="4" rx="0.6" fill={color} />
          <rect x="19.5" y="3" width="2.5" height="4" rx="0.6" fill={color} />
          <path d="M8 9l-2 13M16 9l2 13M9 15h6" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "glutes":
      // Kettlebell — posterior chain
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path d="M9 5c0-2 6-2 6 0v2" stroke={color} strokeWidth={sw} strokeLinecap="round" />
          <path d="M8 8h8c2 0 3 2 3 5s-2 8-7 8s-7-5-7-8s1-5 3-5z" fill={color} />
        </svg>
      );
    case "upper":
      // Dumbbell — chest / shoulder press
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <rect x="2" y="7" width="3.5" height="10" rx="1" fill={color} />
          <rect x="5" y="5" width="2.5" height="14" rx="0.8" fill={color} />
          <rect x="7" y="10.5" width="10" height="3" fill={color} />
          <rect x="16.5" y="5" width="2.5" height="14" rx="0.8" fill={color} />
          <rect x="18.5" y="7" width="3.5" height="10" rx="1" fill={color} />
        </svg>
      );
    case "full":
      // Barbell deadlift — long bar with plates on each end
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <rect x="4" y="11" width="16" height="2" rx="0.8" fill={color} />
          <rect x="4" y="6" width="2.6" height="12" rx="0.8" fill={color} />
          <rect x="17.4" y="6" width="2.6" height="12" rx="0.8" fill={color} />
          <rect x="1" y="8.5" width="2.4" height="7" rx="0.6" fill={color} />
          <rect x="20.6" y="8.5" width="2.4" height="7" rx="0.6" fill={color} />
        </svg>
      );
    case "body":
      // Dynamic runner — cardio / full-body motion
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <circle cx="15" cy="4" r="2.2" fill={color} />
          <path d="M14 7l-3 7" stroke={color} strokeWidth={sw + 0.4} strokeLinecap="round" />
          <path d="M14 9l4 3M11 11l-4 1" stroke={color} strokeWidth={sw} strokeLinecap="round" />
          <path d="M11 14l5 5M11 14l-3 7" stroke={color} strokeWidth={sw + 0.4} strokeLinecap="round" />
          <path d="M2 6h3M2 10h2" stroke={color} strokeWidth="1.6" strokeLinecap="round" opacity="0.7" />
        </svg>
      );
    case "plus":
      // Bold circled plus — add custom day
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" fill={color} />
          <path d="M12 7v10M7 12h10" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" />
        </svg>
      );
    case "custom":
    default:
      // Dumbbell + plus badge — custom workout
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <rect x="2" y="12" width="2.5" height="7" rx="0.6" fill={color} />
          <rect x="4.5" y="10.5" width="2" height="10" rx="0.6" fill={color} />
          <rect x="6.5" y="14" width="7" height="3" fill={color} />
          <rect x="13.5" y="10.5" width="2" height="10" rx="0.6" fill={color} />
          <circle cx="19" cy="6" r="4.5" fill={color} />
          <path d="M19 3.5v5M16.5 6h5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
  }
}
