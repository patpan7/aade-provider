// @ts-nocheck
// XML Escape Utilities
// Handles XML encoding/decoding for AADE myDATA compliance

export function escapeXml(str) {
    if (str === null || str === undefined)
        return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

export function unescapeXml(str) {
    if (!str)
        return '';
    return String(str)
        .replace(/</g, '<')
        .replace(/>/g, '>')
        .replace(/"/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&/g, '&');
}

export function getMeasurementUnitTitle(unit) {
    const units = {
        1: 'Τεμάχια', 2: 'Κιλά', 3: 'Λίτρα', 4: 'Μετρητά', 5: 'Τετραγωνικά μέτρα',
        6: 'Κυβικά μέτρα', 7: 'Κιλώρα', 8: 'Τονnes', 9: 'Δεκάδες', 10: 'Εκατονταδες',
        11: 'Χιλιάδες', 12: 'Μετρικές τόνους', 13: 'Γραμμάρια', 14: 'Χιλιοστά',
        15: 'Εκατοστά', 16: 'Χιλιοστά τετραγωνικά', 17: 'Εκατοστά τετραγωνικά',
        18: 'Μετρικά τετραγωνικά', 19: 'Χιλιοστά κύβικα', 20: 'Εκατοστά κύβικα',
        21: 'Μετρικά κύβικα', 22: 'Ώρες', 23: 'Λεπτά', 24: 'Δευτερόλεπτα',
        25: 'Μέρες', 26: 'Εβδομάδες', 27: 'Μήνες', 28: 'Έτη', 29: 'Κυριολεκτικά',
        30: 'Υπηρεσίες'
    };
    return units[unit] || 'Τεμάχια';
}

export function buildAddressXML(address) {
    return `
      <address>
        ${address.street ? `<street>${escapeXml(address.street)}</street>` : ''}
        ${address.number ? `<number>${escapeXml(address.number)}</number>` : ''}
        <postalCode>${escapeXml(address.postalCode || '')}</postalCode>
        <city>${escapeXml(address.city || '')}</city>
      </address>`;
}

