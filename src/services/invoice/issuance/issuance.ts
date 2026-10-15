// @ts-nocheck
// Invoice Issuance - Main workflow for issuing invoices
// Orchestrates validation, calculation, XML building, and AADE submission

import { InvoiceData, InvoiceLineItem, InvoiceTotals, AADEIssueResponse } from '../../../types/mydata.types.js';
import { generateUUID, insertInvoice, getAllInvoices, getInvoiceById, logQSealSignature, insertInvoicePayments } from '../../../db/database.js';
import { validateGreekAFM } from '../../hash.service.js';
import { buildInvoicesDocXML } from '../../xml/builders/invoices-doc.js';
import { sendInvoiceToAADE } from '../../aade/endpoints/invoices.js';
import { getAadeConfig, isConfigValid } from '../../config/aade.config.js';
import { validateLineClassifications, validateInvoiceHeader, validateProviderRules } from '../validation/validation.js';
import { calculateLineItem, calculateTotals, generateHash } from '../calculation/calculation.js';
import { getNextAA } from '../../../db/database.js';
import { wormStorage } from '../../worm/storage.js';
import { qsealService } from '../../qseal/service.js';
import { logger } from '../../logging/service.js';
import { aesEncryption } from '../../encryption/service.js';

const RETAIL_TYPES = new Set(['11.1', '11.2', '11.3', '11.4', '11.5']);

export function buildQRUrl(hash: string, mark: string, qrBaseUrl: string): string {
  const base = qrBaseUrl.replace(/\/open$/, '').replace(/\/+$/, '');
  return `${base}/TimologioQR/QRInfo?q=${hash}&mark=${mark}`;
}

// Get next AA number for a given series and invoice type
// Uses series_counters table with atomic locking to prevent race conditions

