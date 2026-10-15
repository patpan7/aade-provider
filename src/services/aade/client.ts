// @ts-nocheck
// AADE API Client
// Generic fetch helper, statement XML builder, mock response generator

import { getAadeConfig } from '../../config/aade.config.js';
import { extractInvoiceMark, escapeXml } from '../../xml/index.js';
import dotenv from 'dotenv';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Load .env from project root
const _dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(_dirname, '..', '..', '..', '.env') });
export const USE_MOCK = process.env.AADE_MOCK === 'true';

export interface AADEConfig {
    userId: string;
    subscriptionKey: string;
    apiUrl: string;
    qrBaseUrl: string;
}

// Generic fetch helper for AADE API (with connection pooling + rate limiting)
export async function aadeFetch(url, options = {}) {
    const config = getAadeConfig();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
        console.log('[AADE] Sending request to:', url);
        const response = await fetch(url, {
            method: options.method || 'GET',
            headers: {
                'aade-user-id': config.userId,
                'ocp-apim-subscription-key': config.subscriptionKey,
                'Content-Type': 'application/xml',
                Accept: 'application/xml',
                ...options.headers,
            },
            body: options.body,
            signal: controller.signal,
        });
        clearTimeout(timeout);
        console.log('[AADE] Response status:', response.status);
        const rawResponse = await response.text();
        return { response, rawResponse };
    }
    catch (fetchError) {
        clearTimeout(timeout);
        console.error('[AADE] Fetch error:', fetchError.message);
        throw fetchError;
    }
}

export function buildStatementXml(params) {
    const date = new Date(params.providerContractConclusionDate);
    const activationDate = new Date(params.providerContractActivationDate);
    const conclusionDateStr = date.toISOString().split('T')[0];
    const activationDateStr = activationDate.toISOString().split('T')[0];
    return `<?xml version="1.0" encoding="UTF-8"?>
<StatementDoc xmlns="http://www.aade.gr/myDATA/invoice/v1.0"
              xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
              xsi:schemaLocation="http://www.aade.gr/myDATA/invoice/v1.0 StatementDoc-v2.0.xsd">
  <statement>
    <statementId>${params.statementId || ''}</statementId>
    <submissionDateTime>${new Date().toISOString()}</submissionDateTime>
    <entityVatNumber>${params.entityVatNumber}</entityVatNumber>
    <liableUserCategory>${params.liableUserCategory}</liableUserCategory>
    <providerType>${params.providerType}</providerType>
    <isB2BTransactions>${params.isB2BTransactions}</isB2BTransactions>
    <isB2CTransactions>${params.isB2CTransactions}</isB2CTransactions>
    <isB2GTransactions>${params.isB2GTransactions}</isB2GTransactions>
    <providerVatNumber>${params.providerVatNumber}</providerVatNumber>
    <providerLicenceNumber>${params.providerLicenceNumber}</providerLicenceNumber>
    <providerContractNumber>${params.providerContractNumber}</providerContractNumber>
    <providerContractConclusionDate>${conclusionDateStr}</providerContractConclusionDate>
    <providerContractActivationDate>${activationDateStr}</providerContractActivationDate>
    ${params.issueStartDate ? `<issueStartDate>${params.issueStartDate}</issueStartDate>` : ''}
    ${params.issueStopDate ? `<issueStopDate>${params.issueStopDate}</issueStopDate>` : ''}
    ${params.internetProvider ? `<internetProvider>${params.internetProvider}</internetProvider>` : ''}
    ${params.internetProviderContractNumber ? `<internetProviderContractNumber>${params.internetProviderContractNumber}</internetProviderContractNumber>` : ''}
    ${params.internetProviderContractDate ? `<internetProviderContractDate>${params.internetProviderContractDate}</internetProviderContractDate>` : ''}
  </statement>
</StatementDoc>`;
}

function mockAADEResponse(xmlPayload) {
    // Generate realistic 15-digit numeric MARK typical of AADE myDATA
    const mockMark = '8' + Math.floor(10000000000000 + Math.random() * 90000000000000).toString();
    const mockUid = 'U' + mockMark;
    const config = getAadeConfig();
    const qrUrl = buildQRUrl(mockMark, mockMark, config.qrBaseUrl);
    const mockXmlResponse = `<?xml version="1.0" encoding="utf-8"?>
<ResponseDoc xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <response>
    <index>1</index>
    <invoiceUid>${mockUid}</invoiceUid>
    <invoiceMark>${mockMark}</invoiceMark>
    <qrUrl>${qrUrl}</qrUrl>
    <statusCode>Success</statusCode>
  </response>
</ResponseDoc>`;
    return {
        success: true,
        mark: mockMark,
        invoiceUid: mockUid,
        statusCode: 'Success',
        qrUrl,
        rawResponse: mockXmlResponse,
    };
}

export function buildQRUrl(hash, mark, qrBaseUrl = 'https://mydataapidev.aade.gr/open') {
    return `${qrBaseUrl}/TimologioQR/QRInfo?q=${hash}&mark=${mark}`;
}
