// @ts-nocheck
// Receiver Info Endpoint - Query AADE for receiver information

import { getAadeConfig } from '../../../config/aade.config.js';
import { aadeFetch } from '../client.js';
import { XMLParser } from 'fast-xml-parser';

export async function requestReceiverInfo(vatNumber) {
    const config = getAadeConfig();
    if (!config.userId || !config.subscriptionKey) {
        return {
            success: false,
            errors: ['AADE credentials not configured'],
        };
    }
    if (!vatNumber) {
        return {
            success: false,
            errors: ['VAT number is required'],
        };
    }
    try {
        const baseUrl = config.apiUrl.replace('/myDATAProvider/SendInvoices', '');
        const url = new URL(`${config.apiUrl.replace('/myDATAProvider/SendInvoices', '')}/myDataProvider/RequestReceiverInfo`);
        url.searchParams.append('vatNumber', vatNumber);
        const { response, rawResponse } = await aadeFetch(url.toString(), { method: 'GET' });
        if (!response.ok) {
            return {
                success: false,
                errors: [`HTTP ${response.status}: ${response.statusText}`],
                rawResponse,
            };
        }
        // Parse the XML response
        const parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: '@_',
            textNodeName: '_text',
            trimValues: true,
        });
        const parsed = parser.parse(rawResponse);
        const doc = parsed?.ReceiverInfoDoc || parsed;
        const receivers = doc?.receptionsProviders?.ReceptionProvider
            ? (Array.isArray(doc.receptionsProviders.ReceptionProvider) ? doc.receptionsProviders.ReceptionProvider : [doc.receptionsProviders.ReceptionProvider])
            : [];
        const emails = doc?.receptionsEmails?.Email
            ? (Array.isArray(doc.receptionsEmails.Email) ? doc.receptionsEmails.Email : [doc.receptionsEmails.Email])
            : [];
        return {
            success: true,
            data: {
                receptionsProviders: receivers.map((r) => ({
                    providerId: r.providerId,
                    providerName: r.providerName,
                    isActive: r.isActive,
                })),
                receptionsEmails: emails.map((e) => ({
                    email: e,
                    isActive: true,
                })),
            },
            rawResponse,
        };
    }
    catch (err) {
        return {
            success: false,
            errors: [err.message],
        };
    }
}

