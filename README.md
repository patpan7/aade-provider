# AADE myDATA ΥΠΑΗΕΣ Provider - Web Sandbox & Engine

Ολοκληρωμένος Node.js TypeScript Provider Engine για Υπηρεσίες Παρόχου Ηλεκτρονικής Έκδοσης Στοιχείων (ΥΠΑΗΕΣ) και διαβίβαση στην πλατφόρμα myDATA της ΑΑΔΕ, συνοδευόμενος από Web Testing Dashboard.

## Χαρακτηριστικά (Features)

- **Πλήρης Υποστήριξη Τύπων Παραστατικών myDATA**:
  - `1.1`: Τιμολόγιο Πώλησης (B2B)
  - `1.2`: Τιμολόγιο Πώλησης / Ενδοκοινοτικές Παραδόσεις
  - `2.1`: Τιμολόγιο Παροχής Υπηρεσιών (ΤΠΥ - B2B)
  - `5.1` / `5.2`: Πιστωτικά Τιμολόγια
  - `11.1`: Απόδειξη Λιανικής Πώλησης (ΑΛΠ - B2C - χωρίς υποχρεωτικό λήπτη)
  - `11.2`: Απόδειξη Παροχής Υπηρεσιών (ΑΠΥ - B2C)
- **Multi-Tenancy**:
  - Tenants (Πελάτες/Εταιρείες) με CRUD, VAT lookup, status update
  - Resellers (Μεταπωλητές) με commission rate
  - Users (Χρήστες) με roles: SUPER_ADMIN, RESELLER_ADMIN, CLIENT_ADMIN, USER
- **API Key System**:
  - SHA-256 hashed keys
  - Bearer token auth middleware
  - Branch/series/environment/expiration metadata
- **Credit System**:
  - credit_wallets + credit_transactions ledger
  - Auto-deduct 1 credit per invoice issued through API key
  - Expiry check on issuance
- **Auto-increment AA numbering**:
  - series_counters table
  - Atomic per tenant/branch/invoice_type/series counter
- **Webhooks**:
  - webhook_endpoints table
  - HMAC-signed delivery to tenant URLs
  - Delivery history
- **AADE HTTP Client**:
  - Connection pooling (keep-alive)
  - Token bucket rate limiting per subscription key
  - Retry with exponential backoff (handles 429/5xx)
- **Health Endpoints**: `/healthz`

---

## Εγκατάσταση & Εκτέλεση

### 1. Εγκατάσταση βιβλιοθηκών:
```bash
npm install
```

### 2. Ρύθμιση `.env`:
```bash
cp .env.example .env
# Συμπληρώστε τα στοιχεία διαπιστευτηρίων ΑΑΔΕ Sandbox
```

### 3. Εκτέλεση Test Suite:
```bash
npm test
```

### 4. Εκκίνηση Server:
```bash
# Development (hot reload)
npm run dev

# Production Build & Start
npm run build
npm start
```

Το Web Dashboard ανοίγει στο: **`http://localhost:8000`**

---

## API Endpoints

- `GET /api/config` - Κατάσταση ρυθμίσεων & διαπιστευτηρίων
- `GET /api/validate-afm/:afm` - Έλεγχος εγκυρότητας ελληνικού ΑΦΜ
- `POST /api/invoices/issue` - Έκδοση και διαβίβαση παραστατικού στο myDATA
- `GET /api/invoices` - Λίστα όλων των εκδοθέντων παραστατικών
- `GET /api/invoices/:id` - Λεπτομέρειες συγκεκριμένου παραστατικού

---

## Άδεια Χρήσης

MIT