// Parametric muscle-map silhouette.
// Driven by per-user scan params so the silhouette mirrors what's in their photo.
//
// Params (all 0..1):
//   shoulderW    width of shoulders
//   chestW       width/depth of chest
//   waistW       waist width
//   hipW         hip width (read on females; on males just defines taper)
//   armThickness arm girth
//   legThickness leg girth
//   definition   muscle striation visibility (low BF% = high definition)
//   glow         { chest, back, arms, shoulders, legs, core, glutes }  per-muscle highlight intensity 0..1
//
// Theme:
//   accent       primary glow / fill color
//   isFemale     swaps the base proportions and re-balances muscle emphasis
//
// Renders at any size; intrinsic viewBox 200x420.

import React from "react";

export type SilhouetteParams = {
  shoulderW: number;
  chestW: number;
  waistW: number;
  hipW: number;
  armThickness: number;
  legThickness: number;
  definition: number;
  glow: {
    chest: number;
    back: number;
    arms: number;
    shoulders: number;
    legs: number;
    core: number;
    glutes: number;
  };
};

export const DEFAULT_PARAMS_MALE: SilhouetteParams = {
  shoulderW: 0.6,
  chestW: 0.55,
  waistW: 0.4,
  hipW: 0.45,
  armThickness: 0.5,
  legThickness: 0.55,
  definition: 0.5,
  glow: { chest: 0.55, back: 0.5, arms: 0.55, shoulders: 0.5, legs: 0.45, core: 0.5, glutes: 0.4 },
};

export const DEFAULT_PARAMS_FEMALE: SilhouetteParams = {
  shoulderW: 0.42,
  chestW: 0.4,
  waistW: 0.3,
  hipW: 0.55,
  armThickness: 0.32,
  legThickness: 0.5,
  definition: 0.5,
  glow: { chest: 0.4, back: 0.45, arms: 0.4, shoulders: 0.45, legs: 0.55, core: 0.55, glutes: 0.65 },
};

// Linear interp helper
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
// Clamp helper
const c = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));

