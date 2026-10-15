// @ts-nocheck
// XML Parser Utilities
// Format XML for display and extract invoice mark from AADE responses

import { XMLParser } from 'fast-xml-parser';
import { unescapeXml } from './escape.js';

export function formatXML(xml) {
    let formatted = '';
    let indent = 0;
    const tab = '  ';
    const tokens = xml.replace(/(>)(<)/g, '$1\n$2').split('\n');
    for (const token of tokens) {
        const trimmed = token.trim();
        if (!trimmed)
            continue;
        if (trimmed.startsWith('<?xml')) {
            formatted += trimmed + '\n';
            continue;
        }
        if (trimmed.startsWith('</')) {
            indent--;
        }
        formatted += tab.repeat(Math.max(0, indent)) + trimmed + '\n';
        if (trimmed.startsWith('<') && !trimmed.startsWith('<?') && !trimmed.startsWith('</')) {
            const isSelfClosing = trimmed.endsWith('/>');
            const isClosing = trimmed.startsWith('</');
            const hasClosingTagSameLine = /^<([^>]+)>.*<\/\1>$/.test(trimmed);
            if (!isSelfClosing && !isClosing && !hasClosingTagSameLine) {
                indent++;
            }
        }
    }
    return formatted.trim();
}

export async function extractInvoiceMark(xmlResponse) {
    if (!xmlResponse || typeof xmlResponse !== 'string') {
        return { success: false, errors: ['Empty response from AADE'] };
    }
    // 1. Try parsing JSON (e.g. rate limit 429, gateway timeout, Azure API errors)
    try {
        const jsonResult = JSON.parse(xmlResponse);
        if (jsonResult.message || jsonResult.statusCode) {
            return {
                success: false,
                errors: [jsonResult.message || `HTTP ${jsonResult.statusCode || 'Unknown'}`],
                statusCode: String(jsonResult.statusCode || 'Unknown'),
                rawResponse: xmlResponse,
            };
        }
    }
    catch {
        // Not JSON, continue with XML parsing
    }
    try {
        const parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: '@_',
            textNodeName: '_text',
            trimValues: true,
        });
        let result = parser.parse(xmlResponse);
        // 2. Handle AADE response wrapped in <string> element
        if (result?.string) {
            if (typeof result.string === 'string') {
                result = parser.parse(unescapeXml(result.string));
            }
            else if (result.string._text && typeof result.string._text === 'string') {
                result = parser.parse(unescapeXml(result.string._text));
            }
            else if (result.string.ResponseDoc) {
                result = result.string;
            }
        }
        // 3. Locate response document root
        const doc = result?.ResponseDoc || result?.InvoicesDoc || result;
        let resp = doc?.response || doc?.invoice;
        if (Array.isArray(resp)) {
            resp = resp[0];
        }
        if (!resp) {
            const topErrors = doc?.errors?.error || result?.errors?.error;
            if (topErrors) {
                const errorArr = Array.isArray(topErrors) ? topErrors : [topErrors];
                const errorList = errorArr.map((e) => {
                    const code = e.code !== undefined ? String(e.code) : '';
                    const msg = e.message !== undefined ? String(e.message) : String(e);
                    return code ? `${code}: ${msg}` : msg;
                });
                return { success: false, errors: errorList, rawResponse: xmlResponse };
            }
            return { success: false, errors: ['Unknown response format from AADE'], rawResponse: xmlResponse };
        }
        const statusCode = resp.statusCode ? String(resp.statusCode) : undefined;
        const isSuccess = statusCode === 'Success' || statusCode === '200';
        if (!isSuccess) {
            const errorList = [];
            const errorsObj = resp.errors?.error || doc?.errors?.error;
            if (errorsObj) {
                const arr = Array.isArray(errorsObj) ? errorsObj : [errorsObj];
                for (const e of arr) {
                    const code = e.code !== undefined ? String(e.code) : '';
                    const msg = e.message !== undefined ? String(e.message) : String(e);
                    errorList.push(code ? `${code}: ${msg}` : msg);
                }
            }
            else {
                errorList.push(`Validation/Process error with status: ${statusCode || 'Unknown'}`);
            }
            return {
                success: false,
                statusCode,
                errors: errorList,
                rawResponse: xmlResponse,
            };
        }
        const mark = resp.invoiceMark !== undefined && resp.invoiceMark !== null ? String(resp.invoiceMark) : undefined;
        const invoiceUid = resp.invoiceUid !== undefined && resp.invoiceUid !== null ? String(resp.invoiceUid) : undefined;
        const qrUrl = resp.qrUrl ? String(resp.qrUrl) : undefined;
        return {
            success: true,
            statusCode,
            mark,
            invoiceUid,
            qrUrl,
            rawResponse: xmlResponse,
        };
    }
    catch (err) {
        console.error('[xml.parser] Parse error:', err);
        return {
            success: false,
            errors: [`XML Parse error: ${err.message}`],
            rawResponse: xmlResponse,
        };
    }
}

