// @ts-nocheck
// Build Invoice Details XML (Line Items)
// Handles all v2.0.2 fields per AADE XSD sequence

import { escapeXml } from '../escape.js';
import { buildIncomeClassificationXML, buildExpensesClassificationXML } from './classifications.js';

export function buildInvoiceDetailsXML(lineItems) {
    let xml = '';
    for (const item of lineItems) {
        const netValue = Number(item.netValue || 0).toFixed(2);
        const vatAmount = Number(item.vatAmount || 0).toFixed(2);
        let vatExemptionXml = '';
        if ((item.vatCategory === '7' || item.vatCategory === '8') && item.vatExemptionCategory) {
            vatExemptionXml = `\n        <vatExemptionCategory>${item.vatExemptionCategory}</vatExemptionCategory>`;
        }
        // v2.0.2 fields
        let recTypeXml = item.recType !== undefined && item.recType !== null ? `\n        <recType>${item.recType}</recType>` : '';
        let taricNoXml = item.taricNo ? `\n        <TaricNo>${escapeXml(item.taricNo)}</TaricNo>` : '';
        let itemCodeXml = item.itemCode ? `\n        <itemCode>${escapeXml(item.itemCode)}</itemCode>` : '';
        let itemDescrXml = item.itemDescr ? `\n        <itemDescr>${escapeXml(item.itemDescr)}</itemDescr>` : '';
        let fuelCodeXml = item.fuelCode ? `\n        <fuelCode>${escapeXml(item.fuelCode)}</fuelCode>` : '';
        let invoiceDetailTypeXml = item.invoiceDetailType !== undefined && item.invoiceDetailType !== null ? `\n        <invoiceDetailType>${item.invoiceDetailType}</invoiceDetailType>` : '';
        let discountXml = '';
        if (item.discountOption === true) {
            discountXml = `\n        <discountOption>true</discountOption>`;
        }
        let withheldXml = '';
        if (item.withheldAmount !== undefined && item.withheldAmount !== null && item.withheldAmount > 0) {
            withheldXml = `\n        <withheldAmount>${Number(item.withheldAmount).toFixed(2)}</withheldAmount>`;
            if (item.withheldPercentCategory !== undefined && item.withheldPercentCategory !== null) {
                withheldXml += `\n        <withheldPercentCategory>${item.withheldPercentCategory}</withheldPercentCategory>`;
            }
        }
        let stampDutyXml = '';
        if (item.stampDutyAmount !== undefined && item.stampDutyAmount !== null && item.stampDutyAmount > 0) {
            stampDutyXml = `\n        <stampDutyAmount>${Number(item.stampDutyAmount).toFixed(2)}</stampDutyAmount>`;
            if (item.stampDutyPercentCategory !== undefined && item.stampDutyPercentCategory !== null) {
                stampDutyXml += `\n        <stampDutyPercentCategory>${item.stampDutyPercentCategory}</stampDutyPercentCategory>`;
            }
        }
        let feesXml = '';
        if (item.feesAmount !== undefined && item.feesAmount !== null && item.feesAmount > 0) {
            feesXml = `\n        <feesAmount>${Number(item.feesAmount).toFixed(2)}</feesAmount>`;
            if (item.feesPercentCategory !== undefined && item.feesPercentCategory !== null) {
                feesXml += `\n        <feesPercentCategory>${item.feesPercentCategory}</feesPercentCategory>`;
            }
        }
        let otherTaxesXml = '';
        if (item.otherTaxesAmount !== undefined && item.otherTaxesAmount !== null && item.otherTaxesAmount > 0) {
            otherTaxesXml = `\n        <otherTaxesAmount>${Number(item.otherTaxesAmount).toFixed(2)}</otherTaxesAmount>`;
            if (item.otherTaxesPercentCategory !== undefined && item.otherTaxesPercentCategory !== null) {
                otherTaxesXml += `\n        <otherTaxesPercentCategory>${item.otherTaxesPercentCategory}</otherTaxesPercentCategory>`;
            }
        }
        let deductionsXml = '';
        if (item.deductionsAmount !== undefined && item.deductionsAmount !== null && item.deductionsAmount > 0) {
            deductionsXml = `\n        <deductionsAmount>${Number(item.deductionsAmount).toFixed(2)}</deductionsAmount>`;
        }
        let lineCommentsXml = '';
        if (item.lineComments && item.lineComments.trim()) {
            lineCommentsXml = `\n        <lineComments>${escapeXml(item.lineComments)}</lineComments>`;
        }
        // Standard quantity & measurementUnit (come FIRST in XSD sequence)
        let quantityXml = item.quantity !== undefined && item.quantity !== null
            ? `\n        <quantity>${Number(item.quantity).toFixed(2)}</quantity>`
            : '\n        <quantity>1.00</quantity>';
        let measurementUnitXml = item.measurementUnit !== undefined && item.measurementUnit !== null
            ? `\n        <measurementUnit>${item.measurementUnit}</measurementUnit>`
            : '\n        <measurementUnit>1</measurementUnit>';
        // Alternative quantity15 & otherMeasurementUnit* (come LATER in XSD sequence)
        let quantity15Xml = '';
        if (item.quantity15 !== undefined && item.quantity15 !== null) {
            quantity15Xml = `\n        <quantity15>${Number(item.quantity15).toFixed(2)}</quantity15>`;
        }
        // Do NOT auto-generate quantity15 from quantity - only when explicitly provided
        let otherMeasurementUnitQuantityXml = item.otherMeasurementUnitQuantity !== undefined && item.otherMeasurementUnitQuantity !== null
            ? `\n        <otherMeasurementUnitQuantity>${item.otherMeasurementUnitQuantity}</otherMeasurementUnitQuantity>`
            : '';
        let otherMeasurementUnitTitleXml = item.otherMeasurementUnitTitle
            ? `\n        <otherMeasurementUnitTitle>${escapeXml(item.otherMeasurementUnitTitle)}</otherMeasurementUnitTitle>`
            : '';
        let notVAT195Xml = item.notVAT195 === true ? '\n        <notVAT195>true</notVAT195>' : '';
        let movePurposeLineXml = item.movePurposeLine !== undefined && item.movePurposeLine !== null ? `\n        <movePurposeLine>${item.movePurposeLine}</movePurposeLine>` : '\n        <movePurposeLine>1</movePurposeLine>';
        // String fields: include empty to maintain XSD sequence position
        let otherMovePurposeLineTitleXml = item.otherMovePurposeLineTitle !== undefined ? `\n        <otherMovePurposeLineTitle>${escapeXml(item.otherMovePurposeLineTitle || '')}</otherMovePurposeLineTitle>` : '\n        <otherMovePurposeLineTitle></otherMovePurposeLineTitle>';
        let vatExemptDescrENXml = item.vatExemptDescrEN !== undefined ? `\n        <vatExemptDescrEN>${escapeXml(item.vatExemptDescrEN || '')}</vatExemptDescrEN>` : '\n        <vatExemptDescrEN></vatExemptDescrEN>';
        let vatExemptDescrGRXml = item.vatExemptDescrGR !== undefined ? `\n        <vatExemptDescrGR>${escapeXml(item.vatExemptDescrGR || '')}</vatExemptDescrGR>` : '\n        <vatExemptDescrGR></vatExemptDescrGR>';
        let movePurpDescrLineENXml = item.movePurpDescrLineEN !== undefined ? `\n        <movePurpDescrLineEN>${escapeXml(item.movePurpDescrLineEN || '')}</movePurpDescrLineEN>` : '\n        <movePurpDescrLineEN></movePurpDescrLineEN>';
        let movePurpDescrLineGRXml = item.movePurpDescrLineGR !== undefined ? `\n        <movePurpDescrLineGR>${escapeXml(item.movePurpDescrLineGR || '')}</movePurpDescrLineGR>` : '\n        <movePurpDescrLineGR></movePurpDescrLineGR>';
        let dienergiaXml = '';
        if (item.dienergia) {
            dienergiaXml = `\n        <dienergia>
        <applicationId>${escapeXml(item.dienergia.applicationId)}</applicationId>
        <applicationDate>${escapeXml(item.dienergia.applicationDate)}</applicationDate>
        ${item.dienergia.doy ? `<doy>${escapeXml(item.dienergia.doy)}</doy>` : ''}
        <shipId>${escapeXml(item.dienergia.shipId)}</shipId>
      </dienergia>`;
        }
        // Income/Expense classifications must come AFTER all v2.0.2 fields per sandbox XSD sequence
        const incomeClassXml = item.incomeClassifications && item.incomeClassifications.length > 0
            ? buildIncomeClassificationXML(item.incomeClassifications)
            : '';
        const expensesClassXml = item.expensesClassifications && item.expensesClassifications.length > 0
            ? buildExpensesClassificationXML(item.expensesClassifications)
            : '';
        xml += `
      <invoiceDetails>
        <lineNumber>${item.lineNum}</lineNumber>
        ${recTypeXml}
        ${taricNoXml}
        ${itemCodeXml}
        ${itemDescrXml}
        ${fuelCodeXml}
        ${invoiceDetailTypeXml}
        <netValue>${netValue}</netValue>
        <vatCategory>${escapeXml(item.vatCategory)}</vatCategory>
        <vatAmount>${vatAmount}</vatAmount>${vatExemptionXml}${dienergiaXml}${discountXml}${withheldXml}${stampDutyXml}${feesXml}${otherTaxesXml}${deductionsXml}${lineCommentsXml}${incomeClassXml}${expensesClassXml}${quantity15Xml}${otherMeasurementUnitQuantityXml}${otherMeasurementUnitTitleXml}${notVAT195Xml}${vatExemptDescrENXml}${vatExemptDescrGRXml}${movePurposeLineXml}${otherMovePurposeLineTitleXml}${movePurpDescrLineENXml}${movePurpDescrLineGRXml}
      </invoiceDetails>`;
    }
    return xml;
}

