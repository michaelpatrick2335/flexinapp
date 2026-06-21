// Body-composition analysis for a progress photo.
//
// Two analyzers, chosen automatically:
//   1. OPENAI_API_KEY set  -> GPT-4o Vision (production path)
//   2. Otherwise            -> deterministic image heuristic via `sharp`
//      (consistent per-photo result, so the silhouette actually changes per upload)
//
// Returns BOTH the high-level body composition AND the silhouette params
// the renderer needs, plus the per-muscle emphasis map used by the dashboard.
//
// All scalar params are 0..1 unless commented otherwise.

import fs from "fs";
import sharp from "sharp";

// ───────────────────────────────────────────────────────────────────
// Public types
// ───────────────────────────────────────────────────────────────────

export type BuildLabel = "lean" | "athletic" | "muscular" | "bulk" | "soft";

export type MuscleEmphasis = {
  chest: number;     // 0-100
  back: number;
  arms: number;
  shoulders: number;
  legs: number;
  core: number;
  glutes: number;
};

export type SilhouetteParams = {
  shoulderW: number;
  chestW: number;
  waistW: number;
  hipW: number;
  armThickness: number;
  legThickness: number;
  definition: number;
  glow: MuscleEmphasis;  // 0-1 here (renderer reads as opacity)
};

export type PhotoAnalysis = {
  bodyFatPct: number;          // 5-40 typical
  muscleMassPct: number;       // 0-100 lean-mass score
  buildLabel: BuildLabel;
  silhouetteParams: SilhouetteParams;
  muscleEmphasis: MuscleEmphasis;
  source: "openai-vision" | "heuristic";
  raw?: any;
};

// ───────────────────────────────────────────────────────────────────
// Main entry
// ───────────────────────────────────────────────────────────────────

export async function analyzePhoto(
  photoPath: string,
  sex: "male" | "female" | "unspecified",
): Promise<PhotoAnalysis> {
  const isFemale = sex === "female";

  if (process.env.OPENAI_API_KEY) {
    try {
      return await analyzeWithOpenAI(photoPath, isFemale);
    } catch (e) {
      console.warn("[photoAnalysis] OpenAI vision failed; falling back to heuristic:", (e as Error).message);
    }
  }

  return await analyzeWithHeuristic(photoPath, isFemale);
}

// ───────────────────────────────────────────────────────────────────
// 1. OpenAI Vision path
// ───────────────────────────────────────────────────────────────────

async function analyzeWithOpenAI(photoPath: string, isFemale: boolean): Promise<PhotoAnalysis> {
  const buf = fs.readFileSync(photoPath);
  const dataUrl = `data:image/jpeg;base64,${buf.toString("base64")}`;

  const prompt = `You are a physique analyst. Look at this progress photo of a ${isFemale ? "female" : "male"} subject and return STRICT JSON with the following shape only \u2014 no commentary, no markdown:
{
  "bodyFatPct": <number 5-40, your best estimate>,
  "muscleMassScore": <0-100, where 50 = average gym-goer>,
  "buildLabel": "lean" | "athletic" | "muscular" | "bulk" | "soft",
  "proportions": {
    "shoulderWidth": <0-1>,
    "chestWidth": <0-1>,
    "waistWidth": <0-1>,
    "hipWidth": <0-1>,
    "armThickness": <0-1>,
    "legThickness": <0-1>,
    "definition": <0-1>
  },
  "muscleEmphasis": {
    "chest": <0-100>, "back": <0-100>, "arms": <0-100>,
    "shoulders": <0-100>, "legs": <0-100>, "core": <0-100>, "glutes": <0-100>
  }
}
Estimate from visible muscle development. If the photo is unclear, return reasonable defaults for someone of average fitness.`;

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 600,
    }),
  });

  if (!resp.ok) throw new Error(`OpenAI ${resp.status}: ${await resp.text()}`);
  const data = await resp.json() as any;
  const content = data.choices?.[0]?.message?.content ?? "{}";
  const raw = JSON.parse(content);

  const m = raw.muscleEmphasis ?? {};
  const muscleEmphasis: MuscleEmphasis = {
    chest: clamp(m.chest ?? 50, 0, 100),
    back: clamp(m.back ?? 50, 0, 100),
    arms: clamp(m.arms ?? 50, 0, 100),
    shoulders: clamp(m.shoulders ?? 50, 0, 100),
    legs: clamp(m.legs ?? 50, 0, 100),
    core: clamp(m.core ?? 50, 0, 100),
    glutes: clamp(m.glutes ?? 50, 0, 100),
  };

  const pr = raw.proportions ?? {};
  const silhouetteParams: SilhouetteParams = {
    shoulderW: clamp01(pr.shoulderWidth ?? (isFemale ? 0.42 : 0.55)),
    chestW: clamp01(pr.chestWidth ?? (isFemale ? 0.4 : 0.5)),
    waistW: clamp01(pr.waistWidth ?? (isFemale ? 0.3 : 0.4)),
    hipW: clamp01(pr.hipWidth ?? (isFemale ? 0.55 : 0.45)),
    armThickness: clamp01(pr.armThickness ?? (isFemale ? 0.32 : 0.5)),
    legThickness: clamp01(pr.legThickness ?? (isFemale ? 0.5 : 0.55)),
    definition: clamp01(pr.definition ?? 0.5),
    glow: {
      chest: muscleEmphasis.chest / 100,
      back: muscleEmphasis.back / 100,
      arms: muscleEmphasis.arms / 100,
      shoulders: muscleEmphasis.shoulders / 100,
      legs: muscleEmphasis.legs / 100,
      core: muscleEmphasis.core / 100,
      glutes: muscleEmphasis.glutes / 100,
    },
  };

  return {
    bodyFatPct: clamp(raw.bodyFatPct ?? 18, 5, 45),
    muscleMassPct: clamp(raw.muscleMassScore ?? 55, 0, 100),
    buildLabel: (raw.buildLabel as BuildLabel) ?? "athletic",
    silhouetteParams,
    muscleEmphasis,
    source: "openai-vision",
    raw,
  };
}

