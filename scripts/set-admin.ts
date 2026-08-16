/**
 * Creates (or updates) an admin account: a Supabase auth user with the given
 * email/password, promoted to role='admin' in app_users so it can sign in at
 * /admin/login.
 *
 * Usage:
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='...' npm run set-admin
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;

if (!url || !serviceKey) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running this.');
  process.exit(1);
}
if (!email || !password) {
  console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD, e.g.:');
  console.error("  ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='...' npm run set-admin");
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

async function main() {
  console.log(`Looking up existing user for ${email}…`);

  const { data: users, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (listError) throw listError;

  const existing = users.users.find((candidate) => candidate.email?.toLowerCase() === email!.toLowerCase());
  let userId: string;

  if (existing) {
    console.log(`Found existing user ${existing.id} — updating password.`);
    const { data, error } = await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
    });
    if (error) throw error;
    userId = data.user.id;
  } else {
    console.log('No existing user — creating one.');
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) throw error;
    userId = data.user.id;
  }

  // handle_new_user() (supabase/migrations/0005_functions_and_triggers.sql)
  // inserts an app_users row with role='user' on auth.users insert — this
  // promotes it to admin, or creates the row directly if it's somehow missing.
  const { error: upsertError } = await admin
    .from('app_users')
    .upsert({ user_id: userId, email, role: 'admin', suspended_at: null }, { onConflict: 'user_id' });
  if (upsertError) throw upsertError;

  console.log(`\nDone. ${email} can now sign in at /admin/login with the password you set.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
