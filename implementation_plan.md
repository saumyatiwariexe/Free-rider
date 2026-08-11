# Free-Rider Tracker — Phase-Wise Implementation Rulebook
*NYC CodeQuest — Batch 4 | Track: HUMAN — Engineer for Human Behavior*

> [!IMPORTANT]
> **UI is deferred.** Every phase below is purely backend/logic work. No styling, no frontend polish. UI phase is last, gated by all prior phases passing.

---

## Ground Rules (Always Active)

1. **One phase at a time.** Do not start Phase N+1 until Phase N's exit criteria are all checked.
2. **Every adapter must implement the same `SourceAdapter` interface.** No one-off integrations.
3. **No secrets in code.** All API keys, tokens, DB urls → `.env.local` only.
4. **No manual logging from the user.** If a feature requires a user to "enter" or "rate" something beyond initial OAuth link, it is out of scope.
5. **Graceful degradation always.** If a provider call fails or a member hasn't linked an account, the system must still render a partial report — never crash.
6. **Feature flags for stretch goals.** P1/P2 features get a `FEATURE_*` env flag; they don't ship by default.
7. **Commit after every phase exit.** Each phase ends with a clean git commit.

---

## Tech Stack (Locked)

| Layer | Tool | Notes |
|---|---|---|
| Framework | Next.js 14+ (App Router) | API routes + frontend in one repo |
| Auth | Clerk | GitHub OAuth, session handling |
| Database | Supabase (Postgres) | Row-level security, hosted |
| Queue | Upstash QStash | Serverless job queue |
| Cache | Upstash Redis | Per-provider response cache |
| Deploy | Vercel | Push-to-deploy |
| Language | TypeScript (strict mode) | No `any` allowed |

---

## Phase 0 — Project Scaffold & Environment
**Goal:** A runnable, deployable skeleton. No features yet.

### Rules
- Run `npx create-next-app@latest ./ --typescript --app --no-tailwind --eslint --src-dir` in the project root.
- Install only these dependencies in this phase: `@clerk/nextjs`, `@supabase/supabase-js`, `@upstash/redis`, `@upstash/qstash`.
- Create `.env.local.example` with every key the project will need (values blank).
- Set up Clerk middleware (`middleware.ts`) protecting all routes except `/` and `/sign-in`.
- Set up Supabase client singleton (`src/lib/supabase.ts`).
- Set up Redis client singleton (`src/lib/redis.ts`).
- Set up QStash client singleton (`src/lib/qstash.ts`).

### Files Created This Phase
```
src/
  lib/
    supabase.ts
    redis.ts
    qstash.ts
  middleware.ts
.env.local.example
```

### Exit Criteria (all must pass before Phase 1)
- [ ] `npm run dev` starts without errors.
- [ ] Clerk sign-in flow works end-to-end (redirects, session persists).
- [ ] Supabase connection verified (can run a raw query from a test API route).
- [ ] `.env.local.example` has entries for all 8+ secrets needed across the full build.
- [ ] No `any` TypeScript errors in `npm run build`.

---

## Phase 1 — Database Schema & Data Model
**Goal:** Full Supabase schema matching the PRD's data model, applied via SQL migration.

### Rules
- Every table must have Row-Level Security (RLS) enabled.
- `access_token` on `linked_accounts` must be stored encrypted (use Supabase Vault or a server-side encrypt/decrypt util — never plaintext).
- All foreign keys enforced at the DB level.
- Create a `src/types/db.ts` file with TypeScript types matching every table shape.

### Schema (exact table definitions)

```sql
-- Users (created on first Clerk sign-in via webhook)
create table users (
  id uuid primary key default gen_random_uuid(),
  clerk_id text unique not null,
  name text,
  email text,
  avatar_url text,
  created_at timestamptz default now()
);

-- Linked OAuth accounts (one per provider per user)
create table linked_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  provider text check (provider in ('github','figma','google_docs')) not null,
  external_id text not null,
  access_token_enc text not null,   -- encrypted
  linked_at timestamptz default now(),
  unique(user_id, provider)
);

-- Groups (auto-created from submission; no manual invite)
create table groups (
  id uuid primary key default gen_random_uuid(),
  name text,
  source_refs jsonb not null default '{}',  -- {repo_url?, figma_file_key?, doc_id?}
  created_at timestamptz default now()
);

-- Group membership (derived from contributor/editor lists)
create table group_members (
  group_id uuid references groups(id) on delete cascade,
  user_id  uuid references users(id) on delete cascade,
  joined_at timestamptz default now(),
  primary key (group_id, user_id)
);

-- Normalized contribution events (one row per unit of work)
create table contribution_events (
  id uuid primary key default gen_random_uuid(),
  group_id  uuid references groups(id) on delete cascade,
  user_id   uuid references users(id) on delete cascade,
  provider  text check (provider in ('github','figma','google_docs')) not null,
  type      text not null,  -- 'commit' | 'design_edit' | 'doc_revision'
  timestamp timestamptz not null,
  magnitude numeric not null default 1,  -- lines changed / versions / revisions
  raw_ref   text,           -- original event ID from the provider
  created_at timestamptz default now()
);

-- Submissions (triggers the snapshot + report)
create table submissions (
  id uuid primary key default gen_random_uuid(),
  group_id     uuid references groups(id) on delete cascade,
  submitted_at timestamptz default now(),
  snapshot_ref text
);

-- Insight reports (one per submission, cached)
create table insight_reports (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid references submissions(id) on delete cascade unique,
  per_member_share jsonb not null default '{}',
  timeline         jsonb not null default '[]',
  narrative_insights text[] not null default '{}',
  generated_at timestamptz default now()
);
```

