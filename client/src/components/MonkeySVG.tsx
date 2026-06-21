// Animated SVG flexin face that evolves with banana count
// Hue shifts as the monk progresses through all 25 stages

interface FlexinSVGProps {
  bananas: number;
  size?: number;
  animated?: boolean;
  tier?: string;
}

// Get accent color per tier
function getTierAccent(tier: string): string {
  if (tier === "enlightened") return "#a78bfa";
  if (tier === "experienced") return "#f59e0b";
  return "#4ade80";
}

// Stage-based face expressions
function getFaceStage(bananas: number): number {
  return Math.min(Math.floor(bananas / 40), 5); // 6 distinct face stages across 0–240+
}

export function FlexinSVG({ bananas, size = 120, animated = false, tier = "newbie" }: FlexinSVGProps) {
  const stage = getFaceStage(bananas);
  const accent = getTierAccent(tier);

  // Body color darkens/purples as you progress
  const bodyColors = [
    "#b5651d", // stage 0 — warm brown
    "#9b5516", // stage 1
    "#8b4513", // stage 2
    "#7a3b1e", // stage 3
    "#6b2d3e", // stage 4 — purple tones emerging
    "#5a2060", // stage 5 — enlightened purple
  ];

  const faceColors = [
    "#deb887",
    "#d2a67c",
    "#c8956a",
    "#be8460",
    "#b07055",
    "#9a5f70",
  ];

  const bodyColor = bodyColors[stage];
  const faceColor = faceColors[stage];

  // Eye styles evolve — more peaceful/zen at higher stages
  const eyeStyles = [
    // stage 0 — wide open curious
    { rx: 5, ry: 5, y: -8, transform: "" },
    // stage 1 — slightly narrowed
    { rx: 5, ry: 4, y: -8, transform: "" },
    // stage 2 — half-lid
    { rx: 5, ry: 3.5, y: -8, transform: "" },
    // stage 3 — serene
    { rx: 5, ry: 3, y: -8, transform: "" },
    // stage 4 — nearly closed meditative
    { rx: 5, ry: 2, y: -8, transform: "" },
    // stage 5 — eyes closed in bliss (drawn as curved lines)
    { rx: 0, ry: 0, y: -8, transform: "" },
  ];

  const eyeStyle = eyeStyles[Math.min(stage, 5)];
  const closedEyes = stage >= 5;

  const animClass = animated ? "breathe" : "";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`flexin-glow ${animClass}`}
      aria-label="Flexin mascot"
    >
      {/* Ears */}
      <circle cx="18" cy="60" r="14" fill={bodyColor} />
      <circle cx="18" cy="60" r="9" fill={faceColor} />
      <circle cx="102" cy="60" r="14" fill={bodyColor} />
      <circle cx="102" cy="60" r="9" fill={faceColor} />

      {/* Head */}
      <circle cx="60" cy="58" r="38" fill={bodyColor} />

      {/* Face muzzle */}
      <ellipse cx="60" cy="72" rx="18" ry="13" fill={faceColor} />

      {/* Tier halo — glowing ring above head */}
      {tier === "enlightened" && (
        <ellipse cx="60" cy="22" rx="22" ry="5" fill="none" stroke={accent} strokeWidth="2.5" opacity="0.8" />
      )}
      {tier === "experienced" && (
        <ellipse cx="60" cy="22" rx="18" ry="4" fill="none" stroke={accent} strokeWidth="2" opacity="0.7" />
      )}

      {/* Eyes */}
      {!closedEyes ? (
        <>
          <ellipse cx="46" cy="52" rx={eyeStyle.rx} ry={eyeStyle.ry} fill="#1a0a00" />
          <ellipse cx="74" cy="52" rx={eyeStyle.rx} ry={eyeStyle.ry} fill="#1a0a00" />
          {/* Eye shine */}
          <circle cx="48" cy="50" r="1.5" fill="white" opacity="0.8" />
          <circle cx="76" cy="50" r="1.5" fill="white" opacity="0.8" />
        </>
      ) : (
        // Stage 5 closed meditative eyes — curved lines
        <>
          <path d="M41 52 Q46 48 51 52" stroke="#1a0a00" strokeWidth="2" strokeLinecap="round" fill="none" />
          <path d="M69 52 Q74 48 79 52" stroke="#1a0a00" strokeWidth="2" strokeLinecap="round" fill="none" />
        </>
      )}

      {/* Nose */}
      <ellipse cx="60" cy="65" rx="4" ry="3" fill="#8b4513" opacity="0.6" />

      {/* Mouth — smile grows with stage */}
      {stage <= 1 && (
        <path d="M52 74 Q60 78 68 74" stroke="#8b4513" strokeWidth="2" strokeLinecap="round" fill="none" />
      )}
      {stage === 2 && (
        <path d="M50 73 Q60 80 70 73" stroke="#8b4513" strokeWidth="2" strokeLinecap="round" fill="none" />
      )}
      {stage >= 3 && (
        // serene smile
        <path d="M50 73 Q60 82 70 73" stroke="#7a3030" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      )}

      {/* Third eye / enlightenment dot at stage 4+ */}
      {stage >= 4 && (
        <circle cx="60" cy="44" r="3" fill={accent} opacity="0.9" />
      )}

      {/* Glowing aura dots for enlightened */}
      {tier === "enlightened" && (
        <>
          <circle cx="30" cy="32" r="2" fill={accent} opacity="0.5" />
          <circle cx="90" cy="32" r="2" fill={accent} opacity="0.5" />
          <circle cx="20" cy="70" r="1.5" fill={accent} opacity="0.3" />
          <circle cx="100" cy="70" r="1.5" fill={accent} opacity="0.3" />
        </>
      )}
    </svg>
  );
}
