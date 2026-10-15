// @ts-nocheck
// Build Invoice Header XML
// Follows AADE XSD sequence v2.0.2 - namespace v1.0

import { escapeXml } from '../escape.js';
import { buildAddressXML } from '../escape.js';

export function buildInvoiceHeaderXML(invoice) {
    // AADE XSD sequence (v2.0.2 - namespace v1.0):
    // 1. series, 2. aa, 3. issueDate, 4. invoiceType
    // 5. vatPaymentSuspension (only if true), 6. currency
    // 7. exchangeRate (if currency != EUR or provided)
    // 8. correlatedInvoices (0 or more), 9. selfPricing (only if true)
    // 10-16. dispatchDate, dispatchTime, vehicleNumber, movePurpose, fuelInvoice, specialInvoiceCategory, invoiceVariationType
    // 17. otherCorrelatedEntities (0 or more), 18. otherDeliveryNoteHeader
    // 19. isDeliveryNote, 20. otherMovePurposeTitle, 21. thirdPartyCollection
    // 22. multipleConnectedMarks (0 or more), 23. tableAA, 24. totalCancelDeliveryOrders
    // 25. reverseDeliveryNote, 26. reverseDeliveryNotePurpose, 27. toWeigh
    // 28. receivingNotePurpose, 29. otherReceivingNotePurposeTitle, 30. nonObligatedRecipient
    // 31. withoutDigitalTransportTracking
    // NOTE: issueTime is NOT in invoiceHeader in v1.0/v2.0 XSD
    const vatSuspensionXml = invoice.vatPaymentSuspension === true ? '\n      <vatPaymentSuspension>true</vatPaymentSuspension>' : '';
    const currencyXml = `\n      <currency>${escapeXml(invoice.currency || 'EUR')}</currency>`;
    const exchangeRateXml = (invoice.currency && invoice.currency !== 'EUR' && invoice.exchangeRate)
        ? `\n      <exchangeRate>${Number(invoice.exchangeRate).toFixed(5)}</exchangeRate>`
        : '';
    let correlatedXml = '';
    if (invoice.correlatedInvoices && invoice.correlatedInvoices.length > 0) {
        correlatedXml = '\n      ' + invoice.correlatedInvoices
            .map(inv => `<correlatedInvoices>${escapeXml(inv)}</correlatedInvoices>`)
            .join('\n      ');
    }
    // AADE rule: Code 214: Element selfPricing must be sent only if it is true
    const selfPricingXml = invoice.selfPricing === true ? '\n      <selfPricing>true</selfPricing>' : '';
    // Delivery / Dispatch fields
    const dispatchDateXml = invoice.dispatchDate ? `\n      <dispatchDate>${escapeXml(invoice.dispatchDate)}</dispatchDate>` : '';
    const dispatchTimeXml = invoice.dispatchTime ? `\n      <dispatchTime>${escapeXml(invoice.dispatchTime)}</dispatchTime>` : '';
    const vehicleNumberXml = invoice.vehicleNumber ? `\n      <vehicleNumber>${escapeXml(invoice.vehicleNumber)}</vehicleNumber>` : '';
    const movePurposeXml = invoice.movePurpose !== undefined && invoice.movePurpose !== null
        ? `\n      <movePurpose>${invoice.movePurpose}</movePurpose>`
        : '';
    // v2.0.2 fields
    const fuelInvoiceXml = invoice.fuelInvoice === true ? '\n      <fuelInvoice>true</fuelInvoice>' : '';
    const specialInvoiceCategoryXml = invoice.specialInvoiceCategory ? `\n      <specialInvoiceCategory>${escapeXml(invoice.specialInvoiceCategory)}</specialInvoiceCategory>` : '';
    const invoiceVariationTypeXml = invoice.invoiceVariationType ? `\n      <invoiceVariationType>${escapeXml(invoice.invoiceVariationType)}</invoiceVariationType>` : '';
    let otherCorrelatedEntitiesXml = '';
    if (invoice.otherCorrelatedEntities && invoice.otherCorrelatedEntities.length > 0) {
        otherCorrelatedEntitiesXml = '\n      ' + invoice.otherCorrelatedEntities
            .map(e => `<otherCorrelatedEntities>
        <type>${e.type}</type>
        <entityData>
          <vatNumber>${escapeXml(e.entityData.vatNumber)}</vatNumber>
          <country>${escapeXml(e.entityData.country || 'GR')}</country>
          <branch>${e.entityData.branch || 0}</branch>
          ${e.entityData.name ? `<name>${escapeXml(e.entityData.name)}</name>` : ''}
          ${e.entityData.address && !e.entityData.country.startsWith('GR') ? buildAddressXML(e.entityData.address) : ''}
        </entityData>
      </otherCorrelatedEntities>`)
            .join('\n      ');
    }
    let otherDeliveryNoteHeaderXml = '';
    if (invoice.otherDeliveryNoteHeader) {
        const h = invoice.otherDeliveryNoteHeader;
        otherDeliveryNoteHeaderXml = `\n      <otherDeliveryNoteHeader>
        <loadingAddress>${buildAddressXML(h.loadingAddress)}</loadingAddress>
        <deliveryAddress>${buildAddressXML(h.deliveryAddress)}</deliveryAddress>
        ${h.startShippingBranch !== undefined ? `<startShippingBranch>${h.startShippingBranch}</startShippingBranch>` : ''}
        ${h.completeShippingBranch !== undefined ? `<completeShippingBranch>${h.completeShippingBranch}</completeShippingBranch>` : ''}
      </otherDeliveryNoteHeader>`;
    }
    const isDeliveryNoteXml = invoice.isDeliveryNote === true ? '\n      <isDeliveryNote>true</isDeliveryNote>' : '';
    const otherMovePurposeTitleXml = invoice.otherMovePurposeTitle ? `\n      <otherMovePurposeTitle>${escapeXml(invoice.otherMovePurposeTitle)}</otherMovePurposeTitle>` : '';
    const thirdPartyCollectionXml = invoice.thirdPartyCollection === true ? '\n      <thirdPartyCollection>true</thirdPartyCollection>' : '';
    let multipleConnectedMarksXml = '';
    if (invoice.multipleConnectedMarks && invoice.multipleConnectedMarks.length > 0) {
        multipleConnectedMarksXml = '\n      ' + invoice.multipleConnectedMarks
            .map(m => `<multipleConnectedMarks>${m}</multipleConnectedMarks>`)
            .join('\n      ');
    }
    const tableAAXml = invoice.tableAA ? `\n      <tableAA>${escapeXml(invoice.tableAA)}</tableAA>` : '';
    const totalCancelDeliveryOrdersXml = invoice.totalCancelDeliveryOrders === true ? '\n      <totalCancelDeliveryOrders>true</totalCancelDeliveryOrders>' : '';
    const reverseDeliveryNoteXml = invoice.reverseDeliveryNote === true ? '\n      <reverseDeliveryNote>true</reverseDeliveryNote>' : '';
    const reverseDeliveryNotePurposeXml = invoice.reverseDeliveryNotePurpose ? `\n      <reverseDeliveryNotePurpose>${escapeXml(invoice.reverseDeliveryNotePurpose)}</reverseDeliveryNotePurpose>` : '';
    const toWeighXml = invoice.toWeigh === true ? '\n      <toWeigh>true</toWeigh>' : '';
    const receivingNotePurposeXml = invoice.receivingNotePurpose ? `\n      <receivingNotePurpose>${escapeXml(invoice.receivingNotePurpose)}</receivingNotePurpose>` : '';
    const otherReceivingNotePurposeTitleXml = invoice.otherReceivingNotePurposeTitle ? `\n      <otherReceivingNotePurposeTitle>${escapeXml(invoice.otherReceivingNotePurposeTitle)}</otherReceivingNotePurposeTitle>` : '';
    const nonObligatedRecipientXml = invoice.nonObligatedRecipient === true ? '\n      <nonObligatedRecipient>true</nonObligatedRecipient>' : '';
    const withoutDigitalTransportTrackingXml = invoice.withoutDigitalTransportTracking === true ? '\n      <withoutDigitalTransportTracking>true</withoutDigitalTransportTracking>' : '';
    return `
    <invoiceHeader>
      <series>${escapeXml(invoice.series)}</series>
      <aa>${escapeXml(invoice.aa)}</aa>
      <issueDate>${escapeXml(invoice.issueDate)}</issueDate>
      <invoiceType>${escapeXml(invoice.invoiceType)}</invoiceType>${vatSuspensionXml}${currencyXml}${exchangeRateXml}${correlatedXml}${selfPricingXml}${dispatchDateXml}${dispatchTimeXml}${vehicleNumberXml}${movePurposeXml}${fuelInvoiceXml}${specialInvoiceCategoryXml}${invoiceVariationTypeXml}${otherCorrelatedEntitiesXml}${otherDeliveryNoteHeaderXml}${isDeliveryNoteXml}${otherMovePurposeTitleXml}${thirdPartyCollectionXml}${multipleConnectedMarksXml}${tableAAXml}${totalCancelDeliveryOrdersXml}${reverseDeliveryNoteXml}${reverseDeliveryNotePurposeXml}${toWeighXml}${receivingNotePurposeXml}${otherReceivingNotePurposeTitleXml}${nonObligatedRecipientXml}${withoutDigitalTransportTrackingXml}
    </invoiceHeader>`;
}

