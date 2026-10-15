// @ts-nocheck
// Shared validation utilities
export function validateDateYYYYMMDD(dateStr) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr))
        return false;
    const date = new Date(dateStr);
    return date instanceof Date && !isNaN(date.getTime()) && date.toISOString().split('T')[0] === dateStr;
}
export function validateTimeHHMMSS(timeStr) {
    if (!/^\d{2}:\d{2}:\d{2}$/.test(timeStr))
        return false;
    const [h, m, s] = timeStr.split(':').map(Number);
    return h >= 0 && h <= 23 && m >= 0 && m <= 59 && s >= 0 && s <= 59;
}
export function validateGreekAFM(afm) {
    if (!/^\d{9}$/.test(afm)) {
        return { valid: false, error: 'ΑΦΜ πρέπει να έχει 9 ψηφία' };
    }
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
export function validateISO4217Currency(currency) {
    const validCurrencies = new Set([
        'EUR', 'USD', 'GBP', 'CHF', 'JPY', 'CAD', 'AUD', 'CNY', 'RUB', 'BRL',
        'INR', 'KRW', 'TRY', 'PLN', 'CZK', 'HUF', 'RON', 'BGN', 'HRK', 'SEK',
        'NOK', 'DKK'
    ]);
    return validCurrencies.has(currency.toUpperCase());
}
export function validateVATCategory(vatCategory) {
    return ['1', '2', '3', '4', '5', '6', '7', '8'].includes(vatCategory);
}
export function validateMovePurpose(movePurpose) {
    return [1, 2, 3, 4, 5, 6, 7, 8, 10, 19].includes(movePurpose);
}
export function validatePositiveInteger(value, fieldName) {
    if (value === undefined || value === null)
        return `${fieldName} είναι υποχρεωτικό`;
    if (!Number.isInteger(Number(value)) || Number(value) < 1) {
        return `${fieldName} πρέπει να είναι θετικός ακέραιος`;
    }
    return null;
}
export function validatePositiveNumber(value, fieldName) {
    if (value === undefined || value === null)
        return `${fieldName} είναι υποχρεωτικό`;
    const num = Number(value);
    if (isNaN(num) || num < 0) {
        return `${fieldName} πρέπει να είναι θετικός αριθμός`;
    }
    return null;
}
export function validateRequiredFields(obj, fields, prefix = '') {
    const errors = [];
    for (const field of fields) {
        const value = obj[field];
        if (value === undefined || value === null || (typeof value === 'string' && !value.trim())) {
            errors.push(`${prefix}${field} είναι υποχρεωτικό`);
        }
    }
    return errors;
}
export function validateForbiddenFields(obj, fields, prefix = '') {
    const errors = [];
    for (const field of fields) {
        const value = obj[field];
        if (value !== undefined && value !== null && !(Array.isArray(value) && value.length === 0)) {
            errors.push(`${prefix}${field} δεν επιτρέπεται για αυτό τον τύπο παραστατικού`);
        }
    }
    return errors;
}
export function validateE3TypeCategoryMatch(e3Type, category, allowedE3Types, allowedCategories) {
    const errors = [];
    if (!allowedE3Types.has(e3Type)) {
        errors.push(`Μη επιτρεπόμενος E3 τύπος "${e3Type}". Επιτρεπμένοι: ${Array.from(allowedE3Types).join(', ')}`);
    }
    if (!allowedCategories.has(category)) {
        errors.push(`Μη επιτρεπόμενη κατηγορία "${category}". Επιτρεπτές: ${Array.from(allowedCategories).join(', ')}`);
    }
    return errors.length > 0 ? errors.join('; ') : null;
}

