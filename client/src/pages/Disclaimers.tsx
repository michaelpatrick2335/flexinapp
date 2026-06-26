import React from "react";
import { useTheme } from "@/lib/ThemeProvider";

interface Props {
  onBack: () => void;
}

const APP_VERSION = "1.0.0";
const LAST_UPDATED = "June 26, 2026";

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: "MEDICAL & FITNESS DISCLAIMER",
    body: [
      "Flexin is a fitness tracking and motivation app. It is not a medical device. The content, recommendations, exercise suggestions, muscle activation percentages, body composition estimates, photo comparisons, and any AI-generated coaching messages provided in Flexin are for informational and motivational purposes only. They are not medical advice, diagnosis, or treatment.",
      "Consult a qualified physician or licensed healthcare provider before starting any new exercise program, especially if you are pregnant, recovering from injury or surgery, have a heart condition, high or low blood pressure, diabetes, an eating disorder, or any other medical condition.",
      "Stop exercising immediately and seek medical attention if you experience pain, dizziness, shortness of breath, chest discomfort, or any unusual symptoms. You assume all responsibility and risk for your use of Flexin and for any injuries that may occur. By using Flexin you acknowledge that strength training carries inherent risks including but not limited to muscle strain, joint injury, and in rare cases serious injury or death.",
    ],
  },
  {
    title: "MUSCLE ACTIVATION ESTIMATES",
    body: [
      "The per-exercise muscle activation percentages shown in the dashboard ring are estimates based on published electromyography (EMG) research and may not reflect your individual biomechanics, form, range of motion, or training history.",
      "Flexin's muscle activation scores are for motivational tracking only and are not medical or training advice. Do not use them to diagnose imbalances or rehabilitate injuries.",
    ],
  },
  {
    title: "PHOTO & PROGRESS DATA",
    body: [
      "Progress photos you upload are stored in your private Flexin account and used to display side-by-side comparisons inside the app. We do not sell or share your photos with third parties for advertising.",
      "If you delete a photo from Progress, it is removed from active display immediately and from our backups within 30 days. To delete your entire account and all associated photos, visit Profile → Privacy Settings → Delete Account.",
      "You retain ownership of all photos you upload. You grant Flexin a limited license to store and display them inside the app for your personal use.",
    ],
  },
  {
    title: "AI-GENERATED CONTENT",
    body: [
      "Flexin may use AI to generate coaching messages, workout suggestions, motivational copy, or analyze patterns in your logged workouts. AI output can contain errors and should not be relied on as professional advice.",
      "Always cross-check AI-generated recommendations with a qualified trainer or healthcare provider before acting on them.",
    ],
  },
  {
    title: "AGE & ELIGIBILITY",
    body: [
      "Flexin is intended for users 13 years of age and older (16+ in the European Union and United Kingdom). Users under 18 must have parental or guardian permission to use the app. If you are under the minimum age for your region, do not create an account.",
    ],
  },
  {
    title: "LIMITATION OF LIABILITY",
    body: [
      "To the maximum extent permitted by law, Flexin, its developers, owners, and affiliates are not liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues, arising out of or in connection with your use of the app.",
      "If any part of this limitation is found unenforceable, the total liability of Flexin to you for all claims will not exceed the amount you paid Flexin in the 12 months preceding the claim, or USD $100, whichever is greater.",
    ],
  },
  {
    title: "INDEMNIFICATION",
    body: [
      "You agree to indemnify and hold harmless Flexin, its developers, owners, employees, and affiliates from any claims, damages, losses, liabilities, costs, or expenses (including reasonable attorneys' fees) arising out of your misuse of the app, your violation of these terms, or your violation of any law or third-party right.",
    ],
  },
  {
    title: "DISPUTE RESOLUTION",
    body: [
      "Any dispute arising out of or relating to your use of Flexin will be resolved by binding individual arbitration, not in court, except that either party may bring a claim in small-claims court. You and Flexin waive any right to a jury trial and any right to participate in a class action.",
    ],
  },
];

export function Disclaimers({ onBack }: Props) {
  const t = useTheme();
  return (
    <div style={{ minHeight: "100vh", background: t.bg, color: t.text, paddingBottom: 80 }}>
      <Header t={t} title="Disclaimers & Legal" onBack={onBack} />

      <div style={{ padding: "8px 18px 0", display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{
          background: t.bgElevated,
          border: `1px solid ${t.border}`,
          borderRadius: 16,
          padding: "14px 16px",
          fontSize: 13,
          color: t.textMuted,
          lineHeight: 1.5,
        }}>
          By using Flexin you acknowledge that you have read and agree to the disclaimers below, our{" "}
          <span style={{ color: t.accent, fontWeight: 700 }}>Terms of Service</span> and{" "}
          <span style={{ color: t.accent, fontWeight: 700 }}>Privacy Policy</span>.
        </div>

        {SECTIONS.map((section) => (
          <div key={section.title}>
            <div style={{
              fontSize: 12, fontWeight: 800, letterSpacing: 1.5,
              color: t.textMuted, marginBottom: 8, padding: "0 4px",
            }}>
              {section.title}
            </div>
            <div style={{
              background: t.bgElevated,
              border: `1px solid ${t.border}`,
              borderRadius: 16,
              padding: "16px 16px",
              display: "flex", flexDirection: "column", gap: 12,
            }}>
              {section.body.map((p, i) => (
                <p key={i} style={{
                  margin: 0,
                  fontSize: 14, lineHeight: 1.55,
                  color: t.text,
                }}>{p}</p>
              ))}
            </div>
          </div>
        ))}

        <div style={{
          marginTop: 4,
          padding: "12px 4px",
          fontSize: 12,
          color: t.textMuted,
          textAlign: "center",
          lineHeight: 1.5,
        }}>
          Flexin v{APP_VERSION} · Last updated {LAST_UPDATED}
          <br />
          For the full Terms of Service and Privacy Policy visit{" "}
          <span style={{ color: t.accent }}>flexinfitapp.com/terms</span>
        </div>

        <div style={{ padding: "0 4px" }}>
          <button
            onClick={onBack}
            style={{
              width: "100%",
              background: t.accent,
              color: t.accentText,
              border: "none",
              borderRadius: 16,
              padding: "16px 18px",
              fontSize: 16, fontWeight: 800,
              cursor: "pointer",
              boxShadow: `0 0 18px ${t.accentGlow}`,
            }}
          >
            I Understand
          </button>
        </div>
      </div>
    </div>
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
