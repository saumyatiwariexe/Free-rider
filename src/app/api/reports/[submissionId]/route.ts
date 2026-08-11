/**
 * GET /api/reports/[submissionId]
 *
 * Returns the InsightReport for a submission.
 * - 200: report is ready, returns full JSON
 * - 202: report still being generated (worker hasn't finished)
 * - 404: submission doesn't exist
 * - 403: caller is not a member of the group
 */

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ submissionId: string }> }
) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { submissionId } = await params;
  const db = getSupabaseAdmin();

  // Look up the submission to get the group_id
  const { data: submission } = await db
    .from('submissions')
    .select('id, group_id, submitted_at')
    .eq('id', submissionId)
    .single();

  if (!submission) {
    return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
  }

  // Verify the caller is a member of this group
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
    .eq('group_id', submission.group_id)
    .eq('user_id', callerUser.id)
    .single();

  if (!membership) {
    return NextResponse.json({ error: 'Access denied — you are not a member of this group' }, { status: 403 });
  }

  // Fetch the report
  const { data: report } = await db
    .from('insight_reports')
    .select('*')
    .eq('submission_id', submissionId)
    .single();

  if (!report) {
    // Worker hasn't finished yet
    return NextResponse.json(
      {
        status: 'processing',
        submission_id: submissionId,
        submitted_at: submission.submitted_at,
        message: 'Report is being generated — poll again in a few seconds',
      },
      { status: 202 }
    );
  }

  return NextResponse.json({
    status: 'ready',
    submission_id: submissionId,
    report,
  });
}
