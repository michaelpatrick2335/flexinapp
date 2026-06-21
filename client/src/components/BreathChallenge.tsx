import { useState, useEffect, useRef, useCallback } from "react";
import type { BreathChallenge } from "@/lib/breath-challenges";
// Voice cues fully removed — keeping VOICE_CUES exports below as stubs so other
// modules that imported them don't break, but no audio plays.

interface Props {
  challenge: BreathChallenge;
  onComplete: (bananasEarned: number) => void;
  onSkip: () => void;
  practiceMode?: boolean; // true = launched from stats panel, no banana reward
}

type Stage = "intro" | "active" | "complete";

const MUSIC_URL = "https://cdn.pixabay.com/audio/2022/10/16/audio_12b6e5befa.mp3";

// Cue IDs — each one can have a custom uploaded audio file
export const VOICE_CUES = [
  { id: "now-begin",   label: "Now Begin",    desc: "Opening cue at the start of the exercise" },
  { id: "inhale",      label: "Inhale",        desc: "Spoken when the inhale phase starts" },
  { id: "hold",        label: "Hold",          desc: "Spoken on hold phases" },
  { id: "exhale",      label: "Exhale",        desc: "Spoken when the exhale phase starts" },
  { id: "hold-empty",  label: "Hold Empty",    desc: "Spoken on the empty-hold phase" },
  { id: "complete",    label: "Well Done",     desc: "Played when challenge is complete" },
] as const;

export type VoiceCueId = typeof VOICE_CUES[number]["id"];

// Map phase labels → cue IDs
const PHASE_TO_CUE: Record<string, VoiceCueId> = {
  "Inhale":     "inhale",
  "Hold":       "hold",
  "Exhale":     "exhale",
  "Hold Empty": "hold-empty",
  "Pump":       "inhale",
  "Full Hold":  "hold",
  "Release":    "exhale",
  "Balance":    "hold",
};

// Phase label → custom exercise voice key mapping
const PHASE_TO_VOICE_KEY: Record<string, string> = {
  "Inhale":     "inhale",
  "Hold":       "holdIn",
  "Exhale":     "exhale",
  "Hold Empty": "holdOut",
  "Pump":       "inhale",
  "Full Hold":  "holdIn",
  "Release":    "exhale",
  "Balance":    "holdIn",
};

// Voice cues fully removed — this is a no-op stub kept so call sites compile.
function playVoiceCue(_id: VoiceCueId, _musicAudio: HTMLAudioElement | null, _exerciseId?: string, _phaseLabel?: string) {
  // Intentionally empty.
}

