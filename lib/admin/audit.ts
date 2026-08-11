import 'server-only';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { Json } from '@/lib/types/database';

export interface AdminAuditInput {
  adminUserId: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  /** Enforced by a CHECK constraint: at least 5 characters. */
  reason: string;
  before?: Json | null;
  after?: Json | null;
  ip?: string | null;
}

/**
 * Writes the admin audit row.
 *
 * Unlike document events, this one THROWS on failure. An admin mutation that
 * cannot be attributed must not happen — the audit row and the change are a
 * package, and the caller writes the audit row first.
 */
export async function recordAdminAction(input: AdminAuditInput): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from('admin_audit_log').insert({
    admin_user_id: input.adminUserId,
    action: input.action,
    target_type: input.targetType,
    target_id: input.targetId ?? null,
    reason: input.reason,
    before: input.before ?? null,
    after: input.after ?? null,
    ip: input.ip ?? null,
  });

  if (error) {
    throw new Error(`Refusing to proceed: admin action could not be audited (${error.message}).`);
  }
}
