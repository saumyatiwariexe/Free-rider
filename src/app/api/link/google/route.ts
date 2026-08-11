/**
 * Google OAuth 2.0 Link Flow
 *
 * GET /api/link/google         → Initiate OAuth (redirect to Google)
 * GET /api/link/google?code=xx → Handle callback (exchange code → token, store encrypted)
 *
 * Scopes: drive.readonly (to access revision history on docs the user owns/edits)
 *
 * Required env vars: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI
 *
 * Important: Google OAuth consent screen must be configured with test users
 * (or app must be verified) before anyone outside the team can link.
 */

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { encrypt } from '@/lib/crypto';
import { cacheDel } from '@/lib/redis';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

interface GoogleUserInfo {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

export async function GET(request: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.redirect(new URL('/sign-in', request.url));
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  // ── Phase 1: Initiate OAuth → redirect to Google ─────────
  if (!code && !error) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      return NextResponse.json({ error: 'GOOGLE_CLIENT_ID or GOOGLE_REDIRECT_URI not configured' }, { status: 500 });
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
      access_type: 'offline',   // get refresh_token
      prompt: 'consent',        // force consent to always get refresh_token
      state: clerkId,
    });

    return NextResponse.redirect(`${GOOGLE_AUTH_URL}?${params}`);
  }

  // ── Google returned an error ─────────────────────────────
  if (error) {
    console.error('[Link/Google] OAuth error:', error);
    return NextResponse.redirect(new URL('/link-accounts?error=google_denied', request.url));
  }

  // ── Phase 2: Handle callback — exchange code for token ──
  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI!;

  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: code!,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenRes.ok) {
    const body = await tokenRes.text();
    console.error('[Link/Google] token exchange failed:', body);
    return NextResponse.redirect(new URL('/link-accounts?error=google_token_failed', request.url));
  }

  const tokenData: GoogleTokenResponse = await tokenRes.json();

  // Fetch Google user info
  const meRes = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  if (!meRes.ok) {
    return NextResponse.redirect(new URL('/link-accounts?error=google_userinfo_failed', request.url));
  }

  const me: GoogleUserInfo = await meRes.json();

  // Get our internal user_id from clerk_id
  const db = getSupabaseAdmin();
  const { data: user } = await db.from('users').select('id').eq('clerk_id', clerkId).single();

  if (!user) {
    return NextResponse.redirect(new URL('/link-accounts?error=user_not_found', request.url));
  }

  // Store access_token (and refresh_token combined) encrypted
  // We join them with a separator so we can extract the refresh token later
  const tokenToStore = tokenData.refresh_token
    ? `${tokenData.access_token}::refresh::${tokenData.refresh_token}`
    : tokenData.access_token;

  const encryptedToken = encrypt(tokenToStore);

  const { error: upsertError } = await db.from('linked_accounts').upsert(
    {
      user_id: user.id,
      provider: 'google_docs',
      external_id: me.email, // email as stable external ID for Google
      access_token_enc: encryptedToken,
    },
    { onConflict: 'user_id,provider' }
  );

  if (upsertError) {
    console.error('[Link/Google] upsert error:', upsertError);
    return NextResponse.redirect(new URL('/link-accounts?error=google_save_failed', request.url));
  }

  await cacheDel(`google_docs:user:${me.email}`);

  console.log(`[Link/Google] linked google user ${me.email} for clerk ${clerkId}`);
  return NextResponse.redirect(new URL('/link-accounts?success=google', request.url));
}
