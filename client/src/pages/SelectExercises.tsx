import React, { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTheme } from "@/lib/ThemeProvider";
import { getQueryFn, queryClient, apiRequest, getUserEmail } from "@/lib/queryClient";
import { pushFeedEvent } from "@/lib/feed";

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
  // Per-lift expansion: tapping a lift name opens a dropdown beneath it with
  // sets/reps/weight inputs + a "LOG PR" button. The checkbox on the right
  // still toggles selection independently.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  type StatRow = { sets: string; reps: string; weight: string };
  const [stats, setStats] = useState<Record<string, StatRow>>({});
  function updateStat(name: string, field: keyof StatRow, value: string) {
    setStats((prev) => {
      const cur: StatRow = prev[name] || { sets: "", reps: "", weight: "" };
      return { ...prev, [name]: { ...cur, [field]: value } };
    });
  }

  // Pull the user's real name + avatar from the dashboard cache so feed events
  // are attributed to them ("Mike — 225 lbs") instead of the generic "You".
  const dashboard = queryClient.getQueryData<any>(["/api/dashboard"]);
  const myName: string = (dashboard?.user?.name as string) || "You";
  const myAvatar: string | null = (dashboard?.user?.avatarUrl as string | null) || null;

  const { data, isLoading } = useQuery<ExercisesPayload>({
    queryKey: [`/api/exercises?category=${category.key}`],
    queryFn: getQueryFn({ on401: "throw" }),
    staleTime: 5 * 60_000,
  });

  const allNames = useMemo(() => {
    const builtins = (data?.exercises || []).map((e) => e.name);
    return [...builtins, ...customs];
  }, [data, customs]);

  function liftsWithStats(): string[] {
    return Array.from(selected).filter((name) => {
      const s = stats[name];
      return !!(s && (s.sets || s.reps || s.weight));
    });
  }

  const completeMutation = useMutation({
    mutationFn: async () => {
      const tracked = liftsWithStats();
      const statNotes = tracked.length
        ? tracked
            .map((name) => {
              const s = stats[name];
              if (!s) return null;
              const parts = [
                s.sets && `${s.sets} sets`,
                s.reps && `${s.reps} reps`,
                s.weight && `${s.weight} lbs`,
              ].filter(Boolean);
              return parts.length ? `${name}: ${parts.join(" × ")}` : null;
            })
            .filter(Boolean)
            .join("\n")
        : null;
      return apiRequest("POST", "/api/workout", {
        category: category.key,
        exerciseNames: Array.from(selected),
        durationSeconds: 0,
        notes: statNotes && statNotes.length > 0 ? statNotes : null,
      });
    },
    onSuccess: () => {
      // Push a local feed event so the Home "SQUAD FEED" card has something
      // to show. (Server-side feed table TBD; see lib/feed.ts.)
      try {
        const count = selected.size;
        pushFeedEvent(getUserEmail() || "anon", {
          userName: myName,
          avatarUrl: myAvatar,
          message: `crushed ${category.name} — ${count} exercise${count === 1 ? "" : "s"}`,
          kind: "workout_logged",
        });
        // Per-lift PR events for any lift the user typed a weight into.
        for (const name of liftsWithStats()) {
          const s = stats[name];
          if (!s || !s.weight) continue;
          pushFeedEvent(getUserEmail() || "anon", {
            userName: myName,
            avatarUrl: myAvatar,
            message: `${name} — ${s.weight} lbs${s.reps ? ` x ${s.reps}` : ""}${s.sets ? ` x ${s.sets} sets` : ""}`,
            kind: "pr",
          });
        }
      } catch {}
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      onCompleted();
    },
  });

  function logPRForLift(name: string) {
    const s = stats[name];
    if (!s || !s.weight) return;
    try {
      pushFeedEvent(getUserEmail() || "anon", {
        userName: myName,
        avatarUrl: myAvatar,
        message: `${name} — ${s.weight} lbs${s.reps ? ` x ${s.reps}` : ""}${s.sets ? ` x ${s.sets} sets` : ""}`,
        kind: "pr",
      });
    } catch {}
  }

  function logLiftForLift(name: string) {
    const s = stats[name];
    const hasAny = !!(s && (s.weight || s.reps || s.sets));
    if (!hasAny) return;
    try {
      const parts: string[] = [];
      if (s.weight) parts.push(`${s.weight} lbs`);
      if (s.reps) parts.push(`${s.reps} reps`);
      if (s.sets) parts.push(`${s.sets} sets`);
      pushFeedEvent(getUserEmail() || "anon", {
        userName: myName,
        avatarUrl: myAvatar,
        message: `${name}${parts.length ? " — " + parts.join(" x ") : ""}`,
        kind: "workout_logged",
      });
    } catch {}
  }

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
        Tap a lift to log stats · check to add
      </div>

      {/* Exercise list — per-lift expandable dropdown */}
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
          const isOpen = expanded.has(name);
          const row = stats[name] || { sets: "", reps: "", weight: "" };
          const canLogPR = !!row.weight;
          return (
            <div key={name} style={{
              borderBottom: i < allNames.length - 1 ? `1px solid ${t.border}` : "none",
            }}>
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "16px 4px",
              }}>
                <button
                  onClick={() => {
                    // Tapping the name opens the dropdown AND auto-selects
                    // the lift (so logged stats match intent).
                    setExpanded((prev) => {
                      const next = new Set(prev);
                      if (next.has(name)) next.delete(name); else next.add(name);
                      return next;
                    });
                    if (!checked) toggle(name);
                  }}
                  style={{
                    flex: 1, background: "transparent", border: "none", padding: 0,
                    color: t.text, fontSize: 16, fontWeight: 500, textAlign: "left",
                    cursor: "pointer", display: "flex", alignItems: "center", gap: 10,
                  }}
                >
                  <Chevron color={t.textMuted} open={isOpen} />
                  <span>{name}</span>
                </button>
                <div onClick={() => toggle(name)} style={{ cursor: "pointer", padding: "4px 0 4px 12px" }}>
                  <Checkbox checked={checked} t={t} />
                </div>
              </div>
              {isOpen && (
                <div style={{
                  padding: "4px 6px 14px 30px",
                  display: "flex", flexDirection: "column", gap: 10,
                }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                    <StatField t={t} label="Sets" value={row.sets}
                      onChange={(v) => updateStat(name, "sets", v)} />
                    <StatField t={t} label="Reps" value={row.reps}
                      onChange={(v) => updateStat(name, "reps", v)} />
                    <StatField t={t} label="Weight" value={row.weight} suffix="lbs"
                      onChange={(v) => updateStat(name, "weight", v)} />
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      onClick={() => logLiftForLift(name)}
                      disabled={!(row.weight || row.reps || row.sets)}
                      style={{
                        padding: "8px 14px", borderRadius: 10,
                        border: `1.5px solid ${t.border}`,
                        background: t.bgInput,
                        color: (row.weight || row.reps || row.sets) ? t.text : t.textMuted,
                        fontSize: 11, fontWeight: 800, letterSpacing: 1.2,
                        cursor: (row.weight || row.reps || row.sets) ? "pointer" : "not-allowed",
                        opacity: (row.weight || row.reps || row.sets) ? 1 : 0.6,
                        display: "flex", alignItems: "center", gap: 6,
                      }}
                    >
                      LOG LIFT
                    </button>
                    <button
                      onClick={() => logPRForLift(name)}
                      disabled={!canLogPR}
                      style={{
                        padding: "8px 14px", borderRadius: 10,
                        border: "none",
                        background: canLogPR
                          ? `linear-gradient(135deg, ${t.gradientFrom}, ${t.gradientTo})`
                          : t.bgInput,
                        color: canLogPR ? t.accentText : t.textMuted,
                        fontSize: 11, fontWeight: 800, letterSpacing: 1.2,
                        cursor: canLogPR ? "pointer" : "not-allowed",
                        opacity: canLogPR ? 1 : 0.6,
                        display: "flex", alignItems: "center", gap: 6,
                      }}
                    >
                      <BoltIcon color={canLogPR ? t.accentText : t.textMuted} size={12} />
                      LOG PR
                    </button>
                  </div>
                </div>
              )}
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

// ─── StatField / Checkbox ─────────────────────────────────────────────
function StatField({
  t, label, value, onChange, suffix,
}: {
  t: any; label: string; value: string; onChange: (v: string) => void; suffix?: string;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 10, color: t.textMuted, letterSpacing: 1, fontWeight: 700 }}>
        {label.toUpperCase()}
      </span>
      <div style={{
        display: "flex", alignItems: "center",
        background: t.bgInput, border: `1px solid ${t.border}`, borderRadius: 10,
        padding: "6px 8px",
      }}>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))}
          onClick={(e) => e.stopPropagation()}
          inputMode="numeric"
          placeholder="0"
          style={{
            flex: 1, minWidth: 0, background: "transparent", border: "none",
            color: t.text, fontSize: 14, fontWeight: 700, outline: "none",
          }}
        />
        {suffix && (
          <span style={{ fontSize: 10, color: t.textMuted, marginLeft: 4 }}>{suffix}</span>
        )}
      </div>
    </label>
  );
}

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
function Chevron({ color, open, size = 14 }: { color: string; open: boolean; size?: number }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 120ms ease" }}
    >
      <path d="M9 6l6 6-6 6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
