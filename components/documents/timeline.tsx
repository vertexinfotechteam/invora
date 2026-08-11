import {
  Ban,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  Eye,
  FileOutput,
  FilePlus2,
  Mail,
  PencilLine,
  Send,
  XCircle,
} from 'lucide-react';
import { EVENT_LABELS } from '@/lib/events';
import { formatDateTime } from '@/lib/utils';
import type { DocumentEvent, DocumentEventKind } from '@/lib/types/database';

const ICONS: Record<DocumentEventKind, React.ComponentType<{ className?: string }>> = {
  created: FilePlus2,
  edited: PencilLine,
  sent: Send,
  viewed: Eye,
  accepted: CheckCircle2,
  rejected: XCircle,
  expired: Clock,
  converted: FileOutput,
  payment_recorded: CircleDollarSign,
  paid: CheckCircle2,
  reminder_sent: Mail,
  cancelled: Ban,
};

const TONE: Partial<Record<DocumentEventKind, string>> = {
  accepted: 'text-success',
  paid: 'text-success',
  rejected: 'text-destructive',
  cancelled: 'text-destructive',
  expired: 'text-amber-600',
};

/**
 * The activity timeline. Rendered on every document, because "when did they
 * actually see it?" is the first question anyone asks about an unpaid invoice.
 */
export function DocumentTimeline({ events }: { events: DocumentEvent[] }) {
  return (
    <section className="card-surface p-4">
      <h2 className="text-sm font-semibold">Activity</h2>

      {events.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Nothing has happened yet.</p>
      ) : (
        <ol className="mt-3 space-y-3">
          {events.map((event) => {
            const Icon = ICONS[event.event] ?? PencilLine;
            return (
              <li key={event.id} className="flex gap-2.5">
                <span className="mt-0.5">
                  <Icon className={`h-4 w-4 ${TONE[event.event] ?? 'text-muted-foreground'}`} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{EVENT_LABELS[event.event] ?? event.event}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(event.created_at)} · {describeActor(event)}
                  </p>
                  <EventMeta event={event} />
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function describeActor(event: DocumentEvent): string {
  switch (event.actor) {
    case 'customer':
      return 'by the customer';
    case 'razorpay':
      return 'via Razorpay';
    case 'system':
      return 'automatically';
    default:
      return 'by you';
  }
}

function EventMeta({ event }: { event: DocumentEvent }) {
  const meta = event.meta ?? {};

  if (event.event === 'sent' && typeof meta.to === 'string') {
    return <p className="text-xs text-muted-foreground">to {meta.to}</p>;
  }
  if (
    (event.event === 'payment_recorded' || event.event === 'paid') &&
    typeof meta.amount_paise === 'number'
  ) {
    return (
      <p className="text-xs text-muted-foreground">
        {(meta.amount_paise / 100).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
        {typeof meta.method === 'string' ? ` · ${String(meta.method).replace('_', ' ')}` : ''}
      </p>
    );
  }
  if (event.event === 'accepted' && typeof meta.signed_name === 'string') {
    return <p className="text-xs text-muted-foreground">signed as {meta.signed_name}</p>;
  }
  if (event.event === 'converted' && typeof meta.invoice_number === 'string') {
    return <p className="text-xs text-muted-foreground">to invoice {meta.invoice_number}</p>;
  }
  if (event.event === 'edited' && meta.kind === 'payment_failed') {
    return (
      <p className="text-xs text-destructive">
        Payment attempt failed{typeof meta.reason === 'string' ? `: ${meta.reason}` : ''}
      </p>
    );
  }
  return null;
}
