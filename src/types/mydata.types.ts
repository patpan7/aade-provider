export interface Address {
  street?: string;
  number?: string;
  postalCode: string;
  city: string;
  country: string; // e.g. "GR"
}

export interface Party {
  vatNumber: string;
  country: string;
  branch: number;
  address?: Address;
  name?: string;
  // v2.0.2 fields
  documentIdNo?: string;         // Αριθμός επίσημου εγγράφου
  supplyAccountNo?: string;      // Αρ. Παροχής Ηλ. Ρεύματος
  countryDocumentId?: string;    // Κωδ. Χώρας Έκδοσης Επίσημου Εγγράφου
}

export interface Classification {
  type?: string;     // e.g. "E3_561_001" for income or "E3_102_001" for expenses
  category?: string; // e.g. "category1_1" for income or "category2_1" for expenses
  amount: number;
  id?: number;
}

export interface InvoiceLineItem {
  lineNum: number;
  netValue: number;
  vatCategory: string; // '1' (24%), '2' (13%), '3' (6%), '4' (17%), '5' (9%), '6' (4%), '7' (0%), '8' (No VAT)
  vatAmount: number;
  grossValue: number;
  vatExemptionCategory?: number; // 1-32, mandatory if vatCategory is '7' or '8'
  quantity?: number;
  measurementUnit?: number; // 1: Τεμάχια, 2: Κιλά, 3: Λίτρα, etc.
  description?: string;
  incomeClassifications?: Classification[];
  expensesClassifications?: Classification[];
  // v2.0.2 fields
  recType?: number;                 // Είδος Γραμμής (1-7)
  taricNo?: string;                 // Κωδικός Taric (10 chars)
  itemCode?: string;                // Κωδικός Είδους
  itemDescr?: string;               // Περιγραφή Είδους
  fuelCode?: string;                // Κωδικός Καυσίμου
  invoiceDetailType?: number;       // Επισήμανση
  dienergia?: {                     // ΠΟΛ 1177/2018 Αρ. 27
    applicationId: string;
    applicationDate: string;
    doy?: string;
    shipId: string;
  };
  discountOption?: boolean;         // Δικαίωμα Έκπτωσης
  withheldAmount?: number;          // Ποσό Παρ. Φόρου
  withheldPercentCategory?: number; // Κατηγορία Συντελεστή Παρ. Φόρου
  stampDutyAmount?: number;         // Ποσό Ψηφιακού Τέλους συναλλαγής
  stampDutyPercentCategory?: number; // Κατηγορία Συντελεστή Ψηφιακού Τέλους
  feesAmount?: number;              // Ποσό Τελών
  feesPercentCategory?: number;     // Κατηγορία Συντελεστή Τελών
  otherTaxesPercentCategory?: number; // Κατηγορία Συντελεστή Λοιπών Φόρων
  otherTaxesAmount?: number;        // Άλλοι φόροι επί γραμμής
  deductionsAmount?: number;        // Αποσυρμαίες/αφαιρέσεις
  lineComments?: string;            // Σχόλια Γραμμής
  quantity15?: number;              // Ποσότητα Θερμοκρασίας 15 βαθμών
  otherMeasurementUnitQuantity?: number; // Πλήθος Μονάδας Μέτρησης Τεμάχια Άλλα
  otherMeasurementUnitTitle?: string;    // Τίτλος Μονάδας Μέτρησης Τεμάχια Άλλα
  notVAT195?: boolean;              // Ένδειξη μη συμμετοχής στο ΦΠΑ
  movePurposeLine?: number;         // Σκοπός Διακίνησης Γραμμής (1-20)
  otherMovePurposeLineTitle?: string;    // Τίτλος Λοιπής Αιτίας Διακίνησης Γραμμής
  // XSD sequence required fields (sandbox)
  vatExemptDescrEN?: string;        // Αιτία απαλλαγής ΦΠΑ EN
  vatExemptDescrGR?: string;        // Αιτία απαλλαγής ΦΠΑ GR
  movePurpDescrLineEN?: string;     // Περιγραφή σκοπού διακίνησης EN
  movePurpDescrLineGR?: string;     // Περιγραφή σκοπού διακίνησης GR
}

