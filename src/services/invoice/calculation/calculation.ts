// @ts-nocheck
// Invoice Calculation Utilities
// Handles VAT calculations, totals, and hash generation

import { InvoiceData, InvoiceLineItem, InvoiceTotals } from '../../../types/mydata.types.js';
import { computeSHA256Hash } from '../../hash.service.js';
import { ALLOWED_E3_TYPES, ALLOWED_INCOME_CATEGORIES } from '../shared/classification.js';

const VALID_VAT_CATEGORIES = new Set(['1', '2', '3', '4', '5', '6', '7', '8']);

export const VAT_RATES: Record<string, number> = {
  '1': 0.24, // 24%
  '2': 0.13, // 13%
  '3': 0.06, // 6%
  '4': 0.17, // 17% (reduced for islands)
  '5': 0.09, // 9% (super reduced)
  '6': 0.04, // 4% (super reduced for islands)
  '7': 0.00, // VAT exempt
  '8': 0.00, // VAT exempt (reverse charge)
};

export function calculateLineItem(
  line: Omit<InvoiceLineItem, 'vatAmount' | 'grossValue'>,
  invoiceType?: string
): InvoiceLineItem {
  if (!line.vatCategory || !VALID_VAT_CATEGORIES.has(line.vatCategory)) {
    throw new Error(`Line ${line.lineNum}: Invalid vatCategory: ${line.vatCategory}. Allowed: ${Array.from(VALID_VAT_CATEGORIES).join(', ')}`);
  }

  const vatRate = VAT_RATES[line.vatCategory] ?? 0;
  const netValue = Math.round((Number(line.netValue) || 0) * 100) / 100;
  const vatAmount = Math.round(netValue * vatRate * 100) / 100;
  const grossValue = Math.round((netValue + vatAmount) * 100) / 100;

  let incomeClassifications = line.incomeClassifications ? [...line.incomeClassifications] : undefined;
  let expensesClassifications = line.expensesClassifications ? [...line.expensesClassifications] : undefined;

  if ((!incomeClassifications || incomeClassifications.length === 0) &&
      (!expensesClassifications || expensesClassifications.length === 0)) {
    const allowedE3 = ALLOWED_E3_TYPES[invoiceType || ''] || new Set(['E3_561_001']);
    const allowedCats = ALLOWED_INCOME_CATEGORIES[invoiceType || ''] || new Set(['category1_1']);
    const defaultE3 = allowedE3.values().next().value || 'E3_561_001';
    const defaultCat = allowedCats.values().next().value || 'category1_1';
    incomeClassifications = [{
      type: defaultE3,
      category: defaultCat,
      amount: netValue,
    }];
  }

  if (incomeClassifications && incomeClassifications.length > 0) {
    const sumIncome = incomeClassifications.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
    if (Math.abs(sumIncome - netValue) > 0.05) {
      throw new Error(`Line ${line.lineNum}: Sum of income classifications (${sumIncome.toFixed(2)}) must equal line net value (${netValue.toFixed(2)})`);
    }
  }

  if (expensesClassifications && expensesClassifications.length > 0) {
    const sumExpense = expensesClassifications.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
    if (Math.abs(sumExpense - netValue) > 0.05) {
      throw new Error(`Line ${line.lineNum}: Sum of expense classifications (${sumExpense.toFixed(2)}) must equal line net value (${netValue.toFixed(2)})`);
    }
  }

  if ((line.vatCategory === '7' || line.vatCategory === '8') && (line.vatExemptionCategory === undefined || line.vatExemptionCategory === null)) {
    throw new Error(`Line ${line.lineNum}: vatExemptionCategory is required when vatCategory is 7 (0%) or 8 (No VAT)`);
  }

  if (line.vatExemptionCategory !== undefined && line.vatExemptionCategory !== null) {
    if (!Number.isInteger(line.vatExemptionCategory) || line.vatExemptionCategory < 1 || line.vatExemptionCategory > 32) {
      throw new Error(`Line ${line.lineNum}: vatExemptionCategory must be an integer between 1 and 32`);
    }
  }

  return {
    ...line,
    netValue,
    vatAmount,
    grossValue,
    incomeClassifications,
    expensesClassifications,
  };
}

export function calculateTotals(lineItems: InvoiceLineItem[]): InvoiceTotals {
  const totalNet = Math.round(lineItems.reduce((sum, item) => sum + item.netValue, 0) * 100) / 100;
  const totalVat = Math.round(lineItems.reduce((sum, item) => sum + item.vatAmount, 0) * 100) / 100;
  const totalGross = Math.round(lineItems.reduce((sum, item) => sum + item.grossValue, 0) * 100) / 100;
  return { totalNet, totalVat, totalGross };
}

export function generateHash(invoice: InvoiceData, totals: InvoiceTotals): string {
  return computeSHA256Hash(
    invoice.issuer.vatNumber,
    invoice.issueDate,
    invoice.invoiceType,
    invoice.series,
    invoice.aa,
    totals.totalNet,
    totals.totalVat,
    totals.totalGross
  );
}
