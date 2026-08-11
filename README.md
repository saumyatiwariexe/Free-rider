# Free Rider

Live: https://free-rider-irrp.vercel.app

Automatic contribution tracking for group work. No self-report. No check-ins. No forms.

Members link the accounts they already use to do the work — GitHub for code, Figma for design, Google Docs for writing — and the system reads what actually happened at submission time. The result is an objective Group Insight Report showing per-member contribution percentages, an activity timeline, and plain-language insights.

Built for NYC CodeQuest Batch 4, Track: HUMAN — Engineer for Human Behavior.

---

## The Problem

Group work runs on a broken assumption: that every member will honestly report what they contributed. That assumption fails constantly — not because people are dishonest, but because self-report is friction, and friction is what gets skipped first under deadline pressure.

Every existing fix (peer evaluation forms, task boards, status-check bots) makes the same mistake: it asks people to behave differently. Free Rider assumes they won't, and designs around that instead by reading the one signal that is not self-reported: the work itself, as it was actually done.

---

## Tech Stack

| Layer | Service |
|---|---|
| Framework | Next.js 16 (App Router) on Vercel |
| Auth | Clerk (GitHub sign-in, session management) |
| Database | Supabase (Postgres) |
| Cache | Upstash Redis |
| Job Queue | Upstash QStash |
| Source: Code | GitHub REST API |
| Source: Design | Figma REST API |
| Source: Docs | Google Drive API (revisions) |
| Styling | Tailwind CSS v4, Radix UI primitives |

---

## Architecture

All three data sources plug into the same two-function contract:

```
interface SourceAdapter {
  fetchRawActivity(linkedAccount): RawEvent[]
  normalize(rawEvent): ContributionEvent
}
```

Adding a new source is a single adapter file. The worker does not know or care which provider it is reading — it runs the matching adapter, normalizes the output into a shared `ContributionEvent` shape, and writes to Supabase.

**Data flow:**
GitHub webhook or Figma/Docs pull at submission time → adapter normalizes → QStash queues write → worker persists to Supabase (Redis cache on every provider call) → Next.js frontend reads from Supabase to render the dashboard and report.

---

## Screens

- `/` — Landing page
- `/sign-in` and `/sign-up` — Clerk-hosted auth flows
- `/dashboard` — Member's linked accounts and the "Run Group Insight" trigger
- `/link-accounts` — Connect GitHub, Figma, and/or Google Docs
- `/report/[submissionId]` — Group Insight Report (contribution breakdown, timeline, insights)

---

## Local Setup

### Prerequisites

- Node.js 20+
- A Clerk account with a GitHub OAuth app configured
- A Supabase project with the schema applied (see `supabase/migrations/`)
- An Upstash Redis database
- An Upstash QStash account (optional for local dev — worker can be triggered manually)

### Steps

1. Clone the repository and install dependencies:

```
npm install
```

2. Copy the example environment file and fill in all values:

```
cp .env.local.example .env.local
```

3. Apply the database migrations in your Supabase project. Run each file in `supabase/migrations/` in order via the Supabase SQL editor or the CLI.

4. Start the dev server:

```
npm run dev
```

The app runs at `http://localhost:3000`.

### Environment Variables

