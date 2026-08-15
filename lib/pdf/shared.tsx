import React from 'react';
import { StyleSheet, Text, View } from '@react-pdf/renderer';
import { formatPaise, formatPercent, formatQty } from '@/lib/money';
import type { PdfDocumentData, PdfParty } from '@/lib/pdf/types';

/**
 * Pieces shared by all three templates.
 *
 * Multi-page correctness lives here: the table header carries `fixed` so it
 * repeats on every page, and each row is `wrap={false}` so a row is never
 * split across a page break. Both were verified against a 40-line document.
 */

export const base = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 64,
    paddingHorizontal: 40,
    fontSize: 9.5,
    color: '#0f172a',
    lineHeight: 1.45,
    fontFamily: 'Helvetica',
  },
  row: { flexDirection: 'row' },
  spread: { flexDirection: 'row', justifyContent: 'space-between' },
  muted: { color: '#64748b' },
  bold: { fontFamily: 'Helvetica-Bold' },
  small: { fontSize: 8.5 },
  h1: { fontSize: 20, fontFamily: 'Helvetica-Bold', letterSpacing: -0.3 },
  h2: { fontSize: 11, fontFamily: 'Helvetica-Bold' },
  sectionLabel: {
    fontSize: 7.5,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: '#64748b',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  hr: { borderBottomWidth: 1, borderBottomColor: '#e2e8f0', marginVertical: 12 },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 40,
    right: 40,
    fontSize: 7.5,
    color: '#94a3b8',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});

export const tableStyles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
    paddingVertical: 6,
    fontSize: 7.5,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    fontFamily: 'Helvetica-Bold',
    color: '#475569',
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#e2e8f0',
    paddingVertical: 6,
  },
  cIndex: { width: '5%' },
  cItem: { width: '43%', paddingRight: 8 },
  cQty: { width: '11%', textAlign: 'right' },
  cRate: { width: '15%', textAlign: 'right' },
  cTax: { width: '11%', textAlign: 'right' },
  cAmount: { width: '15%', textAlign: 'right' },
});

/**
 * Currency symbols the PDF's base-14 fonts cannot encode, and what to print
 * instead.
 *
 * The PDF uses Helvetica, one of the 14 standard fonts, which are limited to
 * WinAnsi encoding. `₹` is U+20B9; WinAnsi has no such glyph, so the encoder
 * truncates the code point to its low byte, 0xB9 — which is `¹`. That is why
 * every rupee amount in a downloaded PDF read "¹1,20,000.00".
 *
 * Printing "Rs." keeps the PDF readable with no bundled font. Rendering the
 * real ₹ (or any Devanagari/Gujarati text) needs a Unicode TTF registered with
 * Font.register — see the note in docs/ if that becomes a requirement.
 */
const PDF_UNPRINTABLE_CURRENCY: Record<string, string> = { INR: 'Rs.' };

/**
 * Characters outside WinAnsi that we emit deliberately, and their ASCII stand-ins.
 * U+2212 (the real minus sign) is used on the Discount and Paid rows; it has no
 * WinAnsi slot either, so it corrupted exactly the way `₹` did.
 */
const ASCII_SUBSTITUTES: Record<string, string> = {
  '₹': 'Rs.', // ₹
  '−': '-', // minus sign
  '–': '-', // en dash
  '—': '-', // em dash
  '‘': "'",
  '’': "'",
  '“': '"',
  '”': '"',
  '…': '...',
  ' ': ' ',
};

/**
 * Makes a string safe for the base-14 fonts, which can only encode code points
 * present in WinAnsi (roughly Latin-1). Anything above U+00FF is truncated to
 * its low byte by the encoder rather than dropped — which is why `₹` (U+20B9)
 * printed as `¹` (0xB9) instead of simply going missing.
 *
 * Substitutes what we can and drops the rest, so a stray character can never
 * silently corrupt a money figure on a document a customer receives.
 */
