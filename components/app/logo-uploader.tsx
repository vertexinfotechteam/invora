'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ImageIcon, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';

import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import type { Business } from '@/lib/types/database';

const MAX_BYTES = 2 * 1024 * 1024;
const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

/**
 * Uploads straight to Supabase Storage from the browser.
 *
 * The storage policy keys on the first path segment being the caller's
 * business id, so a user cannot write into another tenant's folder even by
 * crafting the path by hand.
 */
export function LogoUploader({ business }: { business: Business }) {
  return (
    <section className="card-surface space-y-5 p-5">
      <div>
        <h2 className="text-sm font-semibold">Logo & signature</h2>
        <p className="text-xs text-muted-foreground">
          PNG, JPEG, WebP or SVG, up to 2 MB. Both appear on your PDFs.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <ImageSlot
          businessId={business.id}
          column="logo_url"
          currentUrl={business.logo_url}
          label="Business logo"
          hint="Shown top-left on Classic and Modern."
        />
        <ImageSlot
          businessId={business.id}
          column="signature_url"
          currentUrl={business.signature_url}
          label="Signature"
          hint="Printed above your business name at the foot of the document."
        />
      </div>
    </section>
  );
}

function ImageSlot({
  businessId,
  column,
  currentUrl,
  label,
  hint,
}: {
  businessId: string;
  column: 'logo_url' | 'signature_url';
  currentUrl: string | null;
  label: string;
  hint: string;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function upload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!ACCEPTED.includes(file.type)) {
      toast.error('Use a PNG, JPEG, WebP or SVG file.');
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error('That file is over 2 MB. Compress it and try again.');
      return;
    }

    setPending(true);
    try {
      const supabase = createClient();
      const extension = file.name.split('.').pop() ?? 'png';
      const path = `${businessId}/${column}-${Date.now()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from('branding')
        .upload(path, file, { upsert: true, cacheControl: '3600' });

      if (uploadError) {
        toast.error(`Upload failed: ${uploadError.message}`);
        return;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from('branding').getPublicUrl(path);

      const { error: updateError } = await supabase
        .from('businesses')
        .update({ [column]: publicUrl })
        .eq('id', businessId);

      if (updateError) {
        toast.error(`Saved the file but could not attach it: ${updateError.message}`);
        return;
      }

      toast.success(`${label} updated.`);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function remove() {
    const supabase = createClient();
    await supabase.from('businesses').update({ [column]: null }).eq('id', businessId);
    toast.success(`${label} removed.`);
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>

      <div className="flex h-28 items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 p-3">
        {currentUrl ? (
          // Storage host is arbitrary per project, so a plain <img> avoids
          // wiring every deployment's domain into next.config.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={currentUrl} alt={label} className="max-h-full max-w-full object-contain" />
        ) : (
          <ImageIcon className="h-6 w-6 text-muted-foreground" />
        )}
      </div>

      <div className="flex gap-2">
        <label className="flex-1">
          <input
            type="file"
            accept={ACCEPTED.join(',')}
            onChange={upload}
            disabled={pending}
            className="sr-only"
          />
          <span className="flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-input bg-background text-xs font-medium transition-colors hover:bg-secondary">
            <Upload className="h-3.5 w-3.5" />
            {pending ? 'Uploading…' : currentUrl ? 'Replace' : 'Upload'}
          </span>
        </label>

        {currentUrl ? (
          <Button variant="ghost" size="sm" onClick={remove} aria-label={`Remove ${label}`}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </div>

      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
