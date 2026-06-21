import express from 'express';
import type { Express } from 'express';
import fs from "node:fs";
import path from "node:path";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // Serve all static files (landing page assets, app assets, audio)
  app.use(express.static(distPath));

  // Legal / support pages — clean URLs (no .html extension)
  app.get("/privacy", (_req, res) => {
    res.sendFile(path.resolve(distPath, "privacy.html"));
  });
  app.get("/terms", (_req, res) => {
    res.sendFile(path.resolve(distPath, "terms.html"));
  });
  app.get("/support", (_req, res) => {
    res.sendFile(path.resolve(distPath, "support.html"));
  });

  // /app/* — serve the React SPA (app.html)
  app.use("/app", express.static(path.join(distPath, "app")));
  app.use("/app/{*path}", (_req, res) => {
    res.sendFile(path.resolve(distPath, "app", "app.html"));
  });

  // Root / — serve the landing page (index.html)
  app.use("/{*path}", (_req, res) => {
    // Don't catch API routes
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
