import React, { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTheme } from "@/lib/ThemeProvider";
import { getQueryFn, queryClient, apiRequest } from "@/lib/queryClient";

interface ExercisesPayload {
  category: string;
  sex: string;
  isFemale: boolean;
  exercises: { id: number; name: string; category: string; sexTarget: string; isCustom: boolean }[];
}

interface SelectExercisesProps {
  category: { key: string; name: string; summary: string; icon: string };
  onBack: () => void;
  onCompleted: () => void;
}

export function SelectExercises({ category, onBack, onCompleted }: SelectExercisesProps) {
  const t = useTheme();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [customs, setCustoms] = useState<string[]>([]);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customDraft, setCustomDraft] = useState("");

  const { data, isLoading } = useQuery<ExercisesPayload>({
    queryKey: [`/api/exercises?category=${category.key}`],
    queryFn: getQueryFn({ on401: "throw" }),
    staleTime: 5 * 60_000,
  });

  const allNames = useMemo(() => {
    const builtins = (data?.exercises || []).map((e) => e.name);
    return [...builtins, ...customs];
  }, [data, customs]);

  const completeMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/workout", {
        category: category.key,
        exerciseNames: Array.from(selected),
        durationSeconds: 0,
        notes: null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      onCompleted();
    },
  });

  const toggle = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const handleAddCustom = () => {
    const v = customDraft.trim();
    if (!v) {
      setShowCustomInput(false);
      return;
    }
    setCustoms((prev) => (prev.includes(v) ? prev : [...prev, v]));
    setSelected((prev) => new Set(prev).add(v));
    setCustomDraft("");
    setShowCustomInput(false);
  };

  return (
    <div style={{
      minHeight: "100vh", background: t.bg, color: t.text,
      paddingTop: "max(env(safe-area-inset-top), 18px)",
      paddingBottom: "max(env(safe-area-inset-bottom), 24px)",
      display: "flex", flexDirection: "column",
    }}>
      {/* Header */}
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
        <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: 2 }}>{category.name.toUpperCase()}</div>
      </div>
      <div style={{ textAlign: "center", color: t.textMuted, fontSize: 14, marginTop: 4, marginBottom: 14 }}>
        Select exercises
      </div>

      {/* Exercise list — text + checkbox only, NO icons */}
      <div style={{ flex: 1, padding: "0 18px", overflow: "auto" }}>
        {isLoading && (
          <div style={{ color: t.textMuted, fontSize: 13, padding: 20, textAlign: "center" }}>Loading exercises…</div>
        )}
        {!isLoading && allNames.length === 0 && (
          <div style={{ color: t.textMuted, fontSize: 13, padding: 20, textAlign: "center" }}>
            No built-in exercises for this category. Add a custom one below.
          </div>
        )}
        {allNames.map((name, i) => {
          const checked = selected.has(name);
          return (
            <div key={name} onClick={() => toggle(name)} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "16px 4px",
              borderBottom: i < allNames.length - 1 ? `1px solid ${t.border}` : "none",
              cursor: "pointer",
            }}>
              <span style={{ fontSize: 16, color: t.text, fontWeight: 500 }}>{name}</span>
              <Checkbox checked={checked} t={t} />
            </div>
          );
        })}

        {/* + Custom row */}
        {!showCustomInput ? (
          <button
            onClick={() => setShowCustomInput(true)}
            style={{
              marginTop: 16, padding: "12px 16px", borderRadius: 12,
              border: `1.5px dashed ${t.border}`, background: "transparent",
              color: t.accent, fontSize: 14, fontWeight: 600,
              display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
              width: "100%", justifyContent: "center",
            }}
          >
            <PlusIcon color={t.accent} /> Add Custom Exercise
          </button>
        ) : (
          <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
            <input
              autoFocus
              value={customDraft}
              onChange={(e) => setCustomDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAddCustom(); }}
              placeholder="Exercise name"
              style={{
                flex: 1, padding: "12px 14px", borderRadius: 12,
                background: t.bgInput, border: `1px solid ${t.border}`,
                color: t.text, fontSize: 14, outline: "none",
              }}
            />
            <button
              onClick={handleAddCustom}
              style={{
                padding: "0 16px", borderRadius: 12, border: "none",
                background: t.accent, color: t.accentText, fontWeight: 700, fontSize: 13,
                cursor: "pointer",
              }}
            >Add</button>
          </div>
        )}
      </div>

      {/* COMPLETE WORKOUT CTA */}
      <div style={{ padding: "16px 18px 0" }}>
        <button
          onClick={() => completeMutation.mutate()}
          disabled={selected.size === 0 || completeMutation.isPending}
          style={{
            width: "100%", padding: "16px 20px", borderRadius: 30, border: "none",
            background: `linear-gradient(135deg, ${t.gradientFrom}, ${t.gradientTo})`,
            color: t.accentText, fontSize: 14, fontWeight: 800, letterSpacing: 1.5,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            cursor: selected.size > 0 ? "pointer" : "not-allowed",
            opacity: selected.size > 0 && !completeMutation.isPending ? 1 : 0.5,
            boxShadow: `0 12px 32px ${t.accentGlow}`,
          }}
        >
          <BoltIcon color={t.accentText} />
          {completeMutation.isPending ? "SAVING…" : "COMPLETE WORKOUT"}
        </button>
        {selected.size > 0 && (
          <div style={{ textAlign: "center", color: t.textMuted, fontSize: 11, marginTop: 8 }}>
            {selected.size} exercise{selected.size === 1 ? "" : "s"} selected
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Checkbox ─────────────────────────────────────────────────────────
function Checkbox({ checked, t }: { checked: boolean; t: any }) {
  return (
    <div style={{
      width: 26, height: 26, borderRadius: 13,
      background: checked ? t.accent : "transparent",
      border: `1.8px solid ${checked ? t.accent : t.border}`,
      display: "grid", placeItems: "center",
      boxShadow: checked ? `0 0 10px ${t.accentGlow}` : "none",
      transition: "all 120ms ease",
      flexShrink: 0,
    }}>
      {checked && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M5 12l5 5 9-11" stroke={t.accentText} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────
function BackArrow({ color, size = 24 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M19 12H5M5 12l6-6M5 12l6 6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
function PlusIcon({ color, size = 16 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 5v14M5 12h14" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
