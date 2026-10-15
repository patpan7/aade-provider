## **1\. Αρχιτεκτονικό Διάγραμμα Σχέσεων Βάσης (Entity Overview)**

`[ Resellers (Μεταπωλητές) ]`  
       `│`  
       `└──1:N──> [ Tenants (Πελάτες/Εταιρείες) ]`  
                       `│`  
                       `├──1:N──> [ Users (Χρήστες Web UI) ]`  
                       `├──1:N──> [ API Keys (Machine-to-Machine) ]`  
                       `├──1:1──> [ Credit Wallets (Υπόλοιπο Μονάδων) ]`  
                       `├──1:N──> [ Series Counters (Αρίθμηση Σειρών) ]`  
                       `├──1:N──> [ Webhook Endpoints (Ειδοποιήσεις) ]`  
                       `└──1:N──> [ Invoices (Παραστατικά) ]`  
                                      `│`  
                                      `├──1:N──> [ Invoice Payments (POS / Τρόποι Πληρωμής) ]`  
                                      `└──1:1──> [ QSeal Audit Logs (Ψηφιακές Υπογραφές) ]`

## **2\. Πλήρες Schema Βάσης Δεδομένων (PostgreSQL DDL)**

Το παρακάτω SQL script είναι έτοιμο για παραγωγή (Production-Ready) με αυστηρούς κανόνες ακαιρεότητας (Foreign Keys, Unique Constraints, Primary Indexes):  
`-- ============================================================================`  
`-- 1. DOMAIN: RESELLERS & TENANTS (Μεταπωλητές & Πελάτες)`  
`-- ============================================================================`

`-- Μεταπωλητές / Συνεργάτες (White-Label / Agency Partners)`  
`CREATE TABLE resellers (`  
    `id BIGSERIAL PRIMARY KEY,`  
    `name VARCHAR(255) NOT NULL,`  
    `vat_number VARCHAR(20) UNIQUE NOT NULL,`  
    `email VARCHAR(255) NOT NULL,`  
    `commission_rate DECIMAL(5,2) DEFAULT 0.00, -- Ποσοστό προμήθειας %`  
    `is_active BOOLEAN DEFAULT TRUE,`  
    `created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`  
`);`

`-- Πελάτες / Εταιρείες (Tenants)`  
`CREATE TABLE tenants (`  
    `id BIGSERIAL PRIMARY KEY,`  
    `reseller_id BIGINT REFERENCES resellers(id) ON DELETE SET NULL,`  
    `company_name VARCHAR(255) NOT NULL,`  
    `trade_title VARCHAR(255),`  
    `vat_number VARCHAR(20) UNIQUE NOT NULL, -- ΑΦΜ Πελάτη`  
    `tax_office VARCHAR(100),                -- ΔΟΥ`  
    `address VARCHAR(255),`  
    `postal_code VARCHAR(20),`  
    `city VARCHAR(100),`  
    `country VARCHAR(2) DEFAULT 'GR',`  
    `phone VARCHAR(50),`  
    `email VARCHAR(255) NOT NULL,`  
      
    `-- Status myDATA Εξουσιοδότησης ΑΑΔΕ`  
    `aade_authorization_status VARCHAR(50) DEFAULT 'PENDING', -- PENDING, ACTIVE, REVOKED`  
    `aade_authorized_at TIMESTAMP WITH TIME ZONE,`  
      
    `status VARCHAR(50) DEFAULT 'ACTIVE', -- ACTIVE, SUSPENDED, DELETED`  
    `created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`  
`);`

`-- ============================================================================`  
`-- 2. DOMAIN: AUTHENTICATION & API SECURITY (Χρήστες & API Keys)`  
`-- ============================================================================`

