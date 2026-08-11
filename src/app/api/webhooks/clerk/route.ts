/**
 * POST /api/webhooks/clerk
 *
 * Receives Clerk webhook events and syncs user data to Supabase.
 * Handles: user.created, user.updated
 *
 * Verification: Svix signature check using CLERK_WEBHOOK_SECRET.
 * This route must remain PUBLIC (no Clerk auth middleware — the request comes from Clerk's servers).
 *
 * Setup in Clerk Dashboard:
 *   Webhooks → Add endpoint → https://your-domain/api/webhooks/clerk
 *   Subscribe to: user.created, user.updated
 */

import { NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { UserInsert } from '@/types/db';

// ── Clerk webhook payload types ─────────────────────────────

interface ClerkEmailAddress {
  email_address: string;
  id: string;
}

interface ClerkUserPayload {
  id: string;                           // Clerk user ID (clerk_id in our DB)
  first_name: string | null;
  last_name: string | null;
  image_url: string | null;
  email_addresses: ClerkEmailAddress[];
  primary_email_address_id: string | null;
}

interface ClerkWebhookEvent {
  type: 'user.created' | 'user.updated' | string;
  data: ClerkUserPayload;
}

// ── Handler ─────────────────────────────────────────────────

export async function POST(request: Request) {
  const secret = process.env.CLERK_WEBHOOK_SECRET;

  // If no secret is configured, skip verification (useful in dev before webhook is set up)
  if (!secret) {
    console.warn('[Webhook/Clerk] CLERK_WEBHOOK_SECRET not set — skipping signature verification');
  }

  // ── Verify Svix signature
  if (secret) {
    const headersList = await headers();
    const svixId = headersList.get('svix-id');
    const svixTimestamp = headersList.get('svix-timestamp');
    const svixSignature = headersList.get('svix-signature');

    if (!svixId || !svixTimestamp || !svixSignature) {
      return NextResponse.json({ error: 'Missing Svix headers' }, { status: 400 });
    }

    const body = await request.text();

    try {
      const wh = new Webhook(secret);
      wh.verify(body, {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': svixSignature,
      });
    } catch {
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
    }

    // Re-parse body as JSON after text() consumed the stream
    const event: ClerkWebhookEvent = JSON.parse(body);
    return handleEvent(event);
  }

  // No secret — parse directly (dev mode)
  const event: ClerkWebhookEvent = await request.json();
  return handleEvent(event);
}

async function handleEvent(event: ClerkWebhookEvent) {
  const db = getSupabaseAdmin();

  if (event.type !== 'user.created' && event.type !== 'user.updated') {
    return NextResponse.json({ message: `Event type ${event.type} ignored` });
  }

  const { id, first_name, last_name, image_url, email_addresses, primary_email_address_id } = event.data;

  const primaryEmail = email_addresses.find((e) => e.id === primary_email_address_id)?.email_address
    ?? email_addresses[0]?.email_address
    ?? null;

  const name = [first_name, last_name].filter(Boolean).join(' ') || null;

  const userRow: UserInsert = {
    clerk_id: id,
    name,
    email: primaryEmail,
    avatar_url: image_url,
  };

  const { error } = await db
    .from('users')
    .upsert(userRow, { onConflict: 'clerk_id' });

  if (error) {
    console.error('[Webhook/Clerk] upsert error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.log(`[Webhook/Clerk] ${event.type} — upserted user ${id}`);
  return NextResponse.json({ success: true, clerk_id: id });
}
