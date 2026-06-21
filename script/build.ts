import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile, copyFile, mkdir, readdir } from "node:fs/promises";

// server deps to bundle to reduce openat(2) syscalls
// which helps cold start times
const allowlist = [
  "@google/generative-ai",
  "axios",
  "cors",
  "date-fns",
  "drizzle-orm",
  "drizzle-zod",
  "express",
  "express-rate-limit",
  "express-session",
  "jsonwebtoken",
  "memorystore",
  "multer",
  "nanoid",
  "nodemailer",
  "openai",
  "passport",
  "passport-local",
  "stripe",
  "uuid",
  "ws",
  "xlsx",
  "zod",
  "zod-validation-error",
];

async function buildAll() {
  await rm("dist", { recursive: true, force: true });

  console.log("building client...");
  await viteBuild();

  // Copy landing page index.html into dist/public root
  console.log("copying landing page...");
  await copyFile("client/index.html", "dist/public/index.html");

  // Rename app/app.html -> app/index.html so Vercel serves it at /app
  await copyFile("dist/public/app/app.html", "dist/public/app/index.html");

  // Copy legal/support pages (privacy.html, terms.html, support.html) to dist/public root
  console.log("copying legal pages...");
  for (const file of ["privacy.html", "terms.html", "support.html", "join.html", "signup.html", "post-signup.html"]) {
    try {
      await copyFile(`client/public/${file}`, `dist/public/${file}`);
    } catch (e) {
      console.warn(`  skipped ${file}: ${(e as Error).message}`);
    }
  }

  // Copy public image assets referenced by the static HTML pages (join.html, etc.)
  console.log("copying public images...");
  for (const file of [
    "flexin_circle.jpeg",
    "flexin_logo.png",
    "flexin_logo_transparent.png",
    "flexin_icon_192.png",
    "flexin_icon_512.png",
    "wordmark.jpeg",
    "login_scene.jpeg",
    "manifest.json",
    "sw.js",
  ]) {
    try {
      await copyFile(`client/public/${file}`, `dist/public/${file}`);
    } catch (e) {
      console.warn(`  skipped ${file}: ${(e as Error).message}`);
    }
  }

  // Copy audio files to dist/public/audio/ for static serving
  console.log("copying audio files...");
  await mkdir("dist/public/audio", { recursive: true });
  const audioFiles = await readdir("client/public/audio");
  for (const file of audioFiles) {
    await copyFile(`client/public/audio/${file}`, `dist/public/audio/${file}`);
  }
  console.log(`copied ${audioFiles.length} audio files`);

  console.log("building server...");
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter((dep) => !allowlist.includes(dep));

  await esbuild({
    entryPoints: ["server/index.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/index.cjs",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    external: externals,
    logLevel: "info",
  });
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
