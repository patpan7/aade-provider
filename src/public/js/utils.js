// Utility Functions for AADE myDATA Provider UI

// VAT Rates
export const VAT_RATES = {
  '1': 0.24,  // 24%
  '2': 0.13,  // 13%
  '3': 0.06,  // 6%
  '4': 0.17,  // 17% (islands)
  '5': 0.09,  // 9% (super reduced)
  '6': 0.04,  // 4% (super reduced islands)
  '7': 0.00,  // VAT exempt
  '8': 0.00,  // VAT exempt (reverse charge)
};

// Measurement Units
export const MEASUREMENT_UNITS = {
  1: 'Τεμάχια', 2: 'Κιλά', 3: 'Λίτρα', 4: 'Μετρητά', 5: 'Τετραγωνικά μέτρα',
  6: 'Κυβικά μέτρα', 7: 'Κιλώρα', 8: 'Τονnes', 9: 'Δεκάδες', 10: 'Εκατονταδες',
  11: 'Χιλιάδες', 12: 'Μετρικές τόνους', 13: 'Γραμμάρια', 14: 'Χιλιοστά',
  15: 'Εκατοστά', 16: 'Χιλιοστά τετραγωνικά', 17: 'Εκατοστά τετραγωνικά',
  18: 'Μετρικά τετραγωνικά', 19: 'Χιλιοστά κύβικα', 20: 'Εκατοστά κύβικα',
  21: 'Μετρικά κύβικα', 22: 'Ώρες', 23: 'Λεπτά', 24: 'Δευτερόλεπτα',
  25: 'Μέρες', 26: 'Εβδομάδες', 27: 'Μήνες', 28: 'Έτη', 29: 'Κυριολεκτικά',
  30: 'Υπηρεσίες'
};

// Move Purposes
export const MOVE_PURPOSES = {
  1: 'Πώληση', 2: 'Ενδοκοινοτική παράδοση', 3: 'Έξοδος εξωτερικού',
  4: 'Πώληση για λογαριασμό τρίτων', 5: 'Μεταφορά Between warehouses',
  6: 'Επιστροφή', 7: 'Προσαρμογή αποθέματος', 8: 'Λοιπές περιπτώσεις',
  10: 'Διακίνηση υλικών', 19: 'Λοιπές διακινήσεις'
};

// E3 Type Descriptions
export const E3_TYPE_DESCRIPTIONS = {
  'E3_561_001': 'Πωλήσεις Χονδρικές - Επιτηδευματιών',
  'E3_561_002': 'Πωλήσεις Χονδρικές 39α',
  'E3_561_003': 'Πωλήσεις Λιανικές - Ιδιωτική Πελατεία',
  'E3_561_004': 'Πωλήσεις Λιανικές 39α',
  'E3_561_005': 'Πωλήσεις Ενδοκοινοτικές',
  'E3_561_006': 'Πωλήσεις Τρίτες Χώρες',
  'E3_561_007': 'Πωλήσεις Λοιπά',
  'E3_562': 'Λοιπά συνήθη έσοδα',
  'E3_563': 'Πιστωτικοί τόκοι',
  'E3_595': 'Έξοδα ιδιοπαραγωγής',
  'E3_596': 'Επιδοτήσεις',
  'E3_597': 'Επιδοτήσεις επενδυτικών',
  'E3_880_001': 'Πωλήσεις Παγίων Χονδρικές',
  'E3_880_002': 'Πωλήσεις Παγίων Λιανικές',
  'E3_880_003': 'Πωλήσεις Παγίων Ενδοκοινοτικές',
  'E3_880_004': 'Πωλήσεις Παγίων Τρίτες Χώρες',
  'E3_881_001': 'Πωλήσεις για λογ/σμο Τρίτων Χονδρικές',
  'E3_881_002': 'Πωλήσεις για λογ/σμο Τρίτων Λιανικές',
  'E3_881_003': 'Πωλήσεις για λογ/σμο Τρίτων Ενδοκοινοτικές',
  'E3_881_004': 'Πωλήσεις για λογ/σμο Τρίτων Τρίτες Χώρες',
};

// Category Descriptions
export const CATEGORY_DESCRIPTIONS = {
  'category1_1': 'Έσοδα Πώληση Εμπορευμάτων',
  'category1_2': 'Έσοδα Πώληση Προϊόντων',
  'category1_3': 'Έσοδα Παροχή Υπηρεσιών',
  'category1_4': 'Έσοδα Πώληση Παγίων',
  'category1_5': 'Λοιπά Έσοδα/ Κέρδη',
  'category1_6': 'Αυτοπαραδόσεις / Ιδιοχρησιμοποιήσεις',
  'category1_7': 'Έσοδα για λογ/σμο τρίτων',
  'category1_8': 'Έσοδα προηγούμενων χρήσεων',
  'category1_9': 'Έσοδα επομένων χρήσεων',
  'category1_10': 'Λοιπές Εγγραφές Τακτοποίησης Εσόδων',
  'category1_95': 'Λοιπά Πληροφοριακά Στοιχεία Εσόδων',
};

