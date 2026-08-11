/**
 * DELETE /api/link/[provider]
 *
 * Revoke a linked account for the authenticated user.
 * Deletes the row from linked_accounts + clears any Redis-cached tokens.
 *
 * Usage: DELETE /api/link/figma  or  DELETE /api/link/google_docs  or  DELETE /api/link/github
 */

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { cacheDel } from '@/lib/redis';
import type { Provider } from '@/types/db';

const VALID_PROVIDERS: Provider[] = ['github', 'figma', 'google_docs'];

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { provider } = await params;

  if (!VALID_PROVIDERS.includes(provider as Provider)) {
    return NextResponse.json(
      { error: `Invalid provider. Must be one of: ${VALID_PROVIDERS.join(', ')}` },
      { status: 400 }
    );
  }

  const db = getSupabaseAdmin();

  // Get the user's internal ID + existing linked account info
  const { data: user } = await db.from('users').select('id').eq('clerk_id', clerkId).single();

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Fetch the existing linked account so we can clear the right cache key
  const { data: existing } = await db
    .from('linked_accounts')
    .select('external_id')
    .eq('user_id', user.id)
    .eq('provider', provider)
    .single();

  // Delete the linked account row (cascades nothing in linked_accounts, safe)
  const { error: deleteError } = await db
    .from('linked_accounts')
    .delete()
    .eq('user_id', user.id)
    .eq('provider', provider);

  if (deleteError) {
    console.error(`[Link/Revoke] delete error:`, deleteError);
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  // Clear Redis cache entries for this provider's data
  if (existing?.external_id) {
    await cacheDel(`${provider}:user:${existing.external_id}`);
  }

  // Also clear any cached activity data for this user+provider combination
  // (keys like github:commits:owner:repo:* can't be pattern-matched easily without SCAN,
  //  so we accept that stale cache entries expire naturally via TTL)
  console.log(`[Link/Revoke] removed ${provider} link for clerk ${clerkId}`);

  return NextResponse.json({
    success: true,
    message: `${provider} account unlinked successfully`,
  });
}
