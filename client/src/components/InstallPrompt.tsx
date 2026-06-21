import { useState, useEffect } from "react";
import flexinCircle from "@/assets/flexin_circle.jpeg";

interface InstallPromptProps {
  onDone: () => void;
}

export function InstallPrompt({ onDone }: InstallPromptProps) {
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [installed, setInstalled] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if already installed as PWA
    const standalone = window.matchMedia("(display-mode: standalone)").matches
      || (window.navigator as any).standalone === true;
    setIsStandalone(standalone);

    const ua = navigator.userAgent;
    setIsIOS(/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream);
    setIsAndroid(/Android/.test(ua));

    // Capture Android install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // If already installed as PWA, skip straight to app
  useEffect(() => {
    if (isStandalone) onDone();
  }, [isStandalone]);

  const handleAndroidInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setInstalled(true);
        setTimeout(onDone, 1500);
      }
    }
  };

  const bg = "#0d0f1a";
  const gold = "#f5c842";
  const dim = "rgba(255,255,255,0.5)";

  if (installed) {
    return (
      <div style={{ minHeight: "100dvh", background: bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 32px", textAlign: "center" }}>
        <div style={{ fontSize: "3rem", marginBottom: 16 }}>🎉</div>
        <h2 style={{ color: "#fff", fontWeight: 800, fontSize: "1.5rem", marginBottom: 8 }}>Flexin added!</h2>
        <p style={{ color: dim }}>Opening your app...</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100dvh", background: bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 28px", textAlign: "center" }}>
      {/* Logo */}
      <img src={flexinCircle} alt="Flexin" style={{ width: 100, height: 100, borderRadius: "50%", objectFit: "cover", marginBottom: 24, border: `3px solid ${gold}` }} />

      <h1 style={{ color: "#fff", fontWeight: 800, fontSize: "1.8rem", marginBottom: 8, lineHeight: 1.2 }}>
        Add Flexin to your<br />Home Screen
      </h1>
      <p style={{ color: dim, fontSize: "0.95rem", marginBottom: 40, lineHeight: 1.5 }}>
        Get the full app experience — no App Store needed.
      </p>

      {/* Android */}
      {isAndroid && deferredPrompt && (
        <div style={{ width: "100%", maxWidth: 360 }}>
          <button
            onClick={handleAndroidInstall}
            style={{ width: "100%", padding: "16px 24px", background: gold, color: "#0d0f1a", fontWeight: 800, fontSize: "1rem", borderRadius: 50, border: "none", cursor: "pointer", marginBottom: 16 }}
          >
            Add to Home Screen
          </button>
          <button onClick={onDone} style={{ background: "none", border: "none", color: dim, fontSize: "0.9rem", cursor: "pointer", textDecoration: "underline" }}>
            Skip for now
          </button>
        </div>
      )}

      {/* Android but no prompt yet (already dismissed or not triggered) */}
      {isAndroid && !deferredPrompt && (
        <div style={{ width: "100%", maxWidth: 360 }}>
          <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 16, padding: "20px 24px", marginBottom: 24, textAlign: "left" }}>
            <Step n={1} text='Tap the menu (⋮) in Chrome' />
            <Step n={2} text='"Add to Home screen"' />
            <Step n={3} text='Tap "Add" to confirm' />
          </div>
          <button onClick={onDone} style={{ width: "100%", padding: "16px 24px", background: gold, color: "#0d0f1a", fontWeight: 800, fontSize: "1rem", borderRadius: 50, border: "none", cursor: "pointer" }}>
            I added it — let's go!
          </button>
          <button onClick={onDone} style={{ display: "block", margin: "16px auto 0", background: "none", border: "none", color: dim, fontSize: "0.9rem", cursor: "pointer", textDecoration: "underline" }}>
            Skip for now
          </button>
        </div>
      )}

      {/* iOS */}
      {isIOS && (
        <div style={{ width: "100%", maxWidth: 360 }}>
          <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 16, padding: "20px 24px", marginBottom: 24, textAlign: "left" }}>
            <Step n={1} text="Tap the Share button at the bottom of Safari" icon="⬆️" />
            <Step n={2} text='"Add to Home Screen"' />
            <Step n={3} text='Tap "Add" in the top right' />
          </div>
          {/* iOS share arrow indicator */}
          <div style={{ position: "fixed", bottom: 70, left: "50%", transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, animation: "bounce 1.5s ease-in-out infinite" }}>
            <span style={{ color: gold, fontSize: "1.5rem" }}>↓</span>
            <span style={{ color: gold, fontSize: "0.8rem", fontWeight: 700 }}>Share</span>
          </div>
          <button onClick={onDone} style={{ width: "100%", padding: "16px 24px", background: gold, color: "#0d0f1a", fontWeight: 800, fontSize: "1rem", borderRadius: 50, border: "none", cursor: "pointer" }}>
            I added it — let's go!
          </button>
          <button onClick={onDone} style={{ display: "block", margin: "16px auto 0", background: "none", border: "none", color: dim, fontSize: "0.9rem", cursor: "pointer", textDecoration: "underline" }}>
            Skip for now
          </button>
        </div>
      )}

      {/* Desktop / unknown */}
      {!isIOS && !isAndroid && (
        <div style={{ width: "100%", maxWidth: 360 }}>
          <button onClick={onDone} style={{ width: "100%", padding: "16px 24px", background: gold, color: "#0d0f1a", fontWeight: 800, fontSize: "1rem", borderRadius: 50, border: "none", cursor: "pointer" }}>
            Enter the App →
          </button>
        </div>
      )}

      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateX(-50%) translateY(0); }
          50% { transform: translateX(-50%) translateY(8px); }
        }
      `}</style>
    </div>
  );
}

function Step({ n, text, icon }: { n: number; text: string; icon?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
      <div style={{ minWidth: 28, height: 28, borderRadius: "50%", background: "#f5c842", color: "#0d0f1a", fontWeight: 800, fontSize: "0.85rem", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {n}
      </div>
      <span style={{ color: "rgba(255,255,255,0.8)", fontSize: "0.95rem", lineHeight: 1.4, paddingTop: 4 }}>
        {icon && <span style={{ marginRight: 4 }}>{icon}</span>}{text}
      </span>
    </div>
  );
}
