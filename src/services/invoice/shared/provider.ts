// @ts-nocheck
// Provider-specific validation rules (AADE v2.0.2)
// Error codes: 228, 236, 238, 245, 288
export function validateProviderRules(invoice, providerRules) {
    const errors = [];
    // Use Greece local date (AADE sandbox expects Greece local date)
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Athens' });
    // Error 238: IssueDate must equal current date for providers
    if (providerRules.validateIssueDateToday && invoice.issueDate !== today) {
        errors.push(`238: Ημερομηνία έκδοσης (issueDate) πρέπει να είναι η τρέχουσα ημερομηνία (${today}) ` +
            `για διαβίβαση μέσω παρόχου. Δόθηκε: ${invoice.issueDate}`);
    }
    // Error 236: Sender VAT must not equal Issuer VAT
    if (providerRules.validateSenderNotIssuer) {
        // This requires access to provider config (sender VAT)
        // Will be checked in issuance.ts where config is available
    }
    // Error 245: Provider authorization
    if (providerRules.validateProviderAuthorized) {
        // Checked in issuance.ts with config
    }
    // Error 288: TransmissionFlag = 4 handling
    if (providerRules.validateTransmissionFlag4) {
        // Handled in AADE service
    }
    // Error 228: UID uniqueness
    if (providerRules.validateUidUnique) {
        // Checked in database before insertion
    }
    return { valid: errors.length === 0, errors };
}
export function validateProviderConfig(config, invoice) {
    const errors = [];
    // Error 236: Sender VAT (userId) must not equal Issuer VAT
    if (config.userId && invoice.issuer?.vatNumber) {
        if (config.userId === invoice.issuer.vatNumber) {
            errors.push(`236: Το ΑΦΜ του παρόχου (sender) δεν μπορεί να είναι ίδιο με το ΑΦΜ του εκδότη (issuer). ` +
                `ΑΦΜ Παρόχου: ${config.userId}, ΑΦΜ Εκδότη: ${invoice.issuer.vatNumber}`);
        }
    }
    // Error 245: Provider must be authorized (has subscriptionKey)
    if (!config.subscriptionKey) {
        errors.push(`245: Ο πάροχος δεν είναι εξουσιοδοτημένος. Λείπει subscriptionKey.`);
    }
    return { valid: errors.length === 0, errors };
}
export function validateTransmissionFlag4(invoice, transmissionFlag) {
    const errors = [];
    // Error 288: If transmissionFlag = 4 (re-send), invoice must already exist
    if (transmissionFlag === 4) {
        // This will be checked against database
        // Just flag it here for the caller to handle
    }
    return { valid: errors.length === 0, errors };
}

