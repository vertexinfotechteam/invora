import { NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/guards/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { withApiErrors } from '@/lib/guards/errors';
import { DEMO_CONNECTION_ID } from '@/lib/google/calendar';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withApiErrors(async () => {
  await requireAdmin();

  const admin = createSupabaseAdminClient();
  await admin.from('demo_calendar_connection').delete().eq('id', DEMO_CONNECTION_ID);

  return NextResponse.json({ ok: true });
});
