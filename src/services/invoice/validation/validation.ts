// @ts-nocheck
// Invoice Validation Utilities
// Handles validation of invoice headers, line classifications, and provider rules

import { InvoiceData, InvoiceLineItem } from '../../types/mydata.types.js';
import { validateGreekAFM } from '../hash.service.js';
import { ALLOWED_E3_TYPES, ALLOWED_INCOME_CATEGORIES } from '../shared/classification.js';

const RETAIL_TYPES = new Set(['11.1', '11.2', '11.3', '11.4', '11.5']);
const CREDIT_TYPES = new Set(['5.1', '5.2', '5.3', '5.4', '5.5']);
const VALID_INVOICE_TYPES = new Set([
  '1.1', '1.2', '1.3', '1.4',
  '2.1', '2.2', '2.3',
  '5.1', '5.2', '5.3', '5.4', '5.5',
  '11.1', '11.2', '11.3', '11.4', '11.5'
]);
const VALID_VAT_CATEGORIES = new Set(['1', '2', '3', '4', '5', '6', '7', '8']);
const VALID_MOVE_PURPOSES = new Set([1, 2, 3, 4, 5, 6, 7, 8, 10, 19]);
const ISO_CURRENCIES = new Set(['EUR', 'USD', 'GBP', 'CHF', 'JPY', 'CAD', 'AUD', 'CNY', 'RUB', 'BRL', 'INR', 'KRW', 'TRY', 'PLN', 'CZK', 'HUF', 'RON', 'BGN', 'HRK', 'SEK', 'NOK', 'DKK']);

function validateDateYYYYMMDD(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const date = new Date(dateStr);
  return date instanceof Date && !isNaN(date.getTime()) && date.toISOString().split('T')[0] === dateStr;
}

function validateTimeHHMMSS(timeStr: string): boolean {
  if (!/^\d{2}:\d{2}:\d{2}$/.test(timeStr)) return false;
  const [h, m, s] = timeStr.split(':').map(Number);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59 && s >= 0 && s <= 59;
}

