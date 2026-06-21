import { useState, useEffect } from "react";
import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { useQuery } from "@tanstack/react-query";
import { Capacitor } from "@capacitor/core";
import { Clipboard } from "@capacitor/clipboard";
import { queryClient, getQueryFn, getUserEmail, setUserEmail, clearUserEmail, hasPickedExperience } from "@/lib/queryClient";
import { clearCustomExercisesForCurrentUser } from "@/lib/custom-breath-exercises";
import { Welcome } from "@/pages/Welcome";
import { CreateAccount } from "@/pages/CreateAccount";
import { NameEmail } from "@/pages/NameEmail";
import { SexSelect } from "@/pages/SexSelect";
import { Home } from "@/pages/Home";
import { LogWorkout } from "@/pages/LogWorkout";
import { SelectExercises } from "@/pages/SelectExercises";
import { Squad } from "@/pages/Squad";
import { Onboarding } from "@/pages/Onboarding";
import { ExperiencePicker } from "@/pages/ExperiencePicker";
import { TabShell } from "@/components/TabShell";
import { Paywall } from "@/pages/Paywall";
import { FlexinLoader } from "@/components/FlexinLoader";
import { Toaster } from "@/components/ui/toaster";
import type { User } from "@shared/schema";

const IS_IOS = Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";

// Auth entry mode: "welcome" (first screen) | "signup" (Create Account flow)
// | "login" (existing-user login) | "trainer" (Trainer signup path)
type AuthMode = "welcome" | "signup" | "login" | "trainer";

// Sub-step within the signup/trainer flow:
//   "create"      → Screen 2 (Create Account: Apple/Google/Email)
//   "name-email"  → Screen 3 (Name & Email)
//   "sex"         → Screen 4 (Sex Select)
type SignupStep = "create" | "name-email" | "sex";

