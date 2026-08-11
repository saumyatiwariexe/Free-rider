# Free-Rider Tracker
### Product Requirements Document
*NYC CodeQuest — Batch 4 Final Round | Track: HUMAN — Engineer for Human Behavior*

---

## 1. Overview

Free-Rider Tracker removes self-report from group-contribution tracking entirely. Members link the accounts they already use to do the work — **GitHub** for code, **Figma** for design, **Google Docs** for writing and planning — so contribution is measured wherever the work actually happened, not just in a repo. From that point on, the product never asks anyone to log, rate, or check in. When a group submits, the system snapshots every linked source and generates two things automatically: an updated **Individual Profile** for each member, and a **Group Insight Report** showing exactly how the work was actually distributed.

This also closes the biggest gap in commit-only tracking: a teammate who spent the project in Figma or a shared doc is invisible to a tool that only reads GitHub. Reading all three sources means "contribution" reflects the whole project, not just the parts that happen to leave a git history.

---

## 2. Goals & Success Metrics

- Prove contribution can be measured with zero ongoing input from any team member.
- Make linking effortless enough that it doesn't become its own source of friction (one-time, under a minute).
- Generate a report that is objective enough to end free-rider disputes rather than start new ones.

| Metric | Target for the 7-hour build |
|---|---|
| Accounts linked | Every team member links at least one of GitHub / Figma / Google Docs in under 60 seconds per source, no docs/instructions needed |
| Source coverage | A group's report reflects every source any member linked — a design-only contributor is never shown as a zero |
| Report generation time | Group Insight Report renders in under 5 seconds for a typical hackathon-sized repo |
| Accuracy sanity-check | Generated contribution split matches our own team's honest self-assessment within a reasonable margin |
| Zero ongoing input | No screen in the product ever asks a member to manually log or rate work |

---

## 3. Users & Personas

- **Contributor** — a student or team member who does real work and wants it recognized without having to self-promote or nag teammates.
- **Team Lead / Submitter** — the person who submits the group's work and triggers report generation.
- **Evaluator** (judge, professor, manager) — views the Group Insight Report to understand how work was actually distributed, without relying on team testimony.

---

## 4. Core User Flow

1. Sign up and link any combination of GitHub, Figma, and Google Docs — at least one required, all three supported from day one.
2. Individual Profile auto-populates with that person's activity across every source they linked — nothing to fill in manually.
3. Group forms automatically the first time a submission points at a shared repo, Figma file, or Google Doc; no manual invite step needed.
4. Work happens exactly as it normally would — commits, design edits, doc revisions — with no new tool or habit introduced.
5. At submission, the system snapshots every linked source (across all three providers) tied to that group.
6. The Group Insight Report renders: per-member contribution %, an activity timeline, and plain-language insights.
7. Each member's Individual Profile updates with this group's verified contribution history, reusable as a portfolio record.

---

## 5. Features & Requirements

Prioritized against the 7-hour build window:

| Priority | Feature | Scope |
|---|---|---|
| **P0** | Account creation + Clerk auth — GitHub sign-in, one-click, under 60 seconds | 7-hr MVP |
| **P0** | Source Adapter interface — one shared contract (`fetchEvents`, `normalize`) every source plugs into | 7-hr MVP |
| **P0** | GitHub adapter — pulls commits, lines changed, files touched per member | 7-hr MVP |
| **P0** | Figma adapter — pulls file version history and edits per member via the Figma API | 7-hr MVP |
| **P0** | Google Docs adapter — pulls revision history per member via the Drive API | 7-hr MVP |
| **P0** | Auto-detected group — group formed automatically from a repo's contributors / a file's editors | 7-hr MVP |
| **P0** | Individual Profile page — shows linked accounts + personal contribution history across all sources | 7-hr MVP |
| **P0** | Submission trigger — one action snapshots every linked source and freezes a report | 7-hr MVP |
| **P0** | Group Insight Report — contribution % per member per source, activity timeline, plain-language insights | 7-hr MVP |
| **P1** | Slack timestamp integration — adds communication/coordination activity as a signal | Stretch |
| **P1** | Perceived vs. actual comparison — shows self-reported effort next to observed activity | Stretch |
| **P1** | Cross-source weighting — lets a group weight code vs. design vs. writing differently | Stretch |
| **P2** | LMS / grading integration — pushes contribution data into a course gradebook | Future |
| **P2** | Task-weighted scoring — weighs contribution by complexity, not just volume | Future |
| **P2** | Gaming detection — flags suspicious patterns like commit-squashing to inflate share | Future |

