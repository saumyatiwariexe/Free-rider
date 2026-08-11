/**
 * SourceAdapter interface — the shared contract every provider implements.
 *
 * FROZEN after Phase 2. Changes require a team check — every adapter depends on this.
 *
 * Rules:
 *  - `fetchRawActivity` must never throw. Return [] on any error.
 *  - All provider responses must be Redis-cached (TTL: 5 min).
 *  - `normalize` maps one RawEvent → one ContributionEvent (pure function, no I/O).
 */

export type Provider = 'github' | 'figma' | 'google_docs';
export type EventType = 'commit' | 'design_edit' | 'doc_revision';

/** Raw event as returned by the provider's API — shape varies per provider */
export interface RawEvent {
  externalId: string;          // provider's native ID (SHA, version ID, revision ID)
  timestamp: string;           // ISO 8601
  actorExternalId: string;     // provider's user identifier (login, user_id, email)
  actorDisplayName?: string;   // human-readable name if available
  magnitude: number;           // lines changed / versions / revisions
  type: EventType;
  meta?: Record<string, unknown>; // provider-specific extras
}

/** Normalized event — written to contribution_events table */
export interface ContributionEvent {
  provider: Provider;
  type: EventType;
  timestamp: Date;
  magnitude: number;
  rawRef: string;              // = RawEvent.externalId
  actorExternalId: string;
  actorDisplayName?: string;
}

/** Options passed to fetchRawActivity */
export interface FetchOptions {
  accessToken: string;
  /**
   * Provider-specific resource identifier:
   *  - GitHub:      "owner/repo" or "https://github.com/owner/repo"
   *  - Figma:       file key (e.g. "abc123XYZ")
   *  - Google Docs: document ID (e.g. "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms")
   */
  sourceRef: string;
  /** Only fetch events after this timestamp (optional) */
  since?: Date;
}

export interface SourceAdapter {
  readonly provider: Provider;
  fetchRawActivity(opts: FetchOptions): Promise<RawEvent[]>;
  normalize(raw: RawEvent): ContributionEvent;
}