function AppContent() {
  // Local flag: once user taps a level, go straight to Dashboard — no re-fetch needed
  const [experienceDone, setExperienceDone] = useState(false);
  // Which auth screen to show when no user is logged in
  const [authMode, setAuthMode] = useState<AuthMode>("welcome");
  // Sub-step inside the signup/trainer flow
  const [signupStep, setSignupStep] = useState<SignupStep>("create");
  // Buffered signup data — collected across Screens 3 & 4 before final submit
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");

  // Capture ?join=CODE from URL once on mount and stash so signup/login can auto-join
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("join");
      if (code && /^[A-Z0-9]{4,10}$/i.test(code)) {
        localStorage.setItem("flexin_pending_join_code", code.toUpperCase());
      }
    } catch {}

    // Clipboard handoff: on iOS first-launch, the user may have tapped a
    // /join/CODE link before installing the app. join.html copies the code
    // as "FLEXIN-TRIBE:CODE" to the system clipboard. Read it here so we can
    // auto-join after they finish paying.
    if (Capacitor.isNativePlatform()) {
      (async () => {
        try {
          const { value } = await Clipboard.read();
          if (value && typeof value === "string") {
            const m = value.trim().match(/^FLEXIN-TRIBE:([A-Z0-9]{4,10})$/i);
            if (m) {
              localStorage.setItem("flexin_pending_join_code", m[1].toUpperCase());
              // Clear the clipboard so we don't re-process on subsequent launches.
              try { await Clipboard.write({ string: "" }); } catch {}
            }
          }
        } catch {}
      })();
    }
  }, []);

  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ["/api/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    refetchOnWindowFocus: false,
    staleTime: 30_000,
    retry: false,
  });

  // Post-paywall auto-join. Runs whenever the user becomes premium.
  // There are TWO possible sources for a pending tribe code:
  //   1. Server-side `user.pendingJoinCode` — set during web signup (the most
  //      reliable path: code was attached to the account at /api/signup time).
  //   2. Client-side localStorage `flexin_pending_join_code` — set when the
  //      user tapped a /join/CODE link in Safari on the same device or when
  //      the clipboard handoff fired on first launch.
  // We try server-side first (via /api/groups/consume-pending), then fall
  // back to localStorage for the rare case where it wasn't on the user record.
  useEffect(() => {
    if (!user?.isPremium) return;
    const email = getUserEmail();
    if (!email) return;
    const apiBase = Capacitor.isNativePlatform() ? "https://www.flexinapp.com" : "";
    const headers = { "Content-Type": "application/json", "x-user-email": email };

    (async () => {
      // 1. Try the server-side stashed code (web signup path).
      if (user.pendingJoinCode) {
        try {
          const r = await fetch(`${apiBase}/api/groups/consume-pending`, { method: "POST", headers });
          if (r.ok) {
            queryClient.invalidateQueries({ queryKey: ["/api/user"] });
            // Server-side code consumed — we're done. Clear the LS code too
            // in case both were set, so we don't double-join.
            localStorage.removeItem("flexin_pending_join_code");
            return;
          }
        } catch {}
      }

      // 2. Fall back to localStorage code (universal link / clipboard path).
      const lsCode = localStorage.getItem("flexin_pending_join_code");
      if (!lsCode) return;
      try {
        const r = await fetch(`${apiBase}/api/groups/join`, {
          method: "POST", headers, body: JSON.stringify({ joinCode: lsCode }),
        });
        if (r.ok || r.status === 409) {
          localStorage.removeItem("flexin_pending_join_code");
          queryClient.invalidateQueries({ queryKey: ["/api/user"] });
        } else if (r.status === 404) {
          localStorage.removeItem("flexin_pending_join_code");
        }
      } catch {
        // network error — leave LS code in place, retries next launch.
      }
    })();
  }, [user?.isPremium, user?.pendingJoinCode]);

  if (isLoading) {
    return <FlexinLoader />;
  }

  // Not logged in → show Welcome first, then route into the appropriate flow
  if (!user) {
    if (authMode === "welcome") {
      return (
        <Welcome
          onGetStarted={() => setAuthMode("signup")}
          onLogIn={() => setAuthMode("login")}
          onTrainerSignup={() => setAuthMode("trainer")}
        />
      );
    }

    // Signup & trainer signup both start at the Create Account screen.
    // Trainer path will later flag isTrainer=true after auth completes.
    if (authMode === "signup" || authMode === "trainer") {
      if (signupStep === "create") {
        return (
          <CreateAccount
            onApple={() => {
              // TODO: native Sign in with Apple bridge (Capacitor plugin)
              // For now, fall through to the legacy onboarding so dev can keep moving.
              setAuthMode("login");
            }}
            onGoogle={() => {
              // TODO: Google OAuth
              setAuthMode("login");
            }}
            onEmail={() => setSignupStep("name-email")}
            onLogIn={() => setAuthMode("login")}
            onBack={() => {
              setSignupStep("create");
              setAuthMode("welcome");
            }}
          />
        );
      }

      if (signupStep === "name-email") {
        return (
          <NameEmail
            initialName={signupName}
            initialEmail={signupEmail}
            onContinue={({ name, email }) => {
              setSignupName(name);
              setSignupEmail(email);
              setSignupStep("sex");
            }}
            onBack={() => setSignupStep("create")}
          />
        );
      }

      // signupStep === "sex" — Screen 4. On continue, submit the buffered
      // signup data (name + email + sex + themeOverride + isTrainer) to the
      // server, persist the user's email for x-user-email header, and trigger
      // a /api/user refetch so the app advances to Home with the real name.
      return (
        <SexSelect
          onContinue={async ({ sex, themeOverride }) => {
            try {
              const apiBase = Capacitor.isNativePlatform() ? "https://www.flexinapp.com" : "";
              const r = await fetch(`${apiBase}/api/signup`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  name: signupName,
                  email: signupEmail,
                  sex,
                  themeOverride,
                  isTrainer: authMode === "trainer",
                }),
              });
              if (!r.ok) throw new Error(`signup ${r.status}`);
              // Remember the email so future /api requests include x-user-email.
              setUserEmail(signupEmail);
              // Force /api/user refetch — App will re-render and land on Home.
              queryClient.invalidateQueries({ queryKey: ["/api/user"] });
            } catch (err) {
              console.error("[flexin] signup failed", err);
              // Fall back to login so the user isn't stranded.
              setAuthMode("login");
              setSignupStep("create");
            }
          }}
          onBack={() => setSignupStep("name-email")}
        />
      );
    }

    // login still falls through to the legacy Onboarding for now
    return (
      <Onboarding
        onComplete={() => {
          queryClient.invalidateQueries({ queryKey: ["/api/user"] });
        }}
      />
    );
  }

  // Logged in but not premium
  // • On iOS: show the in-app paywall (Apple IAP)
  // • On web: send back to login (web signup uses the Stripe paywall in the marketing flow)
  if (!user.isPremium) {
    if (IS_IOS) {
      return (
        <Paywall
          userName={user.name || "friend"}
          onUnlock={() => {
            queryClient.invalidateQueries({ queryKey: ["/api/user"] });
          }}
        />
      );
    }
    return (
      <Onboarding
        onComplete={() => {
          queryClient.invalidateQueries({ queryKey: ["/api/user"] });
        }}
      />
    );
  }

  // Flexin v1: skip the legacy ExperiencePicker (meditation-era).
  // The Sex Select screen + onboarding submission already collect everything
  // we need for a first-time user.
  void experienceDone; void setExperienceDone; void hasPickedExperience;

  // Fully set up → Flexin Home (Screen 5) or one of the Log Workout sub-screens.
  // We keep this in a tiny local state machine so the back nav between Home,
  // Log Workout (Screen 6), and Select Exercises (Screen 7) is instant and the
  // user's selection state survives navigation.
  return <AuthenticatedShell />;
}

type Screen =
  | { name: "home" }
  | { name: "log-workout" }
  | { name: "select-exercises"; category: { key: string; name: string; summary: string; icon: string } }
  | { name: "squad" };

function AuthenticatedShell() {
  const [screen, setScreen] = useState<Screen>({ name: "home" });

  if (screen.name === "log-workout") {
    return (
      <LogWorkout
        onBack={() => setScreen({ name: "home" })}
        onSelectCategory={(cat) => setScreen({ name: "select-exercises", category: cat })}
      />
    );
  }

  if (screen.name === "select-exercises") {
    return (
      <SelectExercises
        category={screen.category}
        onBack={() => setScreen({ name: "log-workout" })}
        onCompleted={() => setScreen({ name: "home" })}
      />
    );
  }

  if (screen.name === "squad") {
    return (
      <Squad
        onOpenFeed={() => setScreen({ name: "home" })}
        onOpenSquad={() => setScreen({ name: "squad" })}
        onOpenLogWorkout={() => setScreen({ name: "log-workout" })}
        onOpenProfile={() => console.log("[flexin] open Profile")}
      />
    );
  }

  return (
    <Home
      onOpenLogWorkout={() => setScreen({ name: "log-workout" })}
      onOpenSquad={() => setScreen({ name: "squad" })}
      onOpenFeed={() => {
        // TODO: dedicated Feed view
        console.log("[flexin] open Feed");
      }}
      onOpenProfile={() => {
        // TODO: route to Profile/Settings
        console.log("[flexin] open Profile");
      }}
    />
  );
}

export default function App() {
  return (
    <Router hook={useHashLocation}>
      <Switch>
        <Route path="/" component={AppContent} />
        <Route component={AppContent} />
      </Switch>
      <Toaster />
    </Router>
  );
}
