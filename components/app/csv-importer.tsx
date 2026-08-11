'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Papa from 'papaparse';
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Upload } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';

const FIELDS = [
  { value: '__ignore__', label: 'Do not import' },
  { value: 'name', label: 'Contact name *' },
  { value: 'company', label: 'Company' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'gstin', label: 'GSTIN' },
  { value: 'address_line1', label: 'Address line 1' },
  { value: 'address_line2', label: 'Address line 2' },
  { value: 'city', label: 'City' },
  { value: 'state', label: 'State' },
  { value: 'postal_code', label: 'Postal code' },
  { value: 'notes', label: 'Notes' },
];

interface RowError {
  row: number;
  field: string;
  message: string;
  value: string;
}

type Step = 'upload' | 'map' | 'preview' | 'done';

/**
 * Upload → map columns → validate preview → commit → error report.
 *
 * The dry run is a real server-side validation pass, not a client-side guess,
 * so what the preview says will import is what imports.
 */
export function CsvImporter() {
  const router = useRouter();
  const [step, setStep] = React.useState<Step>('upload');
  const [headers, setHeaders] = React.useState<string[]>([]);
  const [rows, setRows] = React.useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = React.useState<Record<string, string>>({});
  const [pending, setPending] = React.useState(false);
  const [summary, setSummary] = React.useState<{
    willImport: number;
    willSkip: number;
    errors: RowError[];
  } | null>(null);
  const [result, setResult] = React.useState<{ imported: number; skipped: number; errors: RowError[] } | null>(
    null,
  );

  function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      complete: (parsed) => {
        const fields = parsed.meta.fields ?? [];
        if (fields.length === 0) {
          toast.error('That file has no header row we can read.');
          return;
        }
        if (parsed.data.length > 5000) {
          toast.error('That file has more than 5,000 rows. Split it and import in batches.');
          return;
        }

        setHeaders(fields);
        setRows(parsed.data);
        // Guess the mapping from the header names — most exports are close.
        setMapping(
          Object.fromEntries(
            fields.map((field) => [field, guessField(field)]),
          ) as Record<string, string>,
        );
        setStep('map');
      },
      error: () => toast.error('We could not read that file.'),
    });
  }

  async function runDryRun() {
    if (!Object.values(mapping).includes('name')) {
      toast.error('Map one column to “Contact name” — it is the only required field.');
      return;
    }

    setPending(true);
    try {
      const response = await fetch('/api/customers/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows, mapping, dryRun: true }),
      });
      const payload = await response.json();

      if (!response.ok) {
        toast.error(payload?.error?.message ?? 'The preview failed.');
        return;
      }
      setSummary(payload);
      setStep('preview');
    } catch {
      toast.error('Could not reach the server. Check your connection and try again.');
    } finally {
      setPending(false);
    }
  }

  async function commit() {
    setPending(true);
    try {
      const response = await fetch('/api/customers/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows, mapping, dryRun: false }),
      });
      const payload = await response.json();

      if (!response.ok) {
        toast.error(payload?.error?.message ?? 'The import failed.');
        return;
      }
      setResult(payload);
      setStep('done');
      router.refresh();
    } catch {
      toast.error('Could not reach the server. Check your connection and try again.');
    } finally {
      setPending(false);
    }
  }

  function downloadErrors(errors: RowError[]) {
    const csv = Papa.unparse(errors);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'invora-import-errors.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <Steps current={step} />

      {step === 'upload' ? (
        <label className="card-surface flex cursor-pointer flex-col items-center gap-3 border-dashed p-12 text-center transition-colors hover:border-primary">
          <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
          <div>
            <p className="font-medium">Choose a CSV file</p>
            <p className="mt-1 text-sm text-muted-foreground">
              The first row must be column headings. Up to 5,000 rows.
            </p>
          </div>
          <input type="file" accept=".csv,text/csv" onChange={onFile} className="sr-only" />
          <span className="mt-1 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            <Upload className="h-4 w-4" />
            Browse
          </span>
        </label>
      ) : null}

      {step === 'map' ? (
        <div className="card-surface overflow-hidden">
          <div className="border-b border-border px-5 py-3">
            <h2 className="text-sm font-semibold">Map your columns</h2>
            <p className="text-xs text-muted-foreground">
              {rows.length.toLocaleString()} rows found. We have guessed where we can.
            </p>
          </div>

          <ul className="divide-y divide-border">
            {headers.map((header) => (
              <li key={header} className="flex items-center justify-between gap-4 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{header}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    e.g. {rows[0]?.[header] || '—'}
                  </p>
                </div>
                <select
                  value={mapping[header] ?? '__ignore__'}
                  onChange={(event) =>
                    setMapping((current) => ({ ...current, [header]: event.target.value }))
                  }
                  aria-label={`Map column ${header}`}
                  className="h-9 w-56 shrink-0 rounded-lg border border-input bg-background px-2 text-sm"
                >
                  {FIELDS.map((field) => (
                    <option key={field.value} value={field.value}>
                      {field.label}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>

          <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
            <Button variant="outline" onClick={() => setStep('upload')}>
              Choose another file
            </Button>
            <Button onClick={runDryRun} loading={pending}>
              Validate
            </Button>
          </div>
        </div>
      ) : null}

      {step === 'preview' && summary ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="card-surface border-success/30 p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Will import
              </p>
              <p className="mt-1 text-2xl font-semibold tabular text-success">{summary.willImport}</p>
            </div>
            <div className="card-surface p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Will skip
              </p>
              <p className="mt-1 text-2xl font-semibold tabular">{summary.willSkip}</p>
            </div>
          </div>

          {summary.errors.length > 0 ? (
            <ErrorTable errors={summary.errors} onDownload={() => downloadErrors(summary.errors)} />
          ) : null}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setStep('map')}>
              Back to mapping
            </Button>
            <Button onClick={commit} loading={pending} disabled={summary.willImport === 0}>
              Import {summary.willImport} customers
            </Button>
          </div>
        </div>
      ) : null}

      {step === 'done' && result ? (
        <div className="space-y-4">
          <div className="card-surface flex items-center gap-3 border-success/30 bg-success/[0.04] p-5">
            <CheckCircle2 className="h-6 w-6 shrink-0 text-success" />
            <div>
              <p className="font-medium">Imported {result.imported} customers</p>
              {result.skipped > 0 ? (
                <p className="text-sm text-muted-foreground">
                  {result.skipped} rows were skipped because they did not validate.
                </p>
              ) : null}
            </div>
          </div>

          {result.errors.length > 0 ? (
            <ErrorTable errors={result.errors} onDownload={() => downloadErrors(result.errors)} />
          ) : null}

          <div className="flex justify-end">
            <Button onClick={() => router.push('/customers')}>Go to customers</Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ErrorTable({ errors, onDownload }: { errors: RowError[]; onDownload: () => void }) {
  return (
    <div className="card-surface overflow-hidden border-warning/40">
      <div className="flex items-center justify-between gap-3 border-b border-border bg-warning/10 px-5 py-3">
        <p className="flex items-center gap-2 text-sm font-medium text-amber-900">
          <AlertTriangle className="h-4 w-4" />
          {errors.length} problems found
        </p>
        <Button variant="outline" size="sm" onClick={onDownload}>
          <Download className="h-3.5 w-3.5" />
          Download report
        </Button>
      </div>

      <div className="max-h-64 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-background">
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-5 py-2 font-medium">Row</th>
              <th className="px-5 py-2 font-medium">Field</th>
              <th className="px-5 py-2 font-medium">Problem</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {errors.slice(0, 100).map((error, index) => (
              <tr key={`${error.row}-${error.field}-${index}`}>
                <td className="px-5 py-2 tabular">{error.row}</td>
                <td className="px-5 py-2 text-muted-foreground">{error.field}</td>
                <td className="px-5 py-2">{error.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Steps({ current }: { current: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: 'upload', label: 'Upload' },
    { key: 'map', label: 'Map columns' },
    { key: 'preview', label: 'Preview' },
    { key: 'done', label: 'Done' },
  ];
  const activeIndex = steps.findIndex((step) => step.key === current);

  return (
    <ol className="flex flex-wrap items-center gap-2 text-xs">
      {steps.map((step, index) => (
        <li key={step.key} className="flex items-center gap-2">
          <span
            className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${
              index <= activeIndex ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}
          >
            {index + 1}
          </span>
          <span className={index <= activeIndex ? 'font-medium' : 'text-muted-foreground'}>
            {step.label}
          </span>
          {index < steps.length - 1 ? <span className="text-muted-foreground">›</span> : null}
        </li>
      ))}
    </ol>
  );
}

function guessField(header: string): string {
  const normalised = header.toLowerCase().replace(/[^a-z]/g, '');
  const guesses: Record<string, string> = {
    name: 'name',
    contactname: 'name',
    fullname: 'name',
    customer: 'name',
    customername: 'name',
    company: 'company',
    companyname: 'company',
    organisation: 'company',
    organization: 'company',
    email: 'email',
    emailaddress: 'email',
    phone: 'phone',
    mobile: 'phone',
    phonenumber: 'phone',
    gstin: 'gstin',
    gst: 'gstin',
    address: 'address_line1',
    addressline1: 'address_line1',
    addressline2: 'address_line2',
    city: 'city',
    state: 'state',
    pincode: 'postal_code',
    postalcode: 'postal_code',
    zip: 'postal_code',
    notes: 'notes',
  };
  return guesses[normalised] ?? '__ignore__';
}
