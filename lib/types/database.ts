/**
 * Hand-maintained mirror of supabase/migrations/*.sql.
 *
 * Regenerate-by-hand rule: if you add a column in a migration, add it here in
 * the same commit. `npm run typecheck` is what stops the two drifting.
 */

export type AppRole = 'user' | 'support' | 'admin';
export type QuotationStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired';
export type InvoiceStatus =
  | 'draft' | 'sent' | 'viewed' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled';
export type DocumentType = 'quotation' | 'invoice';
export type PaymentMethod = 'cash' | 'upi' | 'bank_transfer' | 'cheque' | 'card' | 'other';
export type PaymentSource = 'manual' | 'razorpay';
export type SubscriptionStatus =
  | 'active' | 'past_due' | 'halted' | 'cancelled' | 'expired' | 'pending';
export type TaxModeDb = 'exclusive' | 'inclusive';
export type AiCallStatus =
  | 'ok' | 'error' | 'refusal' | 'rate_limited' | 'credit_exhausted' | 'too_large';
export type WebhookStatus = 'received' | 'processed' | 'failed' | 'ignored';
export type DocumentEventKind =
  | 'created' | 'edited' | 'sent' | 'viewed' | 'accepted' | 'rejected'
  | 'expired' | 'converted' | 'payment_recorded' | 'paid' | 'reminder_sent' | 'cancelled';

export type Json = string | number | boolean | null | { [k: string]: Json } | Json[];

export interface TaxBucketRow {
  ratePct: number;
  taxablePaise: number;
  taxPaise: number;
}

