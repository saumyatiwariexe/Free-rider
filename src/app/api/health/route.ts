import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/health
 * Phase 0 verification endpoint.
 * Checks that the Supabase connection is live by running a trivial query.
 * Remove or gate this behind auth before going to prod.
 */
export async function GET() {
  try {
    const db = getSupabaseAdmin();
    // A SELECT 1 equivalent — just proves the connection is up
    const { error } = await db.from('users').select('id').limit(1);

    if (error) {
      // Table doesn't exist yet (Phase 1 adds the schema) — that's fine for Phase 0
      const isTableMissing = error.message.includes('does not exist');
      return NextResponse.json({
        status: 'degraded',
        supabase: isTableMissing
          ? 'connected — schema not yet applied (run Phase 1 migrations)'
          : `error: ${error.message}`,
      }, { status: isTableMissing ? 200 : 500 });
    }

    return NextResponse.json({ status: 'ok', supabase: 'connected' });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ status: 'error', detail: message }, { status: 500 });
  }
}
