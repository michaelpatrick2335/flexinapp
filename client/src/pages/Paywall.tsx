import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient, clearUserEmail } from "@/lib/queryClient";
import { Capacitor } from "@capacitor/core";
import {
  Dumbbell,
  TrendingUp,
  Flame,
  Users,
  ShieldCheck,
  Sparkles,
  Zap,
  ChevronRight,
  Check,
} from "lucide-react";
import {
  getMonthlyOffering,
  purchaseMonthly,
  restorePurchases,
  type MonthlyOffering,
} from "@/lib/iap";
import flexinCircle from "@/assets/flexin_circle.jpeg";

interface PaywallProps {
  onUnlock: () => void;
  userName: string;
}

// Blue-themed paywall matching the v2 mockup. All accents use the same
// electric-blue tone; backgrounds stay pure black with thin blue strokes.
const BLUE = "#3B82F6";
const BLUE_SOFT = "rgba(59,130,246,0.25)";
const BLUE_STROKE = "rgba(59,130,246,0.45)";
const BLUE_GLOW = "rgba(59,130,246,0.55)";

const PERKS: { Icon: typeof Dumbbell; text: string }[] = [
  { Icon: Dumbbell, text: "Unlimited workout logging" },
  { Icon: TrendingUp, text: "Avatar progression — watch your body level up" },
  { Icon: Flame, text: "Streak tracking, stats & progress photos" },
  { Icon: Users, text: "Squad mode — invite friends, send energy" },
  { Icon: ShieldCheck, text: "All 25 rank tiers + transformation milestones" },
  { Icon: Sparkles, text: "Coach guidance and personalized plans" },
];

const IS_IOS = Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";

