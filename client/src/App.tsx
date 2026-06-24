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
import { AvatarSelect } from "@/pages/AvatarSelect";
import { Home } from "@/pages/Home";
import { LogWorkout } from "@/pages/LogWorkout";
import { SelectExercises } from "@/pages/SelectExercises";
import { Squad } from "@/pages/Squad";
import { Profile } from "@/pages/Profile";
import { NotificationSettings } from "@/pages/NotificationSettings";
import { PrivacySettings } from "@/pages/PrivacySettings";
import { Progress } from "@/pages/Progress";
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
type SignupStep = "create" | "name-email" | "sex" | "avatar";

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
  const [signupAge, setSignupAge] = useState<number | null>(null);
  const [signupWeight, setSignupWeight] = useState<number | null>(null);
  // Buffered sex / theme — picked at SexSelect, submitted at Avatar step
  const [signupSex, setSignupSex] = useState<"male" | "female" | null>(null);
  const [signupThemeOverride, setSignupThemeOverride] = useState<string | null>(null);
  const [signupAvatarId, setSignupAvatarId] = useState<string | null>(null);

  // Capture ?join=CODE from URL once on mount and stash so signup/login can auto-join
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("join");
      if (code && /^[A-Z0-9]{4,10}$/i.test(code)) {
        localStorage.setItem("flexin_pending_join_code", code.toUpperCase());
      }
    } catch {}

    // TestFlight requirement: always start the app at the Welcome screen.
    // Drop any persisted login (email + react-query cache + pending join code
    // staging) before the first render so the splash gives way to Welcome,
    // not to a half-cached "Loading…" against a stale account.
    if (Capacitor.isNativePlatform()) {
      try { clearUserEmail(); } catch {}
      try { queryClient.clear(); } catch {}
    }

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
    const apiBase = Capacitor.isNativePlatform() ? "https://www.flexinfitapp.com" : "";
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
            initialAge={signupAge != null ? String(signupAge) : ""}
            initialWeight={signupWeight != null ? String(signupWeight) : ""}
            onContinue={({ name, email, age, weightLbs }) => {
              setSignupName(name);
              setSignupEmail(email);
              setSignupAge(age);
              setSignupWeight(weightLbs);
              setSignupStep("sex");
            }}
            onBack={() => setSignupStep("create")}
          />
        );
      }

      if (signupStep === "sex") {
        // Screen 4: pick sex + theme, buffer them, then advance to Avatar step.
        return (
          <SexSelect
            onContinue={({ sex, themeOverride }) => {
              setSignupSex(sex);
              setSignupThemeOverride(themeOverride ?? null);
              setSignupStep("avatar");
            }}
            onBack={() => setSignupStep("name-email")}
          />
        );
      }

      // signupStep === "avatar" — Screen 5. Pick body-type avatar, then
      // submit the full buffered signup payload (name + email + age + weight
      // + sex + themeOverride + avatarBodyType + isTrainer) to the server.
      return (
        <AvatarSelect
          sex={signupSex ?? "male"}
          initialAvatarId={signupAvatarId}
          onContinue={async (avatarId) => {
            setSignupAvatarId(avatarId);
            const apiBase = Capacitor.isNativePlatform() ? "https://www.flexinfitapp.com" : "";
            try {
              const r = await fetch(`${apiBase}/api/signup`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  name: signupName,
                  email: signupEmail,
                  sex: signupSex,
                  themeOverride: signupThemeOverride,
                  isTrainer: authMode === "trainer",
                  age: signupAge,
                  weightLbs: signupWeight,
                  avatarBodyType: avatarId,
                }),
              });
              if (r.ok) {
                // Brand-new account created.
                setUserEmail(signupEmail);
                queryClient.invalidateQueries({ queryKey: ["/api/user"] });
                return;
              }
              // 409 = account already exists with this email. Log the user in
              // automatically with the same email so they don't get dumped
              // back to a confusing legacy login screen. The chosen avatar /
              // sex / weight are buffered in component state; we'll persist
              // them post-login via PATCH /api/user.
              if (r.status === 409) {
                const loginRes = await fetch(`${apiBase}/api/login`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ email: signupEmail }),
                });
                if (loginRes.ok) {
                  setUserEmail(signupEmail);
                  // Best-effort: push the freshly-picked profile fields onto
                  // the existing account so the Home screen avatar matches
                  // what they just selected. Failures are non-fatal.
                  try {
                    await fetch(`${apiBase}/api/user`, {
                      method: "PATCH",
                      headers: {
                        "Content-Type": "application/json",
                        "x-user-email": signupEmail,
                      },
                      body: JSON.stringify({
                        name: signupName,
                        sex: signupSex,
                        themeOverride: signupThemeOverride,
                        age: signupAge,
                        weightLbs: signupWeight,
                        avatarBodyType: avatarId,
                      }),
                    });
                  } catch {}
                  queryClient.invalidateQueries({ queryKey: ["/api/user"] });
                  return;
                }
              }
              // Any other failure: surface to console; stay on avatar screen
              // so the user can retry instead of dumping them to a stale
              // legacy login UI.
              console.error("[flexin] signup failed", r.status);
              alert("Couldn't finish signup. Please check your connection and try again.");
            } catch (err) {
              console.error("[flexin] signup network error", err);
              alert("Network error. Please try again.");
            }
          }}
          onBack={() => setSignupStep("sex")}
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
  | { name: "squad" }
  | { name: "profile" }
  | { name: "notification-settings" }
  | { name: "privacy-settings" }
  | { name: "progress" };

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
        onOpenProfile={() => setScreen({ name: "profile" })}
        onOpenProgress={() => setScreen({ name: "progress" })}
      />
    );
  }

  if (screen.name === "profile") {
    return (
      <Profile
        onBack={() => setScreen({ name: "home" })}
        onOpenFeed={() => setScreen({ name: "home" })}
        onOpenSquad={() => setScreen({ name: "squad" })}
        onOpenLogWorkout={() => setScreen({ name: "log-workout" })}
        onOpenProgress={() => setScreen({ name: "progress" })}
        onOpenNotificationSettings={() => setScreen({ name: "notification-settings" })}
        onOpenPrivacySettings={() => setScreen({ name: "privacy-settings" })}
        onLogOut={() => {
          clearUserEmail();
          clearCustomExercisesForCurrentUser();
          queryClient.clear();
          window.location.hash = "";
          window.location.reload();
        }}
      />
    );
  }

  if (screen.name === "notification-settings") {
    return <NotificationSettings onBack={() => setScreen({ name: "profile" })} />;
  }

  if (screen.name === "privacy-settings") {
    return <PrivacySettings onBack={() => setScreen({ name: "profile" })} />;
  }

  if (screen.name === "progress") {
    return (
      <Progress
        onBack={() => setScreen({ name: "home" })}
        onOpenFeed={() => setScreen({ name: "home" })}
        onOpenSquad={() => setScreen({ name: "squad" })}
        onOpenLogWorkout={() => setScreen({ name: "log-workout" })}
        onOpenProfile={() => setScreen({ name: "profile" })}
      />
    );
  }

  return (
    <Home
      onOpenLogWorkout={() => setScreen({ name: "log-workout" })}
      onOpenSquad={() => setScreen({ name: "squad" })}
      onOpenFeed={() => setScreen({ name: "home" })}
      onOpenProfile={() => setScreen({ name: "profile" })}
      onOpenProgress={() => setScreen({ name: "progress" })}
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
