import React from 'react';
import { Document, Page, Text, View } from '@react-pdf/renderer';
import {
  BankBlock,
  LineItemsTable,
  LongFormSection,
  PageFooter,
  TotalsBlock,
  base,
} from '@/lib/pdf/shared';
import type { PdfDocumentData } from '@/lib/pdf/types';

/**
 * Minimal — Premium. Typographic, generous whitespace, no logo block. Suits
 * consultancies and studios that would rather the work spoke than the letterhead.
 */
export function MinimalTemplate({ data }: { data: PdfDocumentData }) {
  const accent = data.brandColor || '#0f172a';

  return (
    <Document
      title={`${data.docLabel} ${data.number}`}
      author={data.from.name}
      creator="Invora by Vertex Infotech"
      producer="Invora"
    >
      <Page size="A4" style={[base.page, { paddingHorizontal: 56, paddingTop: 56 }]}>
        <Text style={{ fontSize: 8, letterSpacing: 2, color: '#94a3b8' }}>
          {data.docLabel.toUpperCase()}
        </Text>
        <Text style={[base.h1, { marginTop: 4 }]}>{data.number}</Text>

        <View style={[base.spread, { marginTop: 28 }]}>
          <View style={{ maxWidth: 200 }}>
            <Text style={base.sectionLabel}>From</Text>
            <Text style={base.bold}>{data.from.company || data.from.name}</Text>
            {data.from.addressLines.map((line, index) => (
              <Text key={`min-from-${index}`} style={base.muted}>
                {line}
              </Text>
            ))}
            {data.from.gstin ? <Text style={base.muted}>GSTIN: {data.from.gstin}</Text> : null}
          </View>

          <View style={{ maxWidth: 200 }}>
            <Text style={base.sectionLabel}>To</Text>
            {data.to ? (
              <>
                <Text style={base.bold}>{data.to.company || data.to.name}</Text>
                {data.to.addressLines.map((line, index) => (
                  <Text key={`min-to-${index}`} style={base.muted}>
                    {line}
                  </Text>
                ))}
                {data.to.gstin ? <Text style={base.muted}>GSTIN: {data.to.gstin}</Text> : null}
              </>
            ) : (
              <Text style={base.muted}>—</Text>
            )}
          </View>

          <View>
            <Text style={base.sectionLabel}>Dates</Text>
            <Text style={base.muted}>Issued {data.issueDate}</Text>
            {data.secondaryDate ? (
              <Text style={base.muted}>
                {data.secondaryDateLabel} {data.secondaryDate}
              </Text>
            ) : null}
          </View>
        </View>

        {data.title ? (
          <Text style={[base.h2, { marginTop: 26 }]}>{data.title}</Text>
        ) : null}

        <View style={{ marginTop: 18 }} />
        <LineItemsTable data={data} accent={accent} />
        <TotalsBlock data={data} accent={accent} />

        <LongFormSection label="Scope" body={data.scope} />
        <LongFormSection label="Deliverables" body={data.deliverables} />
        <LongFormSection label="Not included" body={data.exclusions} />
        <LongFormSection label="Payment terms" body={data.paymentTerms} />
        <LongFormSection label="Notes" body={data.notes} />
        <LongFormSection label="Terms" body={data.terms} />

        <BankBlock data={data} />
        <PageFooter data={data} />
      </Page>
    </Document>
  );
}
