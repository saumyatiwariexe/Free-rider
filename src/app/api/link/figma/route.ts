/**
 * Figma OAuth 2.0 Link Flow
 *
 * GET /api/link/figma         → Initiate OAuth (redirect to Figma)
 * GET /api/link/figma?code=xx → Handle callback (exchange code → token, store encrypted)
 *
 * Figma OAuth docs: https://www.figma.com/developers/api#oauth2
 *
 * Required env vars: FIGMA_CLIENT_ID, FIGMA_CLIENT_SECRET, FIGMA_REDIRECT_URI
 */

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { encrypt } from '@/lib/crypto';
import { cacheDel } from '@/lib/redis';

const FIGMA_AUTH_URL = 'https://www.figma.com/oauth';
const FIGMA_TOKEN_URL = 'https://api.figma.com/v1/oauth/token';

interface FigmaTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user_id: string;
}

interface FigmaMeResponse {
  id: string;
  handle: string;
  email: string;
}

export async function GET(request: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.redirect(new URL('/sign-in', request.url));
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  // ── Phase 1: Initiate OAuth → redirect to Figma ─────────
  if (!code && !error) {
    const clientId = process.env.FIGMA_CLIENT_ID;
    const redirectUri = process.env.FIGMA_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      return NextResponse.json({ error: 'FIGMA_CLIENT_ID or FIGMA_REDIRECT_URI not configured' }, { status: 500 });
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      // Modern Figma OAuth Apps require granular scopes.
      // Based on what this app fetches, it needs versions and user profile:
      scope: 'file_versions:read,current_user:read',
      state: clerkId, // use clerk ID as CSRF state for simplicity
      response_type: 'code',
    });

    return NextResponse.redirect(`${FIGMA_AUTH_URL}?${params}`);
  }

  // ── Figma returned an error ──────────────────────────────
  if (error) {
    console.error('[Link/Figma] OAuth error:', error);
    return NextResponse.redirect(new URL('/link-accounts?error=figma_denied', request.url));
  }

  // ── Phase 2: Handle callback — exchange code for token ──
  const clientId = process.env.FIGMA_CLIENT_ID!;
  const clientSecret = process.env.FIGMA_CLIENT_SECRET!;
  const redirectUri = process.env.FIGMA_REDIRECT_URI!;

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const tokenRes = await fetch(FIGMA_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code: code!,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenRes.ok) {
    const body = await tokenRes.text();
    console.error('[Link/Figma] token exchange failed:', body);
    return NextResponse.redirect(new URL('/link-accounts?error=figma_token_failed', request.url));
  }

  const tokenData: FigmaTokenResponse = await tokenRes.json();

  // Fetch Figma user info to get their user ID
  const meRes = await fetch('https://api.figma.com/v1/me', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  let figmaUserId = tokenData.user_id;
  let figmaHandle = 'unknown';

  if (meRes.ok) {
    const me: FigmaMeResponse = await meRes.json();
    figmaUserId = me.id;
    figmaHandle = me.handle;
  }

  // Get our internal user_id from clerk_id
  const db = getSupabaseAdmin();
  const { data: user } = await db.from('users').select('id').eq('clerk_id', clerkId).single();

  if (!user) {
    return NextResponse.redirect(new URL('/link-accounts?error=user_not_found', request.url));
  }

  // Encrypt and store the access token
  const encryptedToken = encrypt(tokenData.access_token);

  const { error: upsertError } = await db.from('linked_accounts').upsert(
    {
      user_id: user.id,
      provider: 'figma',
      external_id: figmaUserId,
      access_token_enc: encryptedToken,
    },
    { onConflict: 'user_id,provider' }
  );

  if (upsertError) {
    console.error('[Link/Figma] upsert error:', upsertError);
    return NextResponse.redirect(new URL('/link-accounts?error=figma_save_failed', request.url));
  }

  // Invalidate any cached data for this user+provider
  await cacheDel(`figma:user:${figmaUserId}`);

  console.log(`[Link/Figma] linked figma user ${figmaHandle} (${figmaUserId}) for clerk ${clerkId}`);
  return NextResponse.redirect(new URL('/link-accounts?success=figma', request.url));
}