export interface AppUser {
  user_id: string;
  email: string;
  full_name: string | null;
  role: AppRole;
  suspended_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Business {
  id: string;
  owner_user_id: string;
  name: string;
  legal_name: string | null;
  logo_url: string | null;
  signature_url: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string;
  gstin: string | null;
  pan: string | null;
  currency: string;
  locale: string;
  timezone: string;
  quote_prefix: string;
  invoice_prefix: string;
  next_quote_no: number;
  next_invoice_no: number;
  number_padding: number;
  default_tax_rate: number;
  default_tax_mode: TaxModeDb;
  default_payment_terms: string;
  default_terms: string | null;
  default_notes: string | null;
  quote_validity_days: number;
  invoice_due_days: number;
  bank_account_name: string | null;
  bank_account_no: string | null;
  bank_ifsc: string | null;
  bank_name: string | null;
  upi_id: string | null;
  brand_color: string;
  pdf_template: string;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  business_id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  gstin: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  notes: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  sku: string | null;
  unit: string;
  default_price_paise: number;
  tax_rate: number;
  default_discount_pct: number;
  hsn_sac: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Quotation {
  id: string;
  business_id: string;
  customer_id: string | null;
  number: string;
  title: string | null;
  status: QuotationStatus;
  issue_date: string;
  valid_until: string | null;
  currency: string;
  tax_mode: TaxModeDb;
  doc_discount_pct: number;
  subtotal_paise: number;
  discount_paise: number;
  tax_paise: number;
  total_paise: number;
  tax_breakup: TaxBucketRow[];
  notes: string | null;
  scope: string | null;
  deliverables: string | null;
  exclusions: string | null;
  payment_terms: string | null;
  terms: string | null;
  converted_invoice_id: string | null;
  sent_at: string | null;
  viewed_at: string | null;
  responded_at: string | null;
  accepted_by_name: string | null;
  accepted_ip: string | null;
  accepted_user_agent: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: string;
  business_id: string;
  customer_id: string | null;
  quotation_id: string | null;
  number: string;
  title: string | null;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string | null;
  currency: string;
  tax_mode: TaxModeDb;
  doc_discount_pct: number;
  subtotal_paise: number;
  discount_paise: number;
  tax_paise: number;
  total_paise: number;
  tax_breakup: TaxBucketRow[];
  amount_paid_paise: number;
  /** Generated column — read-only. */
  balance_paise: number;
  notes: string | null;
  scope: string | null;
  payment_terms: string | null;
  terms: string | null;
  sent_at: string | null;
  viewed_at: string | null;
  paid_at: string | null;
  last_reminder_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface LineItemRow {
  id: string;
  business_id: string;
  product_id: string | null;
  position: number;
  name: string;
  description: string | null;
  unit: string;
  qty: number;
  rate_paise: number;
  discount_pct: number;
  tax_rate: number;
  hsn_sac: string | null;
  line_total_paise: number;
  created_at: string;
}

export interface QuotationItem extends LineItemRow {
  quotation_id: string;
}
export interface InvoiceItem extends LineItemRow {
  invoice_id: string;
}

export interface Payment {
  id: string;
  business_id: string;
  invoice_id: string;
  amount_paise: number;
  paid_at: string;
  method: PaymentMethod;
  source: PaymentSource;
  reference: string | null;
  notes: string | null;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  recorded_by: string | null;
  created_at: string;
}

export interface ShareLink {
  id: string;
  business_id: string;
  doc_type: DocumentType;
  doc_id: string;
  token_hash: string;
  expires_at: string | null;
  revoked_at: string | null;
  viewed_at: string | null;
  view_count: number;
  created_by: string | null;
  created_at: string;
}

export interface DocumentEvent {
  id: number;
  business_id: string;
  doc_type: DocumentType;
  doc_id: string;
  event: DocumentEventKind;
  actor: string;
  actor_id: string | null;
  meta: Record<string, Json>;
  created_at: string;
}

export interface PlanFeatures {
  premium_templates: boolean;
  remove_branding: boolean;
  csv_import: boolean;
  csv_export: boolean;
  scheduled_reminders: boolean;
  full_reports: boolean;
  priority_support: boolean;
  templates: string[];
}

export interface Plan {
  code: string;
  name: string;
  description: string | null;
  price_paise: number;
  interval: 'month' | 'year';
  doc_limit: number;
  ai_credit_limit: number;
  features: PlanFeatures;
  is_public: boolean;
  sort_order: number;
  created_at: string;
}

export interface Subscription {
  id: string;
  business_id: string;
  plan_code: string;
  status: SubscriptionStatus;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  cancelled_at: string | null;
  razorpay_subscription_id: string | null;
  razorpay_customer_id: string | null;
  bonus_doc_limit: number;
  bonus_ai_credits: number;
  created_at: string;
  updated_at: string;
}

export interface UsageCounter {
  id: string;
  business_id: string;
  period_start: string;
  period_end: string;
  docs_used: number;
  ai_credits_used: number;
  created_at: string;
  updated_at: string;
}

export interface AiUsageLog {
  id: number;
  business_id: string | null;
  user_id: string | null;
  feature: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_creation_tokens: number;
  estimated_cost_usd: number;
  latency_ms: number;
  status: AiCallStatus;
  error_code: string | null;
  stop_reason: string | null;
  credit_charged: boolean;
  meta: Record<string, Json>;
  created_at: string;
}

export interface WebhookEvent {
  id: number;
  provider: string;
  event_id: string;
  event_type: string | null;
  payload: Json;
  status: WebhookStatus;
  error: string | null;
  received_at: string;
  processed_at: string | null;
}

export interface AdminAuditLog {
  id: number;
  admin_user_id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  reason: string;
  before: Json | null;
  after: Json | null;
  ip: string | null;
  created_at: string;
}

export interface EmailLog {
  id: number;
  business_id: string | null;
  to_email: string;
  template: string;
  subject: string | null;
  doc_type: DocumentType | null;
  doc_id: string | null;
  provider_id: string | null;
  status: string;
  error: string | null;
  created_at: string;
}

type Writable<T, Generated extends keyof T = never> = Omit<T, Generated> & Partial<Pick<T, Generated>>;
type TableDef<Row, Generated extends keyof Row = never> = {
  Row: Row;
  Insert: Writable<Row, Generated>;
  Update: Partial<Row>;
  Relationships: [];
};

type Timestamps = 'id' | 'created_at' | 'updated_at';

export interface Database {
  public: {
    Tables: {
      app_users: TableDef<AppUser, 'created_at' | 'updated_at' | 'role' | 'suspended_at' | 'full_name'>;
      businesses: TableDef<Business, keyof Omit<Business, 'owner_user_id'>>;
      customers: TableDef<Customer, Exclude<keyof Customer, 'business_id' | 'name'>>;
      products: TableDef<Product, Exclude<keyof Product, 'business_id' | 'name'>>;
      quotations: TableDef<Quotation, Exclude<keyof Quotation, 'business_id' | 'number'>>;
      quotation_items: TableDef<QuotationItem, Exclude<keyof QuotationItem, 'business_id' | 'quotation_id' | 'name'>>;
      invoices: TableDef<Invoice, Exclude<keyof Invoice, 'business_id' | 'number'>>;
      invoice_items: TableDef<InvoiceItem, Exclude<keyof InvoiceItem, 'business_id' | 'invoice_id' | 'name'>>;
      payments: TableDef<Payment, Exclude<keyof Payment, 'business_id' | 'invoice_id' | 'amount_paise'>>;
      share_links: TableDef<ShareLink, Exclude<keyof ShareLink, 'business_id' | 'doc_type' | 'doc_id' | 'token_hash'>>;
      document_events: TableDef<DocumentEvent, Exclude<keyof DocumentEvent, 'business_id' | 'doc_type' | 'doc_id' | 'event'>>;
      plans: TableDef<Plan, 'created_at'>;
      subscriptions: TableDef<Subscription, Timestamps>;
      usage_counters: TableDef<UsageCounter, Timestamps>;
      ai_usage_logs: TableDef<AiUsageLog, 'id' | 'created_at'>;
      webhook_events: TableDef<WebhookEvent, 'id' | 'received_at' | 'processed_at' | 'status' | 'error' | 'event_type'>;
      admin_audit_log: TableDef<AdminAuditLog, 'id' | 'created_at' | 'before' | 'after' | 'ip' | 'target_id'>;
      email_log: TableDef<EmailLog, 'id' | 'created_at'>;
    };
    Views: {
      v_revenue_daily: { Row: { business_id: string; day: string; amount_paise: number; payment_count: number } };
      v_document_activity_daily: {
        Row: { business_id: string; day: string; doc_type: DocumentType; event: DocumentEventKind; event_count: number };
      };
      v_ai_cost_daily: {
        Row: {
          business_id: string | null; day: string; model: string; requests: number;
          input_tokens: number; output_tokens: number; cache_read_tokens: number; cost_usd: number;
        };
      };
      v_receivables: {
        Row: { business_id: string; outstanding_paise: number | null; overdue_paise: number | null; overdue_count: number };
      };
      v_mrr_by_plan: { Row: { plan_code: string; subscribers: number; mrr_paise: number } };
    };
    Functions: {
      current_business_id: { Args: Record<string, never>; Returns: string };
      is_admin: { Args: Record<string, never>; Returns: boolean };
      next_document_number: { Args: { p_business_id: string; p_doc_type: DocumentType }; Returns: string };
      consume_ai_credits: {
        Args: { p_business_id: string; p_amount?: number };
        Returns: { allowed: boolean; used: number; allowance: number }[];
      };
      release_ai_credits: { Args: { p_business_id: string; p_amount?: number }; Returns: undefined };
      consume_document_quota: {
        Args: { p_business_id: string; p_amount?: number };
        Returns: { allowed: boolean; used: number; allowance: number }[];
      };
      ensure_usage_period: { Args: { p_business_id: string }; Returns: UsageCounter };
      effective_limits: {
        Args: { p_business_id: string };
        Returns: { doc_limit: number; ai_credit_limit: number; plan_code: string }[];
      };
      convert_quotation_to_invoice: { Args: { p_quotation_id: string }; Returns: string };
    };
    Enums: {
      app_role: AppRole;
      quotation_status: QuotationStatus;
      invoice_status: InvoiceStatus;
      document_type: DocumentType;
      payment_method: PaymentMethod;
      payment_source: PaymentSource;
      subscription_status: SubscriptionStatus;
      tax_mode: TaxModeDb;
      ai_call_status: AiCallStatus;
      webhook_status: WebhookStatus;
      document_event_kind: DocumentEventKind;
    };
    CompositeTypes: Record<string, never>;
  };
}
