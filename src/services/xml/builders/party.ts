// @ts-nocheck
// Build Party XML (Issuer/Counterpart)
// Handles AADE rules for Greek vs international parties

import { escapeXml } from '../escape.js';
import { buildAddressXML } from '../escape.js';

export function buildPartyXML(party, role) {
    const tag = role === 'issuer' ? 'issuer' : 'counterpart';
    const branch = party.branch !== undefined && party.branch !== null ? Number(party.branch) : 0;
    const country = party.country || 'GR';
    const isGreek = country === 'GR';
    // AADE rules:
    // - Code 219: Issuer Name is forbidden for Issuer from Greece
    // - Code 205: Address element is forbidden for issuer from Greece
    // - Code 220: Counterpart Name is forbidden for Counterpart from Greece
    const nameXml = (!isGreek && party.name) ? `\n      <name>${escapeXml(party.name)}</name>` : '';
    const addressXml = (!isGreek && party.address) ? buildAddressXML(party.address) : '';
    // v2.0.2 fields
    const documentIdNoXml = party.documentIdNo ? `\n      <documentIdNo>${escapeXml(party.documentIdNo)}</documentIdNo>` : '';
    const supplyAccountNoXml = party.supplyAccountNo ? `\n      <supplyAccountNo>${escapeXml(party.supplyAccountNo)}</supplyAccountNo>` : '';
    const countryDocumentIdXml = party.countryDocumentId ? `\n      <countryDocumentId>${escapeXml(party.countryDocumentId)}</countryDocumentId>` : '';
    return `
    <${tag}>
      <vatNumber>${escapeXml(party.vatNumber)}</vatNumber>
      <country>${escapeXml(country)}</country>
      <branch>${branch}</branch>${nameXml}${addressXml}${documentIdNoXml}${supplyAccountNoXml}${countryDocumentIdXml}
    </${tag}>`;
}

