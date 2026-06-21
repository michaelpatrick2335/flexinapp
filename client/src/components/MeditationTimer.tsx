import { useState, useEffect, useRef, useCallback } from "react";
import { formatDuration } from "@/lib/flexin-game";
import { BUILTIN_TRACKS } from "@/lib/meditation-tracks";
import { API_BASE } from "@/lib/queryClient";

interface MeditationTimerProps {
  durationSeconds: number;
  onComplete: () => void;
  onCancel: () => void;
  customMusicTrackId?: string | null; // if set, play this track instead of synth
}

// ─── Bell synthesizer using Web Audio API ───────────────────────────────────
function playBell(ctx: AudioContext, frequency = 440, duration = 3) {
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  osc.connect(gainNode);
  gainNode.connect(ctx.destination);
  osc.frequency.setValueAtTime(frequency, ctx.currentTime);
  osc.type = "sine";
  gainNode.gain.setValueAtTime(0.8, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);

  // Add overtone for richer bell sound
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.connect(gain2);
  gain2.connect(ctx.destination);
  osc2.frequency.setValueAtTime(frequency * 2.756, ctx.currentTime);
  osc2.type = "sine";
  gain2.gain.setValueAtTime(0.3, ctx.currentTime);
  gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration * 0.7);
  osc2.start(ctx.currentTime);
  osc2.stop(ctx.currentTime + duration * 0.7);
}

// ─── Monk ambient music using oscillators ───────────────────────────────────

export function MeditationTimer({ durationSeconds, onComplete, onCancel, customMusicTrackId }: MeditationTimerProps) {
  const [secondsLeft, setSecondsLeft] = useState(durationSeconds);
  const [phase, setPhase] = useState<"starting" | "meditating" | "ending">("starting");
  const [hasBell, setHasBell] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const stopMusicRef = useRef<(() => void) | null>(null);
  const customAudioRef = useRef<HTMLAudioElement | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const getAudioCtx = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioCtxRef.current;
  }, []);

  // Start bell + music on mount
  useEffect(() => {
    const ctx = getAudioCtx();
    playBell(ctx, 528, 4);
    setHasBell(true);
    setPhase("meditating");

    // Use local static audio files served from /audio/
    const trackId = customMusicTrackId || "bliss";
    const trackUrl = `/audio/${trackId}.mp3`;

    const audio = new Audio(trackUrl);
    audio.loop = true;
    audio.volume = 1.0;
    audio.play().catch((e) => console.warn("Audio play failed:", e));
    customAudioRef.current = audio;
    // When music ends naturally (loop=false for non-looping tracks), fire the closing bell
    audio.onended = () => {
      const ctx = getAudioCtx();
      playBell(ctx, 432, 5);
      setTimeout(onComplete, 3000);
    };
    stopMusicRef.current = () => {
      audio.onended = null; // prevent double-fire on manual stop
      audio.pause();
    };
  }, [getAudioCtx, customMusicTrackId]);

  // Countdown tick
  useEffect(() => {
    if (phase !== "meditating") return;
    intervalRef.current = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) {
          clearInterval(intervalRef.current!);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [phase]);

  // Handle timer completion — bell fires instantly, music stops
  useEffect(() => {
    if (secondsLeft === 0 && phase === "meditating") {
      setPhase("ending");
      // Stop music immediately
      if (customAudioRef.current) {
        customAudioRef.current.onended = null;
        customAudioRef.current.pause();
      }
      // Fire closing bell right now
      const ctx = getAudioCtx();
      playBell(ctx, 432, 5);
      setTimeout(onComplete, 3000);
    }
  }, [secondsLeft, phase, getAudioCtx, onComplete]);

  const handleCancel = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (stopMusicRef.current) stopMusicRef.current();
    onCancel();
  };

  // SVG ring progress
  const radius = 90;
  const circumference = 2 * Math.PI * radius;
  const progress = (durationSeconds - secondsLeft) / durationSeconds;
  const offset = circumference * (1 - progress);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 stars-bg">
      {/* Phase label */}
      <div className="mb-8 text-center">
        {phase === "starting" && (
          <p className="text-lg text-muted-foreground animate-pulse">Preparing your space...</p>
        )}
        {phase === "meditating" && (
          <p className="text-lg" style={{ color: "var(--color-gold)" }}>Breathe and be still</p>
        )}
        {phase === "ending" && (
          <p className="text-lg text-purple-400 animate-pulse">Gently returning...</p>
        )}
      </div>

      {/* Timer ring */}
      <div className="relative flex items-center justify-center pulse-glow" style={{ width: 220, height: 220, borderRadius: '50%' }}>
        <svg width="220" height="220" style={{ transform: 'rotate(-90deg)', position: 'absolute', top: 0, left: 0 }} viewBox="0 0 220 220">
          {/* Track */}
          <circle
            cx="110" cy="110" r={radius}
            strokeWidth="6"
            fill="none"
            className="timer-ring-track"
          />
          {/* Progress */}
          <circle
            cx="110" cy="110" r={radius}
            strokeWidth="6"
            fill="none"
            strokeLinecap="round"
            className="timer-ring-progress"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>

        {/* Time display */}
        <div className="text-center z-10">
          <div
            className="font-display text-gold"
            style={{ fontSize: "clamp(2.5rem, 8vw, 3.5rem)", fontWeight: 700, lineHeight: 1 }}
            data-testid="timer-display"
          >
            {formatDuration(secondsLeft)}
          </div>
          <div className="text-muted-foreground text-sm mt-1">remaining</div>
        </div>
      </div>

      {/* Breathing guide */}
      {phase === "meditating" && (
        <div className="mt-10 flex flex-col items-center">
          <div
            className="w-16 h-16 rounded-full border-2 breathe"
            style={{ borderColor: "var(--color-gold)", background: "var(--color-glow)" }}
          />
          <p className="text-muted-foreground text-sm mt-3">Follow the breath</p>
        </div>
      )}

      {/* Cancel button */}
      {phase === "meditating" && (
        <button
          onClick={handleCancel}
          className="mt-6 text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4"
          data-testid="button-cancel-meditation"
        >
          End early
        </button>
      )}

      {phase === "ending" && (
        <div className="mt-10 text-center">
          <div className="text-4xl mb-2">🍌</div>
          <p className="text-gold font-display text-lg">+1 banana earned</p>
        </div>
      )}
    </div>
  );
}
