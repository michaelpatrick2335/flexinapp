import { useState, useRef } from "react";
import { BUILTIN_TRACKS } from "@/lib/meditation-tracks";

interface MusicPickerPopupProps {
  initialTrackId?: string | null;
  onConfirm: (trackId: string) => void;
  onClose: () => void;
}

export function MusicPickerPopup({ initialTrackId, onConfirm, onClose }: MusicPickerPopupProps) {
  const [selected, setSelected] = useState<string>(initialTrackId || "bliss");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  function togglePreview(id: string) {
    if (playingId === id) {
      audioRef.current?.pause();
      audioRef.current = null;
      setPlayingId(null);
      return;
    }
    audioRef.current?.pause();
    const audio = new Audio(`/audio/${id}.mp3`);
    audio.volume = 1.0;
    audio.play().catch(() => {});
    audio.onended = () => setPlayingId(null);
    audioRef.current = audio;
    setPlayingId(id);
    setTimeout(() => {
      if (audioRef.current === audio) {
        audio.pause();
        audioRef.current = null;
        setPlayingId(null);
      }
    }, 25000);
  }

  function handleConfirm() {
    audioRef.current?.pause();
    audioRef.current = null;
    onConfirm(selected);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-5"
      style={{ background: "rgba(0,0,0,0.80)", backdropFilter: "blur(6px)" }}
    >
      <div
        className="relative w-full max-w-sm rounded-3xl px-5 pt-5 pb-5"
        style={{ background: "#1a1c2a", border: "1.5px solid rgba(245,200,66,0.4)" }}
      >
        {/* Close */}
        <button
          onClick={() => { audioRef.current?.pause(); onClose(); }}
          className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center transition-all active:scale-90"
          style={{ background: "rgba(255,255,255,0.1)" }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>

        {/* Header */}
        <div className="flex flex-col items-center mb-4">
          <span style={{ fontSize: "1.4rem", marginBottom: 4 }}>🎵</span>
          <h2 className="font-display font-bold text-center leading-tight" style={{ color: "var(--color-gold)", fontSize: "1.15rem" }}>
            What music would you like<br/>to meditate with?
          </h2>
        </div>

        {/* Track list */}
        <div className="flex flex-col gap-2 mb-4">
          {BUILTIN_TRACKS.map(track => {
            const isSelected = selected === track.id;
            const isPlaying = playingId === track.id;
            return (
              <div
                key={track.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all active:scale-[0.98]"
                style={{
                  background: isSelected ? "rgba(245,200,66,0.07)" : "rgba(255,255,255,0.04)",
                  border: `1.5px solid ${isSelected ? "rgba(245,200,66,0.5)" : "rgba(255,255,255,0.08)"}`,
                }}
                onClick={() => setSelected(track.id)}
              >
                {/* Play button */}
                <button
                  onClick={e => { e.stopPropagation(); togglePreview(track.id); }}
                  className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all active:scale-90"
                  style={{ background: "rgba(255,255,255,0.12)" }}
                >
                  {isPlaying ? (
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="white"><rect x="5" y="4" width="4" height="16"/><rect x="15" y="4" width="4" height="16"/></svg>
                  ) : (
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg>
                  )}
                </button>

                {/* Emoji + Name */}
                <span style={{ fontSize: "1.15rem" }}>{track.emoji}</span>
                <span
                  className="font-display font-bold flex-1"
                  style={{ color: isSelected ? "var(--color-gold)" : "var(--foreground)", fontSize: "0.9rem" }}
                >
                  {track.name}
                </span>

                {/* Checkmark */}
                {isSelected && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-gold)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                )}
              </div>
            );
          })}
        </div>

        {/* Confirm button */}
        <button
          onClick={handleConfirm}
          className="w-full py-3.5 rounded-2xl font-display font-bold text-white text-base transition-all active:scale-95"
          style={{ background: "linear-gradient(135deg, #2d8a4e, #1f6e3a)" }}
        >
          Start Meditating
        </button>
      </div>
    </div>
  );
}