// ───────────────────────────────────────────────────────────────────
// 2. Heuristic fallback (deterministic per photo)
// ───────────────────────────────────────────────────────────────────
//
// Uses sharp to compute simple visual features from the image:
//   - average brightness  -> definition proxy (shadowed = high definition)
//   - vertical edge density per band -> taper / V-shape estimate
//   - chromaticity         -> hue tint
//   - file-hash fingerprint -> stable per-photo seed so two different photos
//                              never produce the same silhouette
//
// This is intentionally simple; it just needs to produce DIFFERENT,
// PLAUSIBLE silhouettes for different uploads so the demo feels real.

async function analyzeWithHeuristic(photoPath: string, isFemale: boolean): Promise<PhotoAnalysis> {
  const buf = fs.readFileSync(photoPath);

  // Tiny grayscale thumbnail for cheap region statistics
  const W = 32, H = 64;
  const { data } = await sharp(buf)
    .resize(W, H, { fit: "cover" })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Band heights (top→bottom): head, shoulders, chest, waist, hips, thighs, calves
  const bands = {
    head:     [0,    0.1 ],
    shoulder: [0.1,  0.22],
    chest:    [0.22, 0.36],
    waist:    [0.36, 0.5 ],
    hip:      [0.5,  0.6 ],
    thigh:    [0.6,  0.82],
    calf:     [0.82, 1.0 ],
  };

  // For each band: average brightness, and "fill width" (count of dark pixels per row)
  const bandStats: Record<string, { brightness: number; fill: number }> = {};
  for (const [name, [a, b]] of Object.entries(bands)) {
    const y0 = Math.floor(a * H), y1 = Math.floor(b * H);
    let bSum = 0, fSum = 0, n = 0;
    for (let y = y0; y < y1; y++) {
      let darkCount = 0;
      for (let x = 0; x < W; x++) {
        const v = data[y * W + x];
        bSum += v;
        if (v < 110) darkCount++;
        n++;
      }
      fSum += darkCount / W;
    }
    bandStats[name] = {
      brightness: n ? bSum / n / 255 : 0.5,                      // 0..1
      fill: (y1 - y0) ? fSum / (y1 - y0) : 0.4,                  // 0..1 (subject fills band)
    };
  }

  // Image hash for per-photo determinism
  let hash = 5381;
  for (let i = 0; i < buf.length; i += 997) {
    hash = ((hash << 5) + hash + buf[i]) | 0;
  }
  const rand = mulberry32(Math.abs(hash));

  // Map band fills (subject silhouette width) to proportions, blended with sex defaults
  const shoulderFill = bandStats.shoulder.fill;
  const chestFill    = bandStats.chest.fill;
  const waistFill    = bandStats.waist.fill;
  const hipFill      = bandStats.hip.fill;
  const thighFill    = bandStats.thigh.fill;

  const baseShoulder = isFemale ? 0.42 : 0.55;
  const baseChest    = isFemale ? 0.40 : 0.50;
  const baseWaist    = isFemale ? 0.30 : 0.40;
  const baseHip      = isFemale ? 0.55 : 0.45;
  const baseArm      = isFemale ? 0.32 : 0.50;
  const baseLeg      = isFemale ? 0.50 : 0.55;

  // Lower brightness on torso = more shadow = more definition
  const torsoBrightness = (bandStats.chest.brightness + bandStats.waist.brightness) / 2;
  const definition = clamp01(0.9 - torsoBrightness * 0.85 + (rand() - 0.5) * 0.1);

  // Heuristic body fat: brightness up + chest-vs-waist ratio low -> higher BF
  const taper = chestFill > 0 ? clamp01(1 - waistFill / Math.max(chestFill, 0.01)) : 0.3;
  const bodyFat = clamp(
    (isFemale ? 23 : 17) + (1 - definition) * 14 - taper * 6 + (rand() - 0.5) * 3,
    8, 38,
  );

  // Muscle mass score: definition + taper
  const muscleMass = clamp(40 + definition * 40 + taper * 25 + (rand() - 0.5) * 6, 10, 95);

  // Build label from BF + muscle
  let buildLabel: BuildLabel;
  if (muscleMass > 75 && bodyFat < 14) buildLabel = "lean";
  else if (muscleMass > 70) buildLabel = "muscular";
  else if (muscleMass > 60 && bodyFat < 18) buildLabel = "athletic";
  else if (bodyFat > 25) buildLabel = "soft";
  else buildLabel = "bulk";

  // Proportions: blend base + image-driven nudge + a touch of rand for variety
  const nudge = (base: number, observed: number, weight = 0.35) =>
    clamp01(base * (1 - weight) + clamp01(observed * 1.6) * weight + (rand() - 0.5) * 0.06);

  const silhouetteParams: SilhouetteParams = {
    shoulderW: nudge(baseShoulder, shoulderFill),
    chestW:    nudge(baseChest,    chestFill),
    waistW:    nudge(baseWaist,    waistFill, 0.45),
    hipW:      nudge(baseHip,      hipFill,   isFemale ? 0.5 : 0.35),
    armThickness: clamp01(baseArm + (muscleMass - 50) / 200 + (rand() - 0.5) * 0.08),
    legThickness: nudge(baseLeg,   thighFill, 0.4),
    definition,
    glow: { chest: 0, back: 0, arms: 0, shoulders: 0, legs: 0, core: 0, glutes: 0 },
  };

  // Per-muscle emphasis: combine taper + definition + sex-typical weighting + small rand
  const baseM = (k: keyof MuscleEmphasis) => isFemale
    ? ({ chest: 38, back: 50, arms: 42, shoulders: 48, legs: 60, core: 58, glutes: 65 } as const)[k]
    : ({ chest: 65, back: 60, arms: 62, shoulders: 58, legs: 50, core: 55, glutes: 45 } as const)[k];

  const adjMuscle = (k: keyof MuscleEmphasis, weight = 1) =>
    clamp(baseM(k) + (muscleMass - 50) * 0.5 * weight + (rand() - 0.5) * 12, 10, 98);

  const muscleEmphasis: MuscleEmphasis = {
    chest:     adjMuscle("chest"),
    back:      adjMuscle("back"),
    arms:      adjMuscle("arms", 1.1),
    shoulders: adjMuscle("shoulders"),
    legs:      adjMuscle("legs", 0.9),
    core:      adjMuscle("core", definition > 0.5 ? 1.2 : 0.9),
    glutes:    adjMuscle("glutes", isFemale ? 1.2 : 0.8),
  };

  // Mirror emphasis into silhouette glow
  silhouetteParams.glow = {
    chest: muscleEmphasis.chest / 100,
    back: muscleEmphasis.back / 100,
    arms: muscleEmphasis.arms / 100,
    shoulders: muscleEmphasis.shoulders / 100,
    legs: muscleEmphasis.legs / 100,
    core: muscleEmphasis.core / 100,
    glutes: muscleEmphasis.glutes / 100,
  };

  return {
    bodyFatPct: round1(bodyFat),
    muscleMassPct: round1(muscleMass),
    buildLabel,
    silhouetteParams,
    muscleEmphasis: roundMuscle(muscleEmphasis),
    source: "heuristic",
    raw: { bandStats, hash },
  };
}

// ───────────────────────────────────────────────────────────────────
// helpers
// ───────────────────────────────────────────────────────────────────
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
function clamp01(v: number) { return clamp(v, 0, 1); }
function round1(v: number) { return Math.round(v * 10) / 10; }
function roundMuscle(m: MuscleEmphasis): MuscleEmphasis {
  return Object.fromEntries(Object.entries(m).map(([k, v]) => [k, Math.round(v)])) as MuscleEmphasis;
}
function mulberry32(a: number) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = a;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
