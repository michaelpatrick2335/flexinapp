# In-App Purchase Setup ($6.99/mo with 3-day free trial)

This guide walks through configuring the iOS subscription in **App Store Connect**, **RevenueCat**, and **Codemagic**. Code is already wired — these are one-time dashboard steps.

## Pricing

- **Monthly subscription:** $6.99/month
- **Intro offer:** 3-day free trial (first-time subscribers only)
- **Product ID (must match exactly):** `com.flexinapp.meditation.premium.monthly`
- **Entitlement ID (RevenueCat):** `premium`

---

## Step 1 — App Store Connect (create the subscription product)

1. Open [App Store Connect](https://appstoreconnect.apple.com/) → **My Apps** → **Flexin Meditation App**
2. In the left sidebar, click **Monetization** → **Subscriptions**
3. Click **+** next to **Subscription Groups** → name it `Flexin Premium` → Create
4. Inside that group, click **+** next to **Subscriptions**
   - **Reference Name:** `Flexin Premium Monthly`
   - **Product ID:** `com.flexinapp.meditation.premium.monthly`
5. On the subscription detail page:
   - **Subscription Duration:** 1 Month
   - **Subscription Prices:** USD $6.99 (Tier select the row that shows $6.99)
   - **Localization (English U.S.):**
     - Display Name: `Flexin Premium`
     - Description: `Unlimited meditations, all 25 ranks, streak tracking, and your evolving monk companion. Cancel anytime.`
   - **Review Information → Screenshot:** upload `screenshots/screenshot_2_level456.png` (this is the paywall + unlocked dashboard screenshot)
   - **Review Notes:** `Reviewer can sign in with appreview@flexinapp.com / FlexinReview2026! — the test account is auto-granted premium for review purposes.`
6. **Subscription Introductory Offers** section → click **+**
   - **Type:** Free
   - **Duration:** 3 Days
   - **Eligibility:** New Subscribers
   - Click **Save**
7. Click **Save** at the top.

Status should now be **Ready to Submit** (with a yellow dot — that's expected pre-review).

## Step 2 — RevenueCat (free tier handles this fine)

1. Sign up at [RevenueCat](https://app.revenuecat.com/) (free up to $10K MTR)
2. Create a new **Project** named `Flexin`
3. Add an **App** → iOS → Bundle ID: `com.flexinapp.meditation`
4. RevenueCat will ask for an App Store Connect **Shared Secret**:
   - Back in App Store Connect → **Users and Access** → **Integrations** → **App-Specific Shared Secret** → generate and copy
   - Paste it into RevenueCat
5. In RevenueCat → **Products** → **+ New** → enter Product ID: `com.flexinapp.meditation.premium.monthly` → import from App Store
6. In RevenueCat → **Entitlements** → **+ New** → Identifier: `premium`
   - Attach the monthly product to this entitlement
7. In RevenueCat → **Offerings** → make sure the default offering is **`current`** and includes a **Monthly package** pointing to the product
8. Go to **API Keys** → copy the **Public iOS SDK Key** (starts with `appl_...`)

## Step 3 — Codemagic (inject the API key into the build)

1. Open Codemagic → your `flexinapp` workflow → **Environment variables**
2. Add a new variable:
   - **Name:** `VITE_REVENUECAT_IOS_KEY`
   - **Value:** paste the `appl_...` key from RevenueCat
   - **Secure:** ✅ checked
3. Save. Trigger a new build (push any commit or click Start new build).

## Step 4 — Sandbox testing on your iPhone (before submitting)

1. App Store Connect → **Users and Access** → **Sandbox** → **Testers** → **+** → add a test email (cannot be your real Apple ID; use something like `flexin.sandbox@gmail.com`)
2. On your iPhone, **Settings → App Store → Sandbox Account** → sign in with that sandbox tester
3. Install the latest TestFlight build of Flexin
4. Sign in inside the app → you'll be routed to the paywall
5. Tap **Start 3-day free trial** → Apple sandbox sheet appears → confirm
6. You should land on the dashboard with premium unlocked
7. Verify: kill app → reopen → still premium (entitlement persists)
8. Verify: tap **Restore purchase** on a fresh install — should restore premium

## Step 5 — Paid Apps Agreement (required to ship paid apps)

1. App Store Connect → **Business** (left sidebar)
2. Click **Agreements, Tax, and Banking**
3. Accept the **Paid Applications** agreement
4. Fill in:
   - **Bank account** (your business checking)
   - **Tax forms** (W-9 if US sole prop)
   - **Contact info** (3 contacts: business, legal, finance — can all be you)

Apple will NOT let you submit a paid app for review until this is fully accepted (green status on all rows).

## Step 6 — Submit for review

After all above is done:

1. App Store Connect → Flexin → **App Store** → **iOS App** → **+ Version** (1.0.0)
2. Under **In-App Purchases**, attach the monthly subscription
3. Upload screenshots from `/screenshots/` folder
4. Paste copy from `APP_STORE_LISTING.md`
5. Click **Submit for Review**

Expected review time: 24–48 hours.

---

## Code reference (already shipped)

- `client/src/lib/iap.ts` — RevenueCat init, purchase, restore, identify
- `client/src/pages/Paywall.tsx` — branches between iOS IAP and web Stripe
- `client/src/pages/Onboarding.tsx` — calls `identifyUser(email)` after login
- `client/src/App.tsx` — routes non-premium iOS users to `<Paywall>`
- `client/src/main.tsx` — calls `initRevenueCat()` on app start
- `codemagic.yaml` — passes `VITE_REVENUECAT_IOS_KEY` into the Vite build
