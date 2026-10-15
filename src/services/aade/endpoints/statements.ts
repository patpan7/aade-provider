// @ts-nocheck
// Statement Endpoints - Send, Request, and Recall Statements

import { getAadeConfig } from '../../../config/aade.config.js';
import { aadeFetch, buildStatementXml } from '../client.js';
import { XMLParser } from 'fast-xml-parser';

export async function sendStatement(params) {
    const config = getAadeConfig();
    if (!config.userId || !config.subscriptionKey) {
        return {
            success: false,
            errors: ['AADE credentials not configured'],
        };
    }
    // Validate required fields
    if (!params.entityVatNumber || !params.providerVatNumber || !params.providerLicenceNumber ||
        !params.providerContractNumber || !params.providerContractConclusionDate ||
        !params.providerContractActivationDate) {
        return {
            success: false,
            errors: ['Missing required fields for statement submission'],
        };
    }
    // At least one transaction type must be true
    if (!params.isB2BTransactions && !params.isB2CTransactions && !params.isB2GTransactions) {
        return {
            success: false,
            errors: ['At least one transaction type (B2B, B2C, B2G) must be true'],
        };
    }
    try {
        const baseUrl = config.apiUrl.replace('/myDATAProvider/SendInvoices', '');
        const url = new URL(`${config.apiUrl.replace('/myDATAProvider/SendInvoices', '')}/myDataProvider/SendStatement`);
        // Build the StatementDoc XML
        const statementXml = buildStatementXml(params);
        const { response, rawResponse } = await aadeFetch(url.toString(), {
            method: 'POST',
            body: statementXml,
        });
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
        const doc = parsed?.StatementResponse || parsed;
        return {
            success: true,
            statementId: doc?.statementId,
            submissionDateTime: doc?.submissionDateTime,
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

export async function requestStatements(params = {}) {
    const config = getAadeConfig();
    if (!config.userId || !config.subscriptionKey) {
        return {
            success: false,
            errors: ['AADE credentials not configured'],
        };
    }
    try {
        const baseUrl = config.apiUrl.replace('/myDATAProvider/SendInvoices', '');
        const url = new URL(`${config.apiUrl.replace('/myDATAProvider/SendInvoices', '')}/myDataProvider/RequestStatements`);
        if (params.entityVatNumber)
            url.searchParams.append('entityVatNumber', params.entityVatNumber);
        if (params.providerVatNumber)
            url.searchParams.append('providerVatNumber', params.providerVatNumber);
        if (params.fromDate)
            url.searchParams.append('fromDate', params.fromDate);
        if (params.toDate)
            url.searchParams.append('toDate', params.toDate);
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
        const parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: '@_',
            textNodeName: '_text',
            trimValues: true,
        });
        const parsed = parser.parse(rawResponse);
        const doc = parsed?.RequestedStatementsDoc || parsed;
        if (!doc) {
            return { success: false, errors: ['Invalid response format'], rawResponse };
        }
        const stmts = doc?.Statement
            ? (Array.isArray(doc.Statement) ? doc.Statement : [doc.Statement])
            : [];
        return {
            success: true,
            continuationToken: doc?.continuationToken,
            nextPartitionKey: doc?.nextPartitionKey,
            nextRowKey: doc?.nextRowKey,
            statements: stmts.map((s) => ({
                statementId: s.statementId,
                entityVatNumber: s.entityVatNumber,
                submissionDateTime: s.submissionDateTime,
                totalB2B: s.totalB2B,
                totalB2C: s.totalB2C,
                totalB2G: s.totalB2G,
                status: s.status
            })),
        };
    }
    catch (err) {
        return {
            success: false,
            errors: [err.message],
        };
    }
}

export async function recallStatement(params) {
    const config = getAadeConfig();
    if (!config.userId || !config.subscriptionKey) {
        return {
            success: false,
            errors: ['AADE credentials not configured'],
        };
    }
    if (!params.stmtId || !params.entityVatNumber || !params.recallStatus) {
        return {
            success: false,
            errors: ['stmtId, entityVatNumber, and recallStatus are required'],
        };
    }
    if (params.recallStatus === 1 && !params.recallDate) {
        return {
            success: false,
            errors: ['recallDate is required when recallStatus=1 (Partial)'],
        };
    }
    try {
        const baseUrl = config.apiUrl.replace('/myDATAProvider/SendInvoices', '');
        const url = new URL(`${config.apiUrl.replace('/myDATAProvider/SendInvoices', '')}/myDataProvider/RecallStatement`);
        url.searchParams.append('stmtId', params.stmtId);
        url.searchParams.append('entityVatNumber', params.entityVatNumber);
        url.searchParams.append('recallStatus', String(params.recallStatus));
        if (params.recallDate)
            url.searchParams.append('recallDate', params.recallDate);
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
        const doc = parsed?.RecallStatementResponse || parsed;
        return {
            success: true,
            recallId: doc?.recallId,
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

