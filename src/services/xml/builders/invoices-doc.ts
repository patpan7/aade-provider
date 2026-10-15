// @ts-nocheck
// Build Main InvoicesDoc XML
// Orchestrates all builders to create the complete invoice document

import { escapeXml } from '../escape.js';
import { buildPartyXML } from './party.js';
import { buildInvoiceHeaderXML } from './header.js';
import { buildPaymentMethodsXML } from './payment.js';
import { buildInvoiceDetailsXML } from './lines.js';
import { buildInvoiceSummaryXML } from './summary.js';

export function buildInvoicesDocXML(invoice, totals) {
    const issuerXML = buildPartyXML(invoice.issuer, 'issuer');
    const counterpartXML = invoice.counterpart && invoice.counterpart.vatNumber
        ? buildPartyXML(invoice.counterpart, 'counterpart')
        : '';
    const invoiceHeaderXML = buildInvoiceHeaderXML(invoice);
    const paymentMethodsXML = buildPaymentMethodsXML(invoice.paymentMethods, totals.totalGross);
    const invoiceDetailsXML = buildInvoiceDetailsXML(invoice.lineItems);
    const invoiceSummaryXML = buildInvoiceSummaryXML(totals, invoice.lineItems);
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<InvoicesDoc xmlns="http://www.aade.gr/myDATA/invoice/v1.0"
             xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
             xsi:schemaLocation="http://www.aade.gr/myDATA/invoice/v1.0 InvoicesDoc-v1.0.7.xsd"
             xmlns:icls="https://www.aade.gr/myDATA/incomeClassificaton/v1.0"
             xmlns:ecls="https://www.aade.gr/myDATA/expensesClassificaton/v1.0">
  <invoice>
    ${issuerXML}
    ${counterpartXML}
    ${invoiceHeaderXML}
    ${paymentMethodsXML}
    ${invoiceDetailsXML}
    ${invoiceSummaryXML}
    ${invoice.notes ? `<notes>${escapeXml(invoice.notes)}</notes>` : ''}
  </invoice>
</InvoicesDoc>`;
    return xml.trim();
}

