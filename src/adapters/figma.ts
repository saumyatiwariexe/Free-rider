/**
 * Figma Source Adapter — Full Implementation (Phase 3)
 *
 * Fetches file version history from the Figma REST API.
 *
 * - sourceRef: Figma file key (e.g. "abc123XYZ")
 *   Extract from a Figma file URL: figma.com/file/{FILE_KEY}/...
 * - provider auth: personal access token OR OAuth Bearer token
 * - magnitude: 1 per version saved (pixel-level diffing is out of scope per PRD)
 * - Cache: Redis, TTL 5 min
 * - Error handling: always returns [] on failure
 *
 * API docs: https://www.figma.com/developers/api#version-get
 */

import type { RawEvent, ContributionEvent, FetchOptions, SourceAdapter } from './types';
import { cacheGet, cacheSet } from '@/lib/redis';

const FIGMA_API = 'https://api.figma.com';

// ── Figma API types ─────────────────────────────────────────

interface FigmaUser {
  id: string;
  handle: string;   // display name / username
  img_url?: string;
}

interface FigmaVersion {
  id: string;
  created_at: string;   // ISO 8601
  label: string | null; // user-set label (often null for auto-saves)
  description: string | null;
  user: FigmaUser;
}

interface FigmaVersionsResponse {
  versions: FigmaVersion[];
}

// ── Helpers ────────────────────────────────────────────────

function figmaHeaders(accessToken: string): HeadersInit {
  // Figma supports both personal access tokens (X-Figma-Token) and OAuth (Bearer)
  // Personal tokens are prefixed with "figd_", OAuth tokens are longer JWTs
  const isPersonalToken = accessToken.startsWith('figd_') || !accessToken.startsWith('ey');
  return isPersonalToken
    ? { 'X-Figma-Token': accessToken }
    : { Authorization: `Bearer ${accessToken}` };
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchAllVersions(
  fileKey: string,
  accessToken: string,
  since?: Date
): Promise<FigmaVersion[]> {
  const headers = figmaHeaders(accessToken);
  const allVersions: FigmaVersion[] = [];
  const MAX_PAGES = 5;       // cap at 5 pages × 30 = 150 versions
  const FETCH_TIMEOUT_MS = 8000; // abort individual Figma API calls after 8s

  // Figma versions API: paginated via `before` cursor (returns newest first)
  let cursor: string | undefined;

  for (let page = 0; page < MAX_PAGES; page++) {
    const params = new URLSearchParams({ page_size: '30' });
    if (cursor) params.set('before', cursor);

    let res: Response;
    try {
      res = await fetchWithTimeout(
        `${FIGMA_API}/v1/files/${fileKey}/versions?${params}`,
        { headers },
        FETCH_TIMEOUT_MS
      );
    } catch (err) {
      console.error(`[Figma] fetch timed out or failed on page ${page + 1}:`, err);
      break;
    }

    if (!res.ok) {
      const body = await res.text();
      console.error(`[Figma] versions fetch failed: ${res.status} — ${body}`);
      break;
    }

    const data: FigmaVersionsResponse = await res.json();
    const versions = data.versions ?? [];

    let reachedSince = false;
    for (const v of versions) {
      if (since && new Date(v.created_at) < since) {
        reachedSince = true;
        break;
      }
      allVersions.push(v);
    }

    if (reachedSince || versions.length < 30) break;

    // Set cursor for next page (oldest version ID from this page)
    cursor = versions[versions.length - 1]?.id;
    if (!cursor) break;
  }

  return allVersions;
}

// ── Adapter ────────────────────────────────────────────────

export const FigmaAdapter: SourceAdapter = {
  provider: 'figma',

  async fetchRawActivity(opts: FetchOptions): Promise<RawEvent[]> {
    const { accessToken, sourceRef, since } = opts;

    try {
      const fileKey = sourceRef.trim();
      const cacheKey = `figma:versions:${fileKey}:${since?.toISOString() ?? 'all'}`;

      const cached = await cacheGet<RawEvent[]>(cacheKey);
      if (cached !== null) {
        console.log(`[Figma] cache HIT — ${cacheKey}`);
        return cached;
      }

      console.log(`[Figma] cache MISS — fetching file ${fileKey}`);
      const versions = await fetchAllVersions(fileKey, accessToken, since);

      if (versions.length === 0) return [];

      const rawEvents: RawEvent[] = versions.map((v) => ({
        externalId: v.id,
        timestamp: v.created_at,
        actorExternalId: v.user.id,
        actorDisplayName: v.user.handle,
        magnitude: 1,  // 1 version saved = 1 unit of design work
        type: 'design_edit' as const,
        meta: {
          label: v.label,
          description: v.description,
        },
      }));

      await cacheSet(cacheKey, rawEvents);
      return rawEvents;

    } catch (err) {
      console.error('[Figma] fetchRawActivity error:', err);
      return [];
    }
  },

  normalize(raw: RawEvent): ContributionEvent {
    return {
      provider: 'figma',
      type: 'design_edit',
      timestamp: new Date(raw.timestamp),
      magnitude: raw.magnitude,
      rawRef: raw.externalId,
      actorExternalId: raw.actorExternalId,
      actorDisplayName: raw.actorDisplayName,
    };
  },
};
