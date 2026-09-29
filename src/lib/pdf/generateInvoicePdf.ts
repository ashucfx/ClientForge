// src/lib/pdf/generateInvoicePdf.ts
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { CatalystPaidInvoiceDocument } from './CatalystPaidInvoicePdf';
import type { InvoiceData } from '@/types';

/**
 * Compiles the official branded Catalyst Paid Tax Invoice PDF into a Buffer.
 */
export async function generatePaidInvoicePdfBuffer(invoice: InvoiceData): Promise<Buffer> {
  const element = React.createElement(CatalystPaidInvoiceDocument, { invoice });
  // @ts-expect-error - renderToBuffer types can accept ReactElement
  return await renderToBuffer(element);
}