export function Paywall({ onUnlock, userName }: PaywallProps) {
  const [purchased, setPurchased] = useState(false);
  const [offering, setOffering] = useState<MonthlyOffering | null>(null);
  const [iapBusy, setIapBusy] = useState(false);
  const [iapError, setIapError] = useState("");

  // Load IAP offering on mount (iOS only).
  useEffect(() => {
    if (!IS_IOS) return;
    getMonthlyOffering()
      .then((o) => setOffering(o))
      .catch(() => setOffering(null));
  }, []);

  // Web/Stripe path (unchanged) — used on flexinfitapp.com.
  const unlockMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/unlock", {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      setPurchased(true);
      setTimeout(onUnlock, 1800);
    },
  });

  // iOS IAP path — RevenueCat / Apple In-App Purchase.
  // TEMP TestFlight bypass: while the StoreKit product isn't configured yet in App
  // Store Connect, treat "IAP not configured" as a successful unlock so testers
  // can flow into the app. Real Apple purchases still work the same way once the
  // subscription is approved — we only short-circuit the not-configured case.
  const handleIAPPurchase = async () => {
    setIapBusy(true);
    setIapError("");
    const result = await purchaseMonthly();
    setIapBusy(false);
    const notConfigured = !result.ok && !result.cancelled && /not configured/i.test(result.error || "");
    if (result.ok || notConfigured) {
      // Tell our backend so the user's account is flagged premium across devices.
      apiRequest("POST", "/api/unlock", {}).catch(() => {});
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      setPurchased(true);
      setTimeout(onUnlock, 1800);
    } else if (!result.cancelled) {
      setIapError(result.error);
    }
  };

  const handleRestore = async () => {
    setIapBusy(true);
    setIapError("");
    const restored = await restorePurchases();
    setIapBusy(false);
    if (restored) {
      apiRequest("POST", "/api/unlock", {}).catch(() => {});
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      setPurchased(true);
      setTimeout(onUnlock, 1500);
    } else {
      setIapError("No active subscription found to restore.");
    }
  };

  if (purchased) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-6 text-center relative overflow-hidden"
        style={{ background: "#000" }}
      >
        <div className="text-6xl mb-4 relative z-10" style={{ filter: `drop-shadow(0 0 18px ${BLUE_GLOW})` }}>⚡️</div>
        <h2 className="text-2xl font-bold mb-2" style={{ color: BLUE }}>Welcome to Flexin, {userName}</h2>
        <p className="text-sm" style={{ color: "#cbd5e1" }}>Time to build the body and the discipline.</p>
      </div>
    );
  }

  // Pricing display. On iOS use the live price from the App Store (falls back to $24.99).
  // On web, keep the existing $4.99 web price.
  const displayPrice = IS_IOS ? (offering?.priceString || "$24.99") : "$4.99";
  const trialDays = IS_IOS ? (offering?.introTrialDays ?? 3) : null;
  const ctaLabel = IS_IOS
    ? (iapBusy
        ? "Connecting to App Store..."
        : "Start My Journey")
    : (unlockMutation.isPending ? "Unlocking..." : `Unlock for ${displayPrice}`);

  const handleCTA = () => {
    if (IS_IOS) {
      void handleIAPPurchase();
    } else {
      unlockMutation.mutate();
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-start px-5 py-8 overflow-y-auto relative"
      style={{ background: "#000" }}
    >
      {/* Header — logo with blue glow ring + description */}
      <div className="flex flex-col items-center text-center mb-6">
        <div
          style={{
            width: 130,
            height: 130,
            borderRadius: "50%",
            overflow: "hidden",
            marginBottom: 20,
            border: `2px solid ${BLUE}`,
            boxShadow: `0 0 28px ${BLUE_GLOW}, 0 0 60px ${BLUE_SOFT}`,
          }}
        >
          <img src={flexinCircle} alt="Flexin" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
        <p className="text-sm mt-2 max-w-xs" style={{ color: "#cbd5e1", lineHeight: 1.5 }}>
          <span style={{ color: BLUE, fontWeight: 600 }}>Flexin</span> is about showing up for your squad — build strength, discipline, and accountability together.
        </p>
      </div>

      {/* Price card */}
      <div
        className="rounded-3xl p-5 w-full max-w-sm mb-6"
        style={{
          background: "#000",
          border: `1.5px solid ${BLUE_STROKE}`,
          boxShadow: `0 0 32px ${BLUE_SOFT}, inset 0 0 24px rgba(59,130,246,0.05)`,
        }}
      >
        {/* Price label */}
        <div className="flex items-center justify-between mb-5">
          <div style={{ minWidth: 0, flex: 1 }}>
            <p className="font-bold text-white text-lg">Flexin Full Access</p>
            <p className="text-xs mt-0.5" style={{ color: BLUE }}>Cancel anytime</p>
          </div>
          <div className="text-right" style={{ flexShrink: 0 }}>
            {IS_IOS && trialDays ? (
              <>
                <p className="font-bold text-3xl" style={{ color: BLUE, lineHeight: 1 }}>FREE</p>
                <p className="text-xs mt-1" style={{ color: "#94a3b8", maxWidth: 140, lineHeight: 1.3 }}>
                  {displayPrice}/month after {trialDays} days
                </p>
              </>
            ) : (
              <>
                <p className="font-bold text-3xl" style={{ color: BLUE }}>{displayPrice}</p>
                <p className="text-xs" style={{ color: "#94a3b8" }}>/month</p>
              </>
            )}
          </div>
        </div>

        {/* Perks list — each row has a blue-stroked icon tile + thin divider */}
        <div className="flex flex-col">
          {PERKS.map(({ Icon, text }, i) => (
            <div
              key={i}
              className="flex items-center gap-3 py-3"
              style={i > 0 ? { borderTop: "1px solid rgba(59,130,246,0.15)" } : undefined}
            >
              {/* Icon tile */}
              <div
                className="flex items-center justify-center flex-shrink-0"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  border: `1px solid ${BLUE_STROKE}`,
                  background: "rgba(59,130,246,0.08)",
                  boxShadow: `0 0 12px rgba(59,130,246,0.15)`,
                }}
              >
                <Icon size={22} color={BLUE} strokeWidth={2} style={{ filter: `drop-shadow(0 0 6px ${BLUE_GLOW})` }} />
              </div>
              {/* Text */}
              <span className="text-sm flex-1" style={{ color: "#e5e7eb", lineHeight: 1.35 }}>{text}</span>
              {/* Check */}
              <div
                className="flex items-center justify-center flex-shrink-0"
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  border: `1.5px solid ${BLUE}`,
                }}
              >
                <Check size={12} color={BLUE} strokeWidth={3} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA — blue gradient with lightning bolt + chevron */}
      <style>{`
        @keyframes flexin-cta-pulse-blue {
          0%, 100% { transform: scale(1); box-shadow: 0 8px 28px rgba(59,130,246,0.35), 0 0 0 0 rgba(59,130,246,0); }
          50%      { transform: scale(1.02); box-shadow: 0 10px 40px rgba(59,130,246,0.6), 0 0 40px 8px rgba(59,130,246,0.45); }
        }
        .flexin-cta-blue { animation: flexin-cta-pulse-blue 2.6s ease-in-out infinite; will-change: transform, box-shadow; }
        .flexin-cta-blue:disabled { animation: none; }
        @media (prefers-reduced-motion: reduce) {
          .flexin-cta-blue { animation: none; box-shadow: 0 8px 32px rgba(59,130,246,0.4); }
        }
      `}</style>
      <button
        onClick={handleCTA}
        disabled={iapBusy || unlockMutation.isPending}
        className="flexin-cta-blue w-full max-w-sm rounded-2xl font-bold text-lg transition-all active:scale-95 disabled:opacity-50 flex items-center justify-between"
        style={{
          padding: "18px 22px",
          background: "linear-gradient(135deg, #1e40af 0%, #3B82F6 50%, #60a5fa 100%)",
          color: "#ffffff",
          border: "1px solid rgba(147,197,253,0.4)",
        }}
        data-testid="button-unlock"
      >
        <Zap size={22} fill="#ffffff" color="#ffffff" strokeWidth={0} />
        <span style={{ flex: 1, textAlign: "center" }}>{ctaLabel}</span>
        <ChevronRight size={22} color="#ffffff" strokeWidth={2.5} />
      </button>

      {/* Error */}
      {iapError && (
        <div
          className="w-full max-w-sm mt-3 px-4 py-3 rounded-xl text-sm text-center"
          style={{
            background: "rgba(239,68,68,0.12)",
            border: "1px solid rgba(239,68,68,0.3)",
            color: "#f87171",
          }}
        >
          {iapError}
        </div>
      )}

      {/* Fine print — three short lines, soft gray */}
      <p className="text-xs mt-4 text-center max-w-xs" style={{ color: "#94a3b8", lineHeight: 1.55 }}>
        {IS_IOS && trialDays ? (
          <>
            Free for {trialDays} days, then {displayPrice}/month.<br />
            Cancel anytime in Settings · App Store.<br />
            Subscription renews automatically.
          </>
        ) : (
          <>{displayPrice}/month. Cancel anytime. Your progress is always saved.</>
        )}
      </p>

      {/* Bottom links — Restore purchase + Log In */}
      <div className="mt-4 flex items-center gap-4 text-xs" style={{ color: "#94a3b8" }}>
        {IS_IOS && (
          <>
            <button
              onClick={handleRestore}
              disabled={iapBusy}
              className="underline underline-offset-4 opacity-70 hover:opacity-100 transition-opacity disabled:opacity-30"
              data-testid="button-restore"
            >
              Restore purchase
            </button>
            <span className="opacity-40">·</span>
          </>
        )}
        <button
          onClick={async () => {
            // Sign out locally and bounce back to the very first page (Onboarding).
            try { await apiRequest("POST", "/api/logout", {}); } catch {}
            clearUserEmail();
            queryClient.clear();
            window.location.hash = "";
            window.location.reload();
          }}
          className="underline underline-offset-4 opacity-70 hover:opacity-100 transition-opacity"
          data-testid="button-paywall-login"
        >
          Log In
        </button>
      </div>

      {/* Required legal links on the iOS paywall (Apple Guideline 3.1.2 / 5.1.1) */}
      {IS_IOS && (
        <div className="mt-3 flex items-center gap-3 text-xs opacity-70" style={{ color: "#94a3b8" }}>
          <a href="https://www.flexinfitapp.com/terms" target="_blank" rel="noopener" className="underline underline-offset-4">
            Terms of Use
          </a>
          <span>·</span>
          <a href="https://www.flexinfitapp.com/privacy" target="_blank" rel="noopener" className="underline underline-offset-4">
            Privacy
          </a>
        </div>
      )}
    </div>
  );
}
