import { createHash } from 'node:crypto';

export function computeSHA256Hash(
  issuerVat: string,
  issueDate: string,
  invoiceType: string,
  series: string,
  aa: number,
  totalNet: number,
  totalVat: number,
  totalGross: number
): string {
  const formattedNet = Number(totalNet || 0).toFixed(2);
  const formattedVat = Number(totalVat || 0).toFixed(2);
  const formattedGross = Number(totalGross || 0).toFixed(2);

  const hashString = [
    String(issuerVat || '').trim(),
    String(issueDate || '').trim(),
    String(invoiceType || '').trim(),
    String(series || '').trim(),
    aa,
    formattedNet,
    formattedVat,
    formattedGross
  ].join('|');

  return createHash('sha256').update(hashString).digest('hex').toLowerCase();
}

/**
 * Validates a Greek VAT number (ΑΦΜ) using Modulo 11 check digit algorithm.
 */
export function validateGreekAFM(vat: string): { valid: boolean; error?: string } {
  if (!vat || typeof vat !== 'string') {
    return { valid: false, error: 'Το ΑΦΜ είναι υποχρεωτικό' };
  }
  const cleanVat = vat.trim();
  if (!/^\d{9}$/.test(cleanVat)) {
    return { valid: false, error: `Το ΑΦΜ πρέπει να αποτελείται από ακριβώς 9 ψηφία (δόθηκε: "${cleanVat}")` };
  }
  if (cleanVat === '000000000') {
    return { valid: false, error: 'Το ΑΦΜ δεν μπορεί να είναι 000000000' };
  }
  const digits = cleanVat.split('').map(Number);
  let sum = 0;
  for (let i = 0; i < 8; i++) {
    sum += digits[i] * Math.pow(2, 8 - i);
  }
  const rem = sum % 11;
  const checkDigit = rem === 10 ? 0 : rem;
  if (checkDigit !== digits[8]) {
    return { valid: false, error: `Μη έγκυρο ΑΦΜ: το ψηφίο ελέγχου είναι ${digits[8]} αντί για ${checkDigit}` };
  }
  return { valid: true };
}