---

## 6. Data Model

| Entity | Key fields | Notes |
|---|---|---|
| **User** | id, name, email, avatar_url | One record per person; created on first login |
| **LinkedAccount** | id, user_id, provider (`github` / `figma` / `google_docs`), external_id, access_token, linked_at | A user can hold one of each provider; tokens stored encrypted, scoped read-only |
| **Group** | id, name, source_refs (json: repo_url / figma_file_key / doc_id), created_at | Auto-created the first time a submission references any linked resource |
| **GroupMember** | group_id, user_id, joined_at | Derived automatically from contributors/editors across whichever sources the group uses |
| **ContributionEvent** | id, group_id, user_id, provider, type (commit / design_edit / doc_revision), timestamp, magnitude | Normalized record — every adapter maps its provider's native activity into this one shape |
| **Submission** | id, group_id, submitted_at, snapshot_ref | Triggers the pull + freeze of all ContributionEvents up to that moment |
| **InsightReport** | id, submission_id, per_member_share (json), timeline (json), narrative_insights (text[]) | Generated once per submission; cached for repeat viewing |

---

## 7. System Architecture

The architecture is deliberately built on managed services rather than hand-rolled infrastructure. Each service below replaces something that would normally take days of engineering (auth flows, queue infra, DB hosting, rate-limit handling) with an SDK call — that's what lets this look production-grade without a production-sized team or timeline.

| Layer | Service | What it replaces | Why it's still fast to build |
|---|---|---|---|
| Auth & sessions | **Clerk** | Custom OAuth flow, session storage, password/email handling | Pre-built sign-in component; drop-in, no auth code to write |
| Source data | **GitHub REST API** | Building a git activity parser from raw repo data | One authenticated GET per repo returns commits, diffs, contributors |
| Source data | **Figma REST API** | Parsing design file formats or diffing raw file data | `GET /files/:key` and `/versions` return a clean edit history per file, per user |
| Source data | **Google Drive API (Docs revisions)** | Parsing document formats or tracking edits manually | `revisions.list` returns a timestamped edit history per document, per editor |
| Event ingestion | **GitHub Webhooks → Vercel edge function** | Polling the GitHub API on a timer (slow, rate-limit-prone) | Webhooks push code events in real time; Figma/Docs are pulled on submission since they're lower-volume |
| Job queue | **Upstash QStash** | Self-hosted message broker (RabbitMQ/Kafka) | Serverless, HTTP-based queue — a few lines to publish and consume, with automatic retries |
| Caching | **Upstash Redis** | Custom rate-limit handling and response caching | One `set`/`get` call around each provider's API calls, avoids re-fetching the same data |
| Database | **Supabase (Postgres)** | Hosting/managing your own database server | Instant hosted Postgres with a dashboard, generated REST API, and auth-aware row-level security |
| Frontend + API | **Next.js on Vercel** | Separate frontend/backend deploys, manual server config | One repo, one push-to-deploy pipeline, API routes live next to the UI |
| Background processing | **Worker function (Vercel/QStash consumer)** | A dedicated always-on server for report generation | Runs only when triggered by the queue — no server to provision or babysit |

**The Source Adapter pattern — this is what makes three integrations as cheap as one.** Every provider (GitHub, Figma, Google Docs) implements the same two-function contract:

```
interface SourceAdapter {
  fetchRawActivity(linkedAccount): RawEvent[]   // one authenticated API call
  normalize(rawEvent): ContributionEvent         // map to the shared shape
}
```

The worker doesn't know or care which provider it's processing — it loops over every linked account, calls that provider's adapter, and writes the normalized `ContributionEvent` rows. Adding Figma or Google Docs isn't a new pipeline; it's a new ~40-line adapter file plugged into a pipeline that already exists. This is also the detail worth walking judges through — it reads as intentional architecture (an open, extensible integration layer), not three separate one-off integrations bolted together.

