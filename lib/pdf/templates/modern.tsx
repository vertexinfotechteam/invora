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
  money,
} from '@/lib/pdf/shared';
import type { PdfDocumentData } from '@/lib/pdf/types';

/**
 * Modern — Premium. A coloured masthead carrying the brand colour, with the
 * headline amount stated up front so the document is readable at a glance.
 */
export function ModernTemplate({ data }: { data: PdfDocumentData }) {
  const accent = data.brandColor || '#4F46E5';

  return (
    <Document
      title={`${data.docLabel} ${data.number}`}
      author={data.from.name}
      creator="Invora by Vertex Infotech"
      producer="Invora"
    >
      <Page size="A4" style={[base.page, { paddingTop: 0 }]}>
        <View
          style={{
            backgroundColor: accent,
            marginHorizontal: -40,
            paddingHorizontal: 40,
            paddingTop: 30,
            paddingBottom: 24,
            marginBottom: 20,
          }}
        >
          <View style={base.spread}>
            <View>
              {data.logoUrl ? (
                // eslint-disable-next-line jsx-a11y/alt-text
                <Image src={data.logoUrl} style={{ height: 34, marginBottom: 8, objectFit: 'contain' }} />
              ) : null}
              <Text style={[base.h2, { color: '#ffffff' }]}>
                {data.from.company || data.from.name}
              </Text>
              {data.from.addressLines.slice(0, 2).map((line, index) => (
                <Text key={`m-from-${index}`} style={{ color: '#e0e7ff', fontSize: 8.5 }}>
                  {line}
                </Text>
              ))}
            </View>

            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ color: '#e0e7ff', fontSize: 8, letterSpacing: 1.2 }}>
                {data.docLabel.toUpperCase()}
              </Text>
              <Text style={[base.h1, { color: '#ffffff' }]}>{data.number}</Text>
              <Text style={{ color: '#e0e7ff', fontSize: 9, marginTop: 6 }}>
                {data.docType === 'invoice' ? 'Amount due' : 'Quoted total'}
              </Text>
              <Text style={{ color: '#ffffff', fontSize: 15, fontFamily: 'Helvetica-Bold' }}>
                {money(
                  data.docType === 'invoice' ? (data.balancePaise ?? data.totalPaise) : data.totalPaise,
                  data,
                )}
              </Text>
            </View>
          </View>
        </View>

        <View style={base.spread}>
          <PartyBlock label="Billed to" party={data.to} />
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={base.sectionLabel}>Dates</Text>
            <Text>Issued {data.issueDate}</Text>
            {data.secondaryDate ? (
              <Text>
                {data.secondaryDateLabel} {data.secondaryDate}
              </Text>
            ) : null}
            {data.title ? (
              <Text style={[base.bold, { marginTop: 8, textAlign: 'right', maxWidth: 200 }]}>
                {data.title}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={{ marginTop: 16 }} />
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
          <View style={{ marginTop: 22, alignItems: 'flex-end' }} wrap={false}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={data.signatureUrl} style={{ height: 40, objectFit: 'contain' }} />
            <Text style={[base.muted, base.small, { marginTop: 4 }]}>Authorised signatory</Text>
          </View>
        ) : null}

        <PageFooter data={data} />
      </Page>
    </Document>
  );
}
