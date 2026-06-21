interface MustReadPopupProps {
  onClose: () => void;
}

const TIPS = [
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 18v-6a9 9 0 0 1 18 0v6"/>
        <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>
      </svg>
    ),
    title: "Wear headphones",
    sub: "for best experience",
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <circle cx="12" cy="12" r="6"/>
        <circle cx="12" cy="12" r="2"/>
      </svg>
    ),
    title: "Visualize the center of your mind",
    sub: "and stay there",
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
    title: "Thoughts will come in",
    sub: "don't judge, just let it pass.",
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {/* Meditating figure */}
        <circle cx="12" cy="5" r="1.5"/>
        <path d="M12 7v4"/>
        <path d="M8 13c0 0 1.5-2 4-2s4 2 4 2"/>
        <path d="M6 17c1.5-1.5 3.5-2.5 6-2.5s4.5 1 6 2.5"/>
      </svg>
    ),
    title: "Be here",
    sub: "you have no where to go.",
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 12c0 0 3-5 10-5s10 5 10 5"/>
        <path d="M2 17c0 0 3-5 10-5s10 5 10 5"/>
        <path d="M2 7c0 0 3-5 10-5s10 5 10 5"/>
      </svg>
    ),
    title: "Relax and breathe",
    sub: "that's all you need to do.",
  },
];

export function MustReadPopup({ onClose }: MustReadPopupProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-5"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
    >
      <div
        className="relative w-full max-w-sm rounded-3xl px-6 pt-8 pb-6"
        style={{
          background: "#1a1c2a",
          border: "1.5px solid rgba(245,200,66,0.4)",
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-90"
          style={{ background: "rgba(255,255,255,0.1)" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>

        {/* Header */}
        <div className="flex flex-col items-center mb-6">
          <span style={{ fontSize: "2rem" }}>⭐</span>
          <h2
            className="font-display font-bold mt-1"
            style={{ color: "var(--color-gold)", fontSize: "1.5rem", letterSpacing: "-0.01em" }}
          >
            Must Read!
          </h2>
        </div>

        {/* Tips list */}
        <div className="flex flex-col gap-0">
          {TIPS.map((tip, i) => (
            <div key={i}>
              <div className="flex items-start gap-4 py-3">
                {/* Icon box */}
                <div
                  className="flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center"
                  style={{
                    background: "rgba(245,200,66,0.1)",
                    border: "1px solid rgba(245,200,66,0.2)",
                    color: "var(--color-gold)",
                  }}
                >
                  {tip.icon}
                </div>
                {/* Text */}
                <div className="flex flex-col justify-center">
                  <p className="font-bold text-white leading-tight" style={{ fontSize: "0.95rem" }}>{tip.title}</p>
                  <p className="text-muted-foreground leading-snug mt-0.5" style={{ fontSize: "0.8rem" }}>{tip.sub}</p>
                </div>
              </div>
              {/* Dot divider (not after last) */}
              {i < TIPS.length - 1 && (
                <div className="flex items-center justify-center">
                  <div className="w-full h-px" style={{ background: "rgba(255,255,255,0.06)" }}/>
                  <div className="w-1.5 h-1.5 rounded-full mx-3 flex-shrink-0" style={{ background: "rgba(245,200,66,0.5)" }}/>
                  <div className="w-full h-px" style={{ background: "rgba(255,255,255,0.06)" }}/>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Got it button */}
        <button
          onClick={onClose}
          className="w-full mt-6 py-4 rounded-2xl font-display font-bold text-white text-base transition-all active:scale-95"
          style={{ background: "linear-gradient(135deg, #2d8a4e, #1f6e3a)" }}
        >
          Got it
        </button>
      </div>
    </div>
  );
}
