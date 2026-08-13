'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { deleteAccountAction } from '@/app/(app)/actions';

/**
 * Requires typing the business name (or the literal word DELETE, for an
 * account that never got one) back exactly — the one-click "are you sure?"
 * browser confirm() is too easy to reflex-click through for something this
 * irreversible.
 */
export function DeleteAccountDialog({ confirmPhrase }: { confirmPhrase: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [typed, setTyped] = React.useState('');
  const [pending, setPending] = React.useState(false);

  const matches = typed === confirmPhrase;

  async function confirmDelete() {
    setPending(true);
    try {
      const result = await deleteAccountAction(typed);
      if (!result.ok) {
        toast.error(result.message ?? 'Could not delete your account.');
        setPending(false);
        return;
      }
      // On success the action itself redirects — this only runs if, for some
      // reason, it returns instead (it shouldn't on the happy path).
      router.push('/');
    } catch {
      // redirect() throws by design on success — this catch exists only so a
      // *genuine* thrown error doesn't leave the button stuck spinning.
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setTyped('');
      }}
    >
      <div className="card-surface space-y-3 border-destructive/30 p-5">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div>
            <h2 className="text-sm font-semibold">Danger zone</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Permanently delete your account, business profile, and every quotation, invoice,
              customer and catalog item attached to it. This cannot be undone, and there is no
              recovery window.
            </p>
          </div>
        </div>
        <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
          <Trash2 className="h-4 w-4" />
          Delete account
        </Button>
      </div>

      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Delete your account?
          </DialogTitle>
          <DialogDescription>
            This immediately and permanently deletes your business, every document, customer and
            catalog item you have, and signs you out. It cannot be reversed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <label htmlFor="delete-confirm" className="text-sm font-medium">
            Type <span className="font-mono text-destructive">{confirmPhrase}</span> to confirm
          </label>
          <Input
            id="delete-confirm"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoComplete="off"
            autoFocus
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => void confirmDelete()}
            disabled={!matches}
            loading={pending}
          >
            Permanently delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