export interface PaymentMethodDetail {
  type: string; // 1: Επαγγελματικός, 2: Αλλοδαπής, 3: Μετρητά, 4: Επιταγή, 5: POS, 6: Web Banking, 7: Iris, 8: Other
  amount: number;
  info?: string;
  // v2.0.2 fields
  tipAmount?: number;           // Φιλοδώρημα
  transactionId?: string;       // Μοναδική Ταυτότητα Πληρωμής
  tid?: string;                 // tid POS
  providersSignature?: {        // Υπογραφή Πληρωμής Παρόχου
    signingAuthor: string;
    signature: string;
    endToEndReferenceID?: string;
  };
  ecrToken?: {                  // Υπογραφή Πληρωμής ΦΗΜ
    signingAuthor: string;
    sessionNumber: string;
  };
}

export interface InvoiceData {
  uuid?: string;
  invoiceType: string; // '1.1', '1.2', '2.1', '5.1', '11.1', '11.2', etc.
  issuer: Party;
  counterpart?: Party;
  series: string;
  aa: number;
  issueDate: string; // YYYY-MM-DD
  issueTime?: string; // HH:MM:SS
  currency: string;
  exchangeRate?: number;
  paymentMethods: PaymentMethodDetail[];
  lineItems: InvoiceLineItem[];
  notes?: string;
  selfPricing?: boolean;
  vatPaymentSuspension?: boolean;
  correlatedInvoices?: (string | number)[];
  dispatchDate?: string; // YYYY-MM-DD
  dispatchTime?: string; // HH:MM:SS
  vehicleNumber?: string; // e.g. "ΙΧΕ-1234"
  movePurpose?: number; // 1-20
  // v2.0.2 fields
  fuelInvoice?: boolean;                    // Παραστατικό Καυσίμων
  specialInvoiceCategory?: string;          // Ειδική Κατηγορία Παραστατικού
  invoiceVariationType?: string;            // Τύπος Απόκλισης Παραστατικού
  otherCorrelatedEntities?: Array<{        // Λοιπές συσχετιζόμενες οντοτήτες
    type: number;
    entityData: Party;
  }>;
  otherDeliveryNoteHeader?: {               // Λοιπά Γενικά Στοιχεία Διακίνησης
    loadingAddress: Address;
    deliveryAddress: Address;
    startShippingBranch?: number;
    completeShippingBranch?: number;
  };
  isDeliveryNote?: boolean;                 // Ένδειξη Παραστατικού Διακίνησης
  otherMovePurposeTitle?: string;           // Τίτλος Λοιπής Αιτίας Διακίνησης
  thirdPartyCollection?: boolean;           // Ένδειξη Εισπράξης Τρίτων
  multipleConnectedMarks?: number[];        // Πολλαπλά Συνδεόμενα MARKs
  tableAA?: string;                         // AA ΤΡΑΠΕΖΙΟΥ
  totalCancelDeliveryOrders?: boolean;      // Ένδειξη συνολικής αναίρεσης Δελτίων Παραγγελίας
  reverseDeliveryNote?: boolean;            // Αντίστροφη Διακίνηση
  reverseDeliveryNotePurpose?: string;      // Αιτία Έκδοσης Αντίστροφης Διακίνησης
  toWeigh?: boolean;                        // Ένδειξη Προς Ζύγιση
  receivingNotePurpose?: string;            // Αιτία Έκδοσης Δελτίου Ποσοτικής Παραλαβής
  otherReceivingNotePurposeTitle?: string;  // Τίτλος Λοιπής Περίπτωσης Αιτίας
  nonObligatedRecipient?: boolean;          // Μη Υπόχρεος Λήπτης
  withoutDigitalTransportTracking?: boolean; // Χωρίς Ψηφιακή Παρακολούθηση Διακίνησης
}

export interface InvoiceTotals {
  totalNet: number;
  totalVat: number;
  totalGross: number;
  totalWithheld?: number;
  totalFees?: number;
  totalStampDuty?: number;
  totalOtherTaxes?: number;
  totalDeductions?: number;
}

export interface AADEIssueResponse {
  success: boolean;
  mark?: string;
  invoiceUid?: string;
  statusCode?: string;
  errors?: string[];
  qrUrl?: string;
  rawResponse?: string;
}

export interface AADEConfig {
  userId: string;
  subscriptionKey: string;
  apiUrl: string;
  qrBaseUrl: string;
}

export interface InvoiceResult {
  success: boolean;
  mark?: string;
  qrUrl?: string;
  uuid?: string;
  hash?: string;
  xml?: string;
  errors?: string[];
  statusCode?: string;
}