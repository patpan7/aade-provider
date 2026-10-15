// @ts-nocheck
// Build Classification XML for Income and Expenses
// Handles icls: and ecls: namespace prefixes per AADE XSD

import { escapeXml } from '../escape.js';

export function buildIncomeClassificationXML(classifications) {
    let xml = '';
    for (const c of classifications) {
        xml += `
        <incomeClassification>
          ${c.type ? `<icls:classificationType>${escapeXml(c.type)}</icls:classificationType>` : ''}
          ${c.category ? `<icls:classificationCategory>${escapeXml(c.category)}</icls:classificationCategory>` : ''}
          <icls:amount>${Number(c.amount).toFixed(2)}</icls:amount>
          ${c.id !== undefined ? `<icls:id>${c.id}</icls:id>` : ''}
        </incomeClassification>`;
    }
    return xml;
}

export function buildExpensesClassificationXML(classifications) {
    let xml = '';
    for (const c of classifications) {
        xml += `
        <expensesClassification>
          ${c.type ? `<ecls:classificationType>${escapeXml(c.type)}</ecls:classificationType>` : ''}
          ${c.category ? `<ecls:classificationCategory>${escapeXml(c.category)}</ecls:classificationCategory>` : ''}
          <ecls:amount>${Number(c.amount).toFixed(2)}</ecls:amount>
          ${c.id !== undefined ? `<ecls:id>${c.id}</ecls:id>` : ''}
        </expensesClassification>`;
    }
    return xml;
}