// VAT Exemption Categories
export const VAT_EXEMPTION_CATEGORIES = {
  1: '68/41/ΕΕ', 2: 'Ε2/1992', 3: 'Περιουσιακά στοιχεία', 4: 'Φορολογικά μειωμένα',
  5: 'ΦΠΑ 2859/2000', 6: 'Εσωτερική αγορά', 7: 'Εξαγωγή', 8: 'Διακίνηση αγαθών',
  9: 'Παροχή υπηρεσιών', 10: 'Διακίνηση αμετακινήτων', 11: 'Ενοίκια',
  12: 'Πιστοωτικοί τόκοι', 13: 'Κέρδη διακίνησης', 14: 'Ασφαλιστικές αποζημιώσεις',
  15: 'Διαφορά χορήγησης', 16: 'Αθλητικοί οργανισμοί', 17: 'Πολιτιστικοί οργανισμοί',
  18: 'Δημόσιο τομέας', 19: 'Εκπαίδευση', 20: 'Υγεία/Κοινωνική φροντίδα',
  21: 'Εκδοτικές δραστηριότητες', 22: 'Λοταρίες/Τζόγα', 23: 'Ακίνητη περιουσία',
  24: 'Μεταφορές', 25: 'Χρυσός', 26: 'Αξία μετοχών', 27: 'Παραγωγή ηλεκτρικής ενέργειας',
  28: 'Σύμπραξη', 29: 'Λοιπά', 30: 'Ειδικά ρυθμιστικά', 31: 'Πολεμικά υλικά', 32: 'Λοιπά 32'
};

// Calculate VAT for a line item
export function calculateLineVAT(netValue, vatCategory) {
  const rate = VAT_RATES[vatCategory] || 0;
  const vatAmount = Math.round(netValue * rate * 100) / 100;
  const grossValue = Math.round((netValue + vatAmount) * 100) / 100;
  return { vatAmount, grossValue, rate };
}

// Calculate totals for all line items
export function calculateTotals(lineItems) {
  let totalNet = 0;
  let totalVat = 0;
  let totalGross = 0;
  const vatCategoryTotals = {};

  for (const item of lineItems) {
    const { vatAmount, grossValue } = calculateLineVAT(item.netValue, item.vatCategory);
    totalNet += item.netValue;
    totalVat += vatAmount;
    totalGross += grossValue;

    if (!vatCategoryTotals[item.vatCategory]) {
      vatCategoryTotals[item.vatCategory] = { net: 0, vat: 0, gross: 0 };
    }
    vatCategoryTotals[item.vatCategory].net += item.netValue;
    vatCategoryTotals[item.vatCategory].vat += vatAmount;
    vatCategoryTotals[item.vatCategory].gross += grossValue;
  }

  return {
    totalNet: Math.round(totalNet * 100) / 100,
    totalVat: Math.round(totalVat * 100) / 100,
    totalGross: Math.round(totalGross * 100) / 100,
    vatCategoryTotals: Object.entries(vatCategoryTotals).map(([cat, t]) => ({
      category: cat,
      netValue: Math.round(t.net * 100) / 100,
      vatAmount: Math.round(t.vat * 100) / 100,
      grossValue: Math.round(t.gross * 100) / 100,
    })),
  };
}

// Generate SHA-256 hash per AADE spec
export async function generateHash(invoiceData, totals) {
  const hashString = `${invoiceData.issuer.vatNumber}|${invoiceData.issueDate}|${invoiceData.invoiceType}|${invoiceData.series}|${invoiceData.aa}|${totals.totalNet.toFixed(2)}|${totals.totalVat.toFixed(2)}|${totals.totalGross.toFixed(2)}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(hashString);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Build QR URL
export function buildQRUrl(hash, mark, qrBaseUrl = 'https://mydataapidev.aade.gr/open') {
  return `${qrBaseUrl}/TimologioQR/QRInfo?q=${hash}&mark=${mark}`;
}

// Validate Greek AFM (Modulo-11)
export function validateGreekAFM(afm) {
  if (!/^\d{9}$/.test(afm)) return { valid: false, error: 'ΑΦΜ πρέπει να έχει 9 ψηφία' };
  const digits = afm.split('').map(Number);
  const checkDigit = digits[8];
  let sum = 0;
  for (let i = 0; i < 8; i++) {
    sum += digits[i] * Math.pow(2, 8 - i);
  }
  const remainder = sum % 11;
  const calculatedCheckDigit = remainder === 10 ? 0 : remainder;
  if (calculatedCheckDigit !== checkDigit) {
    return { valid: false, error: 'ΑΦΜ δεν είναι έγκυρο (Modulo-11 έλεγχος αποτυγχάνει)' };
  }
  return { valid: true };
}

// Get Greece local date (YYYY-MM-DD)
export function getGreeceDate() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Athens' });
}

// Format number for display
export function formatNumber(num, decimals = 2) {
  return Number(num).toFixed(decimals);
}

// Parse number safely
export function parseNumber(val) {
  const n = parseFloat(val);
  return isNaN(n) ? 0 : n;
}