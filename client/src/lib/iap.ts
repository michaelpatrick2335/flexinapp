// RevenueCat IAP integration for iOS — handles the $6.99/mo subscription with 3-day free trial.
// Web platforms fall back to the existing Stripe paywall via /api/unlock.

import { Capacitor } from "@capacitor/core";
import { Purchases, LOG_LEVEL } from "@revenuecat/purchases-capacitor";

// ── Config ─────────────────────────────────────────────────────────────────
// Public RevenueCat iOS API key — safe to ship in client bundle.
// Set via Codemagic env var VITE_REVENUECAT_IOS_KEY before building the iOS app.
const REVENUECAT_IOS_KEY = (import.meta.env.VITE_REVENUECAT_IOS_KEY as string) || "";

// Entitlement identifier configured in RevenueCat dashboard.
// All products that grant premium access should attach to this entitlement.
export const PREMIUM_ENTITLEMENT = "premium";

// Product identifier registered in App Store Connect.
// Must match the subscription product ID exactly.
export const MONTHLY_PRODUCT_ID = "com.flexinapp.meditation.premium.monthly";

let initialized = false;

// ── Init ───────────────────────────────────────────────────────────────────
export async function initRevenueCat(appUserId?: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  if (initialized) {
    if (appUserId) {
      try { await Purchases.logIn({ appUserID: appUserId }); } catch {}
    }
    return;
  }

  if (!REVENUECAT_IOS_KEY) {
    console.warn("[IAP] VITE_REVENUECAT_IOS_KEY is not set — IAP disabled.");
    return;
  }

  try {
    await Purchases.setLogLevel({ level: LOG_LEVEL.WARN });
    await Purchases.configure({
      apiKey: REVENUECAT_IOS_KEY,
      appUserID: appUserId ?? undefined,
    });
    initialized = true;
  } catch (err) {
    console.error("[IAP] RevenueCat configure failed:", err);
  }
}

// ── Offerings ──────────────────────────────────────────────────────────────
export interface MonthlyOffering {
  productId: string;
  priceString: string; // e.g. "$6.99"
  introTrialDays: number | null;
}

export async function getMonthlyOffering(): Promise<MonthlyOffering | null> {
  if (!Capacitor.isNativePlatform()) return null;
  if (!initialized) await initRevenueCat();
  if (!initialized) return null;

  try {
    const { current } = await Purchases.getOfferings();
    const monthly =
      current?.monthly ??
      current?.availablePackages.find(
        (p) => p.product.identifier === MONTHLY_PRODUCT_ID
      );
    if (!monthly) return null;

    const product = monthly.product;
    const introDays = (product as any)?.introPrice?.periodNumberOfUnits ?? null;

    return {
      productId: product.identifier,
      priceString: product.priceString,
      introTrialDays: introDays,
    };
  } catch (err) {
    console.error("[IAP] getOfferings failed:", err);
    return null;
  }
}

// ── Purchase ───────────────────────────────────────────────────────────────
export type PurchaseResult =
  | { ok: true }
  | { ok: false; cancelled: boolean; error: string };

export async function purchaseMonthly(): Promise<PurchaseResult> {
  if (!Capacitor.isNativePlatform()) {
    return { ok: false, cancelled: false, error: "IAP only available on iOS" };
  }
  if (!initialized) await initRevenueCat();
  if (!initialized) {
    return { ok: false, cancelled: false, error: "IAP not configured" };
  }

  try {
    const { current } = await Purchases.getOfferings();
    const monthly =
      current?.monthly ??
      current?.availablePackages.find(
        (p) => p.product.identifier === MONTHLY_PRODUCT_ID
      );
    if (!monthly) {
      return { ok: false, cancelled: false, error: "Subscription unavailable" };
    }

    const { customerInfo } = await Purchases.purchasePackage({ aPackage: monthly });
    const isPremium = !!customerInfo.entitlements.active[PREMIUM_ENTITLEMENT];
    if (!isPremium) {
      return { ok: false, cancelled: false, error: "Purchase did not grant premium" };
    }
    return { ok: true };
  } catch (err: any) {
    const cancelled = !!err?.userCancelled;
    return {
      ok: false,
      cancelled,
      error: cancelled ? "Cancelled" : err?.message || "Purchase failed",
    };
  }
}

// ── Restore ────────────────────────────────────────────────────────────────
export async function restorePurchases(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  if (!initialized) await initRevenueCat();
  if (!initialized) return false;

  try {
    const { customerInfo } = await Purchases.restorePurchases();
    return !!customerInfo.entitlements.active[PREMIUM_ENTITLEMENT];
  } catch (err) {
    console.error("[IAP] restore failed:", err);
    return false;
  }
}

// ── Status check ───────────────────────────────────────────────────────────
export async function isPremiumViaIAP(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  if (!initialized) await initRevenueCat();
  if (!initialized) return false;

  try {
    const { customerInfo } = await Purchases.getCustomerInfo();
    return !!customerInfo.entitlements.active[PREMIUM_ENTITLEMENT];
  } catch {
    return false;
  }
}

// ── Identify user ──────────────────────────────────────────────────────────
export async function identifyUser(email: string): Promise<void> {
  if (!Capacitor.isNativePlatform() || !initialized) return;
  try {
    await Purchases.logIn({ appUserID: email });
  } catch (err) {
    console.error("[IAP] logIn failed:", err);
  }
}
