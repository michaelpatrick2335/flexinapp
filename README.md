# flexin

A gamified strength-training & accountability iOS app.

> Status: scaffolding from monkyapp base. Screens are being swapped from meditation → fitness one at a time.

## Stack

- **Frontend**: React 18 + Vite + Tailwind + Radix UI + Wouter (routing)
- **Native shell**: Capacitor 8 (iOS only — no Android in v1)
- **Backend**: Vercel serverless (Express compatible) + Vercel Postgres + Drizzle ORM
- **Payments**: Stripe (web invite/signup flow) + RevenueCat (in-app purchase on iOS)
- **CI/CD**: Codemagic → App Store Connect
- **Auth**: Email/password + Sign in with Apple + Sign in with Google (planned)

## Architecture (locked in)

- Native iOS app, distributed only through the App Store.
- Web domain (flexinapp.com) is **marketing + invite-signup landing only** — no in-browser app experience.
- Web flow handles: marketing landing, `/join/CODE` → `/signup` → Stripe → `/post-signup` → App Store CTA, plus `/privacy` and `/terms`.

## App screens (v1)

1. Welcome (logo, Get Started / Log In, 3 feature cards, Trainer signup link)
2. Create Account (Apple / Google / Email)
3. Name & Email
4. Sex Select (Male / Female — sets theme; "Prefer not to answer" lets user choose blue or pink)
5. Home / Feed (body silhouette, Form Level, Energy, Squad Feed, Evolution stats)
6. Log Workout (workout-type picker, sex-conditional)
7. Select Exercises (exercise checklist + "+ Custom" option)
8. Squad (Squad Energy, MAX AI Coach, Live Activity, Ghost Mode, Weekly MVP)
9. Profile / Settings (simple)

Bottom nav: Feed · Squad · ➕ Log · Profile

## Pricing

- **flexin+** — $24.99/mo: up to 3 squads, 20 members per squad
- **flexin Trainer** — $99.99/mo: unlimited squads, unlimited members per squad

## Local dev

```bash
cp .env.example .env   # fill in real keys
npm install
npm run dev
```

## iOS build

```bash
npm run build:ios
npm run ios:open
```

Or push to `main` — Codemagic builds and uploads to App Store Connect automatically.