export function SilhouetteSVG({
  params,
  isFemale,
  accent,
  bg = "transparent",
  showGrid = false,
  className,
  style,
}: {
  params: SilhouetteParams;
  isFemale: boolean;
  accent: string;
  bg?: string;
  showGrid?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  // Center axis x=100; total height ~420
  // All x ranges expressed as half-widths from center
  const p = params;
  const cx = 100;

  // Shoulders
  const shHalf = lerp(28, 56, c(p.shoulderW));
  // Chest (just below shoulders)
  const chHalf = lerp(22, 50, c(p.chestW));
  // Waist
  const waHalf = lerp(14, 40, c(p.waistW));
  // Hips
  const hiHalf = lerp(18, 50, c(p.hipW));
  // Arm thickness
  const armW = lerp(7, 18, c(p.armThickness));
  // Leg thickness
  const legW = lerp(11, 24, c(p.legThickness));

  // Definition controls stroke intensity for striations
  const defLineOpacity = lerp(0.12, 0.55, c(p.definition));
  const defLineWidth = lerp(0.6, 1.4, c(p.definition));

  // Glow opacity from per-muscle param
  const g = p.glow;

  // y-coordinates for landmarks
  const Y_HEAD_TOP = 22;
  const Y_NECK = 60;
  const Y_SHOULDER = 78;
  const Y_CHEST_TOP = 88;
  const Y_CHEST_BOT = 132;
  const Y_WAIST = 178;
  const Y_HIP = 210;
  const Y_KNEE = 308;
  const Y_FOOT = 400;

  // Body outline path \u2014 mirror left/right
  // Going clockwise from head-top right edge
  const outline = [
    `M ${cx - 18} ${Y_HEAD_TOP}`,                              // head top-left
    `Q ${cx - 22} ${Y_NECK - 18} ${cx - 14} ${Y_NECK}`,        // head curve to neck
    `L ${cx - 10} ${Y_NECK + 6}`,                              // neck left
    // Trapezius slope into shoulder
    `L ${cx - shHalf * 0.65} ${Y_SHOULDER - 4}`,
    `Q ${cx - shHalf} ${Y_SHOULDER + 2} ${cx - shHalf} ${Y_SHOULDER + 10}`, // shoulder ball
    // Arm down
    `L ${cx - shHalf + 2} ${Y_CHEST_TOP + 6}`,
    `L ${cx - shHalf + armW * 0.2} ${Y_WAIST - 16}`,           // bicep taper
    `L ${cx - shHalf + armW * 0.6} ${Y_HIP - 8}`,              // forearm
    `L ${cx - shHalf + armW * 0.4} ${Y_HIP + 12}`,             // hand
    // Reconnect back up to torso side near waist
    `M ${cx - chHalf} ${Y_CHEST_TOP}`,
    `L ${cx - chHalf + 2} ${Y_CHEST_BOT}`,
    `L ${cx - waHalf} ${Y_WAIST}`,
    `L ${cx - hiHalf} ${Y_HIP}`,
    // Legs - left
    `L ${cx - hiHalf + 2} ${Y_HIP + 14}`,
    `L ${cx - legW * 1.05} ${Y_KNEE}`,
    `L ${cx - legW * 0.85} ${Y_FOOT}`,
    `L ${cx - legW * 0.15} ${Y_FOOT}`,
    `L ${cx - 4} ${Y_KNEE}`,
    `L ${cx - 4} ${Y_HIP + 14}`,
    // crotch
    `L ${cx} ${Y_HIP + 6}`,
    `L ${cx + 4} ${Y_HIP + 14}`,
    `L ${cx + 4} ${Y_KNEE}`,
    `L ${cx + legW * 0.15} ${Y_FOOT}`,
    `L ${cx + legW * 0.85} ${Y_FOOT}`,
    `L ${cx + legW * 1.05} ${Y_KNEE}`,
    `L ${cx + hiHalf - 2} ${Y_HIP + 14}`,
    `L ${cx + hiHalf} ${Y_HIP}`,
    `L ${cx + waHalf} ${Y_WAIST}`,
    `L ${cx + chHalf - 2} ${Y_CHEST_BOT}`,
    `L ${cx + chHalf} ${Y_CHEST_TOP}`,
    // Right arm down
    `M ${cx + shHalf - armW * 0.4} ${Y_HIP + 12}`,
    `L ${cx + shHalf - armW * 0.6} ${Y_HIP - 8}`,
    `L ${cx + shHalf - armW * 0.2} ${Y_WAIST - 16}`,
    `L ${cx + shHalf - 2} ${Y_CHEST_TOP + 6}`,
    `L ${cx + shHalf} ${Y_SHOULDER + 10}`,
    `Q ${cx + shHalf} ${Y_SHOULDER + 2} ${cx + shHalf * 0.65} ${Y_SHOULDER - 4}`,
    `L ${cx + 10} ${Y_NECK + 6}`,
    `L ${cx + 14} ${Y_NECK}`,
    `Q ${cx + 22} ${Y_NECK - 18} ${cx + 18} ${Y_HEAD_TOP}`,
    // Head top arc
    `Q ${cx} ${Y_HEAD_TOP - 18} ${cx - 18} ${Y_HEAD_TOP}`,
    `Z`,
  ].join(" ");

  // Hair tuft for female silhouette
  const hairBun = isFemale ? (
    <ellipse cx={cx} cy={Y_HEAD_TOP - 10} rx={11} ry={7} fill={accent} opacity={0.6} />
  ) : null;

  // Helper to draw glowing muscle stroke
  const M = (
    d: string,
    intensity: number,
    extraOpacity = 1,
    sw = defLineWidth,
  ) => (
    <path
      d={d}
      stroke={accent}
      strokeWidth={sw}
      fill="none"
      strokeLinecap="round"
      opacity={c(intensity) * extraOpacity * defLineOpacity * 3}
    />
  );

  // Chest pecs (two arcs)
  const chestY = Y_CHEST_TOP + 16;
  const pecHalf = chHalf * 0.55;
  const pecs = (
    <g>
      {M(`M ${cx - pecHalf} ${chestY} Q ${cx - pecHalf / 2} ${chestY + 18} ${cx - 3} ${chestY + 22}`, g.chest)}
      {M(`M ${cx + pecHalf} ${chestY} Q ${cx + pecHalf / 2} ${chestY + 18} ${cx + 3} ${chestY + 22}`, g.chest)}
      {/* Sternum line */}
      {M(`M ${cx} ${chestY - 2} L ${cx} ${chestY + 28}`, g.chest, 0.7)}
    </g>
  );

  // Abs (4 rows × 2 cols of subtle creases)
  const absRows = 4;
  const absStartY = Y_CHEST_BOT + 4;
  const absH = (Y_WAIST - 4 - absStartY) / absRows;
  const absHalf = waHalf * 0.55;
  const abs = (
    <g>
      {/* central line */}
      {M(`M ${cx} ${absStartY} L ${cx} ${Y_WAIST - 4}`, g.core, 0.9)}
      {Array.from({ length: absRows }).map((_, i) => {
        const y = absStartY + (i + 1) * absH - absH * 0.3;
        return (
          <g key={i}>
            {M(`M ${cx - absHalf} ${y} L ${cx - 2} ${y}`, g.core, 0.85)}
            {M(`M ${cx + 2} ${y} L ${cx + absHalf} ${y}`, g.core, 0.85)}
          </g>
        );
      })}
    </g>
  );

  // Shoulder/delt caps
  const delts = (
    <g>
      {M(`M ${cx - shHalf + 4} ${Y_SHOULDER} Q ${cx - shHalf * 0.6} ${Y_SHOULDER + 18} ${cx - chHalf + 2} ${Y_CHEST_TOP + 4}`, g.shoulders)}
      {M(`M ${cx + shHalf - 4} ${Y_SHOULDER} Q ${cx + shHalf * 0.6} ${Y_SHOULDER + 18} ${cx + chHalf - 2} ${Y_CHEST_TOP + 4}`, g.shoulders)}
    </g>
  );

  // Biceps lines
  const biceps = (
    <g>
      {M(`M ${cx - shHalf + 4} ${Y_CHEST_TOP + 14} Q ${cx - shHalf + 2} ${Y_CHEST_BOT + 4} ${cx - shHalf + armW * 0.3} ${Y_WAIST - 14}`, g.arms)}
      {M(`M ${cx + shHalf - 4} ${Y_CHEST_TOP + 14} Q ${cx + shHalf - 2} ${Y_CHEST_BOT + 4} ${cx + shHalf - armW * 0.3} ${Y_WAIST - 14}`, g.arms)}
    </g>
  );

  // Quads (front)
  const quadTop = Y_HIP + 22;
  const quadBot = Y_KNEE - 8;
  const quadHalfTop = hiHalf * 0.7;
  const quadHalfBot = legW * 0.7;
  const quads = (
    <g>
      {/* outer quad */}
      {M(`M ${cx - quadHalfTop} ${quadTop} Q ${cx - quadHalfTop - 2} ${(quadTop + quadBot) / 2} ${cx - quadHalfBot - 2} ${quadBot}`, g.legs)}
      {M(`M ${cx + quadHalfTop} ${quadTop} Q ${cx + quadHalfTop + 2} ${(quadTop + quadBot) / 2} ${cx + quadHalfBot + 2} ${quadBot}`, g.legs)}
      {/* inner quad split */}
      {M(`M ${cx - 6} ${quadTop} L ${cx - 4} ${quadBot}`, g.legs, 0.9)}
      {M(`M ${cx + 6} ${quadTop} L ${cx + 4} ${quadBot}`, g.legs, 0.9)}
    </g>
  );

  // Forearms (light)
  const forearms = (
    <g>
      {M(`M ${cx - shHalf + armW * 0.4} ${Y_WAIST - 10} L ${cx - shHalf + armW * 0.8} ${Y_HIP - 4}`, g.arms, 0.7)}
      {M(`M ${cx + shHalf - armW * 0.4} ${Y_WAIST - 10} L ${cx + shHalf - armW * 0.8} ${Y_HIP - 4}`, g.arms, 0.7)}
    </g>
  );

  // Hip / glute hint (female emphasis)
  const glutesHint = isFemale ? (
    <g>
      {M(`M ${cx - hiHalf * 0.7} ${Y_HIP + 6} Q ${cx} ${Y_HIP + 18} ${cx + hiHalf * 0.7} ${Y_HIP + 6}`, g.glutes, 1.2)}
    </g>
  ) : null;

  // Body fill (soft accent inner glow)
  const bodyFill = accent;
  const bodyFillOpacity = lerp(0.05, 0.18, c(p.definition));

  // Optional grid overlay (for the "scan" look on the silhouette)
  const grid = showGrid ? (
    <g opacity={0.18} stroke={accent} strokeWidth={0.4} fill="none">
      {Array.from({ length: 10 }).map((_, i) => (
        <line key={`v${i}`} x1={(200 / 9) * i} y1={0} x2={(200 / 9) * i} y2={420} />
      ))}
      {Array.from({ length: 12 }).map((_, i) => (
        <line key={`h${i}`} x1={0} y1={(420 / 11) * i} x2={200} y2={(420 / 11) * i} />
      ))}
    </g>
  ) : null;

  return (
    <svg
      viewBox="0 0 200 420"
      preserveAspectRatio="xMidYMid meet"
      className={className}
      style={{ display: "block", background: bg, ...style }}
    >
      {grid}
      <g>
        {/* body silhouette fill */}
        <path d={outline} fill={bodyFill} opacity={bodyFillOpacity} stroke={accent} strokeWidth={1.1} strokeOpacity={0.85} strokeLinejoin="round" />
        {hairBun}
        {delts}
        {pecs}
        {biceps}
        {forearms}
        {abs}
        {quads}
        {glutesHint}
      </g>
    </svg>
  );
}
