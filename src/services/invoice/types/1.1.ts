// @ts-nocheck
export const invoiceType111Rules = {
    type: '1.1',
    name: 'Τιμολόγιο Πώλησης (Χονδρική)',
    category: 'wholesale',
    requiredFields: ['issuer', 'counterpart', 'series', 'aa', 'issueDate', 'lineItems'],
    optionalFields: [
        'currency', 'exchangeRate', 'paymentMethods', 'dispatchTime',
        'vehicleNumber', 'movePurpose', 'incomeClassifications'
    ],
    forbiddenFields: ['expensesClassifications'],
    allowedE3Types: new Set([
        'E3_561_001', 'E3_561_002', 'E3_561_007', 'E3_880_001',
        'E3_562', 'E3_563', 'E3_564', 'E3_565', 'E3_566', 'E3_567', 'E3_568', 'E3_570',
        'E3_881_001', 'E3_881_003', 'E3_881_004', 'E3_596', 'E3_597', 'E3_595'
    ]),
    allowedCategories: new Set([
        'category1_1', 'category1_2', 'category1_3', 'category1_4', 'category1_5', 'category1_6', 'category1_7'
    ]),
    lineRules: {
        vatCategories: new Set(['1', '2', '3', '4', '5', '6', '7', '8']),
        requiresIncomeClassification: true,
        requiresCounterpart: true,
        allowsDispatch: true,
        allowsMovePurpose: true,
        maxLines: 9999,
    },
    headerRules: {
        requiresCounterpartVat: true,
        allowsBranch: true,
        currencyRequired: true,
    },
    providerRules: {
        validateIssueDateToday: true,
        validateSenderNotIssuer: true,
        validateProviderAuthorized: true,
        validateTransmissionFlag4: true,
        validateUidUnique: true,
    },
    // VAT exemption categories allowed per vatCategory
    vatExemptionCategories: {
        '7': new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]),
        '8': new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32]),
    },
};