### Exit Criteria (all must pass before Phase 2)
- [ ] All migrations applied successfully in Supabase dashboard.
- [ ] RLS enabled on all 7 tables (verified in Supabase).
- [ ] `src/types/db.ts` exports a TypeScript interface for each table row.
- [ ] Insert/select can be run from a test API route for `users` and `linked_accounts`.
- [ ] `access_token_enc` does NOT store a raw token in any test run.

---

## Phase 2 — Source Adapter Interface + GitHub Adapter
**Goal:** The `SourceAdapter` contract in code, plus a fully working GitHub adapter that can pull real commit data.

### Rules
- The interface lives in `src/adapters/types.ts`. It must not be changed after this phase without a team check — it's the contract every adapter depends on.
- The GitHub adapter is the first and most important. It must handle pagination.
- Cache every provider response in Redis with a TTL of 5 minutes (`EX 300`).
- Normalize GitHub commits into `ContributionEvent` shape — `magnitude` = lines changed (`additions + deletions`).
- The adapter must not throw. On any API error, log and return an empty array.

### Interface (exact shape)

```typescript
// src/adapters/types.ts
export interface RawEvent {
  externalId: string;
  timestamp: string;       // ISO 8601
  actorExternalId: string; // provider's user ID
  magnitude: number;
  type: string;
  meta?: Record<string, unknown>;
}

export interface ContributionEvent {
  provider: 'github' | 'figma' | 'google_docs';
  type: string;
  timestamp: Date;
  magnitude: number;
  rawRef: string;
  actorExternalId: string;
}

export interface SourceAdapter {
  provider: 'github' | 'figma' | 'google_docs';
  fetchRawActivity(opts: {
    accessToken: string;
    sourceRef: string;       // repo_url | figma_file_key | doc_id
    since?: Date;
  }): Promise<RawEvent[]>;
  normalize(raw: RawEvent): ContributionEvent;
}
```

### Files Created This Phase
```
src/
  adapters/
    types.ts
    github.ts
    figma.ts      (stub — interface only, throws NotImplemented)
    google_docs.ts (stub — interface only, throws NotImplemented)
```

### Exit Criteria (all must pass before Phase 3)
- [ ] `github.ts` implements `SourceAdapter` exactly (TypeScript must compile).
- [ ] Running a test against a real public repo returns normalized `ContributionEvent[]`.
- [ ] Redis cache hit confirmed on a second call (log cache HIT vs MISS).
- [ ] Figma and Google Docs stubs compile and satisfy the interface (even if they return `[]`).
- [ ] No `any` types in any adapter file.

---

## Phase 3 — Figma & Google Docs Adapters
**Goal:** Replace the two stubs with real API calls. After this phase all three adapters are live.

### Rules
- **Figma:** Use `GET /v1/files/:key/versions` for edit history. Each version entry = one `design_edit` event. `magnitude` = 1 per version (pixel-precise diffing is out of scope; count versions + comments as signal).
- **Google Docs:** Use `drive.revisions.list` for revision history. Each revision = one `doc_revision` event. `magnitude` = 1 per revision (byte size available in the API; treat it as a bonus signal if you have time).
- Both adapters must be Redis-cached identically to GitHub (TTL 5 min).
- Both adapters must implement error suppression (return `[]` on any failure).
- OAuth tokens for Figma and Google are obtained at link-time (Phase 4) — for testing in this phase, use a personal API token / service account.

### Files Modified This Phase
```
src/adapters/figma.ts       → full implementation
src/adapters/google_docs.ts → full implementation
```

### Exit Criteria (all must pass before Phase 4)
- [ ] Figma adapter returns real version events for a test file.
- [ ] Google Docs adapter returns real revision events for a test doc.
- [ ] Both adapters return `[]` gracefully when given a bad token (no unhandled rejection).
- [ ] Redis cache confirmed live for both adapters.
- [ ] `npm run build` passes with zero TypeScript errors.

---

## Phase 4 — Auth Linking Flow + User/Group Ingestion
**Goal:** Users can connect GitHub, Figma, and Google Docs. The system stores linked accounts and resolves group membership automatically.

