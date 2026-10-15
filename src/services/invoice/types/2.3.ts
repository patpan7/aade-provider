// @ts-nocheck
export const invoiceType213Rules = {
    type: '2.3',
    name: 'Τιμολόγιο Παροχής / Παροχή Υπηρεσιών Τρίτων Χωρών',
    category: 'export',
    requiredFields: ['issuer', 'counterpart', 'series', 'aa', 'issueDate', 'lineItems'],
    optionalFields: [
        'currency', 'exchangeRate', 'paymentMethods', 'dispatchTime',
        'vehicleNumber', 'movePurpose', 'incomeClassifications'
    ],
    forbiddenFields: ['expensesClassifications'],
    allowedE3Types: new Set([
        'E3_561_006', 'E3_561_007', 'E3_563',
        'E3_562', 'E3_570'
    ]),
    allowedCategories: new Set([
        'category1_3', 'category1_5'
    ]),
    lineRules: {
        vatCategories: new Set(['1', '2', '3', '4', '5', '6', '7', '8']),
        requiresIncomeClassification: true,
        requiresCounterpart: true,
        allowsDispatch: false,
        allowsMovePurpose: false,
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
    vatExemptionCategories: {
        '7': new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]),
        '8': new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32]),
    },
};

