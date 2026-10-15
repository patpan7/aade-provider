// @ts-nocheck
// XML Service - Barrel Export

// Escape utilities
export { escapeXml, unescapeXml, getMeasurementUnitTitle, buildAddressXML } from './escape.js';

// Builders
export { buildPartyXML } from './builders/party.js';
export { buildInvoiceHeaderXML } from './builders/header.js';
export { buildPaymentMethodsXML } from './builders/payment.js';
export { buildIncomeClassificationXML, buildExpensesClassificationXML } from './builders/classifications.js';
export { buildInvoiceDetailsXML } from './builders/lines.js';
export { buildInvoiceSummaryXML } from './builders/summary.js';
export { buildInvoicesDocXML } from './builders/invoices-doc.js';

// Parser
export { formatXML, extractInvoiceMark } from './parser.js';

