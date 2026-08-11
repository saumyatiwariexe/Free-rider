/**
 * Google Docs Source Adapter — STUB (Phase 3 implementation)
 *
 * Implements the SourceAdapter interface but returns [] until Phase 3.
 * Compiles and satisfies the contract — the worker loop can call it safely.
 */

import type { RawEvent, ContributionEvent, FetchOptions, SourceAdapter } from './types';

export const GoogleDocsAdapter: SourceAdapter = {
  provider: 'google_docs',

  async fetchRawActivity(_opts: FetchOptions): Promise<RawEvent[]> {
    console.log('[GoogleDocs] adapter stub — not yet implemented (Phase 3)');
    return [];
  },

  normalize(raw: RawEvent): ContributionEvent {
    return {
      provider: 'google_docs',
      type: 'doc_revision',
      timestamp: new Date(raw.timestamp),
      magnitude: raw.magnitude,
      rawRef: raw.externalId,
      actorExternalId: raw.actorExternalId,
      actorDisplayName: raw.actorDisplayName,
    };
  },
};
