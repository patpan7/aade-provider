import initSqlJs from 'sql.js';
import { randomUUID, createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { aesEncryption } from '../services/encryption/service.js';
import { wormStorage } from '../services/worm/storage.js';
import { logger } from '../services/logging/service.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || join(__dirname, '..', '..', 'data', 'provider.db');

const dbDir = dirname(DB_PATH);
mkdirSync(dbDir, { recursive: true });

let db: any = null;
let initialized = false;

export async function initDatabase(): Promise<void> {
  const SQL = await initSqlJs();

  let savedDb: Uint8Array | null = null;
  if (existsSync(DB_PATH)) {
    try {
      savedDb = readFileSync(DB_PATH);
    } catch (e) {
      console.warn('Could not read existing database file, creating fresh DB:', e);
    }
  }

  if (savedDb && savedDb.length > 0) {
    db = new SQL.Database(savedDb);
  } else {
    db = new SQL.Database();
  }

  // Migrate existing database schema
  try {
    const tableInfo = db.exec('PRAGMA table_info(invoices)');
    const columns = tableInfo[0]?.values?.map((row: any[]) => row[1]) || [];
    
    // Add counterpart_vat_encrypted if missing
    if (!columns.includes('counterpart_vat_encrypted')) {
      db.run('ALTER TABLE invoices ADD COLUMN counterpart_vat_encrypted TEXT');
    }
    
    // Add WORM storage fields if missing
    if (!columns.includes('worm_record_id')) {
      db.run('ALTER TABLE invoices ADD COLUMN worm_record_id TEXT');
      db.run('ALTER TABLE invoices ADD COLUMN qseal_signature TEXT');
      db.run('ALTER TABLE invoices ADD COLUMN qseal_timestamp TEXT');
      db.run('ALTER TABLE invoices ADD COLUMN qtsp_provider TEXT');
    }

    // Add display fields (not sent to AADE, used for printing only)
    const displayFields = [
      'issuer_name', 'issuer_address', 'issuer_postal_code', 'issuer_city',
      'counterpart_name', 'counterpart_address', 'counterpart_postal_code', 'counterpart_city'
    ];
    for (const col of displayFields) {
      if (!columns.includes(col)) {
        try {
          db.run(`ALTER TABLE invoices ADD COLUMN ${col} TEXT`);
        } catch (_) {}
      }
    }

    console.log('[DB] Schema migration completed');
  } catch (e) {
    console.warn('[DB] Schema migration warning:', e);
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT UNIQUE NOT NULL,
      issuer_vat TEXT NOT NULL,
      counterpart_vat TEXT,
      counterpart_vat_encrypted TEXT,
      invoice_type TEXT NOT NULL,
      series TEXT NOT NULL,
      aa INTEGER NOT NULL,
      issue_date TEXT NOT NULL,
      total_net REAL NOT NULL,
      total_vat REAL NOT NULL,
      total_gross REAL NOT NULL,
      sha256_hash TEXT NOT NULL,
      mark TEXT,
      invoice_uid TEXT,
      qr_url TEXT,
      status TEXT NOT NULL DEFAULT 'DRAFT',
      xml_request TEXT,
      aade_raw_response TEXT,
      errors TEXT,
      worm_record_id TEXT,
      qseal_signature TEXT,
      qseal_timestamp TEXT,
      qtsp_provider TEXT,
      tenant_id BIGINT REFERENCES tenants(id) ON DELETE SET NULL,
      api_key_id BIGINT REFERENCES api_keys(id) ON DELETE SET NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create series_counters table for atomic AA number generation
  db.run(`
    CREATE TABLE IF NOT EXISTS series_counters (
      id BIGSERIAL PRIMARY KEY,
      tenant_id BIGINT NOT NULL DEFAULT 0,
      aade_branch INT NOT NULL DEFAULT 0,
      invoice_type VARCHAR(10) NOT NULL,
      series VARCHAR(50) NOT NULL,
      last_number INT NOT NULL DEFAULT 0,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT unique_tenant_series UNIQUE (tenant_id, aade_branch, invoice_type, series)
    )
  `);

  // Create tenants table
  db.run(`
    CREATE TABLE IF NOT EXISTS tenants (
      id BIGSERIAL PRIMARY KEY,
      company_name VARCHAR(255) NOT NULL,
      trade_title VARCHAR(255),
      vat_number VARCHAR(20) UNIQUE NOT NULL,
      tax_office VARCHAR(100),
      address VARCHAR(255),
      postal_code VARCHAR(20),
      city VARCHAR(200),
      country VARCHAR(2) DEFAULT 'GR',
      phone VARCHAR(50),
      email VARCHAR(255) NOT NULL,
      reseller_id INTEGER REFERENCES resellers(id) ON DELETE SET NULL,
      
      -- myDATA Authorization Status
      aade_authorization_status VARCHAR(50) DEFAULT 'PENDING',
      aade_authorized_at TIMESTAMP WITH TIME ZONE,
      
      -- Status
      status VARCHAR(50) DEFAULT 'ACTIVE',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create index for tenants
  db.run(`CREATE INDEX IF NOT EXISTS idx_tenants_vat ON tenants(vat_number)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status)`);

  // Create api_keys table for M2M authentication
  db.run(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id BIGSERIAL PRIMARY KEY,
      tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL,
      key_prefix VARCHAR(20) NOT NULL,
      key_hash VARCHAR(255) UNIQUE NOT NULL,
      aade_branch INT NOT NULL DEFAULT 0,
      default_series VARCHAR(50),
      environment VARCHAR(20) DEFAULT 'LIVE',
      is_active BOOLEAN DEFAULT TRUE,
      expires_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_api_keys_tenant ON api_keys(tenant_id)`);

  // Create credit_wallets table (one wallet per API key; api_key_id NULL = tenant-level fallback)
  db.run(`
    CREATE TABLE IF NOT EXISTS credit_wallets (
      id BIGSERIAL PRIMARY KEY,
      tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      api_key_id BIGINT UNIQUE REFERENCES api_keys(id) ON DELETE CASCADE,
      balance INT NOT NULL DEFAULT 0,
      expires_at TIMESTAMP WITH TIME ZONE,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create credit_transactions table
  db.run(`
    CREATE TABLE IF NOT EXISTS credit_transactions (
      id BIGSERIAL PRIMARY KEY,
      tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      api_key_id BIGINT REFERENCES api_keys(id) ON DELETE SET NULL,
      amount INT NOT NULL,
      type VARCHAR(50) NOT NULL,
      description VARCHAR(255),
      reference_id VARCHAR(100),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_credit_transactions_tenant ON credit_transactions(tenant_id)`);

  // Resellers table
  db.run(`
    CREATE TABLE IF NOT EXISTS resellers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name VARCHAR(255) NOT NULL,
      vat_number VARCHAR(20) UNIQUE NOT NULL,
      email VARCHAR(255) NOT NULL,
      commission_rate DECIMAL(5,2) DEFAULT 0.00,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      tenant_id BIGINT REFERENCES tenants(id) ON DELETE CASCADE,
      reseller_id BIGINT REFERENCES resellers(id) ON DELETE CASCADE,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      first_name VARCHAR(100),
      last_name VARCHAR(100),
      role VARCHAR(50) NOT NULL DEFAULT 'CLIENT_ADMIN',
      is_active BOOLEAN DEFAULT TRUE,
      last_login_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Webhook endpoints table
  db.run(`
    CREATE TABLE IF NOT EXISTS webhook_endpoints (
      id BIGSERIAL PRIMARY KEY,
      tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      url VARCHAR(500) NOT NULL,
      secret VARCHAR(255) NOT NULL,
      events JSONB NOT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Webhook deliveries table
  db.run(`
    CREATE TABLE IF NOT EXISTS webhook_deliveries (
      id BIGSERIAL PRIMARY KEY,
      webhook_endpoint_id BIGINT NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
      event_type VARCHAR(100) NOT NULL,
      payload JSONB NOT NULL,
      response_status INT,
      response_body TEXT,
      delivered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // QSeal signatures log table
  db.run(`
    CREATE TABLE IF NOT EXISTS qseal_signatures_log (
      id BIGSERIAL PRIMARY KEY,
      invoice_id BIGINT UNIQUE NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
      sha256_hash VARCHAR(64) NOT NULL,
      signature_value TEXT NOT NULL,
      timestamp_token TEXT NOT NULL,
      qtsp_provider VARCHAR(100) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Invoice payments table
  db.run(`
    CREATE TABLE IF NOT EXISTS invoice_payments (
      id BIGSERIAL PRIMARY KEY,
      invoice_id BIGINT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      payment_method_type INT NOT NULL,
      amount DECIMAL(12,2) NOT NULL,
      pos_terminal_id VARCHAR(100),
      pos_signature VARCHAR(255),
      pos_rrn VARCHAR(100),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Active sessions table (one active session per user)
  db.run(`
    CREATE TABLE IF NOT EXISTS active_sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Audit log table
  db.run(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY,
      user_id INTEGER,
      api_key_id INTEGER,
      tenant_id INTEGER,
      action VARCHAR(100) NOT NULL,
      entity_type VARCHAR(50),
      entity_id VARCHAR(100),
      details TEXT,
      ip VARCHAR(50),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit_log(tenant_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at)`);

  // Insert default tenant
  db.run(`
    INSERT OR IGNORE INTO tenants (id, company_name, vat_number, email, status)
    VALUES (1, 'Default Company', '000000000', 'default@example.com', 'ACTIVE')
  `);
  // Insert default SUPER_ADMIN user (password: superadmin)
  db.run(`
    INSERT OR IGNORE INTO users (id, email, password_hash, role, first_name, last_name, is_active)
    VALUES (1, 'admin@aade.local', ?, 'SUPER_ADMIN', 'Admin', 'Super', 1)
  `, [createHash('sha256').update('superadmin').digest('hex')]);

  // Insert initial counters for all invoice types with series "A"
  db.run(`
    INSERT OR IGNORE INTO series_counters (tenant_id, aade_branch, invoice_type, series, last_number)
    VALUES 
        (1, 0, '1.1', 'A', 0),
        (1, 0, '1.2', 'A', 0),
        (1, 0, '1.3', 'A', 0),
        (1, 0, '1.4', 'A', 0),
        (1, 0, '2.1', 'A', 0),
        (1, 0, '2.2', 'A', 0),
        (1, 0, '2.3', 'A', 0),
        (1, 0, '5.1', 'A', 0),
        (1, 0, '5.2', 'A', 0),
        (1, 0, '5.3', 'A', 0),
        (1, 0, '5.4', 'A', 0),
        (1, 0, '5.5', 'A', 0),
        (1, 0, '11.1', 'A', 0),
        (1, 0, '11.2', 'A', 0),
        (1, 0, '11.3', 'A', 0),
        (1, 0, '11.4', 'A', 0),
        (1, 0, '11.5', 'A', 0)
  `);

  // Migrate columns if table already existed without invoice_uid or errors
  try {
    const tableInfo = db.exec("PRAGMA table_info(invoices);");
    const cols = tableInfo[0]?.values?.map((v: any) => v[1]) || [];
    if (!cols.includes('invoice_uid')) {
      db.run("ALTER TABLE invoices ADD COLUMN invoice_uid TEXT;");
    }
    if (!cols.includes('errors')) {
      db.run("ALTER TABLE invoices ADD COLUMN errors TEXT;");
    }
    if (!cols.includes('tenant_id')) {
      db.run("ALTER TABLE invoices ADD COLUMN tenant_id BIGINT REFERENCES tenants(id) ON DELETE SET NULL;");
    }
    if (!cols.includes('api_key_id')) {
      db.run("ALTER TABLE invoices ADD COLUMN api_key_id BIGINT REFERENCES api_keys(id) ON DELETE SET NULL;");
    }
  } catch (migErr) {
    console.warn('Migration warning:', migErr);
  }

  // Migrate tenants / credit tables
  try {
    const tCols = db.exec("PRAGMA table_info(tenants);")[0]?.values?.map((v: any) => v[1]) || [];
    if (!tCols.includes('reseller_id')) {
      db.run("ALTER TABLE tenants ADD COLUMN reseller_id INTEGER REFERENCES resellers(id) ON DELETE SET NULL;");
    }
    const wCols = db.exec("PRAGMA table_info(credit_wallets);")[0]?.values?.map((v: any) => v[1]) || [];
    if (!wCols.includes('api_key_id')) {
      db.run("ALTER TABLE credit_wallets ADD COLUMN api_key_id BIGINT REFERENCES api_keys(id) ON DELETE CASCADE;");
    }
    const ctCols = db.exec("PRAGMA table_info(credit_transactions);")[0]?.values?.map((v: any) => v[1]) || [];
    if (!ctCols.includes('api_key_id')) {
      db.run("ALTER TABLE credit_transactions ADD COLUMN api_key_id BIGINT REFERENCES api_keys(id) ON DELETE SET NULL;");
    }
  } catch (migErr2) {
    console.warn('Migration warning:', migErr2);
  }

  // Add reseller_id to tenants if missing
  try {
    const tenantInfo = db.exec("PRAGMA table_info(tenants);");
    const tenantCols = tenantInfo[0]?.values?.map((v: any) => v[1]) || [];
    if (!tenantCols.includes('reseller_id')) {
      db.run("ALTER TABLE tenants ADD COLUMN reseller_id BIGINT REFERENCES resellers(id) ON DELETE SET NULL;");
    }
  } catch (migErr) {
    console.warn('Tenant reseller_id migration warning:', migErr);
  }

  saveDb();
  initialized = true;
}

function assertInitialized(): void {
  if (!initialized || !db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
}

function saveDb(): void {
  if (db) {
    const data = db.export();
    writeFileSync(DB_PATH, Buffer.from(data));
  }
}

export function insertInvoice(data: {
  uuid: string;
  issuerVat: string;
  counterpartVat?: string;
  invoiceType: string;
  series: string;
  aa: number;
  issueDate: string;
  totalNet: number;
  totalVat: number;
  totalGross: number;
  sha256Hash: string;
  mark?: string;
  invoiceUid?: string;
  qrUrl?: string;
  status?: string;
  xmlRequest?: string;
  aadeRawResponse?: string;
  errors?: string;
  tenantId?: number;
  apiKeyId?: number;
  wormRecordId?: string;
  qsealSignature?: string;
  qsealTimestamp?: string;
  qtspProvider?: string;
  // Display fields (not sent to AADE)
  issuerName?: string;
  issuerAddress?: string;
  issuerPostalCode?: string;
  issuerCity?: string;
  counterpartName?: string;
  counterpartAddress?: string;
  counterpartPostalCode?: string;
  counterpartCity?: string;
}): { id: number } {
  assertInitialized();

  const maxId = db.exec('SELECT COALESCE(MAX(id), 0) FROM invoices')[0]?.values[0]?.[0] || 0;
  const id = maxId + 1;

  // Encrypt counterpart VAT for GDPR compliance
  let encryptedVAT = null;
  if (data.counterpartVat) {
    try {
      encryptedVAT = JSON.stringify(aesEncryption.encryptVAT(data.counterpartVat));
    } catch (e) {
      logger.warn('Failed to encrypt counterpart VAT', { error: e });
    }
  }

  const stmt = db.prepare(`
    INSERT INTO invoices (
      id, uuid, issuer_vat, counterpart_vat, counterpart_vat_encrypted, invoice_type, series, aa, issue_date,
      total_net, total_vat, total_gross, sha256_hash, mark, invoice_uid, qr_url, status,
      xml_request, aade_raw_response, errors, tenant_id, api_key_id,
      worm_record_id, qseal_signature, qseal_timestamp, qtsp_provider,
      issuer_name, issuer_address, issuer_postal_code, issuer_city,
      counterpart_name, counterpart_address, counterpart_postal_code, counterpart_city
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.bind([
    id,
    data.uuid,
    data.issuerVat,
    data.counterpartVat || null,
    encryptedVAT,
    data.invoiceType,
    data.series,
    data.aa,
    data.issueDate,
    data.totalNet,
    data.totalVat,
    data.totalGross,
    data.sha256Hash,
    data.mark || null,
    data.invoiceUid || null,
    data.qrUrl || null,
    data.status || 'DRAFT',
    data.xmlRequest || null,
    data.aadeRawResponse || null,
    data.errors || null,
    data.tenantId || null,
    data.apiKeyId || null,
    data.wormRecordId || null,
    data.qsealSignature || null,
    data.qsealTimestamp || null,
    data.qtspProvider || null,
    data.issuerName || null,
    data.issuerAddress || null,
    data.issuerPostalCode || null,
    data.issuerCity || null,
    data.counterpartName || null,
    data.counterpartAddress || null,
    data.counterpartPostalCode || null,
    data.counterpartCity || null,
  ]);
  stmt.run();
  stmt.free();

  saveDb();

  return { id };
}

export function getAllInvoices(): any[] {
  assertInitialized();

  const stmt = db.prepare('SELECT * FROM invoices ORDER BY created_at DESC');
  const results: any[] = [];

  while (stmt.step()) {
    const row = stmt.getAsObject();
    results.push(row);
  }
  stmt.free();

  return results;
}

export function getInvoiceById(id: number): any | undefined {
  assertInitialized();

  const stmt = db.prepare('SELECT * FROM invoices WHERE id = ?');
  stmt.bind([id]);

  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }

  stmt.free();
  return undefined;
}

export function updateInvoiceMark(
  id: number,
  mark: string,
  invoiceUid: string,
  qrUrl: string,
  status: string,
  aadeRawResponse: string,
  errors?: string
): void {
  assertInitialized();

  const stmt = db.prepare(`
    UPDATE invoices 
    SET mark = ?, invoice_uid = ?, qr_url = ?, status = ?, aade_raw_response = ?, errors = ?
    WHERE id = ?
  `);
  stmt.bind([mark || null, invoiceUid || null, qrUrl || null, status, aadeRawResponse || null, errors || null, id]);
  stmt.run();
  stmt.free();
  saveDb();
}

export function generateUUID(): string {
  // In test environment, add timestamp to ensure uniqueness across test runs
  if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
    const timestamp = Date.now().toString(36);
    const randomPart = randomUUID().replace(/-/g, '').substring(0, 16);
    return `${timestamp}${randomPart}`.substring(0, 36);
  }
  return randomUUID();
}

// Get next AA number for a given series and invoice type
// Uses series_counters table with atomic upsert (check first, then insert or update)
export function getNextAA(
  invoiceType: string,
  series: string = 'A',
  aadeBranch: number = 0,
  tenantId: number = 1
): number {
  assertInitialized();

  // First, check if the row exists
  const selectResult = db.exec(`
    SELECT last_number FROM series_counters 
    WHERE tenant_id = ${tenantId} AND aade_branch = ${aadeBranch} 
      AND invoice_type = '${invoiceType}' AND series = '${series}'
  `);

  console.log('[getNextAA] SELECT result:', JSON.stringify(selectResult));

  if (selectResult && selectResult.length > 0 && selectResult[0].values.length > 0) {
    // Row exists - increment and return new value
    const currentValue = selectResult[0].values[0][0];
    const newValue = currentValue + 1;
    console.log('[getNextAA] Row exists, current:', currentValue, 'new:', newValue);
    db.run(`
      UPDATE series_counters 
      SET last_number = ${newValue}, updated_at = CURRENT_TIMESTAMP
      WHERE tenant_id = ${tenantId} AND aade_branch = ${aadeBranch} 
        AND invoice_type = '${invoiceType}' AND series = '${series}'
    `);
    return newValue;
  } else {
    // Row doesn't exist - insert new
    console.log('[getNextAA] Row does not exist, inserting new');
    db.run(`
      INSERT INTO series_counters (tenant_id, aade_branch, invoice_type, series, last_number)
      VALUES (${tenantId}, ${aadeBranch}, '${invoiceType}', '${series}', 1)
    `);
    return 1;
  }
}

// ============================================================================
// Tenant Management Functions
// ============================================================================

export interface Tenant {
  id: number;
  company_name: string;
  trade_title: string | null;
  vat_number: string;
  tax_office: string | null;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  country: string;
  phone: string | null;
  email: string;
  aade_authorization_status: string;
  aade_authorized_at: string | null;
  status: string;
  created_at: string;
}

export function createTenant(data: {
  company_name: string;
  vat_number: string;
  email: string;
  trade_title?: string;
  tax_office?: string;
  address?: string;
  postal_code?: string;
  city?: string;
  country?: string;
  phone?: string;
  reseller_id?: number;
  status?: string;
}): { id: number } {
  assertInitialized();

  const maxId = db.exec('SELECT COALESCE(MAX(id), 0) FROM tenants')[0]?.values[0]?.[0] || 0;
  const id = maxId + 1;

  const stmt = db.prepare(`
    INSERT INTO tenants (id, company_name, vat_number, email, trade_title, tax_office, address, postal_code, city, country, phone, reseller_id, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.bind([
    id,
    data.company_name,
    data.vat_number,
    data.email,
    data.trade_title || null,
    data.tax_office || null,
    data.address || null,
    data.postal_code || null,
    data.city || null,
    data.country || 'GR',
    data.phone || null,
    data.reseller_id || null,
    data.status || 'PENDING',
  ]);
  stmt.run();
  stmt.free();
  saveDb();

  // Initialize series counters for new tenant
  const invoiceTypes = ['1.1', '1.2', '1.3', '1.4', '2.1', '2.2', '2.3', '5.1', '5.2', '5.3', '5.4', '5.5', '11.1', '11.2', '11.3', '11.4', '11.5'];
  
  for (const invoiceType of invoiceTypes) {
    db.run(`
      INSERT OR IGNORE INTO series_counters (tenant_id, aade_branch, invoice_type, series, last_number)
      VALUES (?, 0, ?, 'A', 0)
    `, [id, invoiceType]);
  }

  return { id };
}

export function getTenantById(id: number): any {
  assertInitialized();

  const stmt = db.prepare('SELECT * FROM tenants WHERE id = ?');
  stmt.bind([id]);

  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }

  stmt.free();
  return undefined;
}

export function getTenantByVat(vatNumber: string): any {
  assertInitialized();

  const stmt = db.prepare('SELECT * FROM tenants WHERE vat_number = ?');
  stmt.bind([vatNumber]);

  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }

  stmt.free();
  return undefined;
}

export function getAllTenants(): any[] {
  assertInitialized();

  const stmt = db.prepare('SELECT * FROM tenants ORDER BY created_at DESC');
  const results: any[] = [];

  while (stmt.step()) {
    const row = stmt.getAsObject();
    results.push(row);
  }
  stmt.free();

  return results;
}

export function updateTenantStatus(id: number, status: string): void {
  assertInitialized();

  const stmt = db.prepare('UPDATE tenants SET status = ? WHERE id = ?');
  stmt.bind([status, id]);
  stmt.run();
  stmt.free();
  saveDb();
}

// ============================================================================
// API Key Management Functions
// ============================================================================

export interface ApiKey {
  id: number;
  tenant_id: number;
  name: string;
  key_prefix: string;
  key_hash: string;
  aade_branch: number;
  default_series: string | null;
  environment: string;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
}

export function createApiKey(data: {
  tenant_id: number;
  name: string;
  key_prefix: string;
  key_hash: string;
  aade_branch?: number;
  default_series?: string;
  environment?: string;
  expires_at?: string;
}): { id: number } {
  assertInitialized();

  const maxId = db.exec('SELECT COALESCE(MAX(id), 0) FROM api_keys')[0]?.values[0]?.[0] || 0;
  const id = maxId + 1;

  const stmt = db.prepare(`
    INSERT INTO api_keys (id, tenant_id, name, key_prefix, key_hash, aade_branch, default_series, environment, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.bind([
    id,
    data.tenant_id,
    data.name,
    data.key_prefix,
    data.key_hash,
    data.aade_branch || 0,
    data.default_series || null,
    data.environment || 'LIVE',
    data.expires_at || null,
  ]);
  stmt.run();
  stmt.free();

  saveDb();

  return { id };
}

export function getApiKeyByHash(keyHash: string): any {
  assertInitialized();

  const stmt = db.prepare('SELECT * FROM api_keys WHERE key_hash = ? AND is_active = 1');
  stmt.bind([keyHash]);

  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }

  stmt.free();
  return undefined;
}

export function getApiKeysByTenant(tenantId: number): any[] {
  assertInitialized();

  const stmt = db.prepare('SELECT * FROM api_keys WHERE tenant_id = ? ORDER BY created_at DESC');
  stmt.bind([tenantId]);

  const results: any[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    results.push(row);
  }
  stmt.free();

  return results;
}

export function deactivateApiKey(id: number): void {
  assertInitialized();

  const stmt = db.prepare('UPDATE api_keys SET is_active = 0 WHERE id = ?');
  stmt.bind([id]);
  stmt.run();
  stmt.free();
  saveDb();
}

export function updateApiKey(id: number, data: {
  name?: string;
  aade_branch?: number;
  default_series?: string | null;
  environment?: string;
}): void {
  assertInitialized();

  const stmt = db.prepare('SELECT id FROM api_keys WHERE id = ?');
  stmt.bind([id]);
  const hasRow = stmt.step();
  stmt.free();
  if (!hasRow) throw new Error('API key not found');

  const fields: string[] = [];
  const values: any[] = [];
  if (data.name !== undefined)       { fields.push('name = ?');        values.push(data.name); }
  if (data.aade_branch !== undefined) { fields.push('aade_branch = ?'); values.push(data.aade_branch); }
  if (data.default_series !== undefined) { fields.push('default_series = ?'); values.push(data.default_series || null); }
  if (data.environment !== undefined) { fields.push('environment = ?'); values.push(data.environment); }
  if (fields.length === 0) return;

  values.push(id);
  const updateStmt = db.prepare(`UPDATE api_keys SET ${fields.join(', ')} WHERE id = ?`);
  updateStmt.bind(values);
  updateStmt.run();
  updateStmt.free();
  saveDb();
}

// ============================================================================
// Credit System Functions
// ============================================================================

export interface CreditWallet {
  id: number;
  tenant_id: number;
  api_key_id: number | null;
  balance: number;
  expires_at: string | null;
  updated_at: string;
}

export function getCreditWallet(tenantId: number): CreditWallet | undefined {
  assertInitialized();

  const stmt = db.prepare('SELECT * FROM credit_wallets WHERE tenant_id = ? AND api_key_id IS NULL');
  stmt.bind([tenantId]);

  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row as CreditWallet;
  }

  stmt.free();
  return undefined;
}

export function createOrGetCreditWallet(tenantId: number): CreditWallet {
  assertInitialized();

  let wallet = getCreditWallet(tenantId);
  if (!wallet) {
    const maxId = db.exec('SELECT COALESCE(MAX(id), 0) FROM credit_wallets')[0]?.values[0]?.[0] || 0;
    const id = maxId + 1;
    db.run(`
      INSERT INTO credit_wallets (id, tenant_id, api_key_id, balance)
      VALUES (?, ?, NULL, 0)
    `, [id, tenantId]);
    wallet = getCreditWallet(tenantId)!;
  }
  return wallet!;
}

// ---------- Per-API-key wallets ----------

export function getCreditWalletForKey(tenantId: number, apiKeyId: number): CreditWallet | undefined {
  assertInitialized();

  const stmt = db.prepare('SELECT * FROM credit_wallets WHERE tenant_id = ? AND api_key_id = ?');
  stmt.bind([tenantId, apiKeyId]);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row as CreditWallet;
  }
  stmt.free();
  return undefined;
}

export function createOrGetCreditWalletForKey(tenantId: number, apiKeyId: number): CreditWallet {
  assertInitialized();

  let wallet = getCreditWalletForKey(tenantId, apiKeyId);
  if (!wallet) {
    const maxId = db.exec('SELECT COALESCE(MAX(id), 0) FROM credit_wallets')[0]?.values[0]?.[0] || 0;
    const id = maxId + 1;
    db.run(`
      INSERT INTO credit_wallets (id, tenant_id, api_key_id, balance)
      VALUES (?, ?, ?, 0)
    `, [id, tenantId, apiKeyId]);
    wallet = getCreditWalletForKey(tenantId, apiKeyId)!;
  }
  return wallet!;
}

export function addCreditsForKey(tenantId: number, apiKeyId: number, amount: number, type: string, description?: string, referenceId?: string): void {
  assertInitialized();

  const wallet = createOrGetCreditWalletForKey(tenantId, apiKeyId);
  const newBalance = wallet.balance + amount;
  db.run('UPDATE credit_wallets SET balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newBalance, wallet.id]);

  const stmt = db.prepare(`
    INSERT INTO credit_transactions (tenant_id, api_key_id, amount, type, description, reference_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.bind([tenantId, apiKeyId, amount, type, description || null, referenceId || null]);
  stmt.run();
  stmt.free();

  saveDb();
}

export function useCreditsForKey(tenantId: number, apiKeyId: number, amount: number, description?: string, referenceId?: string): boolean {
  assertInitialized();

  const wallet = getCreditWalletForKey(tenantId, apiKeyId);
  if (!wallet || wallet.balance < amount) {
    return false;
  }
  if (wallet.expires_at && new Date(wallet.expires_at) < new Date()) {
    return false;
  }

  const newBalance = wallet.balance - amount;
  db.run('UPDATE credit_wallets SET balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newBalance, wallet.id]);

  const stmt = db.prepare(`
    INSERT INTO credit_transactions (tenant_id, api_key_id, amount, type, description, reference_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.bind([tenantId, apiKeyId, -amount, 'INVOICE_USAGE', description || null, referenceId || null]);
  stmt.run();
  stmt.free();

  saveDb();
  return true;
}

export function hasValidCreditsForKey(tenantId: number, apiKeyId: number, amount: number = 1): boolean {
  const wallet = getCreditWalletForKey(tenantId, apiKeyId);
  if (!wallet || wallet.balance < amount) return false;
  if (wallet.expires_at && new Date(wallet.expires_at) < new Date()) return false;
  return true;
}

export function getCreditBalanceForKey(tenantId: number, apiKeyId: number): number {
  const wallet = getCreditWalletForKey(tenantId, apiKeyId);
  return wallet?.balance ?? 0;
}

export function getAllCreditWalletsByTenant(tenantId: number): CreditWallet[] {
  assertInitialized();

  const stmt = db.prepare('SELECT * FROM credit_wallets WHERE tenant_id = ? ORDER BY api_key_id IS NULL DESC, api_key_id ASC');
  stmt.bind([tenantId]);
  const results: CreditWallet[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as CreditWallet);
  }
  stmt.free();
  return results;
}

export function addCredits(tenantId: number, amount: number, type: string, description?: string, referenceId?: string, apiKeyId?: number): void {
  assertInitialized();

  const wallet = apiKeyId
    ? createOrGetCreditWalletForKey(tenantId, apiKeyId)
    : createOrGetCreditWallet(tenantId);
  const newBalance = wallet.balance + amount;

  db.run('UPDATE credit_wallets SET balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newBalance, wallet.id]);

  const stmt = db.prepare(`
    INSERT INTO credit_transactions (tenant_id, api_key_id, amount, type, description, reference_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.bind([tenantId, apiKeyId || null, amount, type, description || null, referenceId || null]);
  stmt.run();
  stmt.free();

  saveDb();
}

export function useCredits(tenantId: number, amount: number, description?: string, referenceId?: string, apiKeyId?: number): boolean {
  assertInitialized();

  const wallet = apiKeyId ? getCreditWalletForKey(tenantId, apiKeyId) : getCreditWallet(tenantId);
  if (!wallet || wallet.balance < amount) {
    return false;
  }
  if (wallet.expires_at && new Date(wallet.expires_at) < new Date()) {
    return false;
  }

  const newBalance = wallet.balance - amount;
  db.run('UPDATE credit_wallets SET balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newBalance, wallet.id]);

  const stmt = db.prepare(`
    INSERT INTO credit_transactions (tenant_id, api_key_id, amount, type, description, reference_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.bind([tenantId, apiKeyId || null, -amount, 'INVOICE_USAGE', description || null, referenceId || null]);
  stmt.run();
  stmt.free();

  saveDb();
  return true;
}

export function getCreditTransactions(tenantId: number, limit: number = 50, apiKeyId?: number): any[] {
  assertInitialized();

  const stmt = apiKeyId
    ? db.prepare('SELECT * FROM credit_transactions WHERE tenant_id = ? AND api_key_id = ? ORDER BY created_at DESC LIMIT ?')
    : db.prepare('SELECT * FROM credit_transactions WHERE tenant_id = ? ORDER BY created_at DESC LIMIT ?');
  stmt.bind(apiKeyId ? [tenantId, apiKeyId, limit] : [tenantId, limit]);

  const results: any[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    results.push(row);
  }
  stmt.free();

  return results;
}

export function getCreditBalance(tenantId: number): number {
  const wallet = getCreditWallet(tenantId);
  return wallet?.balance ?? 0;
}

export function hasValidCredits(tenantId: number, amount: number = 1, apiKeyId?: number): boolean {
  const wallet = apiKeyId ? getCreditWalletForKey(tenantId, apiKeyId) : getCreditWallet(tenantId);
  if (!wallet || wallet.balance < amount) return false;
  if (wallet.expires_at && new Date(wallet.expires_at) < new Date()) return false;
  return true;
}

export function updateCreditWalletExpiry(tenantId: number, expiresAt: string, apiKeyId?: number): void {
  assertInitialized();
  const wallet = apiKeyId ? createOrGetCreditWalletForKey(tenantId, apiKeyId) : createOrGetCreditWallet(tenantId);
  db.run('UPDATE credit_wallets SET expires_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [expiresAt, wallet.id]);
  saveDb();
}

// ============================================================================
// Reseller Management Functions
// ============================================================================

export interface Reseller {
  id: number;
  name: string;
  vat_number: string;
  email: string;
  commission_rate: number;
  is_active: boolean;
  created_at: string;
}

export function createReseller(data: {
  name: string;
  vat_number: string;
  email: string;
  commission_rate?: number;
}): { id: number } {
  assertInitialized();

  const maxId = db.exec('SELECT COALESCE(MAX(id), 0) FROM resellers')[0]?.values[0]?.[0] || 0;
  const id = maxId + 1;

  const stmt = db.prepare(`
    INSERT INTO resellers (id, name, vat_number, email, commission_rate)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.bind([id, data.name, data.vat_number, data.email, data.commission_rate || 0]);
  stmt.run();
  stmt.free();

  saveDb();

  return { id };
}

export function getAllResellers(): any[] {
  assertInitialized();

  const stmt = db.prepare('SELECT * FROM resellers ORDER BY created_at DESC');
  const results: any[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

export function getResellerById(id: number): any {
  assertInitialized();

  const stmt = db.prepare('SELECT * FROM resellers WHERE id = ?');
  stmt.bind([id]);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
  return undefined;
}

export function getResellerByVat(vatNumber: string): any {
  assertInitialized();

  const stmt = db.prepare('SELECT * FROM resellers WHERE vat_number = ?');
  stmt.bind([vatNumber]);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
  return undefined;
}

export function updateReseller(id: number, data: {
  name?: string;
  vat_number?: string;
  email?: string;
  commission_rate?: number;
  is_active?: boolean;
}): void {
  assertInitialized();

  const existing = getResellerById(id);
  if (!existing) throw new Error('Reseller not found');

  const stmt = db.prepare(`
    UPDATE resellers SET name = ?, vat_number = ?, email = ?, commission_rate = ?, is_active = ? WHERE id = ?
  `);
  stmt.bind([
    data.name ?? existing.name,
    data.vat_number ?? existing.vat_number,
    data.email ?? existing.email,
    data.commission_rate ?? existing.commission_rate,
    data.is_active !== undefined ? data.is_active : existing.is_active,
    id,
  ]);
  stmt.run();
  stmt.free();
  saveDb();
}

export function deleteReseller(id: number): void {
  assertInitialized();
  db.run('DELETE FROM resellers WHERE id = ?', [id]);
  saveDb();
}

// ============================================================================
// Audit Log Functions
// ============================================================================

export function logAudit(data: {
  userId?: number;
  apiKeyId?: number;
  tenantId?: number;
  action: string;
  entityType?: string;
  entityId?: string | number;
  details?: any;
  ip?: string;
}): void {
  assertInitialized();
  const maxId = db.exec('SELECT COALESCE(MAX(id), 0) FROM audit_log')[0]?.values[0]?.[0] || 0;
  const stmt = db.prepare(`
    INSERT INTO audit_log (id, user_id, api_key_id, tenant_id, action, entity_type, entity_id, details, ip)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.bind([
    maxId + 1,
    data.userId ?? null,
    data.apiKeyId ?? null,
    data.tenantId ?? null,
    data.action,
    data.entityType ?? null,
    data.entityId !== undefined ? String(data.entityId) : null,
    data.details ? JSON.stringify(data.details) : null,
    data.ip ?? null,
  ]);
  stmt.run();
  stmt.free();
  saveDb();
}

export function getAuditLogs(filters: { tenantId?: number; userId?: number; limit?: number } = {}): any[] {
  assertInitialized();
  let sql = 'SELECT * FROM audit_log WHERE 1=1';
  const params: any[] = [];
  if (filters.tenantId !== undefined) { sql += ' AND tenant_id = ?'; params.push(filters.tenantId); }
  if (filters.userId !== undefined) { sql += ' AND user_id = ?'; params.push(filters.userId); }
  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(filters.limit || 100);
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const results: any[] = [];
  while (stmt.step()) results.push(stmt.getAsObject());
  stmt.free();
  return results;
}



export function createUser(data: {
  tenant_id?: number;
  reseller_id?: number;
  email: string;
  password_hash: string;
  first_name?: string;
  last_name?: string;
  role?: string;
}): { id: number } {
  assertInitialized();

  // sql.js doesn't auto-increment INTEGER PRIMARY KEY properly, assign ID manually
  const maxId = db.exec('SELECT COALESCE(MAX(id), 0) FROM users')[0]?.values[0]?.[0] || 0;
  const id = maxId + 1;

  const stmt = db.prepare(`
    INSERT INTO users (id, tenant_id, reseller_id, email, password_hash, first_name, last_name, role)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.bind([
    id,
    data.tenant_id || null,
    data.reseller_id || null,
    data.email,
    data.password_hash,
    data.first_name || null,
    data.last_name || null,
    data.role || 'CLIENT_ADMIN',
  ]);
  stmt.run();
  stmt.free();
  saveDb();

  return { id };
}

export function getUserByEmail(email: string): any {
  assertInitialized();

  const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
  stmt.bind([email]);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
  return undefined;
}

export function getUserById(id: number): any {
  assertInitialized();

  const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
  stmt.bind([id]);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
  return undefined;
}

export function updateUser(userId: number, data: {
  email?: string;
  first_name?: string;
  last_name?: string;
  role?: string;
  tenant_id?: number | null;
  reseller_id?: number | null;
}): void {
  assertInitialized();
  const existing = getUserById(userId);
  if (!existing) throw new Error('User not found');

  db.run(`
    UPDATE users SET email = ?, first_name = ?, last_name = ?, role = ?, tenant_id = ?, reseller_id = ?
    WHERE id = ?
  `, [
    data.email ?? existing.email,
    data.first_name ?? existing.first_name,
    data.last_name ?? existing.last_name,
    data.role ?? existing.role,
    data.tenant_id !== undefined ? data.tenant_id : existing.tenant_id,
    data.reseller_id !== undefined ? data.reseller_id : existing.reseller_id,
    userId,
  ]);
  saveDb();
}

// ============================================================================
// Session Management (single active session per user)
// ============================================================================

const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

export function createSession(userId: number): { token: string; expiresAt: string } {
  assertInitialized();

  const token = 'sess_' + randomUUID().replace(/-/g, '');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();

  // Single session per user: invalidate any existing sessions first
  db.run('DELETE FROM active_sessions WHERE user_id = ?', [userId]);

  const stmt = db.prepare('INSERT INTO active_sessions (token, user_id, expires_at) VALUES (?, ?, ?)');
  stmt.bind([token, userId, expiresAt]);
  stmt.run();
  stmt.free();

  saveDb();
  return { token, expiresAt };
}

export function validateSession(token: string): any {
  assertInitialized();

  const stmt = db.prepare(`
    SELECT s.token, s.expires_at, u.id AS user_id, u.email, u.first_name, u.last_name, u.role, u.tenant_id, u.reseller_id, u.is_active
    FROM active_sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token = ?
  `);
  stmt.bind([token]);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    if (row.is_active !== 1) return undefined;
    if (new Date(row.expires_at) < new Date()) return undefined;
    return row;
  }
  stmt.free();
  return undefined;
}

export function destroySession(token: string): void {
  assertInitialized();
  db.run('DELETE FROM active_sessions WHERE token = ?', [token]);
  saveDb();
}

export function destroyAllUserSessions(userId: number): void {
  assertInitialized();
  db.run('DELETE FROM active_sessions WHERE user_id = ?', [userId]);
  saveDb();
}

export function getUsersByTenant(tenantId: number): any[] {
  assertInitialized();

  const stmt = db.prepare('SELECT * FROM users WHERE tenant_id = ? ORDER BY created_at DESC');
  stmt.bind([tenantId]);
  const results: any[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

export function getAllUsers(): any[] {
  assertInitialized();

  const stmt = db.prepare('SELECT * FROM users ORDER BY created_at DESC');
  const results: any[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

export function updateUserPassword(userId: number, passwordHash: string): void {
  assertInitialized();
  db.run('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, userId]);
  saveDb();
}

export function updateUserLastLogin(userId: number): void {
  assertInitialized();
  db.run('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?', [userId]);
  saveDb();
}

export function deactivateUser(id: number): void {
  assertInitialized();
  db.run('UPDATE users SET is_active = 0 WHERE id = ?', [id]);
  saveDb();
}

// ============================================================================
// Webhook Management Functions
// ============================================================================

export function createWebhookEndpoint(data: {
  tenant_id: number;
  url: string;
  secret: string;
  events: string[];
}): { id: number } {
  assertInitialized();

  const maxId = db.exec('SELECT COALESCE(MAX(id), 0) FROM webhook_endpoints')[0]?.values[0]?.[0] || 0;
  const id = maxId + 1;

  const stmt = db.prepare(`
    INSERT INTO webhook_endpoints (id, tenant_id, url, secret, events)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.bind([id, data.tenant_id, data.url, data.secret, JSON.stringify(data.events || ['invoice.issued'])]);
  stmt.run();
  stmt.free();

  saveDb();

  return { id };
}

export function getWebhookEndpointsByTenant(tenantId: number): any[] {
  assertInitialized();

  const stmt = db.prepare('SELECT * FROM webhook_endpoints WHERE tenant_id = ? ORDER BY created_at DESC');
  stmt.bind([tenantId]);
  const results: any[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    if (typeof row.events === 'string') {
      try { row.events = JSON.parse(row.events); } catch { /* keep raw */ }
    }
    results.push(row);
  }
  stmt.free();
  return results;
}

export function getWebhookEndpointById(id: number): any {
  assertInitialized();

  const stmt = db.prepare('SELECT * FROM webhook_endpoints WHERE id = ?');
  stmt.bind([id]);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    if (typeof row.events === 'string') {
      try { row.events = JSON.parse(row.events); } catch { /* keep raw */ }
    }
    return row;
  }
  stmt.free();
  return undefined;
}

export function deactivateWebhookEndpoint(id: number): void {
  assertInitialized();
  db.run('UPDATE webhook_endpoints SET is_active = 0 WHERE id = ?', [id]);
  saveDb();
}

export function logWebhookDelivery(data: {
  webhook_endpoint_id: number;
  event_type: string;
  payload: any;
  response_status?: number;
  response_body?: string;
}): void {
  assertInitialized();

  const stmt = db.prepare(`
    INSERT INTO webhook_deliveries (webhook_endpoint_id, event_type, payload, response_status, response_body)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.bind([
    data.webhook_endpoint_id,
    data.event_type,
    JSON.stringify(data.payload),
    data.response_status || null,
    data.response_body || null,
  ]);
  stmt.run();
  stmt.free();
  saveDb();
}

export function getWebhookDeliveries(endpointId: number, limit: number = 50): any[] {
  assertInitialized();

  const stmt = db.prepare('SELECT * FROM webhook_deliveries WHERE webhook_endpoint_id = ? ORDER BY delivered_at DESC LIMIT ?');
  stmt.bind([endpointId, limit]);
  const results: any[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

// ============================================================================
// QSeal Signatures Functions
// ============================================================================

export function logQSealSignature(data: {
  invoice_id: number;
  sha256_hash: string;
  signature_value: string;
  timestamp_token: string;
  qtsp_provider: string;
}): { lastInsertRowid: number } {
  assertInitialized();

  const stmt = db.prepare(`
    INSERT INTO qseal_signatures_log (invoice_id, sha256_hash, signature_value, timestamp_token, qtsp_provider)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.bind([data.invoice_id, data.sha256_hash, data.signature_value, data.timestamp_token, data.qtsp_provider]);
  stmt.run();
  stmt.free();

  saveDb();

  const result = db.exec('SELECT last_insert_rowid() as id');
  const lastInsertRowid = result[0]?.values[0]?.[0] || 0;
  return { lastInsertRowid };
}

export function getQSealSignatureByInvoiceId(invoiceId: number): any {
  assertInitialized();

  const stmt = db.prepare('SELECT * FROM qseal_signatures_log WHERE invoice_id = ?');
  stmt.bind([invoiceId]);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
  return undefined;
}

// ============================================================================
// Invoice Payments Functions
// ============================================================================

export function insertInvoicePayments(invoiceId: number, payments: Array<{
  payment_method_type: number;
  amount: number;
  pos_terminal_id?: string;
  pos_signature?: string;
  pos_rrn?: string;
}>): void {
  assertInitialized();

  const stmt = db.prepare(`
    INSERT INTO invoice_payments (invoice_id, payment_method_type, amount, pos_terminal_id, pos_signature, pos_rrn)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (const p of payments) {
const values = [
      invoiceId,
      Number(p.payment_method_type),
      Number(p.amount),
      p.pos_terminal_id ?? null,
      p.pos_signature ?? null,
      p.pos_rrn ?? null,
    ];
    stmt.bind(values);
    stmt.run();
  }
  stmt.free();
  saveDb();
}

export function getInvoicePaymentsByInvoiceId(invoiceId: number): any[] {
  assertInitialized();

  const stmt = db.prepare('SELECT * FROM invoice_payments WHERE invoice_id = ? ORDER BY id');
  stmt.bind([invoiceId]);
  const results: any[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

// ============================================================================
// Tenant Full Update
// ============================================================================

export function updateTenant(id: number, data: {
  company_name?: string;
  trade_title?: string;
  vat_number?: string;
  tax_office?: string;
  address?: string;
  postal_code?: string;
  city?: string;
  country?: string;
  phone?: string;
  email?: string;
  aade_authorization_status?: string;
  aade_authorized_at?: string;
  reseller_id?: number;
}): void {
  assertInitialized();

  const existing = getTenantById(id);
  if (!existing) throw new Error('Tenant not found');

  const stmt = db.prepare(`
    UPDATE tenants SET
      company_name = ?, trade_title = ?, vat_number = ?, tax_office = ?, address = ?,
      postal_code = ?, city = ?, country = ?, phone = ?, email = ?,
      aade_authorization_status = ?, aade_authorized_at = ?, reseller_id = ?
    WHERE id = ?
  `);
  stmt.bind([
    data.company_name ?? existing.company_name,
    data.trade_title ?? existing.trade_title,
    data.vat_number ?? existing.vat_number,
    data.tax_office ?? existing.tax_office,
    data.address ?? existing.address,
    data.postal_code ?? existing.postal_code,
    data.city ?? existing.city,
    data.country ?? existing.country,
    data.phone ?? existing.phone,
    data.email ?? existing.email,
    data.aade_authorization_status ?? existing.aade_authorization_status,
    data.aade_authorized_at ?? existing.aade_authorized_at,
    data.reseller_id !== undefined ? data.reseller_id : (existing.reseller_id ?? null),
    id,
  ]);
  stmt.run();
  stmt.free();
  saveDb();
}

export default db;