export function validateLineClassifications(
  lineItems: InvoiceLineItem[],
  invoiceType: string
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const allowedCategories = ALLOWED_INCOME_CATEGORIES[invoiceType] || new Set();
  const allowedE3Types = ALLOWED_E3_TYPES[invoiceType] || new Set();

  for (const item of lineItems) {
    for (const cls of item.incomeClassifications || []) {
      if (cls.type && !allowedE3Types.has(cls.type)) {
        errors.push(`Line ${item.lineNum}: Invalid E3 type "${cls.type}" for invoiceType ${invoiceType}. Allowed: ${Array.from(allowedE3Types).join(', ')}`);
      }
      if (cls.category && allowedCategories.size > 0 && !allowedCategories.has(cls.category)) {
        errors.push(`Line ${item.lineNum}: Invalid category "${cls.category}" for invoiceType ${invoiceType}. Allowed: ${Array.from(allowedCategories).join(', ')}`);
      }
    }

    for (const cls of item.expensesClassifications || []) {
      if (!['5.1', '5.2'].includes(invoiceType)) {
        errors.push(`Line ${item.lineNum}: Expense classifications not allowed for invoiceType ${invoiceType} (only for Credit Notes)`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validateInvoiceHeader(invoice: InvoiceData): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!invoice.invoiceType) {
    errors.push('invoiceType is required');
  } else if (!VALID_INVOICE_TYPES.has(invoice.invoiceType)) {
    errors.push(`Invalid invoiceType: ${invoice.invoiceType}. Allowed: ${Array.from(VALID_INVOICE_TYPES).join(', ')}`);
  }

  if (!invoice.series || !invoice.series.trim()) {
    errors.push('series is required');
  }

  if (invoice.aa === undefined || invoice.aa === null || !Number.isInteger(invoice.aa) || invoice.aa < 1) {
    errors.push('aa must be a positive integer');
  }

  if (!invoice.issueDate || !validateDateYYYYMMDD(invoice.issueDate)) {
    errors.push('issueDate is required and must be in YYYY-MM-DD format');
  }

  if (invoice.issueTime && !validateTimeHHMMSS(invoice.issueTime)) {
    errors.push('issueTime must be in HH:MM:SS format');
  }

  if (!invoice.currency || !invoice.currency.trim()) {
    errors.push('currency is required');
  } else if (!ISO_CURRENCIES.has(invoice.currency.toUpperCase())) {
    errors.push(`Invalid currency: ${invoice.currency}. Must be valid ISO 4217 code (e.g. EUR, USD)`);
  }

  if (invoice.currency && invoice.currency.toUpperCase() !== 'EUR') {
    if (invoice.exchangeRate === undefined || invoice.exchangeRate === null) {
      errors.push('exchangeRate is required when currency differs from EUR');
    } else if (typeof invoice.exchangeRate !== 'number' || invoice.exchangeRate <= 0) {
      errors.push('exchangeRate must be a positive number');
    }
  }

  if (invoice.vatPaymentSuspension !== undefined && typeof invoice.vatPaymentSuspension !== 'boolean') {
    errors.push('vatPaymentSuspension must be a boolean');
  }

  if (invoice.selfPricing !== undefined && typeof invoice.selfPricing !== 'boolean') {
    errors.push('selfPricing must be a boolean');
  }

  const isCredit = CREDIT_TYPES.has(invoice.invoiceType);
  if (isCredit) {
    if (!invoice.correlatedInvoices || invoice.correlatedInvoices.length === 0) {
      errors.push('correlatedInvoices is required for Credit Notes (5.1-5.5)');
    } else if (!Array.isArray(invoice.correlatedInvoices)) {
      errors.push('correlatedInvoices must be an array');
    }
  }

  if (invoice.dispatchDate && !validateDateYYYYMMDD(invoice.dispatchDate)) {
    errors.push('dispatchDate must be in YYYY-MM-DD format');
  }

  if (invoice.dispatchTime && !validateTimeHHMMSS(invoice.dispatchTime)) {
    errors.push('dispatchTime must be in HH:MM:SS format');
  }

  if (invoice.vehicleNumber !== undefined && invoice.vehicleNumber !== null && typeof invoice.vehicleNumber !== 'string') {
    errors.push('vehicleNumber must be a string');
  }

  if (invoice.movePurpose !== undefined && invoice.movePurpose !== null) {
    if (!Number.isInteger(invoice.movePurpose) || !VALID_MOVE_PURPOSES.has(invoice.movePurpose)) {
      errors.push(`movePurpose must be one of: ${Array.from(VALID_MOVE_PURPOSES).join(', ')}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validateProviderRules(
  invoice: InvoiceData,
  lineItems: InvoiceLineItem[],
  isConfigValid: boolean,
  providerVat?: string
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Athens' });

  if (invoice.issueDate !== today) {
    errors.push(`238: IssueDate must be today (${today}) for provider submission. Got: ${invoice.issueDate}`);
  }

  const senderVat = providerVat ? providerVat.replace(/dev$/, '') : invoice.issuer?.vatNumber;
  if (senderVat && invoice.issuer?.vatNumber && senderVat === invoice.issuer.vatNumber) {
    errors.push('236: Sender VAT must differ from issuer VAT for provider channel');
  }

  if (!isConfigValid) {
    errors.push('245: No valid provider credentials found (AADE_USER_ID / AADE_SUBSCRIPTION_KEY)');
  }

  if (!invoice.issuer?.vatNumber) {
    errors.push('236: Issuer VAT is required for provider channel');
  }

  const isRetail = ['11.1', '11.2', '11.3', '11.4', '11.5'].includes(invoice.invoiceType);
  if (!isRetail && !invoice.counterpart?.vatNumber) {
    errors.push(`Counterpart is required for invoice type ${invoice.invoiceType}`);
  }

  const totalGross = invoice.lineItems.reduce((sum, item) => sum + item.grossValue, 0);
  const paymentTotal = invoice.paymentMethods.reduce((sum, pm) => sum + pm.amount, 0);
  if (Math.abs(paymentTotal - totalGross) > 0.01) {
    errors.push(`Payment methods sum (${paymentTotal.toFixed(2)}) must equal total gross (${totalGross.toFixed(2)})`);
  }

  if (!invoice.paymentMethods || invoice.paymentMethods.length === 0) {
    errors.push('At least one payment method is required');
  }

  return { valid: errors.length === 0, errors };
}
