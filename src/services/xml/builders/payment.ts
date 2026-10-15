// @ts-nocheck
// Build Payment Methods XML
// Handles multiple payment methods with optional fallback amount

import { escapeXml } from '../escape.js';

export function buildPaymentMethodsXML(methods, fallbackAmount) {
    if (!methods || methods.length === 0) {
        if (fallbackAmount !== undefined) {
            return `
    <paymentMethods>
      <paymentMethodDetails>
        <type>1</type>
        <amount>${fallbackAmount.toFixed(2)}</amount>
      </paymentMethodDetails>
    </paymentMethods>`;
        }
        return '';
    }
    let xml = '    <paymentMethods>';
    for (const method of methods) {
        const amount = Number(method.amount) || 0;
        xml += `
      <paymentMethodDetails>
        <type>${escapeXml(method.type || '1')}</type>
        <amount>${amount.toFixed(2)}</amount>
        ${method.info ? `<paymentMethodInfo>${escapeXml(method.info)}</paymentMethodInfo>` : ''}
        ${method.tipAmount !== undefined && method.tipAmount > 0 ? `<tipAmount>${Number(method.tipAmount).toFixed(2)}</tipAmount>` : ''}
        ${method.transactionId ? `<transactionId>${escapeXml(method.transactionId)}</transactionId>` : ''}
        ${method.tid ? `<tid>${escapeXml(method.tid)}</tid>` : ''}
        ${method.providersSignature ? `<ProvidersSignature>
          <SigningAuthor>${escapeXml(method.providersSignature.signingAuthor)}</SigningAuthor>
          <Signature>${escapeXml(method.providersSignature.signature)}</Signature>
          ${method.providersSignature.endToEndReferenceID ? `<EndToEndReferenceID>${escapeXml(method.providersSignature.endToEndReferenceID)}</EndToEndReferenceID>` : ''}
        </ProvidersSignature>` : ''}
        ${method.ecrToken ? `<ECRToken>
          <SigningAuthor>${escapeXml(method.ecrToken.signingAuthor)}</SigningAuthor>
          <SessionNumber>${escapeXml(method.ecrToken.sessionNumber)}</SessionNumber>
        </ECRToken>` : ''}
      </paymentMethodDetails>`;
    }
    xml += '\n    </paymentMethods>';
    return xml;
}

