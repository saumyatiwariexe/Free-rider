import { NextResponse } from 'next/server';
import { FigmaAdapter } from '@/adapters/figma';
import { GoogleDocsAdapter } from '@/adapters/google_docs';

/**
 * GET /api/test/phase3
 *
 * Phase 3 exit criteria verification:
 *  1. Figma adapter returns real version events for a test file
 *  2. Google Docs adapter returns real revision events for a test doc
 *  3. Both adapters Redis-cached (verify speedup on second call)
 *  4. Both return [] gracefully on bad token (no unhandled rejection)
 *
 * Usage:
 *   /api/test/phase3?figma_key=YOUR_FILE_KEY&figma_token=figd_xxx
 *                   &doc_id=YOUR_DOC_ID&google_token=ya29_xxx
 *
 * Any param can be omitted — the route will skip that adapter's real test
 * and still verify the graceful-failure behavior.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const figmaKey = searchParams.get('figma_key');
  const figmaToken = searchParams.get('figma_token');
  const docId = searchParams.get('doc_id');
  const googleToken = searchParams.get('google_token');

  const results: Record<string, unknown> = {};

  // ── 1. Figma real data (if params provided) ───────────────
  if (figmaKey && figmaToken) {
    console.log('[Test/Phase3] Figma — first call (expect MISS)...');
    const t1 = Date.now();
    const rawEvents = await FigmaAdapter.fetchRawActivity({ accessToken: figmaToken, sourceRef: figmaKey });
    const t1ms = Date.now() - t1;

    console.log('[Test/Phase3] Figma — second call (expect HIT)...');
    const t2 = Date.now();
    const rawEvents2 = await FigmaAdapter.fetchRawActivity({ accessToken: figmaToken, sourceRef: figmaKey });
    const t2ms = Date.now() - t2;

    const normalized = rawEvents.map((e) => FigmaAdapter.normalize(e));

    results.figma = {
      version_count: rawEvents.length,
      first_call_ms: t1ms,
      second_call_ms: t2ms,
      speedup: `${(t1ms / Math.max(t2ms, 1)).toFixed(1)}x`,
      counts_match: rawEvents.length === rawEvents2.length ? 'PASS ✅' : 'FAIL ❌',
      sample: rawEvents.slice(0, 3).map((e) => ({
        id: e.externalId,
        actor: e.actorDisplayName ?? e.actorExternalId,
        timestamp: e.timestamp,
        type: e.type,
      })),
      normalize_check: normalized.every((e) => e.timestamp instanceof Date) ? 'Date ✅' : 'FAIL ❌',
    };
  } else {
    results.figma = 'SKIPPED — pass ?figma_key=...&figma_token=... to test';
  }

  // ── 2. Google Docs real data (if params provided) ─────────
  if (docId && googleToken) {
    console.log('[Test/Phase3] GoogleDocs — first call (expect MISS)...');
    const t1 = Date.now();
    const rawEvents = await GoogleDocsAdapter.fetchRawActivity({ accessToken: googleToken, sourceRef: docId });
    const t1ms = Date.now() - t1;

    console.log('[Test/Phase3] GoogleDocs — second call (expect HIT)...');
    const t2 = Date.now();
    const rawEvents2 = await GoogleDocsAdapter.fetchRawActivity({ accessToken: googleToken, sourceRef: docId });
    const t2ms = Date.now() - t2;

    const normalized = rawEvents.map((e) => GoogleDocsAdapter.normalize(e));

    results.google_docs = {
      revision_count: rawEvents.length,
      first_call_ms: t1ms,
      second_call_ms: t2ms,
      speedup: `${(t1ms / Math.max(t2ms, 1)).toFixed(1)}x`,
      counts_match: rawEvents.length === rawEvents2.length ? 'PASS ✅' : 'FAIL ❌',
      sample: rawEvents.slice(0, 3).map((e) => ({
        id: e.externalId,
        actor: e.actorDisplayName ?? e.actorExternalId,
        timestamp: e.timestamp,
        type: e.type,
      })),
      normalize_check: normalized.every((e) => e.timestamp instanceof Date) ? 'Date ✅' : 'FAIL ❌',
    };
  } else {
    results.google_docs = 'SKIPPED — pass ?doc_id=...&google_token=... to test';
  }

  // ── 3. Graceful failure on bad tokens (always tested) ─────
  const [figmaBad, googleBad] = await Promise.all([
    FigmaAdapter.fetchRawActivity({ accessToken: 'bad_token', sourceRef: 'bad_key' }),
    GoogleDocsAdapter.fetchRawActivity({ accessToken: 'bad_token', sourceRef: 'bad_id' }),
  ]);

  results.graceful_failure = {
    figma_bad_token: figmaBad.length === 0 ? 'returns [] ✅' : 'FAIL ❌',
    google_bad_token: googleBad.length === 0 ? 'returns [] ✅' : 'FAIL ❌',
  };

  const gracefulOk = figmaBad.length === 0 && googleBad.length === 0;

  return NextResponse.json({
    ...results,
    overall: gracefulOk ? 'PHASE 3 PARTIAL PASS ✅ (graceful failure verified)' : 'PHASE 3 FAIL ❌',
    note: 'Full pass requires real Figma + Google tokens. Graceful failure always verified.',
  });
}
