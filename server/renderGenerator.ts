// Style B: AI photorealistic body render generator.
//
// Takes the analysis output (body fat, muscle, build, sex) and the user's
// uploaded photo, and produces a clean photorealistic 3D-render-style body
// image matching their build. The result is saved to /scan-renders/<id>.png
// and served via /api/progress/render/:id.
//
// Implementation: shells out to the `asi-generate-image` CLI which is
// pre-installed in the Perplexity sandbox. The CLI requires credentials
// (PPLX_LLM_API_ADDRESS + PPLX_LLM_API_KEY) which must be present in env.
// In production this swaps to a direct API call (Replicate / OpenAI /
// Nano Banana) using a stored API key from process.env.

import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import type { PhotoAnalysis } from "./photoAnalysis";

const RENDER_DIR = path.join(process.cwd(), "scan-renders");
if (!fs.existsSync(RENDER_DIR)) fs.mkdirSync(RENDER_DIR, { recursive: true });

// ───────────────────────────────────────────────────────────────────
// Prompt builder — translate analysis into a photorealistic prompt
// ───────────────────────────────────────────────────────────────────

function describeBuild(a: PhotoAnalysis, sex: "male" | "female"): string {
  const bf = a.bodyFatPct;
  const mm = a.muscleMassPct;
  const e = a.muscleEmphasis;

  // Body fat description
  let leanness: string;
  if (bf < 10) leanness = "extremely lean and shredded with visible vascularity";
  else if (bf < 14) leanness = "very lean with clearly defined six-pack abs";
  else if (bf < 18) leanness = "athletic and lean with defined abs";
  else if (bf < 23) leanness = "fit with a moderately defined midsection";
  else if (bf < 28) leanness = "healthy build with a softer midsection";
  else leanness = "average build, less muscle definition visible";

  // Muscle mass description
  let mass: string;
  if (mm > 80) mass = sex === "male" ? "heavily muscular bodybuilder physique" : "very strong athletic physique with developed muscle";
  else if (mm > 65) mass = sex === "male" ? "muscular athletic build" : "toned athletic build with visible muscle";
  else if (mm > 50) mass = sex === "male" ? "fit athletic build" : "fit toned build";
  else if (mm > 35) mass = "moderate athletic build";
  else mass = "slim build";

  // Standout muscle groups (top 2)
  const groups = Object.entries(e).sort((a2, b2) => b2[1] - a2[1]);
  const top2 = groups.slice(0, 2).map(([k]) => k);
  const emphasis = top2.length
    ? `with particularly developed ${top2.join(" and ")}`
    : "";

  return `${leanness}, ${mass}, ${emphasis}`.replace(/, $/, "");
}

function buildPrompt(a: PhotoAnalysis, sex: "male" | "female"): string {
  const buildDesc = describeBuild(a, sex);
  const accent = sex === "female" ? "#FF4D8F" : "#1E5FFF";
  const bg = sex === "female" ? "soft pink-tinted studio" : "dark navy studio";

  const subject = sex === "female"
    ? "Athletic woman in black sports bra and black athletic shorts, hair in a neat ponytail"
    : "Athletic man, shirtless, wearing simple black athletic shorts, short hair";

  return [
    `Premium fitness app body composition render.`,
    `Single subject: ${subject}.`,
    `Body type: ${buildDesc}.`,
    `Standing straight facing camera, arms slightly away from body, neutral confident pose, full body visible head to feet.`,
    `Photorealistic 3D render style, clean Apple Health / Whoop / Strava aesthetic.`,
    `Plain ${bg} background (${sex === "female" ? "#1a0a14" : "#05070f"}).`,
    `Soft cinematic key light from above-front, subtle ${accent} rim light on shoulders and arms.`,
    `Realistic skin tones, natural anatomy, no muscle exaggeration beyond described build.`,
    `No text, no UI, no logos, no watermarks, no measurement lines.`,
    `9:16 portrait composition, body centered, generous negative space around figure.`,
  ].join(" ");
}

// ───────────────────────────────────────────────────────────────────
// CLI invocation
// ───────────────────────────────────────────────────────────────────

function runCli(args: string[], env: NodeJS.ProcessEnv): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    const child = spawn("asi-generate-image", args, { env });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => { stdout += d.toString(); });
    child.stderr.on("data", (d) => { stderr += d.toString(); });
    child.on("close", (code) => resolve({ stdout, stderr, code: code ?? -1 }));
    child.on("error", () => resolve({ stdout, stderr, code: -1 }));
  });
}

// ───────────────────────────────────────────────────────────────────
// Public: generateBodyRender
// ───────────────────────────────────────────────────────────────────

/**
 * Generate a photorealistic body render for a scan.
 * Returns the absolute path to the saved PNG, or null if generation failed.
 */
export async function generateBodyRender(
  analysis: PhotoAnalysis,
  sex: "male" | "female",
  scanId: number,
): Promise<string | null> {
  const prompt = buildPrompt(analysis, sex);
  const outBase = `scan_${scanId}_render`;
  const outPath = path.join(RENDER_DIR, `${outBase}.png`);

  // CLI writes into CWD by default — change CWD to RENDER_DIR
  const params = {
    prompt,
    filename: outBase,
    aspect_ratio: "9:16",
    model: "nano_banana_pro", // fast + photorealistic
  };

  // Inject credentials via env (the CLI uses these)
  const env = {
    ...process.env,
    // The api_credentials shim is handled by the sandbox env automatically when the CLI runs.
  };

  // If credentials aren't present in env, skip rendering and let the
  // frontend fall back to showing just the user's uploaded photo.
  if (!process.env.PPLX_LLM_API_KEY || !process.env.PPLX_LLM_API_ADDRESS) {
    console.warn("[renderGenerator] skipping render — no LLM API credentials in env");
    return null;
  }

  try {
    const { stdout, stderr, code } = await runCli([JSON.stringify(params)], env);
    if (code !== 0) {
      console.error("[renderGenerator] CLI failed", code, stderr);
      return null;
    }
    // The CLI writes to its own WORKSPACE (/home/user/workspace) by default.
    // Look in several candidate locations and move into RENDER_DIR.
    const candidates = [
      outPath,
      path.join("/home/user/workspace", `${outBase}.png`),
      path.join(process.cwd(), `${outBase}.png`),
    ];
    for (const cand of candidates) {
      if (fs.existsSync(cand)) {
        if (cand !== outPath) {
          fs.renameSync(cand, outPath);
        }
        return outPath;
      }
    }
    console.error("[renderGenerator] expected output not found", outPath, stdout);
    return null;
  } catch (err) {
    console.error("[renderGenerator] error", err);
    return null;
  }
}