`-- Χρήστες για το Web Dashboard`  
`CREATE TABLE users (`  
    `id BIGSERIAL PRIMARY KEY,`  
    `tenant_id BIGINT REFERENCES tenants(id) ON DELETE CASCADE,`  
    `reseller_id BIGINT REFERENCES resellers(id) ON DELETE CASCADE, -- Αν είναι reseller admin`  
    `email VARCHAR(255) UNIQUE NOT NULL,`  
    `password_hash VARCHAR(255) NOT NULL,`  
    `first_name VARCHAR(100),`  
    `last_name VARCHAR(100),`  
    `role VARCHAR(50) NOT NULL DEFAULT 'CLIENT_ADMIN', -- SUPER_ADMIN, RESELLER_ADMIN, CLIENT_ADMIN, USER`  
    `is_active BOOLEAN DEFAULT TRUE,`  
    `last_login_at TIMESTAMP WITH TIME ZONE,`  
    `created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,`  
      
    `CONSTRAINT user_owner_check CHECK (`  
        `(tenant_id IS NOT NULL AND reseller_id IS NULL) OR`  
        `(tenant_id IS NULL AND reseller_id IS NOT NULL) OR`  
        `(role = 'SUPER_ADMIN')`  
    `)`  
`);`

`-- API Keys για διασύνδεση e-shops / ERPs / POS`  
`CREATE TABLE api_keys (`  
    `id BIGSERIAL PRIMARY KEY,`  
    `tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,`  
    `name VARCHAR(100) NOT NULL,              -- π.χ. "WooCommerce Main", "POS Glyfada"`  
    `key_prefix VARCHAR(20) NOT NULL,         -- π.χ. "pk_live_a1b2..." (για γρήγορο lookup)`  
    `key_hash VARCHAR(255) UNIQUE NOT NULL,   -- SHA-256 Hash του πραγματικού key`  
      
    `aade_branch INT NOT NULL DEFAULT 0,      -- 0 = Έδρα, 1 = Υποκατάστημα 1`  
    `default_series VARCHAR(50),              -- Προεπιλεγμένη Σειρά (π.χ. "POS1")`  
      
    `environment VARCHAR(20) DEFAULT 'LIVE',  -- 'SANDBOX' ή 'LIVE'`  
    `is_active BOOLEAN DEFAULT TRUE,`  
    `expires_at TIMESTAMP WITH TIME ZONE,`  
    `created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`  
`);`

`-- ============================================================================`  
`-- 3. DOMAIN: SUBSCRIPTIONS & CREDITS (Μονάδες & Χρεώσεις)`  
`-- ============================================================================`

`-- Υπόλοιπο Μονάδων/Credits ανά Πελάτη`  
`CREATE TABLE credit_wallets (`  
    `id BIGSERIAL PRIMARY KEY,`  
    `tenant_id BIGINT UNIQUE NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,`  
    `balance INT NOT NULL DEFAULT 0,`  
    `expires_at TIMESTAMP WITH TIME ZONE, -- Ημερομηνία λήξης πακέτου (12 μήνες)`  
    `updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`  
`);`

`-- Ιστορικό Κινήσεων Credits (Ledger)`  
`CREATE TABLE credit_transactions (`  
    `id BIGSERIAL PRIMARY KEY,`  
    `tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,`  
    `amount INT NOT NULL,                  -- θετικό (+500) για αγορά, αρνητικό (-1) για έκδοση`  
    `type VARCHAR(50) NOT NULL,            -- 'PURCHASE', 'INVOICE_USAGE', 'REFUND', 'EXPIRED'`  
    `description VARCHAR(255),`  
    `reference_id VARCHAR(100),            -- ID Πληρωμής Stripe ή Invoice ID`  
    `created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`  
`);`

`-- ============================================================================`  
`-- 4. DOMAIN: SEQUENTIAL NUMBERING (Αρίθμηση Σειρών & Atomic Locking)`  
`-- ============================================================================`

`CREATE TABLE series_counters (`  
    `id BIGSERIAL PRIMARY KEY,`  
    `tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,`  
    `aade_branch INT NOT NULL DEFAULT 0,`  
    `invoice_type VARCHAR(10) NOT NULL,   -- π.χ. "1.1", "2.1", "11.1"`  
    `series VARCHAR(50) NOT NULL,         -- π.χ. "A", "ESHOP", "POS"`  
    `last_number INT NOT NULL DEFAULT 0,`  
    `updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,`  
      
    `CONSTRAINT unique_tenant_series UNIQUE (tenant_id, aade_branch, invoice_type, series)`  
`);`

