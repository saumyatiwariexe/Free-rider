/**
 * GitHub Source Adapter
 *
 * Fetches commit history for a repository using the GitHub REST API.
 *
 * - sourceRef: "owner/repo" or "https://github.com/owner/repo"
 * - magnitude: additions + deletions (lines changed) per commit
 * - Cache: Redis, TTL 5 min per (repo, since) key
 * - Error handling: returns [] on any failure — never throws
 *
 * Rate limits:
 *  - Authenticated: 5,000 req/hr
 *  - We fetch: 1 list call (up to 3 pages) + N individual commit calls
 *  - Redis cache prevents re-fetching the same data within 5 min
 */

import type { RawEvent, ContributionEvent, FetchOptions, SourceAdapter } from './types';
import { cacheGet, cacheSet } from '@/lib/redis';

const GITHUB_API = 'https://api.github.com';
const MAX_PAGES = 3;        // max 300 commits per fetch (3 × 100)
const STATS_CONCURRENCY = 5; // fetch N commit stats in parallel

// ── Helpers ────────────────────────────────────────────────

/** Parse "owner/repo" or "https://github.com/owner/repo" into { owner, repo } */
function parseRepoRef(sourceRef: string): { owner: string; repo: string } {
  const clean = sourceRef
    .replace(/^https?:\/\/github\.com\//, '')
    .replace(/\.git$/, '')
    .trim();
  const parts = clean.split('/');
  if (parts.length < 2 || !parts[0] || !parts[1]) {
    throw new Error(`Invalid GitHub sourceRef: "${sourceRef}". Expected "owner/repo".`);
  }
  return { owner: parts[0], repo: parts[1] };
}

function githubHeaders(accessToken: string): HeadersInit {
  return {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

// ── Types for GitHub API responses ─────────────────────────

interface GHCommitListItem {
  sha: string;
  commit: {
    author: { name: string; email: string; date: string } | null;
    message: string;
  };
  author: { login: string } | null;  // null if author's GH account not linked
}

interface GHCommitDetail {
  sha: string;
  stats?: { additions: number; deletions: number; total: number };
}

// ── Core fetch functions ────────────────────────────────────

/** List commits for a repo (paginated, up to MAX_PAGES × 100) */
async function listCommits(
  owner: string,
  repo: string,
  accessToken: string,
  since?: Date
): Promise<GHCommitListItem[]> {
  const headers = githubHeaders(accessToken);
  const commits: GHCommitListItem[] = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const params = new URLSearchParams({
      per_page: '100',
      page: String(page),
      ...(since ? { since: since.toISOString() } : {}),
    });

    const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/commits?${params}`, { headers });

    if (!res.ok) {
      console.error(`[GitHub] listCommits failed: ${res.status} ${res.statusText}`);
      break;
    }

    const page_data: GHCommitListItem[] = await res.json();
    commits.push(...page_data);

    // If fewer than 100 returned, we're on the last page
    if (page_data.length < 100) break;
  }

  return commits;
}

/** Fetch diff stats for a single commit (cached individually) */
async function getCommitStats(
  owner: string,
  repo: string,
  sha: string,
  accessToken: string
): Promise<number> {
  const cacheKey = `github:stats:${owner}:${repo}:${sha}`;
  const cached = await cacheGet<number>(cacheKey);

  if (cached !== null) {
    return cached;
  }

  const headers = githubHeaders(accessToken);
  const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/commits/${sha}`, { headers });

  if (!res.ok) {
    // Return 1 as fallback (at least count the commit)
    return 1;
  }

  const data: GHCommitDetail = await res.json();
  const magnitude = (data.stats?.additions ?? 0) + (data.stats?.deletions ?? 0) || 1;

  // Cache individual commit stats with a long TTL — they never change
  await cacheSet(cacheKey, magnitude, 60 * 60 * 24); // 24 hours
  return magnitude;
}

/** Run async tasks in batches of `concurrency` */
async function batchRun<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

// ── Adapter implementation ──────────────────────────────────

export const GitHubAdapter: SourceAdapter = {
  provider: 'github',

  async fetchRawActivity(opts: FetchOptions): Promise<RawEvent[]> {
    const { accessToken, sourceRef, since } = opts;

    try {
      const { owner, repo } = parseRepoRef(sourceRef);
      const cacheKey = `github:commits:${owner}:${repo}:${since?.toISOString() ?? 'all'}`;

      // Check list-level cache first
      const cached = await cacheGet<RawEvent[]>(cacheKey);
      if (cached !== null) {
        console.log(`[GitHub] cache HIT — ${cacheKey}`);
        return cached;
      }

      console.log(`[GitHub] cache MISS — fetching ${owner}/${repo}`);
      const commits = await listCommits(owner, repo, accessToken, since);

      if (commits.length === 0) return [];

      // Enrich with diff stats (batched, each commit stat is individually cached)
      const withStats = await batchRun(
        commits,
        async (commit) => {
          const magnitude = await getCommitStats(owner, repo, commit.sha, accessToken);
          return { commit, magnitude };
        },
        STATS_CONCURRENCY
      );

      const rawEvents: RawEvent[] = withStats.map(({ commit, magnitude }) => ({
        externalId: commit.sha,
        timestamp: commit.commit.author?.date ?? new Date().toISOString(),
        actorExternalId: commit.author?.login ?? commit.commit.author?.email ?? 'unknown',
        actorDisplayName: commit.commit.author?.name,
        magnitude,
        type: 'commit' as const,
        meta: { message: commit.commit.message.slice(0, 120) },
      }));

      // Cache the full list for 5 minutes
      await cacheSet(cacheKey, rawEvents);
      return rawEvents;

    } catch (err) {
      console.error('[GitHub] fetchRawActivity error:', err);
      return [];
    }
  },

  normalize(raw: RawEvent): ContributionEvent {
    return {
      provider: 'github',
      type: 'commit',
      timestamp: new Date(raw.timestamp),
      magnitude: raw.magnitude,
      rawRef: raw.externalId,
      actorExternalId: raw.actorExternalId,
      actorDisplayName: raw.actorDisplayName,
    };
  },
};
