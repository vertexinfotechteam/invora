import React from 'react';
import { Document, Image, Page, Text, View } from '@react-pdf/renderer';
import {
  BankBlock,
  LineItemsTable,
  LongFormSection,
  PageFooter,
  PartyBlock,
  TotalsBlock,
  base,
} from '@/lib/pdf/shared';
import type { PdfDocumentData } from '@/lib/pdf/types';

/**
 * Classic — the free-plan template. Conservative, letterhead-style, prints
 * cleanly in black and white.
 */
export function ClassicTemplate({ data }: { data: PdfDocumentData }) {
  const accent = data.brandColor || '#0f172a';

  return (
    <Document
      title={`${data.docLabel} ${data.number}`}
      author={data.from.name}
      creator="Invora by Vertex Infotech"
      producer="Invora"
    >
      <Page size="A4" style={base.page}>
        <View style={base.spread}>
          <View style={{ maxWidth: 260 }}>
            {data.logoUrl ? (
              // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt
              <Image src={data.logoUrl} style={{ height: 38, marginBottom: 8, objectFit: 'contain' }} />
            ) : null}
            <Text style={base.h2}>{data.from.company || data.from.name}</Text>
            {data.from.addressLines.map((line, index) => (
              <Text key={`from-${index}`} style={[base.muted, base.small]}>
                {line}
              </Text>
            ))}
            {data.from.gstin ? (
              <Text style={[base.muted, base.small]}>GSTIN: {data.from.gstin}</Text>
            ) : null}
          </View>

          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[base.h1, { color: accent }]}>{data.docLabel}</Text>
            <Text style={base.bold}>{data.number}</Text>
            <Text style={base.muted}>Date: {data.issueDate}</Text>
            {data.secondaryDate ? (
              <Text style={base.muted}>
                {data.secondaryDateLabel}: {data.secondaryDate}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={base.hr} />

        <View style={base.spread}>
          <PartyBlock label="Billed to" party={data.to} />
          {data.title ? (
            <View style={{ maxWidth: 220, alignItems: 'flex-end' }}>
              <Text style={base.sectionLabel}>Project</Text>
              <Text style={[base.bold, { textAlign: 'right' }]}>{data.title}</Text>
            </View>
          ) : null}
        </View>

        <LineItemsTable data={data} accent={accent} />
        <TotalsBlock data={data} accent={accent} />

        <LongFormSection label="Scope of work" body={data.scope} />
        <LongFormSection label="Deliverables" body={data.deliverables} />
        <LongFormSection label="Exclusions" body={data.exclusions} />
        <LongFormSection label="Payment terms" body={data.paymentTerms} />
        <LongFormSection label="Notes" body={data.notes} />
        <LongFormSection label="Terms & conditions" body={data.terms} />

        <BankBlock data={data} />

        {data.signatureUrl ? (
          <View style={{ marginTop: 24, alignItems: 'flex-end' }} wrap={false}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={data.signatureUrl} style={{ height: 40, objectFit: 'contain' }} />
            <Text style={[base.muted, base.small, { marginTop: 4 }]}>
              For {data.from.company || data.from.name}
            </Text>
          </View>
        ) : null}

        <PageFooter data={data} />
      </Page>
    </Document>
  );
}
