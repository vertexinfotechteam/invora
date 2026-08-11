'use client';

import * as React from 'react';
import { Check, Copy, Link2, Share2 } from 'lucide-react';
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

/**
 * Mints a public link.
 *
 * The raw token exists only in this response — we store a hash — so the URL is
 * shown once and copying it is the point of the dialog. Minting a new link
 * revokes the previous one, which is said out loud rather than left as a
 * surprise.
 */
export function ShareDialog({
  docType,
  docId,
}: {
  docType: 'quotation' | 'invoice';
  docId: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [revoking, setRevoking] = React.useState(false);
  const [url, setUrl] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [days, setDays] = React.useState(30);

  async function create() {
    setPending(true);
    try {
      const response = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doc_type: docType, doc_id: docId, expires_in_days: days }),
      });
      const payload = await response.json();

      if (!response.ok) {
        toast.error(payload?.error?.message ?? 'Could not create a link.');
        return;
      }
      setUrl(payload.url);
    } catch {
      toast.error('Could not reach the server. Check your connection and try again.');
    } finally {
      setPending(false);
    }
  }

  async function copy() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success('Link copied.');
    setTimeout(() => setCopied(false), 2000);
  }

  async function revoke() {
    setRevoking(true);
    try {
      const response = await fetch(`/api/share?doc_type=${docType}&doc_id=${docId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        toast.error('Could not revoke the link. Try again.');
        return;
      }
      setUrl(null);
      toast.success('Every existing link for this document has been revoked.');
    } catch {
      toast.error('Could not reach the server. Check your connection and try again.');
    } finally {
      setRevoking(false);
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Share2 className="h-4 w-4" />
        Share
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share a private link</DialogTitle>
            <DialogDescription>
              Your customer opens this in any browser — no account, no sign-in. Creating a new link
              revokes any link you shared before.
            </DialogDescription>
          </DialogHeader>

          {url ? (
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input readOnly value={url} aria-label="Share link" className="font-mono text-xs" />
                <Button variant="outline" size="icon" onClick={copy} aria-label="Copy link">
                  {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Expires in {days} days. This is the only time the full link is shown — copy it now.
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={revoke}
                loading={revoking}
              >
                Revoke all links for this document
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <label className="block text-sm">
                Link expires after
                <select
                  value={days}
                  onChange={(event) => setDays(Number(event.target.value))}
                  className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
                >
                  {[7, 14, 30, 60, 90, 365].map((option) => (
                    <option key={option} value={option}>
                      {option} days
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
            {!url ? (
              <Button onClick={create} loading={pending}>
                <Link2 className="h-4 w-4" />
                Create link
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
