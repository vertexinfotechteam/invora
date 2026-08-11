import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { requireBusiness } from '@/lib/guards/auth';
import { enforceRateLimit } from '@/lib/guards/rate-limit';
import { badRequest, withApiErrors } from '@/lib/guards/errors';
import { assertFeature } from '@/lib/guards/features';
import { customerSchema } from '@/lib/validation/schemas';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  rows: z.array(z.record(z.string(), z.string())).min(1).max(5000),
  /** csvColumn -> customer field */
  mapping: z.record(z.string(), z.string()),
  dryRun: z.boolean().default(true),
});

export interface ImportRowError {
  row: number;
  field: string;
  message: string;
  value: string;
}

/**
 * POST /api/customers/import — CSV import (Premium).
 *
 * Validates every row, imports the good ones, and reports the bad ones with
 * their original row numbers so the user can fix a spreadsheet rather than
 * guess. A `dryRun` pass powers the preview screen.
 */
export const POST = withApiErrors(async (request: NextRequest) => {
  const { user, business } = await requireBusiness();
  await enforceRateLimit('bulk', `customer-import:${user.id}`);
  await assertFeature(business.id, 'csv_import');

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) throw badRequest('The import payload was malformed.');
  const { rows, mapping, dryRun } = parsed.data;

  const valid: z.infer<typeof customerSchema>[] = [];
  const errors: ImportRowError[] = [];

  rows.forEach((raw, index) => {
    const candidate: Record<string, string> = {};
    for (const [csvColumn, field] of Object.entries(mapping)) {
      if (!field || field === '__ignore__') continue;
      const value = (raw[csvColumn] ?? '').trim();
      if (value) candidate[field] = value;
    }

    const result = customerSchema.safeParse(candidate);
    if (result.success) {
      valid.push(result.data);
    } else {
      // +2: one for the header row, one because spreadsheets are 1-indexed.
      const rowNumber = index + 2;
      for (const issue of result.error.issues) {
        const field = String(issue.path[0] ?? 'row');
        errors.push({
          row: rowNumber,
          field,
          message: issue.message,
          value: candidate[field] ?? '',
        });
      }
    }
  });

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      willImport: valid.length,
      willSkip: rows.length - valid.length,
      errors: errors.slice(0, 200),
      preview: valid.slice(0, 10),
    });
  }

  const supabase = await createSupabaseServerClient();
  let imported = 0;

  // Chunked so a 5,000-row file does not become one enormous statement.
  for (let offset = 0; offset < valid.length; offset += 200) {
    const chunk = valid.slice(offset, offset + 200).map((customer) => ({
      ...customer,
      business_id: business.id,
    }));

    const { error, count } = await supabase
      .from('customers')
      .insert(chunk as never, { count: 'exact' });

    if (error) {
      throw badRequest(`Import stopped after ${imported} rows: ${error.message}`);
    }
    imported += count ?? chunk.length;
  }

  return NextResponse.json({
    dryRun: false,
    imported,
    skipped: rows.length - valid.length,
    errors: errors.slice(0, 500),
  });
});
