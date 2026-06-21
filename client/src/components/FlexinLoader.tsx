import flexinCircle from "@/assets/flexin_circle.jpeg";

export function FlexinLoader({ text = "Centering..." }: { text?: string }) {
  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "#0d0f1a",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
      }}
    >
      <div
        style={{
          width: 90,
          height: 90,
          borderRadius: "50%",
          overflow: "hidden",
          border: "3px solid rgba(245,200,66,0.5)",
          boxShadow: "0 0 30px rgba(245,200,66,0.25)",
          animation: "flexinPulse 1.8s ease-in-out infinite",
        }}
      >
        <img
          src={flexinCircle}
          alt="Flexin"
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>
      <p
        style={{
          color: "rgba(255,255,255,0.35)",
          fontSize: "0.85rem",
          fontWeight: 600,
          letterSpacing: "0.05em",
          animation: "flexinFade 1.8s ease-in-out infinite",
        }}
      >
        {text}
      </p>
      <style>{`
        @keyframes flexinPulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 30px rgba(245,200,66,0.25); }
          50% { transform: scale(1.06); box-shadow: 0 0 50px rgba(245,200,66,0.45); }
        }
        @keyframes flexinFade {
          0%, 100% { opacity: 0.35; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}
