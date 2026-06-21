import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { initRevenueCat } from "./lib/iap";
import App from "./App";
import "./index.css";

if (!window.location.hash) {
  window.location.hash = "#/";
}

// Initialize RevenueCat on iOS (no-op on web). Safe to fire-and-forget.
initRevenueCat().catch((err) => console.warn("RevenueCat init failed:", err));

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>
);
