/**
 * POST /api/groups/detect
 *
 * Auto-detects group membership from one or more source references.
 * No manual invite step — group is built entirely from contributor/editor lists.
 *
 * Body:
 * {
 *   source_refs: {
 *     repo_url?: string,         // "owner/repo" or "https://github.com/owner/repo"
 *     figma_file_key?: string,   // Figma file key
 *     doc_id?: string            // Google Doc ID
 *   },
 *   group_name?: string          // optional; falls back to repo name or "Unnamed Group"
 * }
 *
 * Returns: { group_id, group_name, members: [{ user_id, name, linked_providers }] }
 *
 * Logic:
 *  - For each source ref, fetches contributor/editor identifiers from the provider API
 *  - Queries linked_accounts to match identifiers to registered users
 *  - Upserts groups + group_members rows
 *  - Users not yet registered appear as unmatched_contributors in the response
 */

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { SourceRefs } from '@/types/db';

const GITHUB_API = 'https://api.github.com';

// ── GitHub contributor detection ───────────────────────────

async function getGitHubContributors(
  repoRef: string,
  accessToken: string
): Promise<string[]> {
  const clean = repoRef.replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '').trim();
  const [owner, repo] = clean.split('/');
  if (!owner || !repo) return [];

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  
  if (accessToken && !accessToken.includes('dummy')) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const res = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/contributors?per_page=100`,
    { headers }
  );

  if (!res.ok) {
    console.error(`[Groups/Detect] GitHub contributors fetch failed: ${res.status}`);
    return [];
  }

  const contributors: { login: string }[] = await res.json();
  return contributors.map((c) => c.login);
}

// ── Figma editor detection ─────────────────────────────────

async function getFigmaEditors(
  fileKey: string,
  accessToken: string
): Promise<string[]> {
  // Use the versions endpoint to get unique editor user IDs
  const res = await fetch(`https://api.figma.com/v1/files/${fileKey}/versions?page_size=30`, {
    headers: accessToken.startsWith('figd_') || !accessToken.startsWith('ey')
      ? { 'X-Figma-Token': accessToken }
      : { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    console.error(`[Groups/Detect] Figma editors fetch failed: ${res.status}`);
    return [];
  }

  const data: { versions: { user: { id: string } }[] } = await res.json();
  const uniqueIds = [...new Set(data.versions?.map((v) => v.user.id) ?? [])];
  return uniqueIds;
}

// ── Google Doc editor detection ────────────────────────────

async function getGoogleDocEditors(
  docId: string,
  accessToken: string
): Promise<string[]> {
  const params = new URLSearchParams({
    fields: 'revisions(lastModifyingUser/emailAddress)',
    pageSize: '200',
  });

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${docId}/revisions?${params}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(8000),
    }
  );

  if (!res.ok) {
    console.error(`[Groups/Detect] Google editors fetch failed: ${res.status}`);
    return [];
  }

  const data: { revisions?: { lastModifyingUser?: { emailAddress?: string } }[] } = await res.json();
  const emails = data.revisions
    ?.map((r) => r.lastModifyingUser?.emailAddress)
    .filter((e): e is string => Boolean(e)) ?? [];

  return [...new Set(emails)];
}

// ── Route handler ──────────────────────────────────────────

export async function POST(request: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body: { source_refs: SourceRefs; group_name?: string } = await request.json();
  const { source_refs, group_name } = body;

  if (!source_refs || Object.keys(source_refs).length === 0) {
    return NextResponse.json({ error: 'source_refs is required with at least one provider ref' }, { status: 400 });
  }

  const db = getSupabaseAdmin();

  // Get the calling user's linked accounts (we use their tokens to call APIs)
  const { data: callerUser } = await db
    .from('users')
    .select('id')
    .eq('clerk_id', clerkId)
    .single();

  if (!callerUser) {
    return NextResponse.json({ error: 'User not found — sign in first' }, { status: 404 });
  }

  const { data: callerAccounts } = await db
    .from('linked_accounts')
    .select('provider, external_id, access_token_enc')
    .eq('user_id', callerUser.id);

  // Decrypt helper
  const { decrypt } = await import('@/lib/crypto');
  const tokenMap: Record<string, string> = {};
  for (const acct of callerAccounts ?? []) {
    try {
      const raw = decrypt(acct.access_token_enc);
      // For Google, only extract the access token part
      tokenMap[acct.provider] = raw.includes('::refresh::') ? raw.split('::refresh::')[0] : raw;
    } catch {
      /* skip bad tokens */
    }
  }

  // ── Gather contributor identifiers from each source ─────
  const externalIdsByProvider: Record<string, string[]> = {};

  if (source_refs.repo_url && tokenMap['github']) {
    externalIdsByProvider['github'] = await getGitHubContributors(source_refs.repo_url, tokenMap['github']);
  }

  if (source_refs.figma_file_key && tokenMap['figma']) {
    externalIdsByProvider['figma'] = await getFigmaEditors(source_refs.figma_file_key, tokenMap['figma']);
  }

  if (source_refs.doc_id && tokenMap['google_docs']) {
    externalIdsByProvider['google_docs'] = await getGoogleDocEditors(source_refs.doc_id, tokenMap['google_docs']);
  }

  // ── Match identifiers against linked_accounts ────────────
  const matchedUserIds = new Set<string>();
  const unmatchedByProvider: Record<string, string[]> = {};

  for (const [provider, externalIds] of Object.entries(externalIdsByProvider)) {
    if (externalIds.length === 0) continue;

    const { data: matches } = await db
      .from('linked_accounts')
      .select('user_id, external_id')
      .eq('provider', provider)
      .in('external_id', externalIds);

    const matchedExternalIds = new Set((matches ?? []).map((m) => m.external_id));
    const unmatched = externalIds.filter((id) => !matchedExternalIds.has(id));

    for (const m of matches ?? []) {
      matchedUserIds.add(m.user_id);
    }

    if (unmatched.length > 0) {
      unmatchedByProvider[provider] = unmatched;
    }
  }

  // Always include the caller as a member
  matchedUserIds.add(callerUser.id);

  // ── Determine group name ─────────────────────────────────
  const derivedName =
    group_name ||
    (source_refs.repo_url
      ? source_refs.repo_url.replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '')
      : null) ||
    'Unnamed Group';

  // ── Upsert group ─────────────────────────────────────────
  const { data: group, error: groupError } = await db
    .from('groups')
    .insert({ name: derivedName, source_refs })
    .select()
    .single();

  if (groupError || !group) {
    console.error('[Groups/Detect] group insert error:', groupError);
    return NextResponse.json({ error: groupError?.message ?? 'Failed to create group' }, { status: 500 });
  }

  // ── Upsert group_members ─────────────────────────────────
  const memberRows = [...matchedUserIds].map((userId) => ({
    group_id: group.id,
    user_id: userId,
  }));

  const { error: membersError } = await db
    .from('group_members')
    .upsert(memberRows, { onConflict: 'group_id,user_id' });

  if (membersError) {
    console.error('[Groups/Detect] members upsert error:', membersError);
  }

  // ── Fetch member details for the response ────────────────
  const { data: members } = await db
    .from('users')
    .select('id, name, email')
    .in('id', [...matchedUserIds]);

  return NextResponse.json({
    success: true,
    group: {
      id: group.id,
      name: group.name,
      source_refs: group.source_refs,
    },
    members: members ?? [],
    unmatched_contributors: unmatchedByProvider,
    note: Object.keys(unmatchedByProvider).length > 0
      ? 'Some contributors/editors are not yet registered — they will be added when they sign up'
      : 'All detected contributors are registered users',
  });
}
