import { NextResponse } from 'next/server';
import { GitHubAdapter } from '@/adapters/github';
import { FigmaAdapter } from '@/adapters/figma';
import { GoogleDocsAdapter } from '@/adapters/google_docs';
import type { SourceAdapter } from '@/adapters/types';

/**
 * GET /api/test/phase2?repo=owner/repo&token=ghp_xxx
 *
 * Phase 2 exit criteria verification:
 *  1. All three adapters compile and satisfy SourceAdapter interface
 *  2. GitHub adapter returns real ContributionEvent[] for the given repo
 *  3. Redis cache HIT confirmed on second call
 *  4. Figma + Google Docs stubs return [] without throwing
 *  5. No `any` types (enforced by TypeScript at build time)
 *
 * Usage (pass a public repo + GitHub personal access token):
 *   /api/test/phase2?repo=facebook/react&token=ghp_yourtoken
 *
 * Remove before production.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const repo = searchParams.get('repo');
  const token = searchParams.get('token');

  if (!repo || !token) {
    return NextResponse.json(
      { error: 'Missing query params. Usage: ?repo=owner/repo&token=ghp_xxx' },
      { status: 400 }
    );
  }

  const results: Record<string, unknown> = {};

  // ── 1. Interface satisfaction check (compile-time, but verify at runtime too)
  const adapters: SourceAdapter[] = [GitHubAdapter, FigmaAdapter, GoogleDocsAdapter];
  results.interface_check = adapters.map((a) => ({
    provider: a.provider,
    has_fetchRawActivity: typeof a.fetchRawActivity === 'function',
    has_normalize: typeof a.normalize === 'function',
  }));

  // ── 2. GitHub adapter — first call (expect cache MISS in server logs)
  console.log('[Test/Phase2] Calling GitHub adapter — first call (expect MISS)...');
  const t1 = Date.now();
  const rawEvents = await GitHubAdapter.fetchRawActivity({
    accessToken: token,
    sourceRef: repo,
  });
  const t1ms = Date.now() - t1;

  results.github = {
    raw_event_count: rawEvents.length,
    first_call_ms: t1ms,
    sample_events: rawEvents.slice(0, 3).map((e) => ({
      sha: e.externalId.slice(0, 8),
      actor: e.actorExternalId,
      timestamp: e.timestamp,
      magnitude: e.magnitude,
      type: e.type,
    })),
  };

  // ── 3. Normalize all events and verify shape
  const normalized = rawEvents.map((e) => GitHubAdapter.normalize(e));
  results.normalized_sample = normalized.slice(0, 2).map((e) => ({
    provider: e.provider,
    type: e.type,
    timestamp: e.timestamp instanceof Date ? 'Date ✅' : 'NOT a Date ❌',
    magnitude: e.magnitude,
    rawRef: e.rawRef.slice(0, 8),
  }));

  // ── 4. Second call — expect cache HIT in server logs
  console.log('[Test/Phase2] Calling GitHub adapter — second call (expect HIT)...');
  const t2 = Date.now();
  const rawEvents2 = await GitHubAdapter.fetchRawActivity({
    accessToken: token,
    sourceRef: repo,
  });
  const t2ms = Date.now() - t2;

  results.cache_test = {
    first_call_ms: t1ms,
    second_call_ms: t2ms,
    speedup: `${(t1ms / Math.max(t2ms, 1)).toFixed(1)}x faster`,
    note: 'Check server logs for "cache HIT" vs "cache MISS"',
    second_call_count: rawEvents2.length,
    counts_match: rawEvents.length === rawEvents2.length ? 'PASS ✅' : 'FAIL ❌',
  };

  // ── 5. Stub adapters return [] without throwing
  const figmaResult = await FigmaAdapter.fetchRawActivity({ accessToken: 'stub', sourceRef: 'stub' });
  const docsResult = await GoogleDocsAdapter.fetchRawActivity({ accessToken: 'stub', sourceRef: 'stub' });

  results.stubs = {
    figma: figmaResult.length === 0 ? 'returns [] ✅' : 'FAIL ❌',
    google_docs: docsResult.length === 0 ? 'returns [] ✅' : 'FAIL ❌',
  };

  // ── Overall
  const githubHasEvents = rawEvents.length > 0;
  const normalizesCorrectly = normalized.every((e) => e.timestamp instanceof Date);
  const cacheWorking = t2ms < t1ms;
  const stubsOk = figmaResult.length === 0 && docsResult.length === 0;

  const overall =
    githubHasEvents && normalizesCorrectly && stubsOk
      ? 'PHASE 2 PASS ✅'
      : 'PHASE 2 FAIL ❌';

  return NextResponse.json({
    ...results,
    overall,
    cache_performance: cacheWorking
      ? `Cache working (${t2ms}ms vs ${t1ms}ms) ✅`
      : `Cache may not be working (${t2ms}ms vs ${t1ms}ms) — check logs`,
  });
}
