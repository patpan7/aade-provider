// @ts-nocheck
export const invoiceType114Rules = {
    type: '1.4',
    name: 'Τιμολόγιο Πώλησης / Πώληση για Λογαριασμό Τρίτων',
    category: 'thirdparty',
    requiredFields: ['issuer', 'counterpart', 'series', 'aa', 'issueDate', 'lineItems'],
    optionalFields: [
        'currency', 'exchangeRate', 'paymentMethods', 'dispatchTime',
        'vehicleNumber', 'movePurpose', 'incomeClassifications'
    ],
    forbiddenFields: ['expensesClassifications'],
    allowedE3Types: new Set([
        'E3_881_001', 'E3_881_003', 'E3_881_004'
    ]),
    allowedCategories: new Set([
        'category1_7'
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
    vatExemptionCategories: {
        '7': new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]),
        '8': new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32]),
    },
};

