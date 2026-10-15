// @ts-nocheck
// Payments Method Endpoint - Send Payment Methods to AADE

import { getAadeConfig } from '../../../config/aade.config.js';
import { aadeFetch } from '../client.js';
import { escapeXml } from '../../xml/escape.js';

export async function sendPaymentsMethod(methods) {
    const config = getAadeConfig();
    if (!config.userId || !config.subscriptionKey) {
        return {
            success: false,
            errors: ['AADE credentials not configured'],
        };
    }
    if (!methods || methods.length === 0) {
        return {
            success: false,
            errors: ['At least one payment method is required'],
        };
    }
    try {
        const baseUrl = config.apiUrl.replace('/myDATAProvider/SendInvoices', '');
        const url = new URL(`${config.apiUrl.replace('/myDATAProvider/SendInvoices', '')}/myDataProvider/SendPaymentsMethod`);
        // Build the PaymentMethodsDoc XML
        const paymentMethodsDetailsXml = methods.map((m) => {
            return `
      <paymentMethodDetails>
        <type>${m.type}</type>
        <amount>${Number(m.amount || 0).toFixed(2)}</amount>
        ${m.info ? `<paymentMethodInfo>${escapeXml(m.info)}</paymentMethodInfo>` : ''}
        ${m.tipAmount !== undefined ? `<tipAmount>${Number(m.tipAmount).toFixed(2)}</tipAmount>` : ''}
        ${m.transactionId ? `<transactionId>${escapeXml(m.transactionId)}</transactionId>` : ''}
        ${m.tid ? `<tid>${escapeXml(m.tid)}</tid>` : ''}
        ${m.providersSignature ? `
        <ProvidersSignature>
          <SigningAuthor>${escapeXml(m.providersSignature.signingAuthor)}</SigningAuthor>
          <Signature>${escapeXml(m.providersSignature.signature)}</Signature>
          ${m.providersSignature.endToEndReferenceID ? `<EndToEndReferenceID>${escapeXml(m.providersSignature.endToEndReferenceID)}</EndToEndReferenceID>` : ''}
        </ProvidersSignature>` : ''}
        ${m.ecrToken ? `
        <ECRToken>
          <SigningAuthor>${escapeXml(m.ecrToken.signingAuthor)}</SigningAuthor>
          <SessionNumber>${escapeXml(m.ecrToken.sessionNumber)}</SessionNumber>
        </ECRToken>` : ''}
      </paymentMethodDetails>`;
        }).join('\n');
        const paymentMethodsXml = `
      <paymentMethods>${paymentMethodsDetailsXml}
      </paymentMethods>`;
        const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<PaymentMethodsDoc xmlns="http://www.aade.gr/myDATA/invoice/v1.0"
                   xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                   xsi:schemaLocation="http://www.aade.gr/myDATA/invoice/v1.0 PaymentMethodsDoc-v2.0.xsd">
  ${paymentMethodsXml}
</PaymentMethodsDoc>`;
        const { response, rawResponse } = await aadeFetch(`${config.apiUrl.replace('/myDATAProvider/SendInvoices', '')}/myDataProvider/SendPaymentsMethod`, { method: 'POST', body: xmlPayload });
        if (!response.ok) {
            return {
                success: false,
                errors: [`HTTP ${response.status}: ${response.statusText}`],
                rawResponse,
            };
        }
        return {
            success: true,
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

