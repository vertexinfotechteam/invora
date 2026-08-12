'use client';

import * as React from 'react';
import Link from 'next/link';
import { Download, FileSpreadsheet, TriangleAlert } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/**
 * PDF/Excel download, with a one-time nudge when the business profile is
 * missing details that print on the document (name, logo, GSTIN, bank/UPI…).
 * Never blocks the download outright — "Download anyway" always works —
 * this is a reminder, not a gate, so it can't get in the way of someone who
 * has already decided their document is fine as-is.
 */
export function DownloadMenu({
  docType,
  docId,
  missingLabels,
}: {
  docType: 'quotation' | 'invoice';
  docId: string;
  missingLabels: string[];
}) {
  const [pendingFormat, setPendingFormat] = React.useState<'pdf' | 'excel' | null>(null);

  function urlFor(format: 'pdf' | 'excel') {
    const base = format === 'pdf' ? '/api/pdf' : '/api/excel';
    const query = format === 'pdf' ? '?download=1' : '';
    return `${base}/${docType}/${docId}${query}`;
  }

  function requestDownload(format: 'pdf' | 'excel') {
    if (missingLabels.length > 0) {
      setPendingFormat(format);
      return;
    }
    window.location.href = urlFor(format);
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => requestDownload('pdf')}>
        <Download className="h-4 w-4" />
        PDF
      </Button>
      <Button variant="outline" size="sm" onClick={() => requestDownload('excel')}>
        <FileSpreadsheet className="h-4 w-4" />
        Excel
      </Button>

      <Dialog open={pendingFormat !== null} onOpenChange={(open) => !open && setPendingFormat(null)}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TriangleAlert className="h-5 w-5 text-warning" />
              Your business profile is incomplete
            </DialogTitle>
            <DialogDescription>
              These appear on every {docType} you send, and are still missing:
            </DialogDescription>
          </DialogHeader>

          <ul className="space-y-1 text-sm text-muted-foreground">
            {missingLabels.map((label) => (
              <li key={label}>• {label}</li>
            ))}
          </ul>

          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              onClick={() => {
                if (pendingFormat) window.location.href = urlFor(pendingFormat);
                setPendingFormat(null);
              }}
            >
              Download anyway
            </Button>
            <Button asChild>
              <Link href="/settings/profile">Complete profile</Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
