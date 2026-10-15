// @ts-nocheck
// Cancellation Endpoints - Cancel Delivery and Receiving Notes

import { getAadeConfig } from '../../../config/aade.config.js';
import { aadeFetch } from '../client.js';
import { XMLParser } from 'fast-xml-parser';

export async function cancelDeliveryNote(params) {
    const config = getAadeConfig();
    if (!config.userId || !config.subscriptionKey) {
        return {
            success: false,
            errors: ['AADE credentials not configured'],
        };
    }
    if (!params.mark || !params.entityVatNumber) {
        return {
            success: false,
            errors: ['MARK and entityVatNumber are required'],
        };
    }
    try {
        const baseUrl = config.apiUrl.replace('/myDATAProvider/SendInvoices', '');
        const url = new URL(`${config.apiUrl.replace('/myDATAProvider/SendInvoices', '')}/myDataProvider/CancelDeliveryNote`);
        url.searchParams.append('mark', params.mark);
        url.searchParams.append('entityVatNumber', params.entityVatNumber);
        const { response, rawResponse } = await aadeFetch(url.toString(), { method: 'GET' });
        if (!response.ok) {
            return {
                success: false,
                errors: [`HTTP ${response.status}: ${response.statusText}`],
                rawResponse,
            };
        }
        const parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: '@_',
            textNodeName: '_text',
            trimValues: true,
        });
        const parsed = parser.parse(rawResponse);
        const doc = parsed?.CancelDeliveryNoteResponse || parsed;
        return {
            success: true,
            mark: doc?.mark,
            cancellationMark: doc?.cancellationMark,
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

export async function cancelReceivingNote(params) {
    const config = getAadeConfig();
    if (!config.userId || !config.subscriptionKey) {
        return {
            success: false,
            errors: ['AADE credentials not configured'],
        };
    }
    if (!params.mark || !params.entityVatNumber) {
        return {
            success: false,
            errors: ['MARK and entityVatNumber are required'],
        };
    }
    try {
        const baseUrl = config.apiUrl.replace('/myDATAProvider/SendInvoices', '');
        const url = new URL(`${config.apiUrl.replace('/myDATAProvider/SendInvoices', '')}/myDataProvider/CancelReceivingNote`);
        url.searchParams.append('mark', params.mark);
        url.searchParams.append('entityVatNumber', params.entityVatNumber);
        const { response, rawResponse } = await aadeFetch(url.toString(), { method: 'GET' });
        if (!response.ok) {
            return {
                success: false,
                errors: [`HTTP ${response.status}: ${response.statusText}`],
                rawResponse,
            };
        }
        const parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: '@_',
            textNodeName: '_text',
            trimValues: true,
        });
        const parsed = parser.parse(rawResponse);
        const doc = parsed?.CancelReceivingNoteResponse || parsed;
        return {
            success: true,
            mark: doc?.mark,
            cancellationMark: doc?.cancellationMark,
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