export function BreathChallengeScreen({ challenge, onComplete, onSkip, practiceMode = false }: Props) {
  const [stage, setStage] = useState<Stage>("intro");
  const [round, setRound] = useState(1);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [countdown, setCountdown] = useState(challenge.phases[0].count);
  const [scriptIdx, setScriptIdx] = useState(0);
  const [ringScale, setRingScale] = useState(1);

  const audioRef       = useRef<HTMLAudioElement | null>(null);
  const bellRef        = useRef<AudioContext | null>(null);
  const timerRef       = useRef<ReturnType<typeof setInterval> | null>(null);
  const scriptTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevPhaseRef   = useRef<number>(-1);

  const phase       = challenge.phases[phaseIdx];
  const totalPhases = challenge.phases.length;

  // ── Bell ──────────────────────────────────────────────────────────────────
  const playBell = useCallback((freq = 432, duration = 1.2) => {
    try {
      if (!bellRef.current) bellRef.current = new AudioContext();
      const ctx = bellRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = "sine";
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
    } catch {}
  }, []);

  // ── Music ─────────────────────────────────────────────────────────────────
  function startMusic() {
    try {
      const audio = new Audio(MUSIC_URL);
      audio.loop = true;
      audio.volume = 0.22;
      audio.play().catch(() => {});
      audioRef.current = audio;
    } catch {}
  }

  function stopMusic() {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
  }

  // ── Start ─────────────────────────────────────────────────────────────────
  function startExercise() {
    setStage("active");
    setRound(1);
    setPhaseIdx(0);
    setCountdown(challenge.phases[0].count);
    setScriptIdx(0);
    prevPhaseRef.current = -1;
    startMusic();
    playBell(396);
    // Opening cue
    setTimeout(() => playVoiceCue("now-begin", audioRef.current), 800);
  }

  // ── Phase-change cue ──────────────────────────────────────────────────────
  useEffect(() => {
    if (stage !== "active") return;
    if (phaseIdx === prevPhaseRef.current) return;
    prevPhaseRef.current = phaseIdx;
    const cueId = PHASE_TO_CUE[phase.label];
    if (cueId) setTimeout(() => playVoiceCue(cueId, audioRef.current, challenge.id, phase.label), 250);
  }, [phaseIdx, stage, phase.label]);

  // ── Main countdown ────────────────────────────────────────────────────────
  useEffect(() => {
    if (stage !== "active") return;

    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          const nextPhaseIdx = (phaseIdx + 1) % totalPhases;
          const isNewRound   = nextPhaseIdx === 0;
          const nextRound    = isNewRound ? round + 1 : round;

          if (isNewRound && round >= challenge.totalRounds) {
            if (timerRef.current) clearInterval(timerRef.current);
            stopMusic();
            playBell(528, 2.5);
            setStage("complete");
            setTimeout(() => playVoiceCue("complete", audioRef.current), 1200);
            return 0;
          }

          setPhaseIdx(nextPhaseIdx);
          if (isNewRound) setRound(nextRound);
          playBell(nextPhaseIdx === 0 ? 396 : 330, 0.6);
          return challenge.phases[nextPhaseIdx].count;
        }
        return prev - 1;
      });
    }, 1000);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [stage, phaseIdx, round, challenge, totalPhases, playBell]);

  // ── Ring animation ────────────────────────────────────────────────────────
  useEffect(() => {
    if (stage !== "active") return;
    if (phase.label === "Inhale" || phase.label === "Pump") setRingScale(1.35);
    else if (phase.label === "Exhale" || phase.label === "Release") setRingScale(0.75);
  }, [phaseIdx, stage, phase.label]);

  // ── Script cycling ────────────────────────────────────────────────────────
  useEffect(() => {
    if (stage !== "active") return;
    scriptTimerRef.current = setInterval(() => {
      setScriptIdx(i => Math.min(i + 1, challenge.script.length - 1));
    }, 8000);
    return () => { if (scriptTimerRef.current) clearInterval(scriptTimerRef.current); };
  }, [stage, challenge.script.length]);

  // ── Cleanup ───────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      stopMusic();
      if (timerRef.current) clearInterval(timerRef.current);
      if (scriptTimerRef.current) clearInterval(scriptTimerRef.current);
    };
  }, []);

  // ── Progress ──────────────────────────────────────────────────────────────
  const totalPhaseCount = challenge.totalRounds * totalPhases;
  const completedPhases = (round - 1) * totalPhases + phaseIdx;
  const progressPct     = totalPhaseCount > 0 ? (completedPhases / totalPhaseCount) * 100 : 0;

  // ─────────────────────────────────────────────────────────────────────────
  // INTRO
  // ─────────────────────────────────────────────────────────────────────────
  if (stage === "intro") {
    return (
      <div
        className="fixed inset-0 flex flex-col items-center justify-center px-6 z-50"
        style={{ background: "radial-gradient(ellipse at top, #1a1f3a 0%, #0d0f1a 60%)" }}
      >
        <button onClick={onSkip} className="absolute top-6 right-6 text-muted-foreground text-sm" data-testid="button-skip-challenge">
          Skip
        </button>

        <div className="text-6xl mb-6" style={{ filter: "drop-shadow(0 0 24px rgba(245,200,66,0.5))" }}>
          {challenge.emoji}
        </div>
        <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "var(--color-gold)" }}>
          {practiceMode ? "🧘 Breath Exercise" : "🍌 Bonus Challenge"}
        </div>
        <h1 className="font-display font-bold text-center mb-2" style={{ fontSize: "1.9rem", color: "var(--color-gold)" }}>
          {challenge.name}
        </h1>
        <p className="text-muted-foreground text-center text-sm mb-8 max-w-xs">{challenge.subtitle}</p>

        <div
          className="flex items-center gap-2 px-5 py-3 rounded-2xl mb-8"
          style={{ background: "rgba(245,200,66,0.1)", border: "1px solid rgba(245,200,66,0.3)" }}
        >
          <span className="text-2xl">{practiceMode ? "🧘" : "🍌"}</span>
          <div>
            {!practiceMode && (
              <p className="font-display font-bold text-gold text-lg leading-none">+{challenge.bananaReward} Bananas</p>
            )}
            {practiceMode && (
              <p className="font-display font-bold text-gold text-lg leading-none">Free Practice</p>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">
              {challenge.totalRounds} rounds · {challenge.phases.map(p => p.count).join("-")} counts
            </p>
          </div>
        </div>

        <div className="flex gap-2 mb-10">
          {challenge.phases.map((p, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ background: `${p.color}20`, border: `2px solid ${p.color}50`, color: p.color }}
              >
                {p.count}s
              </div>
              <span className="text-muted-foreground" style={{ fontSize: "0.62rem" }}>{p.label}</span>
            </div>
          ))}
        </div>

        <button
          onClick={startExercise}
          data-testid="button-accept-challenge"
          className="w-full max-w-xs py-5 rounded-3xl font-display font-bold text-lg transition-all active:scale-95"
          style={{ background: "linear-gradient(135deg, #2d8a4e 0%, #1f6e3a 100%)", color: "#fff", boxShadow: "0 8px 32px rgba(45,138,78,0.35)" }}
        >
          Accept Challenge
        </button>
        <button onClick={onSkip} className="mt-4 text-sm text-muted-foreground underline underline-offset-2">
          Maybe later
        </button>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // COMPLETE
  // ─────────────────────────────────────────────────────────────────────────
  if (stage === "complete") {
    return (
      <div
        className="fixed inset-0 flex flex-col items-center justify-center px-6 z-50"
        style={{ background: "radial-gradient(ellipse at top, #1a1f3a 0%, #0d0f1a 60%)" }}
      >
        <div className="text-7xl mb-6" style={{ filter: "drop-shadow(0 0 32px rgba(245,200,66,0.6))" }}>🏆</div>
        <h1 className="font-display font-bold text-center mb-2" style={{ fontSize: "1.9rem", color: "var(--color-gold)" }}>
          Challenge Complete!
        </h1>
        <p className="text-center text-sm text-muted-foreground mb-8 max-w-xs leading-relaxed">
          {challenge.completionMessage}
        </p>
        <div
          className="flex items-center gap-3 px-6 py-4 rounded-2xl mb-10"
          style={{ background: "rgba(245,200,66,0.12)", border: "1.5px solid rgba(245,200,66,0.4)" }}
        >
          <span className="text-3xl">{practiceMode ? "🧘" : "🍌"}</span>
          <div>
            {!practiceMode ? (
              <>
                <p className="font-display font-bold text-gold text-2xl leading-none">+{challenge.bananaReward} Bananas</p>
                <p className="text-xs text-muted-foreground mt-1">Added to your total</p>
              </>
            ) : (
              <>
                <p className="font-display font-bold text-gold text-2xl leading-none">Well Done</p>
                <p className="text-xs text-muted-foreground mt-1">Practice complete</p>
              </>
            )}
          </div>
        </div>
        <button
          onClick={() => onComplete(practiceMode ? 0 : challenge.bananaReward)}
          data-testid="button-challenge-done"
          className="w-full max-w-xs py-5 rounded-3xl font-display font-bold text-lg transition-all active:scale-95"
          style={{ background: "linear-gradient(135deg, var(--color-saffron), var(--color-gold))", color: "#1a0a00", boxShadow: "0 8px 32px rgba(245,200,66,0.3)" }}
        >
          {practiceMode ? "Back to Dashboard" : "Claim Reward 🍌"}
        </button>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ACTIVE
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-between px-6 py-10 z-50"
      style={{ background: "radial-gradient(ellipse at top, #0f1a2a 0%, #0d0f1a 70%)" }}
    >
      {/* Header */}
      <div className="w-full flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-widest">Round</p>
          <p className="font-display font-bold text-foreground text-base">{round} / {challenge.totalRounds}</p>
        </div>
        <div className="font-display font-bold text-gold">{challenge.emoji} {challenge.name}</div>
        <button onClick={() => { stopMusic(); onSkip(); }} className="text-muted-foreground text-xs">End</button>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{ width: `${progressPct}%`, background: `linear-gradient(90deg, ${phase.color}80, ${phase.color})` }}
        />
      </div>

      {/* Breathing ring */}
      <div className="flex flex-col items-center justify-center flex-1 gap-6">
        <div className="relative flex items-center justify-center" style={{ width: 240, height: 240 }}>
          <div
            className="absolute rounded-full"
            style={{
              width: "100%", height: "100%",
              background: `radial-gradient(circle, ${phase.color}15 0%, transparent 70%)`,
              transform: `scale(${ringScale})`,
              transition: `transform ${phase.count * 0.95}s cubic-bezier(0.4, 0, 0.6, 1)`,
            }}
          />
          <div
            className="absolute rounded-full"
            style={{
              width: "80%", height: "80%",
              border: `3px solid ${phase.color}`,
              boxShadow: `0 0 30px ${phase.color}50, inset 0 0 30px ${phase.color}10`,
              transform: `scale(${ringScale})`,
              transition: `transform ${phase.count * 0.95}s cubic-bezier(0.4, 0, 0.6, 1), border-color 0.5s ease, box-shadow 0.5s ease`,
            }}
          />
          <div className="flex flex-col items-center gap-1 z-10">
            <div className="font-display font-bold transition-colors duration-500" style={{ fontSize: "4rem", color: phase.color, lineHeight: 1 }}>
              {countdown}
            </div>
            <div className="font-display text-center transition-colors duration-500" style={{ fontSize: "1rem", color: phase.color, opacity: 0.9 }}>
              {phase.cue}
            </div>
          </div>
        </div>

        <div className="text-center uppercase" style={{ fontSize: "1.5rem", fontWeight: 700, color: phase.color, fontFamily: "var(--font-display)", letterSpacing: "0.05em" }}>
          {phase.label}
        </div>

        <div className="flex gap-2">
          {challenge.phases.map((p, i) => (
            <div key={i} className="w-2 h-2 rounded-full transition-all duration-300"
              style={{ background: i === phaseIdx ? p.color : "rgba(255,255,255,0.15)", transform: i === phaseIdx ? "scale(1.4)" : "scale(1)" }}
            />
          ))}
        </div>
      </div>

      {/* Script narration */}
      <div className="w-full max-w-xs text-center" style={{ minHeight: 56 }} key={scriptIdx}>
        <p className="text-muted-foreground text-sm leading-relaxed" style={{ fontStyle: "italic", opacity: 0.8, animation: "fadeInUp 0.6s ease" }}>
          {challenge.script[scriptIdx]}
        </p>
      </div>
    </div>
  );
}
