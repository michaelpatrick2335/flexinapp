import React, { useState } from "react";
import { useTheme } from "@/lib/ThemeProvider";

interface Props {
  onBack: () => void;
}

interface ToggleDef {
  key: string;
  label: string;
  description: string;
  defaultValue: boolean;
}

const SECTIONS: { title: string; toggles: ToggleDef[] }[] = [
  {
    title: "VISIBILITY",
    toggles: [
      { key: "publicProfile",   label: "Public profile",        description: "Anyone with your invite link can view your stats.", defaultValue: true },
      { key: "squadVisibility", label: "Visible to squad",      description: "Squadmates see your lifts and Live Activity.",      defaultValue: true },
      { key: "showLevel",       label: "Show form level",       description: "Display your Level badge on your profile.",         defaultValue: true },
    ],
  },
  {
    title: "DATA",
    toggles: [
      { key: "shareForResearch", label: "Share anonymized data", description: "Help improve MAX with anonymous training data.",  defaultValue: false },
      { key: "personalizedAds",  label: "Personalized ads",      description: "Use my activity to tailor in-app promos.",         defaultValue: false },
    ],
  },
  {
    title: "DISCOVERY",
    toggles: [
      { key: "findByEmail",     label: "Find me by email",      description: "Friends can add you if they know your email.",      defaultValue: true },
      { key: "suggestSquads",   label: "Suggest me to squads",  description: "Open squads can invite you to join.",               defaultValue: false },
    ],
  },
];

export function PrivacySettings({ onBack }: Props) {
  const t = useTheme();
  const initial = Object.fromEntries(
    SECTIONS.flatMap((s) => s.toggles.map((tg) => [tg.key, tg.defaultValue]))
  ) as Record<string, boolean>;
  const [values, setValues] = useState<Record<string, boolean>>(initial);

  return (
    <div style={{ minHeight: "100vh", background: t.bg, color: t.text, paddingBottom: 60 }}>
      <Header t={t} title="Privacy Settings" onBack={onBack} />

      <div style={{ padding: "8px 18px 0", display: "flex", flexDirection: "column", gap: 18 }}>
        {SECTIONS.map((section) => (
          <div key={section.title}>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.5, color: t.textMuted, marginBottom: 8, padding: "0 4px" }}>
              {section.title}
            </div>
            <div style={{
              background: t.bgElevated,
              border: `1px solid ${t.border}`,
              borderRadius: 18,
              overflow: "hidden",
            }}>
              {section.toggles.map((tg, i) => (
                <React.Fragment key={tg.key}>
                  {i > 0 && <div style={{ height: 1, background: t.border, marginLeft: 16 }} />}
                  <ToggleRow
                    t={t}
                    label={tg.label}
                    description={tg.description}
                    value={values[tg.key]}
                    onChange={(v) => setValues((prev) => ({ ...prev, [tg.key]: v }))}
                  />
                </React.Fragment>
              ))}
            </div>
          </div>
        ))}

        <div style={{ fontSize: 12, color: t.textMuted, padding: "0 4px", lineHeight: 1.5 }}>
          You can change these anytime. Your data is yours.{" "}
          <span style={{ color: t.accent, fontWeight: 700 }}>View Privacy Policy</span>
        </div>
      </div>
    </div>
  );
}

function ToggleRow({ t, label, description, value, onChange }: {
  t: any; label: string; description: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>{label}</div>
        <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>{description}</div>
      </div>
      <Toggle t={t} value={value} onChange={onChange} />
    </div>
  );
}

function Toggle({ t, value, onChange }: { t: any; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      role="switch"
      aria-checked={value}
      style={{
        width: 50, height: 30, borderRadius: 15,
        background: value ? t.accent : t.bgInput,
        border: `1px solid ${value ? t.accent : t.border}`,
        position: "relative",
        cursor: "pointer",
        transition: "background 0.18s ease, border-color 0.18s ease",
        boxShadow: value ? `0 0 12px ${t.accentGlow}` : "none",
        flexShrink: 0,
      }}
    >
      <div style={{
        position: "absolute",
        top: 2, left: value ? 22 : 2,
        width: 24, height: 24, borderRadius: 12,
        background: value ? t.accentText : (t.name === "pink" ? "#ffffff" : "#cfd6e8"),
        transition: "left 0.18s ease",
        boxShadow: value ? "none" : "0 1px 3px rgba(0,0,0,0.15)",
      }} />
    </button>
  );
}

function Header({ t, title, onBack }: { t: any; title: string; onBack: () => void }) {
  return (
    <div style={{
      paddingTop: "max(env(safe-area-inset-top), 14px)",
      padding: "14px 18px 12px",
      display: "flex", alignItems: "center", gap: 12,
      position: "sticky", top: 0, zIndex: 10,
      background: t.bg,
    }}>
      <button
        onClick={onBack}
        aria-label="Back"
        style={{
          width: 38, height: 38, borderRadius: 19,
          background: "transparent", border: `1px solid ${t.border}`,
          display: "grid", placeItems: "center",
          cursor: "pointer",
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M15 6l-6 6 6 6" stroke={t.text} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: t.text, flex: 1 }}>{title}</h1>
    </div>
  );
}
