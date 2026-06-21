// Animated golden firefly background — purely decorative, pointer-events disabled.
// Drop <Fireflies /> anywhere inside a positioned container (relative/absolute/fixed parent).
// For full-screen use, wrap in a `relative` container or place at root of a flex column with min-h-screen.

import { useMemo } from "react";

interface FirefliesProps {
  count?: number; // default 14
  /** Use fixed positioning so fireflies float over the entire viewport regardless of parent layout. */
  fixed?: boolean;
}

export function Fireflies({ count = 14, fixed = false }: FirefliesProps) {
  // Stable random positions per mount.
  const flies = useMemo(
    () =>
      Array.from({ length: count }).map((_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: 2 + Math.random() * 3,
        duration: 5 + Math.random() * 8,
        delay: Math.random() * 5,
      })),
    [count],
  );
  return (
    <div
      className={`pointer-events-none ${fixed ? "fixed" : "absolute"} inset-0 overflow-hidden`}
      style={{ zIndex: 0 }}
      aria-hidden="true"
    >
      {flies.map((f) => (
        <span
          key={f.id}
          style={{
            position: "absolute",
            left: `${f.x}%`,
            top: `${f.y}%`,
            width: f.size,
            height: f.size,
            borderRadius: "50%",
            background: "rgba(245,200,66,0.85)",
            boxShadow: "0 0 8px rgba(245,200,66,0.7), 0 0 16px rgba(245,200,66,0.4)",
            animation: `firefly ${f.duration}s ease-in-out ${f.delay}s infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes firefly {
          0%,100% { opacity: 0; transform: translate(0,0) scale(0.5); }
          25%     { opacity: 0.9; transform: translate(8px,-12px) scale(1); }
          50%     { opacity: 0.4; transform: translate(-6px,-22px) scale(0.8); }
          75%     { opacity: 0.85; transform: translate(10px,-30px) scale(1.1); }
        }
      `}</style>
    </div>
  );
}
