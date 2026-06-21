import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient, clearUserEmail } from "@/lib/queryClient";
import { Capacitor } from "@capacitor/core";
import {
  getMonthlyOffering,
  purchaseMonthly,
  restorePurchases,
  type MonthlyOffering,
} from "@/lib/iap";
import flexinCircle from "@/assets/flexin_circle.jpeg";
import { Fireflies } from "@/components/Fireflies";

interface PaywallProps {
  onUnlock: () => void;
  userName: string;
}

const PERKS = [
  { icon: "🧘", text: "Unlimited daily meditations" },
  { icon: "🍌", text: "Full banana & level progression" },
  { icon: "🔔", text: "Bell sounds & monk music" },
  { icon: "🔥", text: "Streak tracking & stats" },
  { icon: "🐒", text: "All 25 monk rank names + evolving mascot" },
  { icon: "✨", text: "Access to Experienced & Enlightened tiers" },
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

  // Web/Stripe path (unchanged) — used on flexinapp.com.
  const unlockMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/unlock", {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      setPurchased(true);
      setTimeout(onUnlock, 1800);
    },
  });

  // iOS IAP path — RevenueCat / Apple In-App Purchase.
  const handleIAPPurchase = async () => {
    setIapBusy(true);
    setIapError("");
    const result = await purchaseMonthly();
    setIapBusy(false);
    if (result.ok) {
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
      <div className="min-h-screen flex flex-col items-center justify-center stars-bg px-6 text-center relative overflow-hidden">
        <Fireflies />
        <div className="text-6xl mb-4 level-up relative z-10">🙏</div>
        <h2 className="font-display text-gold text-2xl font-bold mb-2">Welcome to the temple, {userName}</h2>
        <p className="text-muted-foreground text-sm">Your journey has no limit now.</p>
      </div>
    );
  }

  // Pricing display. On iOS use the live price from the App Store (falls back to $6.99).
  // On web, keep the existing $4.99 web price.
  const displayPrice = IS_IOS ? (offering?.priceString || "$6.99") : "$4.99";
  const trialDays = IS_IOS ? (offering?.introTrialDays ?? 3) : null;
  const ctaLabel = IS_IOS
    ? (iapBusy
        ? "Connecting to App Store..."
        : "Enter Temple")
    : (unlockMutation.isPending ? "Unlocking..." : `Unlock for ${displayPrice} 🙏`);

  const handleCTA = () => {
    if (IS_IOS) {
      void handleIAPPurchase();
    } else {
      unlockMutation.mutate();
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-start px-5 py-8 stars-bg overflow-y-auto relative">
      <Fireflies fixed />
      {/* Header */}
      <div className="flex flex-col items-center text-center mb-6">
        <div style={{ width: 110, height: 110, borderRadius: '50%', overflow: 'hidden', marginBottom: 18, border: '2px solid rgba(245,200,66,0.4)', boxShadow: '0 0 24px rgba(245,200,66,0.25)' }}>
          <img src={flexinCircle} alt="Flexin" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
        <h1 className="font-display text-gold font-bold" style={{ fontSize: "1.6rem", lineHeight: 1.15 }}>
          Journey to inner peace starts now
        </h1>
        <p className="text-muted-foreground text-sm mt-2 max-w-xs">
          Flexin is about showing up for your squad — build strength, discipline, and accountability together.
        </p>
      </div>

      {/* Price card */}
      <div
        className="glass-card rounded-3xl p-5 w-full max-w-sm mb-5"
        style={{ border: "1.5px solid rgba(245,200,66,0.3)", boxShadow: "0 0 30px rgba(245,200,66,0.08)" }}
      >
        {/* Price label */}
        <div className="flex items-center justify-between mb-4">
          <div style={{ minWidth: 0, flex: 1 }}>
            <p className="font-display font-bold text-foreground text-lg">Flexin Full Access</p>
            <p className="text-muted-foreground text-xs">Cancel anytime</p>
          </div>
          <div className="text-right" style={{ flexShrink: 0 }}>
            {IS_IOS && trialDays ? (
              <>
                <p className="font-display font-bold text-gold text-2xl" style={{ lineHeight: 1 }}>FREE</p>
                <p className="text-muted-foreground text-xs mt-1" style={{ maxWidth: 130, lineHeight: 1.3 }}>
                  {displayPrice}/month after {trialDays} days
                </p>
              </>
            ) : (
              <>
                <p className="font-display font-bold text-gold text-2xl">{displayPrice}</p>
                <p className="text-muted-foreground text-xs">/month</p>
              </>
            )}
          </div>
        </div>

        {/* Perks list */}
        <div className="flex flex-col gap-2.5">
          {PERKS.map((perk, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="text-lg w-7 flex-shrink-0">{perk.icon}</span>
              <span className="text-sm text-foreground">{perk.text}</span>
              <svg className="ml-auto flex-shrink-0" width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="7" fill="rgba(245,200,66,0.15)" />
                <path d="M4 7L6 9L10 5" stroke="#f5c842" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          ))}
        </div>
      </div>

      {/* CTA — with gentle pulse/glow */}
      <style>{`
        @keyframes flexin-cta-pulse {
          0%, 100% { transform: scale(1); box-shadow: 0 8px 28px rgba(245,200,66,0.25), 0 0 0 0 rgba(245,200,66,0); }
          50%      { transform: scale(1.025); box-shadow: 0 10px 36px rgba(245,200,66,0.45), 0 0 36px 8px rgba(245,200,66,0.35); }
        }
        .flexin-cta { animation: flexin-cta-pulse 2.6s ease-in-out infinite; will-change: transform, box-shadow; }
        .flexin-cta:disabled { animation: none; }
        @media (prefers-reduced-motion: reduce) {
          .flexin-cta { animation: none; box-shadow: 0 8px 32px rgba(245,200,66,0.3); }
        }
      `}</style>
      <button
        onClick={handleCTA}
        disabled={iapBusy || unlockMutation.isPending}
        className="flexin-cta w-full max-w-sm py-5 rounded-3xl font-display font-bold text-lg transition-all active:scale-95 disabled:opacity-50"
        style={{
          background: "linear-gradient(135deg, var(--color-saffron), var(--color-gold))",
          color: "#1a0a00",
        }}
        data-testid="button-unlock"
      >
        {ctaLabel}
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

      {/* Fine print */}
      <p className="text-xs text-muted-foreground mt-3 text-center max-w-xs">
        {IS_IOS && trialDays ? (
          <>
            Free for {trialDays} days, then {displayPrice}/month.
            Cancel anytime in Settings · App Store.
            Subscription renews automatically.
          </>
        ) : (
          <>{displayPrice}/month. Cancel anytime. Your progress is always saved.</>
        )}
      </p>

      {/* Bottom links — Restore purchase + Log In */}
      <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
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
            // Clearing the stored email drops `x-user-email`, so `/api/user` returns null
            // and App.tsx renders <Onboarding /> as the first screen.
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
        <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground opacity-70">
          <a href="https://www.flexinapp.com/terms" target="_blank" rel="noopener" className="underline underline-offset-4">
            Terms of Use
          </a>
          <span>·</span>
          <a href="https://www.flexinapp.com/privacy" target="_blank" rel="noopener" className="underline underline-offset-4">
            Privacy
          </a>
        </div>
      )}
    </div>
  );
}
