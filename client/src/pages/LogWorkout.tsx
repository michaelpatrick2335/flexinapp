import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "@/lib/ThemeProvider";
import { getQueryFn } from "@/lib/queryClient";

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
  // User-added custom workout days, persisted in localStorage so they
  // survive navigation between Home and LogWorkout.
  const [customDays, setCustomDays] = useState<Category[]>(() => {
    try {
      const raw = localStorage.getItem("flexin.customDays");
      return raw ? (JSON.parse(raw) as Category[]) : [];
    } catch { return []; }
  });
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addDraft, setAddDraft] = useState("");

  const { data } = useQuery<CategoriesPayload>({
    queryKey: ["/api/workout-categories"],
    queryFn: getQueryFn({ on401: "throw" }),
    staleTime: 5 * 60_000,
  });

  // Server-provided day tiles first, then any custom days the user has added.
  const baseCategories = data?.categories || [];
  const categories = [...baseCategories, ...customDays];
  const selected = categories.find((c) => c.key === selectedKey) ?? categories[0];

  function persistCustom(next: Category[]) {
    setCustomDays(next);
    try { localStorage.setItem("flexin.customDays", JSON.stringify(next)); } catch {}
  }

  function handleAddDay() {
    const v = addDraft.trim();
    if (!v) { setShowAddDialog(false); return; }
    const key = `custom-${Date.now()}`;
    const newDay: Category = { key, name: v, summary: "Custom day", icon: "plus" };
    persistCustom([...customDays, newDay]);
    setSelectedKey(key);
    setAddDraft("");
    setShowAddDialog(false);
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

      {/* Add Workout button — lets user add a custom workout day to the list */}
      <div style={{ padding: "0 14px 12px" }}>
        <button
          onClick={() => { setAddDraft(""); setShowAddDialog(true); }}
          data-testid="add-workout-day"
          style={{
            width: "100%",
            padding: "12px 16px",
            borderRadius: 14,
            border: `1px dashed ${t.accent}`,
            background: "transparent",
            color: t.accent,
            fontSize: 14,
            fontWeight: 800,
            letterSpacing: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            cursor: "pointer",
          }}
        >
          <PlusIcon color={t.accent} /> ADD WORKOUT
        </button>
      </div>

      {/* Category tiles */}
      <div style={{ padding: "0 14px", display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
        {categories.map((cat) => {
          const isSelected = selected?.key === cat.key;
          return (
            <button
              key={cat.key}
              onClick={() => setSelectedKey(cat.key)}
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
              <div style={{
                width: 32, height: 32, display: "grid", placeItems: "center",
                color: isSelected ? t.accentText : t.accent,
                flexShrink: 0,
              }}>
                <CategoryIcon icon={cat.icon} color={isSelected ? t.accentText : t.accent} />
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

      {/* COMPLETE WORKOUT CTA — proceeds to Select Exercises for the chosen category */}
      <div style={{ padding: "18px 14px 0" }}>
        <button
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
        >
          <BoltIcon color={t.accentText} /> COMPLETE WORKOUT
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

// Tiny accent icons for category tiles. The actual exercise rows (Screen 7)
// have NO icons per product spec — only category tiles get an icon.
function CategoryIcon({ icon, color, size = 24 }: { icon: string; color: string; size?: number }) {
  switch (icon) {
    case "bolt":
      return <BoltIcon color={color} size={size} />;
    case "pull":
      // person doing a pull-up
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path d="M4 4h16M9 4v4M15 4v4" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="12" cy="11" r="2" stroke={color} strokeWidth="1.8" />
          <path d="M12 13v8M8 16l4-3 4 3M9 22l3-1 3 1" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "legs":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="4" r="2" stroke={color} strokeWidth="1.8" />
          <path d="M12 6v6M10 12l-2 8M14 12l2 8M9 22h2M15 22h2" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "glutes":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="4" r="2" stroke={color} strokeWidth="1.8" />
          <path d="M12 6v3M8 12c0-1.5 1.8-3 4-3s4 1.5 4 3v3c0 1.5-1.8 2.5-4 2.5S8 16.5 8 15v-3zM10 17l-1 5M14 17l1 5" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "upper":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="4" r="2" stroke={color} strokeWidth="1.8" />
          <path d="M12 6v9M7 10l5-2 5 2M6 14l3-2M18 14l-3-2" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "full":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="4" r="2" stroke={color} strokeWidth="1.8" />
          <path d="M12 6v8M7 9l5-1 5 1M9 14v8M15 14v8" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "body":
      // Full body — standing person
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="4" r="2" stroke={color} strokeWidth="1.8" />
          <path d="M12 6v8M9 14v8M15 14v8M8 9l4-1 4 1" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "plus":
      // Custom day — person + plus marker
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <circle cx="10" cy="5" r="2" stroke={color} strokeWidth="1.8" />
          <path d="M10 7v8M8 15v6M12 15v6" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
          <path d="M17 4h5M19.5 1.5v5" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "custom":
    default:
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="4" r="2" stroke={color} strokeWidth="1.8" />
          <path d="M12 6v8M9 14v8M15 14v8" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
          <path d="M16 4h6M19 1v6" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
  }
}
