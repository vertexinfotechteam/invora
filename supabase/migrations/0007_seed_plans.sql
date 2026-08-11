-- =============================================================================
-- Invora 0007 — plan catalog
--
-- Feature flags live in `features` and are read server-side by assertFeature().
-- Hiding a button in the UI is cosmetic; this table is the actual gate.
-- =============================================================================

insert into public.plans (code, name, description, price_paise, interval, doc_limit, ai_credit_limit, sort_order, features)
values
  (
    'free',
    'Starter',
    'Everything you need to send your first professional quotations and invoices.',
    0, 'month', 10, 15, 0,
    jsonb_build_object(
      'premium_templates', false,
      'remove_branding',   false,
      'csv_import',        false,
      'csv_export',        false,
      'scheduled_reminders', false,
      'full_reports',      false,
      'priority_support',  false,
      'templates',         jsonb_build_array('classic')
    )
  ),
  (
    'premium_monthly',
    'Premium',
    'Unlimited-feeling limits, branded templates, automation and full reporting.',
    99900, 'month', 500, 500, 1,
    jsonb_build_object(
      'premium_templates', true,
      'remove_branding',   true,
      'csv_import',        true,
      'csv_export',        true,
      'scheduled_reminders', true,
      'full_reports',      true,
      'priority_support',  true,
      'templates',         jsonb_build_array('classic', 'modern', 'minimal')
    )
  ),
  (
    'premium_yearly',
    'Premium (annual)',
    'The Premium plan billed yearly — two months free.',
    999000, 'year', 500, 500, 2,
    jsonb_build_object(
      'premium_templates', true,
      'remove_branding',   true,
      'csv_import',        true,
      'csv_export',        true,
      'scheduled_reminders', true,
      'full_reports',      true,
      'priority_support',  true,
      'templates',         jsonb_build_array('classic', 'modern', 'minimal')
    )
  )
on conflict (code) do update set
  name            = excluded.name,
  description     = excluded.description,
  price_paise     = excluded.price_paise,
  doc_limit       = excluded.doc_limit,
  ai_credit_limit = excluded.ai_credit_limit,
  features        = excluded.features,
  sort_order      = excluded.sort_order;