`-- ============================================================================`  
`-- 5. DOMAIN: INVOICES & PAYMENTS (Παραστατικά & myDATA Sync)`  
`-- ============================================================================`

`CREATE TABLE invoices (`  
    `id BIGSERIAL PRIMARY KEY,`  
    `uuid UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),`  
    `tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,`  
    `api_key_id BIGINT REFERENCES api_keys(id) ON DELETE SET NULL,`  
      
    `-- Φορολογικά Στοιχεία`  
    `invoice_type VARCHAR(10) NOT NULL,   -- 1.1, 2.1, 11.1, 11.4 κλπ.`  
    `series VARCHAR(50) NOT NULL,`  
    `aa INT NOT NULL,                     -- Αύξων Αριθμός`  
    `issue_date DATE NOT NULL,`  
    `issue_time TIME NOT NULL,`  
    `currency VARCHAR(3) DEFAULT 'EUR',`  
    `aade_branch INT DEFAULT 0,`  
      
    `-- Στοιχεία Συμβαλλομένων`  
    `issuer_vat VARCHAR(20) NOT NULL,`  
    `counterpart_vat VARCHAR(20),`  
    `counterpart_name VARCHAR(255),`  
      
    `-- Οικονομικά Μεγέθη`  
    `total_net DECIMAL(12,2) NOT NULL,`  
    `total_vat DECIMAL(12,2) NOT NULL,`  
    `total_gross DECIMAL(12,2) NOT NULL,`  
      
    `-- Κρυπτογραφία & myDATA Response`  
    `sha256_hash VARCHAR(64) NOT NULL,`  
    `mark VARCHAR(50),                    -- ΜΑΡΚ ΑΑΔΕ`  
    `qr_code_url TEXT,                    -- URL Επαλήθευσης ΑΑΔΕ`  
      
    `-- B2G / Peppol Metadata (JSON)`  
    `is_b2g BOOLEAN DEFAULT FALSE,`  
    `b2g_metadata JSONB,                  -- ADAM, ADA, CPV, Buyer Reference`  
      
    `-- Κατάσταση & Αποθήκευση`  
    `status VARCHAR(50) NOT NULL DEFAULT 'SIGNED', -- DRAFT, SIGNED, SUBMITTED, FAILED, CANCELLED`  
    `offline_flag BOOLEAN DEFAULT FALSE,  -- True αν εκδόθηκε εκτός σύνδεσης`  
    `s3_object_key VARCHAR(500),          -- Διαδρομή WORM Storage (S3) για το υπογεγραμμένο XML`  
    `raw_aade_response TEXT,              -- Αυτούσια η απάντηση της ΑΑΔΕ`  
      
    `created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`  
`);`

`-- Τρόποι Πληρωμής & Υπογραφές POS (Α.1155)`  
`CREATE TABLE invoice_payments (`  
    `id BIGSERIAL PRIMARY KEY,`  
    `invoice_id BIGINT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,`  
    `payment_method_type INT NOT NULL,    -- 1=Κατάθεση, 3=Μετρητά, 5=POS / Κάρτα`  
    `amount DECIMAL(12,2) NOT NULL,`  
      
    `-- Πεδία για διασύνδεση POS (Α.1155)`  
    `pos_terminal_id VARCHAR(100),`  
    `pos_signature VARCHAR(255),          -- HMAC-SHA256 Signature`  
    `pos_rrn VARCHAR(100),                -- Retrieval Reference Number από την Τράπεζα`  
    `created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`  
`);`

`-- ============================================================================`  
`-- 6. DOMAIN: AUDIT TRAIL & QSEAL SIGNATURES (Έλεγχος eIDAS & ISO 27001)`  
`-- ============================================================================`

`CREATE TABLE qseal_signatures_log (`  
    `id BIGSERIAL PRIMARY KEY,`  
    `invoice_id BIGINT UNIQUE NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,`  
    `sha256_hash VARCHAR(64) NOT NULL,`  
    `signature_value TEXT NOT NULL,       -- Base64 QSeal Signature`  
    `timestamp_token TEXT NOT NULL,       -- eIDAS Qualified Timestamp`  
    `qtsp_provider VARCHAR(100) NOT NULL, -- ADACOM, HARICA, κλπ.`  
    `created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`  
