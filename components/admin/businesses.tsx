'use client';

import * as React from 'react';
import { Search } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { Badge } from '@/components/ui/badge';
import { TableSkeleton, EmptyState, ErrorState } from '@/components/ui/states';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatDate } from '@/lib/utils';

interface BusinessRow {
  id: string;
  name: string;
  email: string | null;
  created_at: string;
  subscriptions: { plan_code: string; status: string; current_period_end: string } | null;
  account_role: string;
  account_suspended_at: string | null;
}

/**
 * Operator search across tenants.
 *
 * Every mutation here requires a typed reason, which is written to
 * admin_audit_log *before* the change lands. If the audit write fails, the
 * change does not happen — an unattributable admin action is worse than an
 * unmade one.
 */
export function AdminBusinesses() {
  const [query, setQuery] = React.useState('');
  const [rows, setRows] = React.useState<BusinessRow[] | null>(null);
  const [error, setError] = React.useState(false);
  const [target, setTarget] = React.useState<BusinessRow | null>(null);

  const load = React.useCallback(async (search: string) => {
    setError(false);
    setRows(null);
    try {
      const response = await fetch(`/api/admin/businesses?q=${encodeURIComponent(search)}`);
      if (!response.ok) {
        setError(true);
        return;
      }
      const payload = await response.json();
      setRows(payload.businesses);
    } catch {
      setError(true);
    }
  }, []);

  React.useEffect(() => {
    void load('');
  }, [load]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Businesses</h1>
        <p className="text-sm text-muted-foreground">
          Search every tenant. Changes are audited with a mandatory reason.
        </p>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void load(query);
        }}
        className="flex gap-2 sm:max-w-md"
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Business name or email…"
            aria-label="Search businesses"
            className="pl-9"
          />
        </div>
        <Button type="submit">Search</Button>
      </form>

      {error ? (
        <ErrorState description="Could not load businesses." onRetry={() => void load(query)} />
      ) : rows === null ? (
        <TableSkeleton rows={6} columns={5} />
      ) : rows.length === 0 ? (
        <EmptyState title="No businesses match" description="Try a different name or email." />
      ) : (
        <div className="card-surface overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Business</th>
                <th className="px-4 py-2.5 font-medium">Email</th>
                <th className="px-4 py-2.5 font-medium">Plan</th>
                <th className="px-4 py-2.5 font-medium">Joined</th>
                <th className="px-4 py-2.5 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => {
                const subscription = Array.isArray(row.subscriptions)
                  ? row.subscriptions[0]
                  : row.subscriptions;
                return (
                  <tr key={row.id}>
                    <td className="px-4 py-3 font-medium">{row.name || '(unnamed)'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.email ?? '—'}</td>
                    <td className="px-4 py-3">
                      <Badge variant={subscription?.plan_code === 'free' ? 'neutral' : 'default'}>
                        {subscription?.plan_code ?? 'free'}
                      </Badge>
                      {subscription?.status && subscription.status !== 'active' ? (
                        <Badge variant="warning" className="ml-1">
                          {subscription.status}
                        </Badge>
                      ) : null}
                      {row.account_suspended_at ? (
                        <Badge variant="danger" className="ml-1">
                          Suspended
                        </Badge>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(row.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="outline" size="sm" onClick={() => setTarget(row)}>
                        Manage
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ManageDialog
        target={target}
        onClose={() => setTarget(null)}
        onDone={() => {
          setTarget(null);
          void load(query);
        }}
      />
    </div>
  );
}

function ManageDialog({
  target,
  onClose,
  onDone,
}: {
  target: BusinessRow | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = React.useState('');
  const [bonusDocs, setBonusDocs] = React.useState('0');
  const [bonusCredits, setBonusCredits] = React.useState('0');
  const [confirmEmail, setConfirmEmail] = React.useState('');
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    setReason('');
    setBonusDocs('0');
    setBonusCredits('0');
    setConfirmEmail('');
  }, [target]);

  async function send(body: Record<string, unknown>) {
    if (reason.trim().length < 5) {
      toast.error('A reason of at least 5 characters is required.');
      return;
    }

    setPending(true);
    try {
      const response = await fetch('/api/admin/businesses', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, target_business_id: target?.id, reason }),
      });
      const payload = await response.json();

      if (!response.ok) {
        toast.error(payload?.error?.message ?? 'The change was rejected.');
        return;
      }
      toast.success('Done, and recorded in the audit log.');
      onDone();
    } finally {
      setPending(false);
    }
  }

  async function sendDelete() {
    if (reason.trim().length < 5) {
      toast.error('A reason of at least 5 characters is required.');
      return;
    }

    setPending(true);
    try {
      const response = await fetch('/api/admin/businesses', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_business_id: target?.id,
          reason,
          confirm_email: confirmEmail,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        toast.error(payload?.error?.message ?? 'The account could not be deleted.');
        return;
      }
      toast.success('Account permanently deleted, and recorded in the audit log.');
      onDone();
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={Boolean(target)} onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{target?.name || 'Business'}</DialogTitle>
          <DialogDescription>
            Every action below writes an audit row with your identity, the reason, and a
            before/after snapshot.
          </DialogDescription>
        </DialogHeader>

        <Field
          label="Reason"
          htmlFor="admin-reason"
          hint="Required. Include a ticket reference where there is one."
          required
        >
          <Textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={2}
            placeholder="Customer reported a failed upgrade — INV-2231"
          />
        </Field>

        <section className="space-y-3 rounded-lg border border-border p-4">
          <h3 className="text-sm font-medium">Subscription</h3>
          <div className="flex flex-wrap gap-2">
            {(['activate', 'cancel', 'suspend', 'reactivate'] as const).map((action) => (
              <Button
                key={action}
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => send({ kind: 'subscription', action })}
                className="capitalize"
              >
                {action}
              </Button>
            ))}
          </div>
        </section>

        <section className="space-y-3 rounded-lg border border-border p-4">
          <h3 className="text-sm font-medium">Bonus allowances</h3>
          <p className="text-xs text-muted-foreground">
            Added on top of the plan allowance for every period, until you set them back to zero.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Bonus documents" htmlFor="bonus-docs">
              <Input
                type="number"
                min={0}
                value={bonusDocs}
                onChange={(event) => setBonusDocs(event.target.value)}
              />
            </Field>
            <Field label="Bonus AI credits" htmlFor="bonus-credits">
              <Input
                type="number"
                min={0}
                value={bonusCredits}
                onChange={(event) => setBonusCredits(event.target.value)}
              />
            </Field>
          </div>
          <Button
            size="sm"
            disabled={pending}
            onClick={() =>
              send({
                kind: 'limits',
                bonus_doc_limit: Number(bonusDocs),
                bonus_ai_credits: Number(bonusCredits),
              })
            }
          >
            Apply allowances
          </Button>
        </section>

        {target?.account_role === 'admin' ? (
          <section className="space-y-2 rounded-lg border border-border p-4">
            <h3 className="text-sm font-medium">Account</h3>
            <p className="text-xs text-muted-foreground">
              This account has admin access — it cannot be suspended or deleted from this panel.
            </p>
          </section>
        ) : (
          <section className="space-y-4 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
            <div>
              <h3 className="text-sm font-medium text-destructive">Danger zone</h3>
              <p className="text-xs text-muted-foreground">
                Suspending blocks sign-in immediately and can be undone. Deleting is permanent.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {target?.account_suspended_at ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => send({ kind: 'account', action: 'unsuspend' })}
                >
                  Unsuspend account
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => send({ kind: 'account', action: 'suspend' })}
                >
                  Suspend account
                </Button>
              )}
            </div>

            <div className="space-y-2 border-t border-destructive/20 pt-4">
              <Field
                label="Type the account's email to confirm permanent deletion"
                htmlFor="confirm-email"
                hint={target?.email ? `Type "${target.email}" exactly.` : undefined}
              >
                <Input
                  id="confirm-email"
                  value={confirmEmail}
                  onChange={(event) => setConfirmEmail(event.target.value)}
                  placeholder={target?.email ?? 'account email'}
                  autoComplete="off"
                />
              </Field>
              <Button
                variant="destructive"
                size="sm"
                disabled={
                  pending ||
                  !target?.email ||
                  confirmEmail.trim().toLowerCase() !== target.email.trim().toLowerCase()
                }
                onClick={() => {
                  if (!confirm(`Permanently delete ${target?.name || target?.email}? This cannot be undone.`)) return;
                  void sendDelete();
                }}
              >
                Permanently delete account
              </Button>
            </div>
          </section>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
