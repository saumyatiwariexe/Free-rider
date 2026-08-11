/**
 * TypeScript types matching every Supabase table row.
 * Generated to match the Phase 1 schema in supabase/migrations/001_initial_schema.sql
 *
 * Conventions:
 *  - `Row`    = data returned from SELECT
 *  - `Insert` = data required for INSERT (optional fields have `?`)
 *  - `Update` = data for UPDATE (all fields optional)
 */

// ── users ────────────────────────────────────────────────────

export interface UserRow {
  id: string;
  clerk_id: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface UserInsert {
  id?: string;
  clerk_id: string;
  name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  created_at?: string;
}

export interface UserUpdate {
  name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
}

// ── linked_accounts ──────────────────────────────────────────

export type Provider = 'github' | 'figma' | 'google_docs';

export interface LinkedAccountRow {
  id: string;
  user_id: string;
  provider: Provider;
  external_id: string;
  access_token_enc: string;  // AES-256-GCM encrypted; decrypt with src/lib/crypto.ts
  linked_at: string;
}

export interface LinkedAccountInsert {
  id?: string;
  user_id: string;
  provider: Provider;
  external_id: string;
  access_token_enc: string;
  linked_at?: string;
}

// ── groups ───────────────────────────────────────────────────

export interface SourceRefs {
  repo_url?: string;
  figma_file_key?: string;
  doc_id?: string;
}

export interface GroupRow {
  id: string;
  name: string | null;
  source_refs: SourceRefs;
  created_at: string;
}

export interface GroupInsert {
  id?: string;
  name?: string | null;
  source_refs: SourceRefs;
  created_at?: string;
}

// ── group_members ────────────────────────────────────────────

export interface GroupMemberRow {
  group_id: string;
  user_id: string;
  joined_at: string;
}

export interface GroupMemberInsert {
  group_id: string;
  user_id: string;
  joined_at?: string;
}

// ── contribution_events ──────────────────────────────────────

export type EventType = 'commit' | 'design_edit' | 'doc_revision';

export interface ContributionEventRow {
  id: string;
  group_id: string;
  user_id: string;
  provider: Provider;
  type: EventType;
  timestamp: string;
  magnitude: number;
  raw_ref: string | null;
  created_at: string;
}

export interface ContributionEventInsert {
  id?: string;
  group_id: string;
  user_id: string;
  provider: Provider;
  type: EventType;
  timestamp: string;
  magnitude: number;
  raw_ref?: string | null;
  created_at?: string;
}

// ── submissions ──────────────────────────────────────────────

export interface SubmissionRow {
  id: string;
  group_id: string;
  submitted_at: string;
  snapshot_ref: string | null;
}

export interface SubmissionInsert {
  id?: string;
  group_id: string;
  submitted_at?: string;
  snapshot_ref?: string | null;
}

// ── insight_reports ──────────────────────────────────────────

/** Per-source contribution share for one member */
export interface MemberShare {
  github?: number;    // 0–1, fraction of total github magnitude
  figma?: number;
  google_docs?: number;
}

/** { [userId]: MemberShare } */
export type PerMemberShare = Record<string, MemberShare>;

/** One day-bucket in the timeline */
export interface TimelineBucket {
  date: string;       // ISO date string YYYY-MM-DD
  events: {
    user_id: string;
    provider: Provider;
    count: number;
    magnitude: number;
  }[];
}

export interface InsightReportRow {
  id: string;
  submission_id: string;
  per_member_share: PerMemberShare;
  timeline: TimelineBucket[];
  narrative_insights: string[];
  generated_at: string;
}

export interface InsightReportInsert {
  id?: string;
  submission_id: string;
  per_member_share: PerMemberShare;
  timeline: TimelineBucket[];
  narrative_insights: string[];
  generated_at?: string;
}