See `.env.local.example` for the full list with descriptions. The required variables to get the app running locally are:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` — from the Clerk dashboard
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` — from Supabase project settings
- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` — from Upstash
- `ENCRYPTION_KEY` — a 64-character hex string (generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
- `GITHUB_TOKEN` — a classic personal access token used as a server-side fallback for the GitHub adapter

---

## What is Working

- Clerk authentication with GitHub sign-in (one-click, redirects to dashboard on success)
- Clerk webhook at `/api/webhooks/clerk` auto-creates a user row in Supabase on sign-up
- Dashboard page loads linked accounts and shows which sources are connected
- Link Accounts page with connect buttons for all three providers
- GitHub account linking — pulls the OAuth token Clerk negotiated during sign-in and stores it encrypted; falls back to a server-side personal access token if the Clerk OAuth token is unavailable
- GitHub adapter reads commits, lines changed, and files touched per contributor from the repository
- Figma adapter reads file version history per user when OAuth credentials are configured; falls back to a dummy/stub token for local dev
- Google Docs adapter reads revision history per editor when OAuth credentials are configured; falls back to a dummy token for local dev
- Worker endpoint (`POST /api/worker/process`) runs all adapters, normalizes events into `ContributionEvent` rows, auto-detects unlinked contributors, and generates the InsightReport
- Report page renders contribution percentages per member per source, an activity timeline, and plain-language insights
- Upstash Redis caching wraps every provider API call to avoid re-fetching within a session
- QStash job queue wires submission creation to the worker asynchronously when `WORKER_URL` is set; falls back to manual trigger if not

---

## What is Not Working

**Figma OAuth in production**
Figma OAuth requires a correctly registered OAuth App with an approved redirect URI. Without `FIGMA_CLIENT_ID`, `FIGMA_CLIENT_SECRET`, and `FIGMA_REDIRECT_URI` set, the link flow falls back to storing a dummy token that will not actually authenticate against the Figma API. Real Figma activity will not appear in reports unless the OAuth app is registered and those variables are configured.

**Google Docs OAuth in production**
Google's OAuth consent screen requires either app verification by Google or an explicit allowlist of test users before anyone outside the team can link their account. Without this, the Google authorization page will show an "app not verified" warning and most users will be blocked. The same fallback-to-dummy-token behavior applies if `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI` are missing.

**GitHub real token extraction**
The GitHub link flow calls `clerkClient().users.getUserOauthAccessToken()` to retrieve the GitHub token that Clerk negotiated at sign-in. This only returns a real token if the Clerk application is configured with GitHub as an OAuth Social Connection and the user signed in via GitHub. If the user signed in via email, this call returns nothing and the system falls back to the server-side `GITHUB_TOKEN` variable, which is a single shared token rather than the user's personal token. Commit attribution will still work (the REST API identifies authors by username, not by who is calling the API), but the `external_id` stored in `linked_accounts` will be the username prefix of the user's email rather than their actual GitHub username, which may cause contributor matching issues across reports.

**QStash for local development**
QStash requires a public HTTPS URL to deliver jobs to the worker. In local development without a tunnel (ngrok or similar), `WORKER_URL` will not be set and job queuing is skipped. The submission is created in Supabase but the worker does not run automatically. To trigger it manually, make a POST request directly to `http://localhost:3000/api/worker/process` with the `submission_id` and `group_id` from the submission response.

**Figma data granularity**
The Figma API returns file-level version history, not a per-user diff size or pixel-level contribution measure. The adapter counts "versions saved" per user as the magnitude signal. This is a less precise measure than GitHub's line counts. Comment activity is not currently included in the magnitude calculation.

**Cross-source contribution weighting**
Contribution percentages are calculated per source independently (GitHub share, Figma share, Docs share) and displayed separately. There is no blended cross-source score. A member who only worked in Figma will show 0% on GitHub and 100% on Figma, not a unified total. Unified weighting that lets a group balance code vs. design vs. writing is not built.

**Group Insight `/dashboard/new` flow**
The "Run Group Insight" button on the dashboard links to `/dashboard/new`. That page is not yet built. The submission API (`POST /api/submissions`) is complete and functional, but there is no UI form for entering a repo URL, Figma file key, or Google Doc ID and triggering a submission.

---

## API Reference

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/link/github` | Link GitHub account (pulls token from Clerk) |
| `GET` | `/api/link/figma` | Initiate Figma OAuth or apply dummy fallback |
| `GET` | `/api/link/figma?code=...` | Figma OAuth callback — exchange code for token |
| `GET` | `/api/link/google` | Initiate Google OAuth or apply dummy fallback |
| `GET` | `/api/link/google?code=...` | Google OAuth callback — exchange code for token |
| `POST` | `/api/submissions` | Create submission and queue worker job |
| `POST` | `/api/worker/process` | Worker — runs adapters, stores events, generates report |
| `POST` | `/api/webhooks/clerk` | Clerk webhook — creates user row on sign-up |
| `GET` | `/api/health` | Health check |

---

## Project Structure

```
src/
  adapters/
    github.ts         GitHub source adapter
    figma.ts          Figma source adapter
    google_docs.ts    Google Docs source adapter
    types.ts          Shared SourceAdapter interface and event types
  app/
    (dashboard)/
      dashboard/      Dashboard page
      link-accounts/  Integration connect page
      report/         Group Insight Report page
    api/
      link/           OAuth link routes (GitHub, Figma, Google)
      submissions/    Submission creation
      worker/         QStash consumer worker
      webhooks/       Clerk webhook handler
    page.tsx          Landing page
  components/
    ui/
      landing-hero.tsx
      features-detail.tsx
      navbar.tsx
  lib/
    supabase.ts       Supabase admin client
    redis.ts          Upstash Redis helpers
    qstash.ts         QStash publish helper
    crypto.ts         AES-256 token encryption/decryption
    report.ts         Report generation logic
  types/
    db.ts             Supabase table types
supabase/
  migrations/         SQL schema files (apply in order)
```
