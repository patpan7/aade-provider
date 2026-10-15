// @ts-nocheck
// Invoice Type Rules Registry
// Maps invoice type codes to their validation rules
import { invoiceType111Rules } from './1.1.js';
import { invoiceType112Rules } from './1.2.js';
import { invoiceType113Rules } from './1.3.js';
import { invoiceType114Rules } from './1.4.js';
import { invoiceType211Rules } from './2.1.js';
import { invoiceType212Rules } from './2.2.js';
import { invoiceType213Rules } from './2.3.js';
import { invoiceType1111Rules } from './11.1.js';
import { invoiceType1112Rules } from './11.2.js';
import { invoiceType1113Rules } from './11.3.js';
import { invoiceType1114Rules } from './11.4.js';
import { invoiceType1115Rules } from './11.5.js';
import { invoiceType511Rules } from './5.1.js';
import { invoiceType512Rules } from './5.2.js';
// 5.3, 5.4, 5.5 use same rules as 5.2 (not in Excel)
import { invoiceType512Rules as invoiceType513Rules } from './5.2.js';
import { invoiceType512Rules as invoiceType514Rules } from './5.2.js';
import { invoiceType512Rules as invoiceType515Rules } from './5.2.js';
export const invoiceTypeRules = {
    '1.1': invoiceType111Rules,
    '1.2': invoiceType112Rules,
    '1.3': invoiceType113Rules,
    '1.4': invoiceType114Rules,
    '2.1': invoiceType211Rules,
    '2.2': invoiceType212Rules,
    '2.3': invoiceType213Rules,
    '11.1': invoiceType1111Rules,
    '11.2': invoiceType1112Rules,
    '11.3': invoiceType1113Rules,
    '11.4': invoiceType1114Rules,
    '11.5': invoiceType1115Rules,
    '5.1': invoiceType511Rules,
    '5.2': invoiceType512Rules,
    '5.3': invoiceType513Rules,
    '5.4': invoiceType514Rules,
    '5.5': invoiceType515Rules,
};
export const VALID_INVOICE_TYPES = new Set(Object.keys(invoiceTypeRules));
export function getInvoiceTypeRules(type) {
    return invoiceTypeRules[type];
}
export function isValidInvoiceType(type) {
    return VALID_INVOICE_TYPES.has(type);
}
export function getInvoiceTypeName(type) {
    return invoiceTypeRules[type]?.name || 'Άγνωστος Τύπος';
}
export function getInvoiceTypeCategory(type) {
    return invoiceTypeRules[type]?.category || 'unknown';
}

