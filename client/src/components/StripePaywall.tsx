import { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { apiRequest, API_BASE } from "@/lib/queryClient";
import flexinFlexinOnly from "@/assets/flexin_circle.jpeg";
import paymentBg from "@/assets/payment_bg.jpeg";

const stripePromise = loadStripe("pk_live_51ThZa31zeUc213dYMlMpzP0u7dbu73zjJcr4hXQhBNZb0jW0VDUQNpHidSQmnrSZg1SxWAEYmW1ZLTPnEvCNqWSj00vemq95c5");

interface StripePaywallProps {
  userName: string;
  onSuccess: () => void;
  onSkip?: () => void;
}

function getTrialEndDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

// ── Inner card form (needs Stripe context) ──────────────────────
function CardForm({ email, onSuccess, onError }: { email: string; onSuccess: () => void; onError: (msg: string) => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!stripe || !elements) return;
    setLoading(true);

    try {
      // 1. Get SetupIntent clientSecret from server
      const siRes = await fetch(`${API_BASE}/api/stripe-setup-intent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const siData = await siRes.json();

      if (siData.demo) {
        // Demo mode — just unlock
        await apiRequest("POST", "/api/unlock", {});
        onSuccess();
        return;
      }

      if (siData.error) {
        onError(siData.error);
        setLoading(false);
        return;
      }

      // 2. Confirm card setup with Stripe Elements
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) { setLoading(false); return; }

      const { error, setupIntent } = await stripe.confirmCardSetup(siData.clientSecret, {
        payment_method: {
          card: cardElement,
          billing_details: { email: email || undefined },
        },
      });

      if (error) {
        onError(error.message || "Card declined. Please try again.");
        setLoading(false);
        return;
      }

      // 3. Create subscription on server with saved payment method
      const subRes = await fetch(`${API_BASE}/api/stripe-confirm-subscription`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: siData.customerId,
          paymentMethodId: setupIntent?.payment_method,
        }),
      });
      const subData = await subRes.json();

      if (subData.success || subData.demo) {
        onSuccess();
      } else {
        onError(subData.error || "Something went wrong. Please try again.");
      }
    } catch (e: any) {
      onError("Connection error. Please try again.");
    }
    setLoading(false);
  };

  return (
    <button
      onClick={handleSubmit}
      disabled={loading || !stripe}
      style={{
        width: "100%", padding: "16px 0", borderRadius: 14,
        background: loading ? "#a0a0a0" : "#635bff",
        border: "none", color: "white", fontSize: 15,
        fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
        marginTop: 16, marginBottom: 12,
        transition: "background 0.2s",
      }}
    >
      {loading ? "Processing..." : "Start Free Trial"}
    </button>
  );
}

// ── Main paywall ────────────────────────────────────────────────
export function StripePaywall({ userName, onSuccess, onSkip }: StripePaywallProps) {
  const [showSheet, setShowSheet] = useState(false);
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"paywall" | "success">("paywall");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSuccess = () => {
    setShowSheet(false);
    setStep("success");
    setTimeout(() => onSuccess(), 3000);
  };

  // ── Success screen ──────────────────────────────────────────
  if (step === "success") {
    return (
      <div style={{ minHeight: "100dvh", position: "relative", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <img src={paymentBg} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        <div style={{ position: "absolute", inset: 0, background: "rgba(8,12,22,0.75)" }} />
        <div style={{ position: "relative", zIndex: 2, textAlign: "center", padding: "0 32px" }}>
          <div style={{ fontSize: "4rem", marginBottom: 16 }}>🎉</div>
          <h1 style={{ fontWeight: 800, fontSize: "2rem", color: "#ffffff", marginBottom: 10 }}>You're all set!</h1>
          <p style={{ color: "rgba(255,255,255,0.65)", fontSize: "0.95rem", marginBottom: 6 }}>Your 3-day free journey has started.</p>
          <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.85rem" }}>You won't be charged until {getTrialEndDate()}.</p>
          <div style={{ marginTop: 32, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#f5c842", animation: "breathe 1.5s ease-in-out infinite" }} />
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.8rem" }}>Entering the temple...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100dvh", position: "relative", overflow: "hidden", display: "flex", flexDirection: "column" }}>
      {/* Background */}
      <img src={paymentBg} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" }} />
      <div style={{ position: "absolute", inset: 0, background: "rgba(8,12,22,0.45)" }} />

      {/* Main content */}
      <div style={{
        position: "relative", zIndex: 2,
        display: "flex", flexDirection: "column", alignItems: "center",
        padding: "64px 20px 40px", minHeight: "100dvh",
        filter: showSheet ? "blur(3px)" : "none",
        transform: showSheet ? "scale(0.97)" : "scale(1)",
        transition: "filter 0.3s, transform 0.3s",
      }}>
        <h1 style={{ fontWeight: 800, fontSize: "2.2rem", color: "#ffffff", textAlign: "center", lineHeight: 1.15, marginBottom: 10, textShadow: "0 2px 16px rgba(0,0,0,0.5)" }}>
          Start your journey,
        </h1>
        <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.95rem", textAlign: "center", marginBottom: 32, textShadow: "0 1px 8px rgba(0,0,0,0.5)" }}>
          Lock in your practice before your first meditation
        </p>

        {/* Plan card */}
        <div style={{
          width: "100%", maxWidth: 380, borderRadius: 24,
          background: "rgba(18,22,36,0.88)", backdropFilter: "blur(12px)",
          border: "1.5px solid rgba(245,200,66,0.4)", padding: "32px 24px 28px",
          position: "relative", marginBottom: 24,
        }}>
          <div style={{ position: "absolute", top: -18, left: "50%", transform: "translateX(-50%)", background: "#f5c842", color: "#0d0f1a", padding: "6px 22px", borderRadius: 99, fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", whiteSpace: "nowrap" }}>
            ✦ MOST POPULAR
          </div>
          <h2 style={{ fontWeight: 800, fontSize: "2.8rem", color: "#f5c842", textAlign: "center", lineHeight: 1.1, marginBottom: 10, marginTop: 8 }}>
            3 Day Journey
          </h2>
          <p style={{ textAlign: "center", color: "rgba(245,200,66,0.8)", fontSize: "1.1rem", marginBottom: 20 }}>
            then <span style={{ color: "#f5c842", fontWeight: 700 }}>$4.99</span>/ monthly
          </p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 22 }}>
            <div style={{ flex: 1, height: 1, background: "rgba(245,200,66,0.25)" }} />
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#f5c842", margin: "0 8px", flexShrink: 0 }} />
            <div style={{ flex: 1, height: 1, background: "rgba(245,200,66,0.25)" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {["Unlimited meditations", "All 1,000 levels unlocked", "All 25 monk ranks", "Progress forever saved", "Level affirmations"].map(f => (
              <div key={f} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0, border: "2px solid #2ea057", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2.5 6.5l3 3 5-5" stroke="#2ea057" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
                <span style={{ color: "rgba(255,255,255,0.9)", fontSize: "1rem", fontWeight: 500 }}>{f}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Start Free button */}
        <button
          onClick={() => setShowSheet(true)}
          style={{
            width: "100%", maxWidth: 380, padding: "20px 0", borderRadius: 18,
            background: "#f5c842", border: "none", color: "#0d0f1a",
            fontSize: "1.2rem", fontWeight: 800, cursor: "pointer",
            boxShadow: "0 0 32px rgba(245,200,66,0.4)", marginBottom: 14,
          }}
        >
          Start Free
        </button>
        <p style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.35)", textAlign: "center" }}>
          3 days free, then $4.99/month. Cancel anytime.
        </p>

      </div>

      {/* ── Payment sheet ── */}
      <div style={{
        position: "fixed", insetInline: 0, bottom: 0,
        borderRadius: "24px 24px 0 0", background: "#ffffff",
        transform: showSheet ? "translateY(0)" : "translateY(100%)",
        transition: "transform 0.45s cubic-bezier(0.32,0.72,0,1)",
        maxHeight: "88vh", overflowY: "auto", zIndex: 50,
        boxShadow: "0 -8px 40px rgba(0,0,0,0.45)",
      }}>
        {/* Handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "14px 0 4px" }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: "#e5e7eb" }} />
        </div>

        <div style={{ padding: "8px 20px 40px" }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: "#635bff", letterSpacing: "-0.5px" }}>stripe</span>
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#6b7280" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
              Secure
            </div>
          </div>

          {/* Order summary */}
          <div style={{ borderRadius: 14, padding: "10px 14px", marginBottom: 18, display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f9fafb", border: "1px solid #e5e7eb" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, overflow: "hidden", background: "#0d1520", flexShrink: 0 }}>
                <img src={flexinFlexinOnly} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 20%" }} />
              </div>
              <div>
                <p style={{ fontWeight: 700, fontSize: 13, color: "#111827" }}>Flexin — 3 Day Journey</p>
                <p style={{ fontSize: 11, color: "#6b7280" }}>Free trial · then $4.99/month</p>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontWeight: 700, fontSize: 13, color: "#111827" }}>$0.00</p>
              <p style={{ fontSize: 10, color: "#6b7280" }}>today</p>
            </div>
          </div>

          {/* Email */}
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={{ width: "100%", padding: "13px 14px", borderRadius: 12, marginBottom: 12, fontSize: 14, background: "#f9fafb", border: "1.5px solid #e5e7eb", color: "#111827", outline: "none", boxSizing: "border-box" }}
          />

          {/* Real Stripe Card Element */}
          <Elements stripe={stripePromise}>
            <div style={{ padding: "13px 14px", borderRadius: 12, marginBottom: 4, fontSize: 14, background: "#f9fafb", border: "1.5px solid #e5e7eb" }}>
              <CardElement options={{
                style: {
                  base: { fontSize: "14px", color: "#111827", fontFamily: "inherit", "::placeholder": { color: "#9ca3af" } },
                  invalid: { color: "#ef4444" },
                },
                hidePostalCode: true,
              }} />
            </div>

            {errorMsg && (
              <p style={{ color: "#ef4444", fontSize: 12, marginBottom: 8, marginTop: 4 }}>{errorMsg}</p>
            )}

            <CardForm
              email={email}
              onSuccess={handleSuccess}
              onError={(msg) => setErrorMsg(msg)}
            />
          </Elements>

          <p style={{ textAlign: "center", fontSize: 10, color: "#9ca3af", lineHeight: 1.5 }}>
            3-day free trial, then $4.99/month. Cancel anytime before trial ends.
          </p>
        </div>

        {/* Close */}
        <button onClick={() => { setShowSheet(false); setErrorMsg(""); }} style={{ position: "absolute", top: 14, right: 16, background: "none", border: "none", cursor: "pointer", color: "#9ca3af", padding: 4 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {showSheet && <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={() => { setShowSheet(false); setErrorMsg(""); }} />}
    </div>
  );
}