export function pdfSafe(text: string): string {
  let out = '';
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (code <= 0xff) out += char;
    else out += ASCII_SUBSTITUTES[char] ?? '';
  }
  return out;
}

export function money(paise: number, data: PdfDocumentData): string {
  // Normalised because `currency` is char(3) and nothing upstream guarantees
  // its case; a stored "inr" missed the lookup and fell through to the symbol.
  const fallback = PDF_UNPRINTABLE_CURRENCY[(data.currency ?? '').trim().toUpperCase()];

  if (fallback) {
    const amount = formatPaise(paise, data.currency, data.locale, { withSymbol: false });
    return `${fallback} ${amount}`;
  }

  // Any other currency: whatever Intl produced still has to survive the encoder.
  return pdfSafe(formatPaise(paise, data.currency, data.locale));
}

export function PartyBlock({ label, party }: { label: string; party: PdfParty | null }) {
  if (!party) return null;
  return (
    <View style={{ maxWidth: 220 }}>
      <Text style={base.sectionLabel}>{label}</Text>
      <Text style={base.bold}>{party.company || party.name}</Text>
      {party.company && party.name !== party.company ? <Text>{party.name}</Text> : null}
      {party.addressLines.map((line, index) => (
        <Text key={`${label}-addr-${index}`} style={base.muted}>
          {line}
        </Text>
      ))}
      {party.email ? <Text style={base.muted}>{party.email}</Text> : null}
      {party.phone ? <Text style={base.muted}>{party.phone}</Text> : null}
      {party.gstin ? <Text style={[base.muted, base.small]}>GSTIN: {party.gstin}</Text> : null}
    </View>
  );
}

export function LineItemsTable({ data, accent }: { data: PdfDocumentData; accent: string }) {
  return (
    <View style={{ marginTop: 6 }}>
      {/* `fixed` repeats this header on every page of a long document. */}
      <View style={[tableStyles.header, { borderBottomColor: accent }]} fixed>
        <Text style={tableStyles.cIndex}>#</Text>
        <Text style={tableStyles.cItem}>Description</Text>
        <Text style={tableStyles.cQty}>Qty</Text>
        <Text style={tableStyles.cRate}>Rate</Text>
        <Text style={tableStyles.cTax}>Tax</Text>
        <Text style={tableStyles.cAmount}>Amount</Text>
      </View>

      {data.lines.map((line, index) => (
        // wrap={false} keeps a row whole — no orphaned description rows.
        <View key={`line-${line.position}-${index}`} style={tableStyles.row} wrap={false}>
          <Text style={tableStyles.cIndex}>{index + 1}</Text>
          <View style={tableStyles.cItem}>
            <Text style={base.bold}>{line.name}</Text>
            {line.description ? <Text style={[base.muted, base.small]}>{line.description}</Text> : null}
            {line.hsnSac ? (
              <Text style={[base.muted, base.small]}>HSN/SAC: {line.hsnSac}</Text>
            ) : null}
            {line.discountPct > 0 ? (
              <Text style={[base.muted, base.small]}>Discount {formatPercent(line.discountPct)}</Text>
            ) : null}
          </View>
          <Text style={tableStyles.cQty}>
            {formatQty(line.qty)} {line.unit}
          </Text>
          <Text style={tableStyles.cRate}>{money(line.ratePaise, data)}</Text>
          <Text style={tableStyles.cTax}>{formatPercent(line.taxRate)}</Text>
          <Text style={tableStyles.cAmount}>{money(line.lineTotalPaise, data)}</Text>
        </View>
      ))}
    </View>
  );
}

