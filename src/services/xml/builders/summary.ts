// @ts-nocheck
// Build Invoice Summary XML
// Aggregates classifications by (type, category) across all line items

import { escapeXml } from '../escape.js';

export function buildInvoiceSummaryXML(totals, lineItems) {
    // Aggregate Income Classifications by (type, category)
    const incomeMap = new Map();
    for (const item of lineItems) {
        for (const c of item.incomeClassifications || []) {
            const type = c.type || '';
            const cat = c.category || '';
            const key = `${type}|${cat}`;
            if (!incomeMap.has(key)) {
                incomeMap.set(key, { type: c.type, category: c.category, amount: Number(c.amount) || 0 });
            }
            else {
                incomeMap.get(key).amount += Number(c.amount) || 0;
            }
        }
    }
    // Aggregate Expenses Classifications by (type, category)
    const expenseMap = new Map();
    for (const item of lineItems) {
        for (const c of item.expensesClassifications || []) {
            const type = c.type || '';
            const cat = c.category || '';
            const key = `${type}|${cat}`;
            if (!expenseMap.has(key)) {
                expenseMap.set(key, { type: c.type, category: c.category, amount: Number(c.amount) || 0 });
            }
            else {
                expenseMap.get(key).amount += Number(c.amount) || 0;
            }
        }
    }
    let classificationsXml = '';
    for (const c of incomeMap.values()) {
        classificationsXml += `
      <incomeClassification>
        ${c.type ? `<icls:classificationType>${escapeXml(c.type)}</icls:classificationType>` : ''}
        ${c.category ? `<icls:classificationCategory>${escapeXml(c.category)}</icls:classificationCategory>` : ''}
        <icls:amount>${c.amount.toFixed(2)}</icls:amount>
      </incomeClassification>`;
    }
    for (const c of expenseMap.values()) {
        classificationsXml += `
      <expensesClassification>
        ${c.type ? `<ecls:classificationType>${escapeXml(c.type)}</ecls:classificationType>` : ''}
        ${c.category ? `<ecls:classificationCategory>${escapeXml(c.category)}</ecls:classificationCategory>` : ''}
        <ecls:amount>${c.amount.toFixed(2)}</ecls:amount>
      </expensesClassification>`;
    }
    return `
    <invoiceSummary>
      <totalNetValue>${totals.totalNet.toFixed(2)}</totalNetValue>
      <totalVatAmount>${totals.totalVat.toFixed(2)}</totalVatAmount>
      <totalWithheldAmount>${(totals.totalWithheld || 0).toFixed(2)}</totalWithheldAmount>
      <totalFeesAmount>${(totals.totalFees || 0).toFixed(2)}</totalFeesAmount>
      <totalStampDutyAmount>${(totals.totalStampDuty || 0).toFixed(2)}</totalStampDutyAmount>
      <totalOtherTaxesAmount>${(totals.totalOtherTaxes || 0).toFixed(2)}</totalOtherTaxesAmount>
      <totalDeductionsAmount>${(totals.totalDeductions || 0).toFixed(2)}</totalDeductionsAmount>
      <totalGrossValue>${totals.totalGross.toFixed(2)}</totalGrossValue>
      ${classificationsXml}
    </invoiceSummary>`;
}

