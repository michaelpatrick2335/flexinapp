import paymentBg from "@/assets/payment_bg.jpeg";

interface BenefitItem {
  icon: string;
  title: string;
  subtitle: string;
}

interface BenefitData {
  emoji: string;
  title: string;
  subtitle: string;
  body: string;
  items: BenefitItem[];
}

export const BENEFIT_POPUPS: BenefitData[] = [
  // Session 1 complete → Focus
  {
    emoji: "💡",
    title: "Focus",
    subtitle: "To handle everything in your life",
    body: "Meditation trains your mind to stay present and ignore distractions. You'll think clearer, make better decisions, and get more done.",
    items: [
      { icon: "🎯", title: "Better Concentration", subtitle: "Stay focused on what matters" },
      { icon: "🧠", title: "Clearer Thinking", subtitle: "Make decisions with confidence" },
      { icon: "✅", title: "More Productivity", subtitle: "Get more done with less stress" },
    ],
  },
  // Session 2 complete → Stress Less
  {
    emoji: "😮‍💨",
    title: "Stress Less",
    subtitle: "Understanding your stress and letting go",
    body: "Meditation helps reduce stress by calming your mind and relaxing your body. It lowers anxiety, improves mood, and helps you feel more in control—even on tough days.",
    items: [
      { icon: "🌿", title: "Lower Stress Levels", subtitle: "Reduce cortisol and feel calmer" },
      { icon: "😊", title: "Better Mood", subtitle: "Feel happier and more balanced" },
      { icon: "〰️", title: "Relax Deeply", subtitle: "Let go of tension and fatigue" },
    ],
  },
  // Session 3 complete → Healthy Body & Mind
  {
    emoji: "💚",
    title: "Healthy Body\n& Mind",
    subtitle: "Hormones and brain start working better",
    body: "Meditation supports your entire well-being. It balances hormones, boosts your immune system, improves sleep, and enhances brain function so you can feel your best every day.",
    items: [
      { icon: "🧠", title: "Better Brain Function", subtitle: "Improve memory, focus and cognition" },
      { icon: "🛡️", title: "Stronger Immunity", subtitle: "Support your body's natural defense" },
      { icon: "🌙", title: "Better Sleep", subtitle: "Fall asleep faster and sleep deeper" },
    ],
  },
  // Session 4 complete → Relationships Improve
  {
    emoji: "🤝",
    title: "Relationships\nImprove",
    subtitle: "People and partners become more in your life!",
    body: "Meditation helps you listen better, communicate with kindness, and be more present with the people who matter most. It builds empathy, patience, and understanding—creating stronger, deeper connections.",
    items: [
      { icon: "❤️", title: "Stronger Connections", subtitle: "Build deeper and more meaningful relationships" },
      { icon: "👥", title: "Better Communication", subtitle: "Express yourself clearly and listen with compassion" },
      { icon: "🪷", title: "More Empathy", subtitle: "Understand others and strengthen your bonds" },
    ],
  },
];

interface BenefitPopupProps {
  data: BenefitData;
  onClose: () => void;
}

export function BenefitPopup({ data, onClose }: BenefitPopupProps) {
  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 60,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "0 16px",
      }}
    >
      {/* Background image + overlay */}
      <img
        src={paymentBg}
        alt=""
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" }}
      />
      <div style={{ position: "absolute", inset: 0, background: "rgba(6,10,18,0.72)" }} />

      {/* Card */}
      <div
        style={{
          position: "relative", zIndex: 2,
          width: "100%", maxWidth: 380,
          background: "rgba(20,24,38,0.95)",
          backdropFilter: "blur(16px)",
          borderRadius: 28,
          border: "1.5px solid rgba(245,200,66,0.4)",
          padding: "28px 24px 24px",
          boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
          animation: "fadeInUp 0.35s ease",
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: "absolute", top: 16, right: 16,
            width: 32, height: 32, borderRadius: "50%",
            background: "rgba(255,255,255,0.1)",
            border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "rgba(255,255,255,0.6)",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M13 1L1 13M1 1l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>

        {/* Icon box */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 18,
            background: "rgba(245,200,66,0.1)",
            border: "1.5px solid rgba(245,200,66,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "2rem",
          }}>
            {data.emoji}
          </div>
        </div>

        {/* Title */}
        <h2 style={{
          fontFamily: "var(--font-display)", fontWeight: 800,
          fontSize: "1.9rem", color: "#f5c842",
          textAlign: "center", lineHeight: 1.15,
          marginBottom: 6, whiteSpace: "pre-line",
        }}>
          {data.title}
        </h2>

        {/* Subtitle */}
        <p style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.9rem", textAlign: "center", lineHeight: 1.4, marginBottom: 16 }}>
          {data.subtitle}
        </p>

        {/* Divider + dot */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
          <div style={{ flex: 1, height: 1, background: "rgba(245,200,66,0.2)" }} />
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#f5c842", margin: "0 8px", flexShrink: 0 }} />
          <div style={{ flex: 1, height: 1, background: "rgba(245,200,66,0.2)" }} />
        </div>

        {/* Body text */}
        <p style={{ color: "rgba(255,255,255,0.8)", fontSize: "0.88rem", textAlign: "center", lineHeight: 1.6, marginBottom: 20 }}>
          {data.body}
        </p>

        {/* Feature items */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 24 }}>
          {data.items.map((item, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{
                width: 42, height: 42, borderRadius: "50%", flexShrink: 0,
                background: "rgba(245,200,66,0.1)",
                border: "1px solid rgba(245,200,66,0.2)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "1.2rem",
              }}>
                {item.icon}
              </div>
              <div>
                <p style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.95rem", color: "#ffffff", marginBottom: 2 }}>{item.title}</p>
                <p style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.5)" }}>{item.subtitle}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Got it button */}
        <button
          onClick={onClose}
          style={{
            width: "100%", padding: "17px 0",
            borderRadius: 16,
            background: "linear-gradient(135deg, #2d8a4e, #1f6e3a)",
            border: "none", color: "#ffffff",
            fontSize: "1.05rem", fontWeight: 700,
            fontFamily: "var(--font-display)",
            cursor: "pointer",
            boxShadow: "0 4px 20px rgba(45,138,78,0.4)",
          }}
        >
          Got it
        </button>
      </div>
    </div>
  );
}
