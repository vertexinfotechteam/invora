'use server';

import { revalidatePath } from 'next/cache';

import { requireAdmin } from '@/lib/guards/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * Marks a contact message handled, or puts it back in the queue.
 *
 * Deliberately reversible: "handled" is a reading aid, not a destructive
 * action, and mis-clicking one in a long list should cost nothing. Nothing here
 * deletes — a support inbox that can silently lose a message is the problem
 * this table was added to solve.
 */
export async function setMessageHandledAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = String(formData.get('id') ?? '');
  if (!id) return;

  const handled = String(formData.get('handled') ?? '') === 'true';

  const admin = createSupabaseAdminClient();
  await admin
    .from('contact_messages')
    .update({ handled_at: handled ? new Date().toISOString() : null })
    .eq('id', id);

  revalidatePath('/admin/messages');
}