**Data flow:** each source (GitHub webhook, or a Figma/Docs pull triggered at submission) lands as a raw event → the matching adapter normalizes it → QStash queues the write → the worker persists it to Supabase (Redis-backed caching on every provider call) → the Next.js frontend (behind Clerk auth) reads live from Supabase to render the Individual Profile and Group Insight Report.

**Why this is genuinely easy to build in 7 hours:** none of these services require you to design or operate infrastructure — you're wiring together SDKs, not building systems. The complexity a judge *sees* (event-driven ingestion, three provider integrations, a queue, a cache, real auth) is complexity these services absorbed or the adapter pattern contained, not complexity your team has to write three times over.

---

## 8. Screens

- **Login / Landing** — one-click sign-in via Clerk, one-line explanation of what gets read and why.
- **Link Accounts** — three connect buttons (GitHub, Figma, Google Docs), each showing connected/not-connected state; no required fields to type, no source is mandatory beyond the first.
- **Individual Profile** — this member's contribution history across every group they've been part of.
- **Group Insight Report** — contribution breakdown, timeline chart, and narrative insights for the submitted group.

---

## 9. Non-Functional Requirements

- **Privacy:** read-only OAuth scopes only across all three providers (`repo:read` for GitHub, `file_read` for Figma, `drive.readonly`/`documents.readonly` for Google); the system reads metadata (timestamps, diff sizes, edit counts), not file or document contents; linking is opt-in and revocable per provider.
- **Performance:** report generation completes in under 5 seconds for a typical hackathon-sized repository.
- **Resilience:** if a source API is rate-limited or a member hasn't linked an account, the report still renders with a clear disclaimer on the gap rather than failing outright.

---

## 10. Risks & Assumptions

- Provider API rate limits (GitHub, Figma, or Google) could affect live report generation during judging — mitigated by the Redis caching layer on every provider call, shared across all three adapters.
- Google's OAuth consent screen requires either verification or an explicit test-user allowlist for non-published apps — add every team member and demo judge as a test user ahead of time so linking isn't blocked mid-demo.
- Figma's API returns file-level version history, not always a clean per-user diff size — the MVP adapter should count "versions saved" and "comments" as its magnitude signal rather than attempting pixel-level diffing.
- Combining three sources with different units (commits vs. design versions vs. doc revisions) makes raw totals hard to compare directly — the MVP should show each source's share separately in the report rather than forcing a single blended number; true cross-source weighting is P1.
- There is still a one-time linking step at signup per provider — this is accepted friction (identity/consent), distinct from the ongoing self-report friction the product is designed to eliminate.

---

## 11. 7-Hour Build Roadmap

The adapter pattern is what makes this parallelizable — once the shared contract and skeleton exist, each source can be built by a different teammate at the same time.

| Time block | Track A (lead) | Track B | Track C | Shared |
|---|---|---|---|---|
| Hr 0 – 1 | Project scaffold, Clerk auth, Supabase schema, `SourceAdapter` interface | Set up Figma dev account + API token | Set up Google Cloud project + OAuth consent (test users) | — |
| Hr 1 – 3 | GitHub adapter (webhook + REST fallback) | Figma adapter (`/files`, `/versions`) | Google Docs adapter (`revisions.list`) | Everyone normalizes into the same `ContributionEvent` shape |
| Hr 3 – 4 | Worker: consumes queue, writes normalized events | Wire Figma adapter into worker | Wire Google Docs adapter into worker | Group auto-detection across all three source types |
| Hr 4 – 5.5 | Group Insight Report UI (per-source breakdown + timeline) | Individual Profile UI | Link Accounts screen (3 connect buttons) | Merge branches |
| Hr 5.5 – 7 | Test end-to-end on our own repo, Figma file, and shared doc | Bug fixes from integration testing | Bug fixes from integration testing | Final polish + demo run-through |

---

## 12. Out of Scope (for this build)

- Grading/LMS integration.
- Weighting contribution by task difficulty or code/design/writing quality.
- Detecting deliberate gaming of the metric (e.g., trivial commits or throwaway comments to inflate count).
- Sources beyond GitHub, Figma, and Google Docs (Slack, Notion, Jira, etc.) within the 7-hour window.
- Blending code, design, and writing activity into one single cross-source score — each source reports its own share; unified weighting is P1.
