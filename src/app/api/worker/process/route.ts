/**
 * POST /api/worker/process
 *
 * QStash consumer — the core data ingestion + report generation worker.
 *
 * Called by QStash after a submission is created. Never called directly by the UI.
 * For local dev testing, can be called directly (signature verification skipped if no keys).
 *
 * Job payload: { submission_id: string, group_id: string }
 *
 * Process:
 *  1. Idempotency check — skip if report already exists for this submission
 *  2. Fetch all group members + their linked accounts
 *  3. For each account, run the matching adapter → normalize → batch insert events
 *  4. Generate InsightReport from all events for this group
 *  5. Persist InsightReport
 */

import { NextResponse } from 'next/server';
import { Receiver } from '@upstash/qstash';
import { headers } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase';
import { decrypt } from '@/lib/crypto';
import { GitHubAdapter } from '@/adapters/github';
import { FigmaAdapter } from '@/adapters/figma';
import { GoogleDocsAdapter } from '@/adapters/google_docs';
import { generateReport } from '@/lib/report';
import type { SourceAdapter } from '@/adapters/types';
import type { ContributionEventInsert, GroupRow } from '@/types/db';

// Adapter registry
const ADAPTERS: Record<string, SourceAdapter> = {
  github: GitHubAdapter,
  figma: FigmaAdapter,
  google_docs: GoogleDocsAdapter,
};

interface WorkerPayload {
  submission_id: string;
  group_id: string;
}

// ── QStash signature verification ──────────────────────────

async function verifyQStashSignature(request: Request): Promise<boolean> {
  // Always allow local bypass so the manual UI fetch('/api/worker/process') works in local dev
  if (process.env.NODE_ENV === 'development') {
    return true;
  }

  const currentKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextKey = process.env.QSTASH_NEXT_SIGNING_KEY;

  if (!currentKey || !nextKey) {
    console.warn('[Worker] QStash signing keys not configured — skipping verification (dev mode)');
    return true;
  }

  const headersList = await headers();
  const signature = headersList.get('upstash-signature');
  if (!signature) return false;

  const receiver = new Receiver({ currentSigningKey: currentKey, nextSigningKey: nextKey });
  const body = await request.text();

  try {
    await receiver.verify({ signature, body });
    return true;
  } catch {
    return false;
  }
}

// ── Main handler ────────────────────────────────────────────

export async function POST(request: Request) {
  // Verify it's a legitimate QStash call
  const isValid = await verifyQStashSignature(request);
  if (!isValid) {
    return NextResponse.json({ error: 'Invalid QStash signature' }, { status: 401 });
  }

  // Clone request so we can read body (verifyQStashSignature may have consumed it)
  let payload: WorkerPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { submission_id, group_id } = payload;
  if (!submission_id || !group_id) {
    return NextResponse.json({ error: 'submission_id and group_id are required' }, { status: 400 });
  }

  const db = getSupabaseAdmin();

  // ── 1. Idempotency check ─────────────────────────────────
  const { data: existingReport } = await db
    .from('insight_reports')
    .select('id')
    .eq('submission_id', submission_id)
    .single();

  if (existingReport) {
    console.log(`[Worker] submission ${submission_id} already processed — skipping`);
    return NextResponse.json({ status: 'already_processed', submission_id });
  }

  // ── 2. Fetch group members + linked accounts ─────────────
  const { data: members } = await db
    .from('group_members')
    .select('user_id')
    .eq('group_id', group_id);

  if (!members || members.length === 0) {
    return NextResponse.json({ error: 'No members found for this group' }, { status: 404 });
  }

  const memberIds = members.map((m) => m.user_id);

  const { data: users } = await db
    .from('users')
    .select('id, name, email')
    .in('id', memberIds);

  const memberNames: Record<string, string> = {};
  for (const u of users ?? []) {
    memberNames[u.id] = u.name ?? u.email ?? u.id;
  }

  const { data: linkedAccounts } = await db
    .from('linked_accounts')
    .select('user_id, provider, external_id, access_token_enc')
    .in('user_id', memberIds);

  // Fetch group source_refs
  const { data: group } = await db
    .from('groups')
    .select('source_refs')
    .eq('id', group_id)
    .single();

  const sourceRefs = (group as { source_refs: GroupRow['source_refs'] } | null)?.source_refs ?? {};

  // ── 3. Run adapters + collect normalized events ──────────
  const eventsToInsert: ContributionEventInsert[] = [];

  // Map from (provider, externalId) → user_id for event attribution
  const externalToUserId: Record<string, string> = {};
  for (const acct of linkedAccounts ?? []) {
    externalToUserId[`${acct.provider}::${acct.external_id}`] = acct.user_id;
  }

  for (const acct of linkedAccounts ?? []) {
    const adapter = ADAPTERS[acct.provider];
    if (!adapter) continue;

    // Determine sourceRef for this provider from the group's source_refs
    let sourceRef: string | undefined;
    if (acct.provider === 'github') sourceRef = sourceRefs.repo_url;
    if (acct.provider === 'figma') sourceRef = sourceRefs.figma_file_key;
    if (acct.provider === 'google_docs') sourceRef = sourceRefs.doc_id;

    if (!sourceRef) continue;

    // Decrypt access token
    let accessToken: string;
    try {
      const raw = decrypt(acct.access_token_enc);
      accessToken = raw.includes('::refresh::') ? raw.split('::refresh::')[0] : raw;
    } catch (err) {
      console.error(`[Worker] Token decrypt failed for ${acct.provider}:`, err);
      continue;
    }

    // Fetch raw events from provider (cached, never throws)
    const rawEvents = await adapter.fetchRawActivity({ accessToken, sourceRef });
    console.log(`[Worker] ${acct.provider}: ${rawEvents.length} events for user ${acct.user_id}`);

    for (const raw of rawEvents) {
      const normalized = adapter.normalize(raw);

      // Map actorExternalId → user_id
      const userId = externalToUserId[`${acct.provider}::${normalized.actorExternalId}`] ?? acct.user_id;

      eventsToInsert.push({
        group_id,
        user_id: userId,
        provider: acct.provider,
        type: normalized.type,
        timestamp: normalized.timestamp.toISOString(),
        magnitude: normalized.magnitude,
        raw_ref: normalized.rawRef,
      });
    }
  }

  // ── 4. Batch-insert events (idempotent — skip duplicates) ─
  if (eventsToInsert.length > 0) {
    const { error: insertError } = await db
      .from('contribution_events')
      .upsert(eventsToInsert, {
        onConflict: 'group_id,provider,raw_ref',
        ignoreDuplicates: true,
      });

    if (insertError) {
      console.error('[Worker] event insert error:', insertError);
      // Continue — partial data is better than no report
    }
  }

  // ── 5. Fetch all persisted events for report generation ──
  const { data: allEvents } = await db
    .from('contribution_events')
    .select('*')
    .eq('group_id', group_id)
    .order('timestamp', { ascending: true });

  // ── 6. Generate and persist the InsightReport ────────────
  const reportInsert = generateReport(submission_id, allEvents ?? [], memberNames);

  const { data: report, error: reportError } = await db
    .from('insight_reports')
    .insert(reportInsert)
    .select()
    .single();

  if (reportError || !report) {
    console.error('[Worker] report insert error:', reportError);
    return NextResponse.json({ error: 'Failed to persist report' }, { status: 500 });
  }

  console.log(`[Worker] ✅ report generated for submission ${submission_id} — ${eventsToInsert.length} events processed`);

  return NextResponse.json({
    status: 'completed',
    submission_id,
    events_processed: eventsToInsert.length,
    report_id: report.id,
  });
}
