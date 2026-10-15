// @ts-nocheck
// Invoice Endpoints - Send and Request Invoices

import { getAadeConfig } from '../../../config/aade.config.js';
import { aadeFetch } from '../client.js';
import { extractInvoiceMark } from '../../xml/parser.js';
import { buildQRUrl } from '../client.js';
import { XMLParser } from 'fast-xml-parser';

export async function sendInvoiceToAADE(xmlPayload, credentials) {
    const config = getAadeConfig();
    const userId = credentials?.userId || config.userId;
    const subscriptionKey = credentials?.subscriptionKey || config.subscriptionKey;
    const isMock = process.env.AADE_MOCK === 'true';
    if (isMock) {
        console.log('[AADE] AADE_MOCK is true, returning mock response');
        // Re-import mock function dynamically
        const { mockAADEResponse } = await import('../client.js');
        return mockAADEResponse(xmlPayload);
    }
    if (!userId || !subscriptionKey) {
        return {
            success: false,
            errors: [
                'AADE credentials not configured. Set AADE_USER_ID and AADE_SUBSCRIPTION_KEY in .env or pass them in the request.',
            ],
        };
    }
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);
        let response;
        let rawResponse = '';
        try {
            console.log('[AADE] Sending request to:', config.apiUrl);
            response = await fetch(config.apiUrl, {
                method: 'POST',
                headers: {
                    'aade-user-id': userId,
                    'ocp-apim-subscription-key': subscriptionKey,
                    'Content-Type': 'application/xml',
                    Accept: 'application/xml',
                },
                body: xmlPayload,
                signal: controller.signal,
            });
            clearTimeout(timeout);
            console.log('[AADE] Response status:', response.status);
            try {
                rawResponse = await response.text();
            }
            catch (textError) {
                console.error('[AADE] Error reading response text:', textError.message);
                rawResponse = '';
            }
        }
        catch (fetchError) {
            clearTimeout(timeout);
            console.error('[AADE] Fetch error:', fetchError.message);
            return {
                success: false,
                errors: [`Network error: ${fetchError.message}`],
            };
        }
        const parsed = await extractInvoiceMark(rawResponse);
        if (!response.ok) {
            const errorList = (parsed.errors && parsed.errors.length > 0)
                ? parsed.errors
                : [`HTTP ${response.status}: ${response.statusText}`];
            return {
                success: false,
                statusCode: parsed.statusCode || String(response.status),
                errors: errorList,
                rawResponse,
            };
        }
        if (parsed.success && parsed.mark) {
            const qrUrl = parsed.qrUrl || buildQRUrl(parsed.mark, parsed.mark, config.qrBaseUrl);
            return {
                success: true,
                mark: parsed.mark,
                invoiceUid: parsed.invoiceUid || parsed.mark,
                statusCode: parsed.statusCode || 'Success',
                qrUrl,
                rawResponse,
            };
        }
        // Handled validation or business errors
        return {
            success: false,
            statusCode: parsed.statusCode,
            errors: (parsed.errors && parsed.errors.length > 0) ? parsed.errors : ['No invoiceMark found in response'],
            rawResponse,
        };
    }
    catch (err) {
        const errorName = err?.name || '';
        const errorMsg = err?.message || String(err);
        let detail = `Network error: ${errorMsg}`;
        if (errorName === 'AbortError') {
            detail = 'Timeout: AADE server did not respond within 30 seconds. Check network/VPN connection.';
        }
        else if (errorMsg.includes('ENOTFOUND') || errorMsg.includes('EAI_AGAIN')) {
            detail = 'DNS resolution failed - cannot reach AADE endpoint. Check internet/VPN connection.';
        }
        else if (errorMsg.includes('ECONNREFUSED') || errorMsg.includes('ECONNRESET')) {
            detail = 'Connection refused/reset by AADE server. The sandbox may be down or blocking connection.';
        }
        else if (errorMsg.includes('CERT') || errorMsg.includes('SSL') || errorMsg.includes('TLS')) {
            detail = `TLS/SSL error: ${errorMsg}. Check system certificates.`;
        }
        return {
            success: false,
            errors: [detail],
        };
    }
}

export async function requestTransmittedDocs(params = {}) {
    const config = getAadeConfig();
    if (!config.userId || !config.subscriptionKey) {
        return {
            success: false,
            errors: ['AADE credentials not configured'],
        };
    }
    try {
        const baseUrl = config.apiUrl.replace('/myDATAProvider/SendInvoices', '');
        const url = new URL(`${config.apiUrl.replace('/myDATAProvider/SendInvoices', '')}/myDataProvider/RequestTransmittedDocs`);
        if (params.issuerVat)
            url.searchParams.append('issuerVat', params.issuerVat);
        if (params.mark)
            url.searchParams.append('mark', params.mark);
        if (params.nextPartitionKey)
            url.searchParams.append('nextPartitionKey', params.nextPartitionKey);
        if (params.nextRowKey)
            url.searchParams.append('nextRowKey', params.nextRowKey);
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
        const doc = parsed?.RequestedProviderDoc || parsed;
        if (!doc) {
            return { success: false, errors: ['Invalid response format'], rawResponse };
        }
        const docs = doc?.InvoiceProviderType
            ? (Array.isArray(doc.InvoiceProviderType) ? doc.InvoiceProviderType : [doc.InvoiceProviderType])
            : [];
        const documents = docs.map((d) => {
            return {
                mark: d.invoiceProviderMark,
                invoiceUid: d.invoiceUid,
                series: d.series,
                aa: d.aa,
                issueDate: d.issueDate,
                invoiceType: d.invoiceType,
                status: d.status,
                authenticationCode: d.authenticationCode,
                qrUrl: d.qrUrl,
            };
        });
        return {
            success: true,
            continuationToken: doc?.continuationToken,
            nextPartitionKey: doc?.nextPartitionKey,
            nextRowKey: doc?.nextRowKey,
            documents,
        };
    }
    catch (err) {
        return {
            success: false,
            errors: [err.message],
        };
    }
}

