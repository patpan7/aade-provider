// @ts-nocheck
// Unsigned Invoices Endpoint (Stub)
// Placeholder for future implementation

import { getAadeConfig } from '../../../config/aade.config.js';

export async function sendUnsignedInvoices(invoiceData, credentials) {
    // This is similar to issueInvoice but sends to the unsigned endpoint
    const config = getAadeConfig();
    const userId = credentials?.userId || config.userId;
    const subscriptionKey = credentials?.subscriptionKey || config.subscriptionKey;
    if (!userId || !subscriptionKey) {
        return {
            success: false,
            errors: ['AADE credentials not configured'],
            uuid: '',
            hash: '',
            xml: '',
            id: 0,
        };
    }
    try {
        // Build the invoice XML (same as issueInvoice but unsigned)
        const { buildInvoicesDocXML } = await import('../../xml/builders/invoices-doc.js');
        const { generateUUID } = await import('../../../db/database.js');
        const { calculateLineItem, calculateTotals, generateHash } = await import('../../invoice/calculation/calculation.js');
        const uuid = generateUUID();
        // ... build invoice similar to issueInvoice
        // For now, return not implemented
        return {
            success: false,
            errors: ['sendUnsignedInvoices not fully implemented yet'],
            uuid: '',
            hash: '',
            xml: '',
            id: 0,
        };
    }
    catch (err) {
        return {
            success: false,
            errors: [err.message],
            uuid: '',
            hash: '',
            xml: '',
            id: 0,
        };
    }
}

