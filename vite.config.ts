import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  // Web build serves from /app/ on flexinapp.com. Native (iOS/Android) build is served from
  // capacitor://localhost/ so assets must be referenced relatively ("./assets/...")
  // instead of "/app/assets/...". The VITE_NATIVE_BUILD flag flips this.
  base: process.env.VITE_NATIVE_BUILD === "1" ? "./" : "/app/",
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public/app"),
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(import.meta.dirname, "client", "app.html"),
    },
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
