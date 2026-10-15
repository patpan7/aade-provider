// @ts-nocheck
// Invoice line item and totals calculation
const VAT_RATES = {
    '1': 0.24, // 24%
    '2': 0.13, // 13%
    '3': 0.06, // 6%
    '4': 0.17, // 17% (reduced for islands)
    '5': 0.09, // 9% (super reduced)
    '6': 0.04, // 4% (super reduced for islands)
    '7': 0.00, // VAT exempt
    '8': 0.00, // VAT exempt (reverse charge)
};
export function calculateLineItem(item) {
    const netValue = Number(item.netValue) || 0;
    const vatRate = VAT_RATES[item.vatCategory] || 0;
    const vatAmount = Math.round(netValue * vatRate * 100) / 100;
    const grossValue = Math.round((netValue + vatAmount) * 100) / 100;
    return { netValue, vatAmount, grossValue, vatRate };
}
export function calculateTotals(lineItems) {
    let totalNet = 0;
    let totalVat = 0;
    let totalGross = 0;
    const vatCategoryTotals = {};
    for (const item of lineItems) {
        const { netValue, vatAmount, grossValue, vatRate } = calculateLineItem(item);
        totalNet += netValue;
        totalVat += vatAmount;
        totalGross += grossValue;
        const cat = item.vatCategory;
        if (!vatCategoryTotals[cat]) {
            vatCategoryTotals[cat] = { net: 0, vat: 0, gross: 0 };
        }
        vatCategoryTotals[cat].net += netValue;
        vatCategoryTotals[cat].vat += vatAmount;
        vatCategoryTotals[cat].gross += grossValue;
    }
    // Round to 2 decimal places
    totalNet = Math.round(totalNet * 100) / 100;
    totalVat = Math.round(totalVat * 100) / 100;
    totalGross = Math.round(totalGross * 100) / 100;
    // Convert vatCategoryTotals to array format for XML
    const vatCategoryTotalsArray = Object.entries(vatCategoryTotals).map(([category, totals]) => ({
        category,
        netValue: Math.round(totals.net * 100) / 100,
        vatAmount: Math.round(totals.vat * 100) / 100,
        grossValue: Math.round(totals.gross * 100) / 100,
    }));
    return {
        totalNet,
        totalVat,
        totalGross,
        vatCategoryTotals: vatCategoryTotalsArray,
    };
}
export function validateAmountsMatch(lineItems, totals) {
    const errors = [];
    // Check each line's classifications sum to netValue
    for (const item of lineItems) {
        if (item.incomeClassifications && item.incomeClassifications.length > 0) {
            const sumClassifications = item.incomeClassifications.reduce((sum, cls) => sum + (Number(cls.amount) || 0), 0);
            const netValue = Number(item.netValue) || 0;
            if (Math.abs(sumClassifications - netValue) > 0.01) {
                errors.push(`Line ${item.lineNum}: Άθροισμα χαρακτηρισμών (${sumClassifications.toFixed(2)}€) ` +
                    `πρέπει να ισούται με netValue (${netValue.toFixed(2)}€)`);
            }
        }
    }
    // Check payment methods sum to totalGrossValue
    // This would be validated in the header validation
    return { valid: errors.length === 0, errors };
}
export function generateHash(issuerVat, issueDate, invoiceType, series, aa, totalNet, totalVat, totalGross) {
    // AADE SHA-256 hash format: issuerVat|issueDate|invoiceType|series|aa|totalNet|totalVat|totalGross
    const hashString = `${issuerVat}|${issueDate}|${invoiceType}|${series}|${aa}|${totalNet.toFixed(2)}|${totalVat.toFixed(2)}|${totalGross.toFixed(2)}`;
    // Use Web Crypto API (Node.js 19+)
    // For Node.js < 19, use crypto.createHash
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(hashString).digest('hex');
}

