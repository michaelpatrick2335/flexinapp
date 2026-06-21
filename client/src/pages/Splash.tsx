import { useEffect, useState } from "react";
import splashScene from "@/assets/splash_scene.jpeg";

interface SplashProps {
  onComplete: () => void;
}

export function Splash({ onComplete }: SplashProps) {
  const [phase, setPhase] = useState<"hidden" | "visible" | "morphing">("hidden");

  useEffect(() => {
    // Fade in the scene
    const t0 = setTimeout(() => setPhase("visible"), 80);
    return () => clearTimeout(t0);
  }, []);

  function handleAction() {
    setPhase("morphing");
    setTimeout(onComplete, 650);
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden"
      style={{
        opacity: phase === "hidden" ? 0 : phase === "morphing" ? 0 : 1,
        transform: phase === "morphing" ? "scale(1.06)" : "scale(1)",
        transition: phase === "hidden"
          ? "opacity 0.6s ease"
          : "opacity 0.6s ease, transform 0.65s cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      {/* Full-screen jungle scene */}
      <img
        src={splashScene}
        alt="Flexin"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "center top",
        }}
      />

      {/* Very subtle dark overlay at bottom so buttons pop */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "42%",
          background: "linear-gradient(to bottom, transparent 0%, rgba(8,14,22,0.55) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* Buttons — overlaid at the same vertical position as the image design */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          padding: "0 32px 56px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
          opacity: phase === "visible" ? 1 : 0,
          transform: phase === "visible" ? "translateY(0)" : "translateY(16px)",
          transition: "opacity 0.5s ease 0.4s, transform 0.5s ease 0.4s",
        }}
      >
        {/* Sign Up */}
        <button
          data-testid="button-signup"
          onClick={handleAction}
          style={{
            width: "100%",
            padding: "18px 0",
            borderRadius: 14,
            background: "linear-gradient(135deg, #2d8a4e 0%, #1f6e3a 100%)",
            border: "none",
            color: "#fff",
            fontSize: "1.1rem",
            fontWeight: 700,
            fontFamily: "var(--font-display)",
            letterSpacing: "0.02em",
            cursor: "pointer",
            boxShadow: "0 4px 20px rgba(45,138,78,0.45)",
            transition: "transform 0.12s ease, box-shadow 0.12s ease",
          }}
          onMouseDown={e => (e.currentTarget.style.transform = "scale(0.97)")}
          onMouseUp={e => (e.currentTarget.style.transform = "scale(1)")}
          onTouchStart={e => (e.currentTarget.style.transform = "scale(0.97)")}
          onTouchEnd={e => { e.currentTarget.style.transform = "scale(1)"; handleAction(); }}
        >
          Sign up
        </button>

        {/* Login */}
        <button
          data-testid="button-login"
          onClick={handleAction}
          style={{
            width: "100%",
            padding: "17px 0",
            borderRadius: 14,
            background: "transparent",
            border: "2px solid rgba(245,200,66,0.75)",
            color: "#f5c842",
            fontSize: "1.1rem",
            fontWeight: 600,
            fontFamily: "var(--font-display)",
            letterSpacing: "0.02em",
            cursor: "pointer",
            transition: "transform 0.12s ease, border-color 0.12s ease",
          }}
          onMouseDown={e => (e.currentTarget.style.transform = "scale(0.97)")}
          onMouseUp={e => (e.currentTarget.style.transform = "scale(1)")}
          onTouchStart={e => (e.currentTarget.style.transform = "scale(0.97)")}
          onTouchEnd={e => { e.currentTarget.style.transform = "scale(1)"; handleAction(); }}
        >
          Login
        </button>
      </div>
    </div>
  );
}
