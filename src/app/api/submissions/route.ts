/**
 * POST /api/submissions
 *
 * Triggers a contribution snapshot for a group.
 * - Creates a submissions row
 * - Publishes a processing job to QStash (returns in < 200ms)
 * - The actual data ingestion + report generation happens in /api/worker/process
 *
 * Body: { group_id: string }
 * Returns: { submission_id, status: "queued" }
 */

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { publishJob } from '@/lib/qstash';

export async function POST(request: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body: { group_id?: string } = await request.json();

  if (!body.group_id) {
    return NextResponse.json({ error: 'group_id is required' }, { status: 400 });
  }

  const db = getSupabaseAdmin();

  // Verify the calling user is a member of this group
  const { data: callerUser } = await db
    .from('users')
    .select('id')
    .eq('clerk_id', clerkId)
    .single();

  if (!callerUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const { data: membership } = await db
    .from('group_members')
    .select('group_id')
    .eq('group_id', body.group_id)
    .eq('user_id', callerUser.id)
    .single();

  if (!membership) {
    return NextResponse.json({ error: 'You are not a member of this group' }, { status: 403 });
  }

  // Create the submission row
  const { data: submission, error: submissionError } = await db
    .from('submissions')
    .insert({ group_id: body.group_id })
    .select()
    .single();

  if (submissionError || !submission) {
    return NextResponse.json({ error: submissionError?.message ?? 'Failed to create submission' }, { status: 500 });
  }

  // Publish processing job to QStash (fire-and-forget)
  // If WORKER_URL is not set (dev without tunnel), log and return anyway
  let messageId: string | null = null;
  const workerUrl = process.env.WORKER_URL;

  if (workerUrl) {
    try {
      messageId = await publishJob({
        submission_id: submission.id,
        group_id: body.group_id,
      });
      console.log(`[Submissions] queued job ${messageId} for submission ${submission.id}`);
    } catch (err) {
      console.error('[Submissions] QStash publish failed:', err);
      // Don't fail the request — caller can retry via a manual endpoint
    }
  } else {
    console.warn('[Submissions] WORKER_URL not set — job NOT queued. Call /api/worker/process manually.');
  }

  return NextResponse.json(
    {
      submission_id: submission.id,
      group_id: body.group_id,
      status: 'queued',
      message_id: messageId,
      note: !workerUrl ? 'WORKER_URL not configured — trigger worker manually at POST /api/worker/process' : undefined,
    },
    { status: 201 }
  );
}