export function TotalsBlock({ data, accent }: { data: PdfDocumentData; accent: string }) {
  // In inclusive mode, subtotalPaise is the tax-*exclusive* value — it will
  // never equal the sum of the printed (tax-inclusive) per-line amounts, so
  // labelling it "Subtotal" reads as a math error. "Taxable value" is the
  // term Indian GST invoices already use for exactly this figure.
  const subtotalLabel = data.taxMode === 'inclusive' ? 'Taxable value' : 'Subtotal';
  const rows: { label: string; value: string; strong?: boolean }[] = [
    { label: subtotalLabel, value: money(data.subtotalPaise, data) },
  ];

  if (data.discountPaise > 0) {
    const suffix = data.docDiscountPct > 0 ? ` (${formatPercent(data.docDiscountPct)})` : '';
    rows.push({ label: `Discount${suffix}`, value: `- ${money(data.discountPaise, data)}` });
  }

  for (const bucket of data.taxBreakup) {
    if (bucket.taxPaise === 0 && bucket.ratePct === 0) continue;
    rows.push({
      label: `Tax @ ${formatPercent(bucket.ratePct)}`,
      value: money(bucket.taxPaise, data),
    });
  }

  if (data.roundOffPaise !== 0) {
    rows.push({ label: 'Round off', value: money(data.roundOffPaise, data) });
  }

  return (
    <View style={{ width: 240, marginLeft: 'auto', marginTop: 12 }} wrap={false}>
      {rows.map((row) => (
        <View key={row.label} style={[base.spread, { paddingVertical: 2.5 }]}>
          <Text style={base.muted}>{row.label}</Text>
          <Text>{row.value}</Text>
        </View>
      ))}

      <View
        style={[
          base.spread,
          {
            marginTop: 6,
            paddingTop: 7,
            paddingBottom: 7,
            paddingHorizontal: 8,
            backgroundColor: accent,
            borderRadius: 3,
          },
        ]}
      >
        <Text style={[base.bold, { color: '#ffffff' }]}>Total</Text>
        <Text style={[base.bold, { color: '#ffffff' }]}>{money(data.totalPaise, data)}</Text>
      </View>

      {typeof data.amountPaidPaise === 'number' && data.amountPaidPaise > 0 ? (
        <>
          <View style={[base.spread, { paddingVertical: 2.5, marginTop: 4 }]}>
            <Text style={base.muted}>Amount paid</Text>
            <Text>- {money(data.amountPaidPaise, data)}</Text>
          </View>
          <View style={[base.spread, { paddingVertical: 2.5 }]}>
            <Text style={base.bold}>Balance due</Text>
            <Text style={base.bold}>{money(data.balancePaise ?? 0, data)}</Text>
          </View>
        </>
      ) : null}

      <Text style={[base.muted, base.small, { marginTop: 8 }]}>{data.amountInWords}</Text>
    </View>
  );
}

export function LongFormSection({ label, body }: { label: string; body?: string | null }) {
  if (!body || !body.trim()) return null;
  return (
    <View style={{ marginTop: 12 }} wrap={false}>
      <Text style={base.sectionLabel}>{label}</Text>
      <Text>{body.trim()}</Text>
    </View>
  );
}

export function BankBlock({ data }: { data: PdfDocumentData }) {
  const { bank } = data;
  const has = bank.accountNo || bank.upiId || bank.bankName;
  if (!has) return null;

  return (
    <View style={{ marginTop: 14 }} wrap={false}>
      <Text style={base.sectionLabel}>Payment details</Text>
      {bank.accountName ? <Text>Account name: {bank.accountName}</Text> : null}
      {bank.bankName ? <Text>Bank: {bank.bankName}</Text> : null}
      {bank.accountNo ? <Text>Account number: {bank.accountNo}</Text> : null}
      {bank.ifsc ? <Text>IFSC: {bank.ifsc}</Text> : null}
      {bank.upiId ? <Text>UPI: {bank.upiId}</Text> : null}
      {data.payUrl ? (
        <Text style={[base.small, { marginTop: 3, color: data.brandColor }]}>Pay online: {data.payUrl}</Text>
      ) : null}
    </View>
  );
}

export function PageFooter({ data }: { data: PdfDocumentData }) {
  return (
    <View style={base.footer} fixed>
      <Text>
        {data.docLabel} {data.number}
        {data.showInvoraBranding ? '  ·  Made with Invora by Vertex Infotech' : ''}
      </Text>
      <Text
        render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
      />
    </View>
  );
}