`);`

`-- ============================================================================`  
`-- 7. DOMAIN: WEBHOOKS & NOTIFICATIONS (Ειδοποιήσεις Πελατών)`  
`-- ============================================================================`

`CREATE TABLE webhook_endpoints (`  
    `id BIGSERIAL PRIMARY KEY,`  
    `tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,`  
    `url VARCHAR(500) NOT NULL,`  
    `secret VARCHAR(255) NOT NULL,        -- HMAC Secret για επαλήθευση από τον πελάτη`  
    `events JSONB NOT NULL,               -- ['invoice.issued', 'invoice.failed', 'b2g.status_updated']`  
    `is_active BOOLEAN DEFAULT TRUE,`  
    `created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`  
`);`

`CREATE TABLE webhook_deliveries (`  
    `id BIGSERIAL PRIMARY KEY,`  
    `webhook_endpoint_id BIGINT NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,`  
    `event_type VARCHAR(100) NOT NULL,`  
    `payload JSONB NOT NULL,`  
    `response_status INT,                 -- HTTP Status Code (π.χ. 200, 500)`  
    `response_body TEXT,`  
    `delivered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`  
`);`

`-- ============================================================================`  
`-- 8. INDEXES FOR HIGH PERFORMANCE (Ευρετήρια Ταχείας Αναζήτησης)`  
`-- ============================================================================`

`CREATE INDEX idx_tenants_vat ON tenants(vat_number);`  
`CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);`  
`CREATE INDEX idx_api_keys_prefix ON api_keys(key_prefix);`  
`CREATE INDEX idx_invoices_tenant ON invoices(tenant_id);`  
`CREATE INDEX idx_invoices_mark ON invoices(mark);`  
`CREATE INDEX idx_invoices_hash ON invoices(sha256_hash);`  
`CREATE INDEX idx_invoices_lookup ON invoices(tenant_id, invoice_type, series, aa);`  
`CREATE INDEX idx_credit_transactions_tenant ON credit_transactions(tenant_id);`

## **3\. Ανάλυση Βασικών Πινάκων & Λειτουργιών**

| Πίνακας | Σκοπός | Κρίσιμη Λειτουργικότητα |
| :---- | :---- | :---- |
| **resellers** | Διαχείριση Μεταπωλητών / Agencies | Επιτρέπει σε λογιστικά γραφεία ή εταιρείες software να μεταπωλούν τον Πάροχο με ποσοστό προμήθειας (commission\_rate). |
| **tenants** | Οργανισμοί/Εταιρείες Πελατών | Κεντρικός πίνακας για το ΑΦΜ, τα στοιχεία και το status εξουσιοδότησης myDATA (aade\_authorization\_status). |
| **api\_keys** | Machine-to-Machine Αυθεντικοποίηση | Αποθηκεύει μόνο το SHA-256 Hash του key. Συνδέει το API Key με συγκεκριμένο Υποκατάστημα (aade\_branch) και Σειρά. |
| **credit\_wallets** | Διαχείριση Υπολοίπου Μονάδων | Κράτηση υπολοίπου (balance) και ημερομηνίας λήξης (expires\_at \- 12μηνη ισχύς). |
| **series\_counters** | Πρόληψη Race Conditions | Διατηρεί τον τελευταίο ΑΑ ανά Σειρά. Με χρήση FOR UPDATE lock εγγυάται τη μοναδικότητα των αριθμών. |
| **invoices** | Κεντρικό Αρχείο Παραστατικών | Αποθηκεύει το MARK, το QR URL, τα οικονομικά μεγέθη και τη διαδρομή στο WORM S3 Storage (s3\_object\_key). |
| **invoice\_payments** | Υπογραφές POS (Α.1155) | Καταγράφει τις υπογραφές HMAC-SHA256, τα τερματικά POS (pos\_terminal\_id) και τα τραπεζικά RRNs. |
| **qseal\_signatures\_log** | ISO 27001 & eIDAS Audit Trail | Πλήρης κρυπτογραφικός έλεγχος με QSeal υπογραφές και eIDAS Timestamps για τους ελεγκτές της ΑΑΔΕ. |