export async function issueInvoice(
  invoiceData: any,
  credentials?: { userId: string; subscriptionKey: string }
): Promise<AADEIssueResponse & { uuid: string; hash: string; xml: string; id: number }> {
  if (!invoiceData.invoiceType) {
    throw new Error('Invoice type is required');
  }

  const issuerVat = invoiceData.issuer?.vatNumber || invoiceData.issuerVat;
  if (!issuerVat) {
    throw new Error('Issuer VAT number is required');
  }

  if (!invoiceData.issuer?.country || invoiceData.issuer.country === 'GR') {
    const afmCheck = validateGreekAFM(issuerVat);
    if (!afmCheck.valid) {
      throw new Error(`Invalid Issuer VAT: ${afmCheck.error}`);
    }
  }

  const isRetail = RETAIL_TYPES.has(invoiceData.invoiceType);
  const counterpartVat = invoiceData.counterpart?.vatNumber || invoiceData.counterpartVat;

  if (!isRetail && !counterpartVat) {
    throw new Error(`Counterpart is required for invoice type ${invoiceData.invoiceType}`);
  }

  if (counterpartVat && (!invoiceData.counterpart?.country || invoiceData.counterpart.country === 'GR')) {
    const afmCheck = validateGreekAFM(counterpartVat);
    if (!afmCheck.valid) {
      throw new Error(`Invalid Counterpart VAT: ${afmCheck.error}`);
    }
  }

  if (!invoiceData.lineItems || invoiceData.lineItems.length === 0) {
    throw new Error('Invoice must contain at least one line item');
  }

  const uuid = generateUUID();
  const processedLineItems = invoiceData.lineItems.map((item: any, idx: number) =>
    calculateLineItem({ ...item, lineNum: item.lineNum || idx + 1 }, invoiceData.invoiceType)
  );

  const totals = calculateTotals(processedLineItems);

  let paymentMethods = invoiceData.paymentMethods;
  if (!paymentMethods || paymentMethods.length === 0) {
    paymentMethods = [{
      type: '1',
      amount: totals.totalGross,
      info: 'Settlement'
    }];
  }

  const normalizedInvoice: InvoiceData = {
    uuid,
    invoiceType: String(invoiceData.invoiceType),
    issuer: {
      vatNumber: issuerVat,
      country: invoiceData.issuer?.country || 'GR',
      branch: invoiceData.issuer?.branch !== undefined ? Number(invoiceData.issuer.branch) : 0,
      name: invoiceData.issuer?.name,
      address: invoiceData.issuer?.address,
    },
    counterpart: counterpartVat ? {
      vatNumber: counterpartVat,
      country: invoiceData.counterpart?.country || 'GR',
      branch: invoiceData.counterpart?.branch !== undefined ? Number(invoiceData.counterpart.branch) : 0,
      name: invoiceData.counterpart?.name,
      address: invoiceData.counterpart?.address,
    } : undefined,
    series: String(invoiceData.series || 'A'),
    aa: await getNextAA(invoiceData.invoiceType, invoiceData.series || 'A', 
      invoiceData.issuer?.branch ?? 0, invoiceData.tenant_id ?? 1),
    issueDate: String(invoiceData.issueDate || new Date().toISOString().split('T')[0]),
    issueTime: invoiceData.issueTime ? String(invoiceData.issueTime) : undefined,
    currency: String(invoiceData.currency || 'EUR'),
    exchangeRate: invoiceData.exchangeRate !== undefined ? Number(invoiceData.exchangeRate) : undefined,
    paymentMethods,
    lineItems: processedLineItems,
    notes: invoiceData.notes,
    selfPricing: invoiceData.selfPricing === true,
    vatPaymentSuspension: invoiceData.vatPaymentSuspension === true,
    correlatedInvoices: invoiceData.correlatedInvoices,
    dispatchDate: invoiceData.dispatchDate,
    dispatchTime: invoiceData.dispatchTime,
    vehicleNumber: invoiceData.vehicleNumber,
    movePurpose: invoiceData.movePurpose !== undefined ? Number(invoiceData.movePurpose) : undefined,
    tenantId: invoiceData.tenant_id,
    apiKeyId: invoiceData.api_key_id,
  };

  const config = getAadeConfig();

  const headerValidation = validateInvoiceHeader(normalizedInvoice);
  if (!headerValidation.valid) {
    throw new Error(`Header validation failed:\n${headerValidation.errors.join('\n')}`);
  }

  const classValidation = validateLineClassifications(processedLineItems, normalizedInvoice.invoiceType);
  if (!classValidation.valid) {
    throw new Error(`Classification validation failed:\n${classValidation.errors.join('\n')}`);
  }

  const providerValidation = validateProviderRules(normalizedInvoice, processedLineItems, isConfigValid(), config.userId);
  if (!providerValidation.valid) {
    throw new Error(`Provider validation failed:\n${providerValidation.errors.join('\n')}`);
  }

  const hash = generateHash(normalizedInvoice, totals);
  const xml = buildInvoicesDocXML(normalizedInvoice, totals);

  const effectiveCredentials = credentials || (config.userId && config.subscriptionKey ? {
    userId: config.userId,
    subscriptionKey: config.subscriptionKey
  } : undefined);

  const result = await sendInvoiceToAADE(xml, effectiveCredentials) as any;

  const errorString = result.errors && result.errors.length > 0 ? result.errors.join(' | ') : undefined;
  const qrBaseUrl = config.qrBaseUrl || 'https://mydataapidev.aade.gr/open';
  const qrUrl = result.qrUrl || (result.mark ? buildQRUrl(hash, result.mark, qrBaseUrl) : undefined);

  const insertResult = insertInvoice({
    uuid,
    issuerVat,
    counterpartVat: counterpartVat || undefined,
    invoiceType: normalizedInvoice.invoiceType,
    series: normalizedInvoice.series,
    aa: normalizedInvoice.aa,
    issueDate: normalizedInvoice.issueDate,
    totalNet: totals.totalNet,
    totalVat: totals.totalVat,
    totalGross: totals.totalGross,
    sha256Hash: hash,
    mark: result.mark,
    invoiceUid: result.invoiceUid,
    qrUrl,
    status: result.success ? 'SENT' : 'FAILED',
    xmlRequest: xml,
    aadeRawResponse: result.rawResponse,
    errors: errorString,
    tenantId: normalizedInvoice.tenantId,
    apiKeyId: normalizedInvoice.apiKeyId,
    // Display fields (not sent to AADE)
    issuerName: invoiceData.issuer?.name || undefined,
    issuerAddress: invoiceData.issuer?.address || undefined,
    issuerPostalCode: invoiceData.issuer?.postalCode || undefined,
    issuerCity: invoiceData.issuer?.city || undefined,
    counterpartName: invoiceData.counterpart?.name || undefined,
    counterpartAddress: invoiceData.counterpart?.address || undefined,
    counterpartPostalCode: invoiceData.counterpart?.postalCode || undefined,
    counterpartCity: invoiceData.counterpart?.city || undefined,
  });

  const recordId = insertResult.id as number;

  // Store invoice in WORM storage (immutable archival)
  let wormRecordId: string | undefined;
  try {
    const wormRecord = wormStorage.storeInvoice(
      recordId,
      xml,
      hash,
      result.success ? 'MOCK_QSEAL_' + hash.substring(0, 16) : undefined,
      result.success ? new Date().toISOString() : undefined,
      'MOCK_QTSP'
    );
    wormRecordId = wormRecord.id;
    logger.info('Invoice stored in WORM', { invoice_id: recordId, worm_id: wormRecordId });
  } catch (e) {
    logger.warn('WORM storage failed', { invoice_id: recordId, error: e });
  }

  // Sign with QSeal (mock for sandbox, real for production)
  if (result.success && result.mark) {
    try {
      const qsealResult = await qsealService.signInvoice(xml, hash, recordId);
      if (qsealResult.success) {
        logQSealSignature({
          invoice_id: recordId,
          sha256_hash: hash,
          signature_value: qsealResult.signature!,
          timestamp_token: qsealResult.timestampToken!,
          qtsp_provider: qsealResult.qtspProvider || 'MOCK',
        });
        logger.info('QSeal signed successfully', { invoice_id: recordId, provider: qsealResult.qtspProvider });
      }
    } catch (e) {
      logger.warn('QSeal signing failed (continuing)', { invoice_id: recordId, error: e });
    }
  }

  // Persist payment methods (including POS Α.1155 data)
  try {
    const payments = (normalizedInvoice.paymentMethods || []).map(p => ({
      payment_method_type: p.type ?? 1,
      amount: p.amount ?? 0,
      pos_terminal_id: p.pos_terminal_id ?? null,
      pos_signature: p.pos_signature ?? null,
      pos_rrn: p.pos_rrn ?? null,
    }));
    insertInvoicePayments(recordId, payments);
  } catch (e) {
    console.warn('[Issuance] Payment log failed:', e);
  }

  return {
    ...result,
    qrUrl,
    uuid,
    hash,
    xml,
    id: recordId,
  };
}

export function getInvoices() {
  return getAllInvoices();
}

export function getInvoice(id: number) {
  return getInvoiceById(id);
}

export { buildInvoicesDocXML } from '../../xml/builders/invoices-doc.js';
