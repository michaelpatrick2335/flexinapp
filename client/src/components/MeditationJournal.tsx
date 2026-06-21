import { useState } from "react";

interface MeditationJournalProps {
  level: number;
  onSubmit: (entry: string) => void;
  onSkip: () => void;
  isSaving?: boolean;
}

const PROMPTS = [
  "In one sentence, tell me how you feel after your meditation.",
  "One sentence — how do you feel right now?",
  "How does your mind feel? One sentence.",
  "Capture this moment in one sentence.",
  "One breath, one sentence — how do you feel?",
];

const SPARKS = ["✨", "🌿", "🧘", "🌙", "☀️", "💫", "🪷"];

export function MeditationJournal({ level, onSubmit, onSkip, isSaving = false }: MeditationJournalProps) {
  const [entry, setEntry] = useState("");
  const [focused, setFocused] = useState(false);

  // Deterministic prompt + spark per level so it feels coherent
  const prompt = PROMPTS[level % PROMPTS.length];
  const spark = SPARKS[level % SPARKS.length];

  const trimmed = entry.trim();
  const canSubmit = trimmed.length > 0 && !isSaving;

  function handleSubmit() {
    if (!canSubmit) return;
    onSubmit(trimmed);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center px-6 overflow-y-auto"
      style={{
        background: "radial-gradient(circle at 50% 30%, rgba(245,200,66,0.10), rgba(0,0,0,0) 60%), #0b0d12",
        paddingTop: "max(env(safe-area-inset-top), 56px)",
        paddingBottom: "max(env(safe-area-inset-bottom), 32px)",
      }}
    >
      {/* Floating sparkles */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute text-2xl opacity-20"
            style={{
              left: `${10 + i * 15}%`,
              top: `${15 + (i % 3) * 25}%`,
              animation: `float-${i % 3} ${4 + i}s ease-in-out infinite`,
            }}
          >
            {SPARKS[i % SPARKS.length]}
          </div>
        ))}
      </div>

      <style>{`
        @keyframes float-0 { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
        @keyframes float-1 { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-18px)} }
        @keyframes float-2 { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
      `}</style>

      <div className="relative z-10 w-full max-w-sm flex flex-col items-center">
        {/* Spark */}
        <div className="text-4xl mb-3" aria-hidden>{spark}</div>

        {/* Title */}
        <h1
          className="font-display font-bold text-center mb-2"
          style={{
            fontSize: "clamp(28px, 7vw, 36px)",
            background: "linear-gradient(135deg, #f5c842, #e8952a)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          Meditation Journal
        </h1>

        {/* Level pill */}
        <div
          className="text-[10px] font-bold uppercase tracking-[0.18em] px-3 py-1 rounded-full mb-5"
          style={{
            color: "#f5c842",
            background: "rgba(245,200,66,0.08)",
            border: "1px solid rgba(245,200,66,0.25)",
          }}
        >
          Level {level} complete
        </div>

        {/* Prompt */}
        <p
          className="text-center text-base mb-5 leading-snug"
          style={{ color: "rgba(255,255,255,0.78)" }}
        >
          {prompt}
        </p>

        {/* Textarea */}
        <div
          className="w-full rounded-2xl p-1 transition-all"
          style={{
            background: focused
              ? "linear-gradient(135deg, rgba(245,200,66,0.35), rgba(232,149,42,0.35))"
              : "rgba(255,255,255,0.08)",
          }}
        >
          <textarea
            autoFocus
            value={entry}
            onChange={(e) => setEntry(e.target.value.slice(0, 500))}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Write what you feel…"
            rows={4}
            className="w-full bg-[#11141b] rounded-[14px] px-4 py-3 text-white placeholder:text-white/30 resize-none outline-none text-base leading-relaxed"
            style={{ fontFamily: "inherit" }}
            data-testid="input-journal-entry"
          />
        </div>
        <div
          className="self-end text-[11px] mt-1.5 mr-1"
          style={{ color: trimmed.length > 450 ? "#f5c842" : "rgba(255,255,255,0.35)" }}
        >
          {trimmed.length}/500
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          data-testid="button-journal-save"
          className="w-full mt-4 py-4 rounded-2xl font-display font-bold text-base transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
          style={{
            background: canSubmit
              ? "linear-gradient(135deg, #f5c842, #e8952a)"
              : "rgba(255,255,255,0.08)",
            color: canSubmit ? "#1a0a00" : "rgba(255,255,255,0.4)",
            boxShadow: canSubmit ? "0 8px 28px rgba(245,200,66,0.30)" : "none",
          }}
        >
          {isSaving ? "Saving…" : "Save & Continue →"}
        </button>

        {/* Skip */}
        <button
          onClick={onSkip}
          disabled={isSaving}
          className="mt-3 text-xs text-white/40 hover:text-white/70 transition-colors disabled:opacity-50"
          data-testid="button-journal-skip"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