### Rules
- Use Clerk's OAuth connection for GitHub (primary auth). Figma and Google Docs are **additional** links stored in `linked_accounts`, each independently revocable.
- On first Clerk sign-in, fire a Clerk webhook → `/api/webhooks/clerk` → upsert a `users` row.
- When a user links Figma or Google Docs, store the encrypted access token in `linked_accounts`.
- **Group auto-detection:** when a submission comes in referencing a `repo_url`, `figma_file_key`, or `doc_id`, query each provider's contributor/editor list and upsert matching `users` + `group_members` rows. Members who haven't signed up yet get a placeholder that resolves when they do.
- All `/api/*` routes are protected by Clerk `auth()` — no unauthenticated access.

### API Routes Created This Phase
```
POST /api/webhooks/clerk           → upsert user on sign-up
POST /api/link/figma               → store Figma OAuth token
POST /api/link/google              → store Google OAuth token
DELETE /api/link/:provider         → revoke a linked account
POST /api/groups/detect            → given source refs, auto-detect group + members
```

### Exit Criteria (all must pass before Phase 5)
- [ ] New Clerk sign-up creates a `users` row in Supabase.
- [ ] Figma link flow stores an encrypted token in `linked_accounts`.
- [ ] Google link flow stores an encrypted token in `linked_accounts`.
- [ ] Revoking a link deletes the row and the Redis-cached token.
- [ ] `POST /api/groups/detect` given a real repo URL returns a `groups` + `group_members` record.

---

## Phase 5 — Event Pipeline: Submission → Queue → Worker → Report
**Goal:** The full async pipeline. One submission trigger kicks off data ingestion across all linked sources and produces a persisted `InsightReport`.

### Rules
- **Submission endpoint** (`POST /api/submissions`) does only one thing: validates the request, creates a `submissions` row, and publishes a job to QStash. It returns immediately (< 200ms).
- **Worker endpoint** (`POST /api/worker/process`) is the QStash consumer. It:
  1. Reads all `linked_accounts` for every `group_member`.
  2. For each account, calls the matching adapter's `fetchRawActivity`.
  3. Writes all normalized `ContributionEvent` rows to Supabase (batch insert).
  4. Calls `generateReport()` on the resulting events.
  5. Writes the `InsightReport` row.
- **Report generation** (`src/lib/report.ts`):
  - Per-member, per-source contribution % (share of magnitude within that source).
  - Timeline: bucket events by day, per member per source.
  - Narrative insights: ≥ 3 plain-language strings (e.g., *"Alex contributed 60% of all commits in the final 12 hours"*). Logic only — no LLM in MVP.
- Worker must be idempotent: if called twice for the same `submission_id`, it skips re-processing.
- If any single adapter call fails, log the error and continue — partial data is better than no report.

### Files Created This Phase
```
src/
  app/api/
    submissions/route.ts
    worker/process/route.ts
  lib/
    report.ts
```

### Exit Criteria (all must pass before Phase 6 / UI)
- [ ] `POST /api/submissions` returns in < 200ms and creates a DB row.
- [ ] QStash delivers the job to the worker endpoint (verify via QStash dashboard).
- [ ] Worker writes ≥ 1 `ContributionEvent` row for a real test submission.
- [ ] `insight_reports` row exists after worker completes with valid `per_member_share`, `timeline`, and `narrative_insights`.
- [ ] Running the same submission twice does not double-write events.
- [ ] `GET /api/reports/:submissionId` returns the cached report (or 202 if still processing).

---

## Phase 6 — UI (Deferred, Gated by Phase 5 Exit)

> [!NOTE]
> UI work begins **only after all Phase 5 exit criteria are verified**. The screens are:
> 1. **Login / Landing** — Clerk sign-in, one-line value prop.
> 2. **Link Accounts** — Three connect buttons (GitHub / Figma / Google Docs), connected state per source.
> 3. **Individual Profile** — This member's contribution history across all groups.
> 4. **Group Insight Report** — Per-source contribution %, timeline chart, narrative insights.

UI aesthetics and implementation details will be planned separately in a UI implementation doc.

---

## Verification Plan

| Phase | How we verify |
|---|---|
| 0 | `npm run dev` + Clerk sign-in flow |
| 1 | Supabase dashboard schema view + test API route |
| 2 | Test script against a real public GitHub repo |
| 3 | Test scripts against a real Figma file + Google Doc |
| 4 | End-to-end OAuth link flow + group detection test |
| 5 | Full submission run on our own team's repo/file/doc; compare report to self-assessment |

---

## Open Questions

> [!IMPORTANT]
> These need answers before Phase 3/4 begin:
> 1. **Figma API access** — Do we have a Figma developer account and a test file ready?
> 2. **Google Cloud project** — Has the OAuth consent screen been configured? Are all team members added as test users (required for unpublished apps)?
> 3. **Supabase Vault** — Are we using Supabase Vault for token encryption, or a custom AES util? (Decision affects Phase 1 schema.)
> 4. **Vercel deployment** — Is there a Vercel project linked to this repo already, or do we set that up in Phase 0?
