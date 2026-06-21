// Bottom-nav tab shell — switches between Tribe / Home / Profile.
// Replaces the previous single-page Dashboard root.

import { useState } from "react";
import { Tribe } from "@/pages/Tribe";
import { Dashboard } from "@/pages/Dashboard";
import { Settings } from "@/pages/Settings";
import type { User } from "@shared/schema";

type Tab = "tribe" | "home" | "profile";

interface TabShellProps {
  user: User;
  onLogout: () => void;
}

export function TabShell({ user, onLogout }: TabShellProps) {
  const [tab, setTab] = useState<Tab>("home");

  return (
    <div className="relative" style={{ minHeight: "100vh" }}>
      {/* Active view (each view is responsible for its own layout/scrolling) */}
      {tab === "tribe" && <Tribe user={user} />}
      {tab === "home" && <Dashboard onLogout={onLogout} onOpenTribe={() => setTab("tribe")} />}
      {tab === "profile" && (
        <Settings
          user={user}
          onBack={() => setTab("home")}
          onLogout={() => {
            onLogout();
          }}
        />
      )}

      {/* Bottom nav — always visible, transparent over content */}
      <nav
        className="fixed left-0 right-0 z-40"
        style={{
          bottom: 0,
          paddingBottom: "max(env(safe-area-inset-bottom), 12px)",
          paddingTop: 8,
          background:
            "linear-gradient(180deg, rgba(13,15,26,0) 0%, rgba(13,15,26,0.85) 35%, rgba(13,15,26,0.96) 100%)",
          backdropFilter: "blur(10px)",
        }}
      >
        <div
          className="mx-auto flex items-center justify-around"
          style={{
            maxWidth: 480,
            margin: "0 auto",
            padding: "8px 12px",
          }}
        >
          <TabButton
            label="Tribe"
            active={tab === "tribe"}
            onClick={() => setTab("tribe")}
            icon={<TribeIcon active={tab === "tribe"} />}
          />
          <TabButton
            label="Home"
            active={tab === "home"}
            onClick={() => setTab("home")}
            icon={<HomeIcon active={tab === "home"} />}
          />
          <TabButton
            label="Profile"
            active={tab === "profile"}
            onClick={() => setTab("profile")}
            icon={<ProfileIcon active={tab === "profile"} />}
          />
        </div>
      </nav>
    </div>
  );
}

function TabButton({
  label,
  active,
  onClick,
  icon,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1 py-1.5 px-4 rounded-2xl"
      style={{
        color: active ? "var(--color-gold)" : "rgba(255,255,255,0.55)",
        background: active ? "rgba(245,200,66,0.08)" : "transparent",
        transition: "all 200ms ease",
        minWidth: 80,
      }}
    >
      {icon}
      <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.3 }}>{label}</span>
    </button>
  );
}

// Minimal gold-line icons
function TribeIcon({ active }: { active: boolean }) {
  const c = active ? "#f5c842" : "rgba(255,255,255,0.55)";
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="9" cy="8" r="3.2" stroke={c} strokeWidth="1.6" />
      <circle cx="17" cy="9" r="2.5" stroke={c} strokeWidth="1.6" />
      <path d="M3 19c0-3 2.7-5.5 6-5.5s6 2.5 6 5.5" stroke={c} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M14 19c0-2.2 1.8-4 4-4s4 1.8 4 4" stroke={c} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function HomeIcon({ active }: { active: boolean }) {
  const c = active ? "#f5c842" : "rgba(255,255,255,0.55)";
  // Stylized lotus / meditation pose
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 4c-1.2 2.2-1.2 4.4 0 6.6 1.2-2.2 1.2-4.4 0-6.6Z" stroke={c} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M5 13c2.4-0.4 4.6 0.6 6 2.2C8.8 16.2 6 16 4 14.4 4.2 13.7 4.6 13.3 5 13Z" stroke={c} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M19 13c-2.4-0.4-4.6 0.6-6 2.2 2.2 1 5 0.8 7-0.8-0.2-0.7-0.6-1.1-1-1.4Z" stroke={c} strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="12" cy="18" r="2.2" stroke={c} strokeWidth="1.6" />
    </svg>
  );
}
function ProfileIcon({ active }: { active: boolean }) {
  const c = active ? "#f5c842" : "rgba(255,255,255,0.55)";
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="8" r="3.5" stroke={c} strokeWidth="1.6" />
      <path d="M4 20c0-3.5 3.5-6.5 8-6.5s8 3 8 6.5" stroke={c} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
