import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import swaggerUi from 'swagger-ui-express';
import { swaggerDocument } from './config/swagger.js';
import { initDatabase } from './db/database.js';
import { getConfigStatus } from './config/aade.config.js';
import { issueInvoice, getInvoices, getInvoice } from './services/invoice/index.js';
import { validateGreekAFM } from './services/hash.service.js';
import { requestTransmittedDocs, requestReceiverInfo, cancelDeliveryNote, cancelReceivingNote, sendStatement, requestStatements, recallStatement, sendPaymentsMethod, sendUnsignedInvoices } from './services/aade/index.js';
import { createTenant, getTenantById, getTenantByVat, getAllTenants, updateTenantStatus, createApiKey, getApiKeyByHash, getApiKeysByTenant, deactivateApiKey, updateApiKey, getCreditBalance, addCredits, useCredits, getCreditTransactions, hasValidCredits, updateCreditWalletExpiry, createReseller, getAllResellers, getResellerById, getResellerByVat, updateReseller, deleteReseller, createUser, getUserByEmail, getUserById, getUsersByTenant, updateUser, updateUserPassword, updateUserLastLogin, deactivateUser, getAllUsers, createWebhookEndpoint, getWebhookEndpointsByTenant, deactivateWebhookEndpoint, logWebhookDelivery, getWebhookDeliveries, logQSealSignature, getQSealSignatureByInvoiceId, insertInvoicePayments, getInvoicePaymentsByInvoiceId, updateTenant, createSession, validateSession, destroySession, logAudit, getAuditLogs, getAllCreditWalletsByTenant, getCreditBalanceForKey, addCreditsForKey } from './db/database.js';
import { logger } from './services/logging/service.js';
import { tlsManager } from './services/tls/manager.js';
import { wormStorage } from './services/worm/storage.js';
import { qsealService } from './services/qseal/service.js';
import { aesEncryption } from './services/encryption/service.js';

// Load .env from project root
const _dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(_dirname, '..', '.env') });

const app = express();
const PORT = Number(process.env.PORT) || 8000;

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Resolve public folder (supports both src/public and dist/public)
const publicDir = existsSync(join(_dirname, 'public')) 
  ? join(_dirname, 'public') 
  : join(_dirname, '..', 'src', 'public');

// Unhandled rejection handlers
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Process] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[Process] Uncaught Exception:', error);
});

app.use(cors());
app.use(express.json());
app.use(express.static(publicDir));

// SPA fallback — runs AFTER static so static files are served first
app.get('*', (req, res, next) => {
  // Only pass through actual API routes
  const isApiRoute = req.path.startsWith('/api/') || req.path === '/api';
  if (isApiRoute || req.path.startsWith('/healthz')) return next();
  // Check for page templates in pages/ subdirectory
  const pageFile = join(publicDir, 'pages' + req.path + '.html');
  try {
    const stat = require('fs').statSync(pageFile);
    if (stat.isFile()) return res.sendFile(pageFile);
  } catch (_) {}
  // All other GETs → app shell
  if (req.method === 'GET') return res.sendFile(join(publicDir, 'index.html'));
  next();
});

// ============ ROLE-BASED SCOPING HELPERS ============

// SUPER_ADMIN sees everything; RESELLER_ADMIN sees only own reseller's tenants;
// CLIENT_ADMIN / USER see only their own tenant.
function scopedTenantIds(req: any): number[] | null {
  const s = req.session;
  if (!s) return null;
  if (s.role === 'SUPER_ADMIN') return null; // no restriction
  if (s.role === 'RESELLER_ADMIN' && s.reseller_id) {
    return getAllTenants().filter(t => t.reseller_id === s.reseller_id).map(t => t.id);
  }
  if (s.tenant_id) return [s.tenant_id];
  return [];
}

// Whether a session is allowed to touch a specific tenant.
function canAccessTenant(req: any, tenantId: number): boolean {
  const s = req.session;
  if (!s) return false;
  if (s.role === 'SUPER_ADMIN') return true;
  if (s.role === 'RESELLER_ADMIN') {
    const t = getTenantById(tenantId);
    return !!t && t.reseller_id === s.reseller_id;
  }
  return s.tenant_id === tenantId;
}

const requireAdmin = (req: any, res: any, next: any) => {
  if (req.session?.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ success: false, errors: ['Administrator access required'] });
  }
  next();
};

const requireTenantAdmin = (req: any, res: any, next: any) => {
  if (!['SUPER_ADMIN', 'RESELLER_ADMIN', 'CLIENT_ADMIN'].includes(req.session?.role)) {
    return res.status(403).json({ success: false, errors: ['Tenant administrator access required'] });
  }
  next();
};

function canManageUser(req: any, user: any): boolean {
  if (!user) return false;
  if (req.session.role === 'SUPER_ADMIN') return true;
  if (req.session.role === 'CLIENT_ADMIN') return user.tenant_id === req.session.tenant_id;
  if (req.session.role === 'RESELLER_ADMIN') {
    if (user.reseller_id === req.session.reseller_id) return true;
    const tenant = user.tenant_id ? getTenantById(user.tenant_id) : null;
    return !!tenant && tenant.reseller_id === req.session.reseller_id;
  }
  return false;
}

// Session validation middleware
// Accepts Authorization: Bearer <session-token> header
const requireSession = (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, errors: ['Missing or invalid session token'] });
  }
  const token = authHeader.substring(7);
  const session = validateSession(token);
  if (!session) {
    return res.status(401).json({ success: false, errors: ['Session expired or invalid. Please log in again.'] });
  }
  req.session = session;
  req.userId = session.user_id;
  req.tenantId = session.tenant_id;
  req.resellerId = session.reseller_id;
  req.role = session.role;
  next();
};

// Central session guard: protect all /api routes except a public whitelist.
// req.path here is relative to the /api mount (e.g. /config, /users/login).
const PUBLIC_API_PREFIXES = [
  '/config',
  '/validate-afm',
  '/users/login',
  '/users/logout',
  '/users/me',
  '/invoices/issue',        // protected by API key auth (apiKeyAuth)
  '/invoices/issue-public',
  '/invoices/issue-web', // public direct AADE
];
app.use('/api', (req, res, next) => {
  if (PUBLIC_API_PREFIXES.some(p => req.path === p || req.path.startsWith(p + '/'))) {
    return next();
  }
  return requireSession(req, res, next);
});

async function start() {
  logger.info('Starting AADE myDATA Provider...', { port: PORT });
  
  console.log('Initializing database...');
  await initDatabase();
  console.log('Database ready.');

  // Setup TLS if certificates exist
  if (tlsManager.hasCertificates()) {
    const tlsInfo = tlsManager.getCertificateInfo();
    logger.info('TLS certificates found', { certPath: tlsInfo.certPath, keyPath: tlsInfo.keyPath, validFrom: tlsInfo.validFrom, validTo: tlsInfo.validTo });
  } else {
    logger.warn('No TLS certificates found. Running on HTTP only.');
    logger.info('To generate self-signed certs: tlsManager.generateCertificates()');
  }

  // Log encryption status
  logger.info('Encryption status', aesEncryption.getStatus());

  // Log WORM storage status
  const wormStats = wormStorage.getStatistics();
  logger.info('WORM storage initialized', wormStats);

  // Log QSeal service status
  logger.info('QSeal service status', qsealService.getStatus());

  app.get('/api/config', (_req, res) => {
    res.json(getConfigStatus());
  });

  // Security Health Endpoint
  app.get('/api/security/health', (_req, res) => {
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      encryption: aesEncryption.getStatus(),
      tls: tlsManager.getCertificateInfo(),
      worm: wormStorage.getStatistics(),
      qseal: qsealService.getStatus(),
      logging: logger.getStats(),
    });
  });

  app.get('/api/validate-afm/:afm', (req, res) => {
    const result = validateGreekAFM(req.params.afm);
    res.json(result);
  });

  app.post('/api/invoices/issue-public', async (req, res) => {
    try {
      const { credentials, ...invoiceData } = req.body;
      const result = await issueInvoice(invoiceData, credentials);
      res.json({
        success: result.success,
        uuid: result.uuid,
        id: result.id,
        hash: result.hash,
        mark: result.mark || null,
        invoiceUid: result.invoiceUid || null,
        statusCode: result.statusCode || null,
        qrUrl: result.qrUrl || null,
        errors: result.errors || [],
        xml: result.xml,
        rawResponse: result.rawResponse || null,
      });
    } catch (err: any) {
      console.error('[Server] Invoice issue error:', err.message);
      res.status(400).json({ success: false, errors: [err.message] });
    }
  });

  app.get('/api/invoices', (req: any, res) => {
    try {
      let invoices = getInvoices();
      const allowed = scopedTenantIds(req);
      if (allowed !== null) invoices = invoices.filter(i => allowed.includes(i.tenant_id));
      res.json(invoices);
    } catch (err: any) {
      res.status(500).json({ success: false, errors: [err.message] });
    }
  });

  app.get('/api/invoices/:id', (req: any, res) => {
    try {
      const invoice = getInvoice(parseInt(req.params.id, 10));
      if (!invoice) {
        return res.status(404).json({ success: false, errors: ['Invoice not found'] });
      }
      if (invoice.tenant_id && !canAccessTenant(req, invoice.tenant_id)) {
        return res.status(403).json({ success: false, errors: ['No access to this invoice'] });
      }
      res.json(invoice);
    } catch (err: any) {
      res.status(500).json({ success: false, errors: [err.message] });
    }
  });

  // ============ NEW ENDPOINTS v2.0.2 ============
  
  // GET /api/documents/transmitted - Query transmitted documents
  app.get('/api/documents/transmitted', async (req, res) => {
    try {
      const { issuerVat, mark, nextPartitionKey, nextRowKey } = req.query;
      const result = await requestTransmittedDocs({
        issuerVat: issuerVat as string,
        mark: mark as string,
        nextPartitionKey: nextPartitionKey as string,
        nextRowKey: nextRowKey as string,
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, errors: [err.message] });
    }
  });

  // GET /api/receiver/info - Get recipient's delivery channels
  app.get('/api/receiver/info', async (req, res) => {
    try {
      const { vatNumber } = req.query;
      if (!vatNumber) {
        return res.status(400).json({ success: false, errors: ['VAT number is required'] });
      }
      const result = await requestReceiverInfo(vatNumber as string);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, errors: [err.message] });
    }
  });

  // ============ CANCEL DELIVERY/RECEIVING NOTES v2.0.2 ============
  
  // GET /api/delivery-notes/cancel - Cancel delivery note (10.1, 10.2)
  app.get('/api/delivery-notes/cancel', async (req, res) => {
    try {
      const { mark, entityVatNumber } = req.query;
      if (!mark || !entityVatNumber) {
        return res.status(400).json({ success: false, errors: ['MARK and entityVatNumber are required'] });
      }
      const result = await cancelDeliveryNote({
        mark: mark as string,
        entityVatNumber: entityVatNumber as string,
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, errors: [err.message] });
    }
  });

  // GET /api/receiving-notes/cancel - Cancel receiving note (10.1, 10.2) - v2.0.2 NEW
  app.get('/api/receiving-notes/cancel', async (req, res) => {
    try {
      const { mark, entityVatNumber } = req.query;
      if (!mark || !entityVatNumber) {
        return res.status(400).json({ success: false, errors: ['MARK and entityVatNumber are required'] });
      }
      const result = await cancelReceivingNote({
        mark: mark as string,
        entityVatNumber: entityVatNumber as string,
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, errors: [err.message] });
    }
  });

  // ============ STATEMENTS v2.0.2 ============
  
  // POST /api/statements - Submit B2B transaction statements
  app.post('/api/statements', async (req, res) => {
    try {
      const result = await sendStatement(req.body);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, errors: [err.message] });
    }
  });

  // GET /api/statements - Query submitted statements
  app.get('/api/statements', async (req, res) => {
    try {
      const { entityVatNumber, providerVatNumber, fromDate, toDate, nextPartitionKey, nextRowKey } = req.query;
      const result = await requestStatements({
        entityVatNumber: entityVatNumber as string,
        providerVatNumber: providerVatNumber as string,
        fromDate: fromDate as string,
        toDate: toDate as string,
        nextPartitionKey: nextPartitionKey as string,
        nextRowKey: nextRowKey as string,
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, errors: [err.message] });
    }
  });

  // GET /api/statements/recall - Recall a statement
  app.get('/api/statements/recall', async (req, res) => {
    try {
      const { stmtId, entityVatNumber, recallStatus, recallDate } = req.query;
      if (!stmtId || !entityVatNumber || !recallStatus) {
        return res.status(400).json({ success: false, errors: ['stmtId, entityVatNumber, and recallStatus are required'] });
      }
      const result = await recallStatement({
        stmtId: stmtId as string,
        entityVatNumber: entityVatNumber as string,
        recallStatus: Number(recallStatus),
        recallDate: recallDate as string,
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, errors: [err.message] });
    }
  });

  // ============ PAYMENT METHODS v2.0.2 ============
  
  // POST /api/payment-methods - Register payment methods
  app.post('/api/payment-methods', async (req, res) => {
    try {
      const result = await sendPaymentsMethod(req.body);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, errors: [err.message] });
    }
  });

  // ============ UNSIGNED INVOICES v2.0.2 ============
  
  // POST /api/invoices/unsigned - Submit unsigned invoices
  app.post('/api/invoices/unsigned', async (req, res) => {
    try {
      const { credentials, ...invoiceData } = req.body;
      const result = await sendUnsignedInvoices(invoiceData, credentials);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, errors: [err.message] });
    }
  });

  // ============ TENANT MANAGEMENT ============
  
  // GET /api/tenants - List tenants (role-scoped)
  app.get('/api/tenants', (req: any, res) => {
    try {
      let tenants = getAllTenants();
      const allowed = scopedTenantIds(req);
      if (allowed !== null) tenants = tenants.filter(t => allowed.includes(t.id));
      res.json({ success: true, tenants });
    } catch (err: any) {
      res.status(500).json({ success: false, errors: [err.message] });
    }
  });

  // GET /api/tenants/pending-approvals - PENDING tenants for admin
  app.get('/api/tenants/pending-approvals', requireAdmin, (_req, res) => {
    try {
      const tenants = getAllTenants().filter(t => t.status === 'PENDING');
      res.json({ success: true, tenants });
    } catch (err: any) {
      res.status(500).json({ success: false, errors: [err.message] });
    }
  });

  // PATCH /api/tenants/:id/approve - Approve a PENDING tenant (admin only)
  app.patch('/api/tenants/:id/approve', requireAdmin, (req: any, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const tenant = getTenantById(id);
      if (!tenant) return res.status(404).json({ success: false, errors: ['Tenant not found'] });
      updateTenantStatus(id, 'ACTIVE');
      logAudit({ userId: req.userId, action: 'TENANT_APPROVED', entityType: 'tenant', entityId: id, tenantId: id });
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ success: false, errors: [err.message] });
    }
  });

  // PATCH /api/tenants/:id/reject - Reject a PENDING tenant (admin only)
  app.patch('/api/tenants/:id/reject', requireAdmin, (req: any, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const tenant = getTenantById(id);
      if (!tenant) return res.status(404).json({ success: false, errors: ['Tenant not found'] });
      updateTenantStatus(id, 'REJECTED');
      logAudit({ userId: req.userId, action: 'TENANT_REJECTED', entityType: 'tenant', entityId: id, tenantId: id });
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ success: false, errors: [err.message] });
    }
  });

  // GET /api/tenants/:id - Get tenant by ID (role-scoped)
  app.get('/api/tenants/:id', (req: any, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (!canAccessTenant(req, id)) {
        return res.status(403).json({ success: false, errors: ['No access to this tenant'] });
      }
      const tenant = getTenantById(id);
      if (!tenant) {
        return res.status(404).json({ success: false, errors: ['Tenant not found'] });
      }
      res.json({ success: true, tenant });
    } catch (err: any) {
      res.status(500).json({ success: false, errors: [err.message] });
    }
  });

  // GET /api/tenants/vat/:vatNumber - Get tenant by VAT number
  app.get('/api/tenants/vat/:vatNumber', (req, res) => {
    try {
      const tenant = getTenantByVat(req.params.vatNumber);
      if (!tenant) {
        return res.status(404).json({ success: false, errors: ['Tenant not found'] });
      }
      if (!canAccessTenant(req, tenant.id)) {
        return res.status(403).json({ success: false, errors: ['No access to this tenant'] });
      }
      res.json({ success: true, tenant });
    } catch (err: any) {
      res.status(500).json({ success: false, errors: [err.message] });
    }
  });

  // POST /api/tenants - Create new tenant (admin or own reseller's reseller-admin)
  app.post('/api/tenants', async (req: any, res) => {
    try {
      const { company_name, vat_number, email, trade_title, tax_office, address, postal_code, city, country, phone, reseller_id } = req.body;
      
      if (!company_name || !vat_number || !email) {
        return res.status(400).json({ success: false, errors: ['company_name, vat_number, and email are required'] });
      }

      // Resellers can only create tenants under themselves; admin can set any reseller
      let finalResellerId: number | undefined = reseller_id || undefined;
      if (req.session.role === 'RESELLER_ADMIN') {
        finalResellerId = req.session.reseller_id;
      } else if (req.session.role === 'CLIENT_ADMIN' || req.session.role === 'USER') {
        return res.status(403).json({ success: false, errors: ['Only admins and resellers can create tenants'] });
      }

      const result = createTenant({
        company_name,
        vat_number,
        email,
        trade_title,
        tax_office,
        address,
        postal_code,
        city,
        country,
        phone,
        reseller_id: finalResellerId,
        status: 'PENDING',
      });
      
      logAudit({ userId: req.userId, action: 'TENANT_CREATED', entityType: 'tenant', entityId: result.id, tenantId: result.id, details: { company_name, vat_number, reseller_id: finalResellerId } });
      
      res.status(201).json({ success: true, tenantId: result.id, status: 'PENDING' });
    } catch (err: any) {
      res.status(400).json({ success: false, errors: [err.message] });
    }
  });

  // PATCH /api/tenants/:id/status - Update tenant status (admin, or reseller own tenant)
  app.patch('/api/tenants/:id/status', (req: any, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (!['SUPER_ADMIN', 'RESELLER_ADMIN'].includes(req.session.role)) {
        return res.status(403).json({ success: false, errors: ['Administrator access required'] });
      }
      if (!canAccessTenant(req, id)) {
        return res.status(403).json({ success: false, errors: ['No access to this tenant'] });
      }
      const { status } = req.body;
      if (!['PENDING', 'ACTIVE', 'REJECTED', 'SUSPENDED'].includes(status)) {
        return res.status(400).json({ success: false, errors: ['Invalid tenant status'] });
      }
      
      updateTenantStatus(id, status);
      logAudit({ userId: req.userId, action: 'TENANT_STATUS_CHANGED', entityType: 'tenant', entityId: id, tenantId: id, details: { status } });
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ success: false, errors: [err.message] });
    }
  });

  // ============ TENANT CREDITS ============
  
  // GET /api/tenants/:id/credits - Get all credit wallets (tenant-level + per API key)
  app.get('/api/tenants/:id/credits', (req: any, res) => {
    try {
      const tenantId = parseInt(req.params.id, 10);
      if (!canAccessTenant(req, tenantId)) {
        return res.status(403).json({ success: false, errors: ['No access to this tenant'] });
      }
      const wallets = getAllCreditWalletsByTenant(tenantId);
      res.json({ 
        success: true, 
        wallets,
        credits: { balance: getCreditBalance(tenantId), expires_at: null } 
      });
    } catch (err: any) {
      res.status(500).json({ success: false, errors: [err.message] });
    }
  });

  // GET /api/tenants/:id/api-keys/:keyId/credits - Balance for one key's wallet
  app.get('/api/tenants/:id/api-keys/:keyId/credits', (req: any, res) => {
    try {
      const tenantId = parseInt(req.params.id, 10);
      const keyId = parseInt(req.params.keyId, 10);
      if (!canAccessTenant(req, tenantId)) {
        return res.status(403).json({ success: false, errors: ['No access to this tenant'] });
      }
      res.json({ success: true, balance: getCreditBalanceForKey(tenantId, keyId) });
    } catch (err: any) {
      res.status(500).json({ success: false, errors: [err.message] });
    }
  });

  // POST /api/tenants/:id/api-keys/:keyId/credits/add - Add credits to one key's wallet
  app.post('/api/tenants/:id/api-keys/:keyId/credits/add', (req: any, res) => {
    try {
      if (!['SUPER_ADMIN', 'RESELLER_ADMIN', 'CLIENT_ADMIN'].includes(req.session.role)) {
        return res.status(403).json({ success: false, errors: ['Tenant administrator access required'] });
      }
      const tenantId = parseInt(req.params.id, 10);
      const keyId = parseInt(req.params.keyId, 10);
      if (!canAccessTenant(req, tenantId)) {
        return res.status(403).json({ success: false, errors: ['No access to this tenant'] });
      }
      if (!getApiKeysByTenant(tenantId).some(key => key.id === keyId)) {
        return res.status(404).json({ success: false, errors: ['API key not found for this tenant'] });
      }
      const { amount, type, description, reference_id } = req.body;
      if (!amount || amount <= 0) {
        return res.status(400).json({ success: false, errors: ['amount must be positive'] });
      }
      addCreditsForKey(tenantId, keyId, amount, type || 'PURCHASE', description, reference_id);
      logAudit({ userId: req.userId, action: 'CREDITS_ADDED', entityType: 'api_key', entityId: keyId, tenantId, details: { amount } });
      res.json({ success: true, balance: getCreditBalanceForKey(tenantId, keyId) });
    } catch (err: any) {
      res.status(400).json({ success: false, errors: [err.message] });
    }
  });

  // GET /api/tenants/:id/credit-transactions - Get tenant credit transactions
  app.get('/api/tenants/:id/credit-transactions', (req: any, res) => {
    try {
      const tenantId = parseInt(req.params.id, 10);
      if (!canAccessTenant(req, tenantId)) {
        return res.status(403).json({ success: false, errors: ['No access to this tenant'] });
      }
      const limit = parseInt(req.query.limit as string) || 50;
      const keyId = req.query.api_key_id ? parseInt(req.query.api_key_id as string, 10) : undefined;
      const transactions = getCreditTransactions(tenantId, limit, keyId);
      res.json({ success: true, transactions });
    } catch (err: any) {
      res.status(500).json({ success: false, errors: [err.message] });
    }
  });

  // POST /api/tenants/:id/credits/add - Add credits to tenant (tenant-level wallet)
  app.post('/api/tenants/:id/credits/add', (req: any, res) => {
    try {
      if (!['SUPER_ADMIN', 'RESELLER_ADMIN', 'CLIENT_ADMIN'].includes(req.session.role)) {
        return res.status(403).json({ success: false, errors: ['Tenant administrator access required'] });
      }
      const tenantId = parseInt(req.params.id, 10);
      if (!canAccessTenant(req, tenantId)) {
        return res.status(403).json({ success: false, errors: ['No access to this tenant'] });
      }
      const { amount, type, description, reference_id } = req.body;
      
      if (!amount || amount <= 0) {
        return res.status(400).json({ success: false, errors: ['amount must be positive'] });
      }
      
      addCredits(tenantId, amount, type || 'PURCHASE', req.body.description, req.body.reference_id);
      logAudit({ userId: req.userId, action: 'CREDITS_ADDED', entityType: 'tenant', entityId: tenantId, tenantId, details: { amount } });
      const balance = getCreditBalance(tenantId);
      res.json({ success: true, balance });
    } catch (err: any) {
      res.status(400).json({ success: false, errors: [err.message] });
    }
  });

  // ============ API KEY MANAGEMENT ============
  
  // POST /api/tenants/:id/api-keys - Create API key
  app.post('/api/tenants/:id/api-keys', requireTenantAdmin, (req: any, res) => {
    try {
      const tenantId = parseInt(req.params.id, 10);
      if (!canAccessTenant(req, tenantId)) {
        return res.status(403).json({ success: false, errors: ['No access to this tenant'] });
      }
      const { name, aade_branch, default_series, environment, expires_at } = req.body;
      
      if (!req.body.name) {
        return res.status(400).json({ success: false, errors: ['name is required'] });
      }
      
      // Generate API key
      const keyPrefix = 'pk_' + (req.body.environment === 'SANDBOX' ? 'test_' : 'live_') + Math.random().toString(36).substring(2, 10);
      const rawKey = keyPrefix + '_' + Math.random().toString(36).substring(2, 20);
      const keyHash = createHash('sha256').update(rawKey).digest('hex');
      
      const result = createApiKey({
        tenant_id: tenantId,
        name: req.body.name,
        key_prefix: keyPrefix,
        key_hash: keyHash,
        aade_branch: req.body.aade_branch || 0,
        default_series: req.body.default_series,
        environment: req.body.environment || 'LIVE',
        expires_at: req.body.expires_at,
      });
      
      logAudit({ userId: req.userId, action: 'API_KEY_CREATED', entityType: 'api_key', entityId: result.id, tenantId, details: { name, prefix: keyPrefix } });
      
      res.status(201).json({ 
        success: true, 
        apiKey: { id: result.id, key: rawKey, prefix: keyPrefix },
        message: 'Save the key now - it will not be shown again!' 
      });
    } catch (err: any) {
      res.status(400).json({ success: false, errors: [err.message] });
    }
  });

  // GET /api/tenants/:id/api-keys - List API keys for tenant
  app.get('/api/tenants/:id/api-keys', (req: any, res) => {
    try {
      const tenantId = parseInt(req.params.id, 10);
      if (!canAccessTenant(req, tenantId)) {
        return res.status(403).json({ success: false, errors: ['No access to this tenant'] });
      }
      const keys = getApiKeysByTenant(tenantId);
      // Don't return the hash; include per-key credit balance
      const safeKeys = keys.map(k => ({ ...k, key_hash: undefined, credit_balance: getCreditBalanceForKey(tenantId, k.id) }));
      res.json({ success: true, keys: safeKeys });
    } catch (err: any) {
      res.status(500).json({ success: false, errors: [err.message] });
    }
  });

  // DELETE /api/tenants/:id/api-keys/:keyId - Deactivate API key
  app.delete('/api/tenants/:id/api-keys/:keyId', requireTenantAdmin, (req: any, res) => {
    try {
      const tenantId = parseInt(req.params.id, 10);
      const keyId = parseInt(req.params.keyId, 10);
      if (!canAccessTenant(req, tenantId)) {
        return res.status(403).json({ success: false, errors: ['No access to this tenant'] });
      }
      if (!getApiKeysByTenant(tenantId).some(key => key.id === keyId)) {
        return res.status(404).json({ success: false, errors: ['API key not found for this tenant'] });
      }
      deactivateApiKey(keyId);
      logAudit({ userId: req.userId, action: 'API_KEY_DEACTIVATED', entityType: 'api_key', entityId: keyId, tenantId });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, errors: [err.message] });
    }
  });

  // PATCH /api/tenants/:id/api-keys/:keyId - Update API key metadata
  app.patch('/api/tenants/:id/api-keys/:keyId', requireTenantAdmin, (req: any, res) => {
    try {
      const tenantId = parseInt(req.params.id, 10);
      const keyId = parseInt(req.params.keyId, 10);
      if (!canAccessTenant(req, tenantId)) {
        return res.status(403).json({ success: false, errors: ['No access to this tenant'] });
      }
      const keys = getApiKeysByTenant(tenantId);
      const key = keys.find(k => k.id === keyId);
      if (!key) return res.status(404).json({ success: false, errors: ['API key not found for this tenant'] });
      const allowed = ['name', 'aade_branch', 'default_series', 'environment'];
      const updates: any = {};
      for (const f of allowed) {
        if (req.body[f] !== undefined) updates[f] = req.body[f];
      }
      if (updates.environment && !['LIVE', 'SANDBOX'].includes(updates.environment)) {
        return res.status(400).json({ success: false, errors: ['environment must be LIVE or SANDBOX'] });
      }
      updateApiKey(keyId, updates);
      logAudit({ userId: req.userId, action: 'API_KEY_UPDATED', entityType: 'api_key', entityId: keyId, tenantId, details: updates });
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ success: false, errors: [err.message] });
    }
  });

  // ============ API KEY AUTH MIDDLEWARE ============

  // Middleware to authenticate API requests via API Key
  const apiKeyAuth = (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, errors: ['Missing or invalid Authorization header'] });
    }
    
    const apiKey = authHeader.substring(7); // Remove 'Bearer '
    const keyHash = createHash('sha256').update(apiKey).digest('hex');
    
    const apiKeyRecord = getApiKeyByHash(keyHash);
    if (!apiKeyRecord) {
      return res.status(401).json({ success: false, errors: ['Invalid API key'] });
    }
    
    if (apiKeyRecord.expires_at && new Date(apiKeyRecord.expires_at) < new Date()) {
      return res.status(401).json({ success: false, errors: ['API key expired'] });
    }
    
    // Attach tenant and api key info to request
    req.apiKey = apiKeyRecord;
    req.tenantId = apiKeyRecord.tenant_id;
    req.aadeBranch = apiKeyRecord.aade_branch;
    req.defaultSeries = apiKeyRecord.default_series;
    
    next();
  };

  // Apply API key auth to invoice issuance endpoint
  app.post('/api/invoices/issue', apiKeyAuth, async (req: any, res) => {
    try {
      const { credentials, ...invoiceData } = req.body;
      
      // Override with API key credentials
      const apiKey = req.apiKey;
      const credentialsOverride = {
        userId: apiKey.tenant_id.toString(),
        subscriptionKey: apiKey.key_hash,
      };
      
      // Set tenant context
      invoiceData.tenant_id = req.tenantId;
      invoiceData.api_key_id = apiKey.id;
      invoiceData.aade_branch = req.aadeBranch || 0;
      if (req.defaultSeries && !invoiceData.series) {
        invoiceData.series = req.defaultSeries;
      }
      
      // Block PENDING / REJECTED tenants
      const tenant = getTenantById(req.tenantId);
      if (!tenant || tenant.status !== 'ACTIVE') {
        return res.status(403).json({ success: false, errors: ['Tenant is not active or has been rejected'] });
      }
      
      // Check per-key credit balance (including expiry)
      const hasCredits = req.tenantId ? hasValidCredits(req.tenantId, 1, apiKey.id) : true;
      if (!hasCredits) {
        return res.status(402).json({ success: false, errors: ['Insufficient credits in this API key wallet'] });
      }
      
      const result = await issueInvoice(invoiceData, credentialsOverride);
      
      // Use credits from the same key's wallet
      if (req.tenantId) {
        const creditUsed = useCredits(req.tenantId, 1, `INVOICE_USAGE`, `Invoice ${result.mark || result.id}`, apiKey.id);
        if (!creditUsed) {
          console.warn(`Tenant ${req.tenantId} has insufficient credits after check`);
          return res.status(402).json({ success: false, errors: ['Insufficient credits in this API key wallet'] });
        }
      }

      logAudit({ userId: undefined as number | undefined, apiKeyId: apiKey.id, tenantId: req.tenantId, action: 'INVOICE_ISSUED', entityType: 'invoice', entityId: result.id, details: { mark: result.mark, invoiceType: invoiceData.invoiceType, success: result.success } });

      // Fire webhook if configured
      if (req.tenantId) {
        try {
          const hooks = getWebhookEndpointsByTenant(req.tenantId);
          for (const hook of hooks) {
            if (!hook.is_active) continue;
            const events = hook.events && typeof hook.events === 'string' ? JSON.parse(hook.events) : (hook.events || ['invoice.issued']);
            const eventName = result.success ? 'invoice.issued' : 'invoice.failed';
            if (!events.includes(eventName)) continue;
            const payload = {
              event: eventName,
              tenant_id: req.tenantId,
              data: { mark: result.mark, id: result.id, uuid: result.uuid, invoiceType: invoiceData.invoiceType, success: result.success, errors: result.errors },
              timestamp: new Date().toISOString(),
            };
            try {
              const whRes = await fetch(hook.url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Webhook-Signature': createHash('sha256').update(JSON.stringify(payload) + hook.secret).digest('hex') },
                body: JSON.stringify(payload),
              });
              const body = await whRes.text();
              logWebhookDelivery({ webhook_endpoint_id: hook.id, event_type: eventName, payload, response_status: whRes.status, response_body: body });
            } catch (whErr: any) {
              logWebhookDelivery({ webhook_endpoint_id: hook.id, event_type: eventName, payload, response_status: 0, response_body: whErr.message });
            }
          }
        } catch (whErr: any) {
          console.error('[Server] Webhook dispatch error:', whErr.message);
        }
      }
      
      res.json({
        success: result.success,
        uuid: result.uuid,
        id: result.id,
        hash: result.hash,
        mark: result.mark || null,
        invoiceUid: result.invoiceUid || null,
        statusCode: result.statusCode || null,
        qrUrl: result.qrUrl || null,
        errors: result.errors || [],
        xml: result.xml,
        rawResponse: result.rawResponse || null,
      });
    } catch (err: any) {
      console.error('[Server] Invoice issue error:', err.message);
      res.status(400).json({ success: false, errors: [err.message] });
    }
  });

  // Session-authenticated web issue: selects per-key wallet via req.body.api_key_id
  app.post('/api/invoices/issue-web', requireSession, async (req: any, res) => {
    try {
      const { credentials, api_key_id, ...invoiceData } = req.body;
      if (!req.tenantId) {
        return res.status(403).json({ success: false, errors: ['User has no tenant assignment'] });
      }
      if (!canAccessTenant(req, req.tenantId)) {
        return res.status(403).json({ success: false, errors: ['No access to this tenant'] });
      }

      // Resolve key's wallet (super-admin can use any key)
      let targetKeyId: number | null = api_key_id ? parseInt(String(api_key_id), 10) : null;
      if (targetKeyId && req.session.role !== 'SUPER_ADMIN') {
        const keys = getApiKeysByTenant(req.tenantId);
        const key = keys.find(k => k.id === targetKeyId);
        if (!key) return res.status(400).json({ success: false, errors: ['Invalid api_key_id'] });
      }

      const hasCredits = req.tenantId ? hasValidCredits(req.tenantId, 1, targetKeyId ?? undefined) : true;
      if (!hasCredits) {
        return res.status(402).json({ success: false, errors: ['Insufficient credits in selected wallet'] });
      }

      invoiceData.tenant_id = req.tenantId;
      invoiceData.api_key_id = targetKeyId;
      invoiceData.aade_branch = invoiceData.aade_branch || 0;
      const result = await issueInvoice(invoiceData, credentials);

      if (targetKeyId) {
        const creditUsed = useCredits(req.tenantId, 1, 'INVOICE_USAGE', `Invoice ${result.mark || result.id}`, targetKeyId);
        if (!creditUsed) {
          return res.status(402).json({ success: false, errors: ['Insufficient credits in selected wallet'] });
        }
      }

      logAudit({ userId: req.userId, action: 'INVOICE_ISSUED', entityType: 'invoice', entityId: result.id, tenantId: req.tenantId, details: { mark: result.mark, invoiceType: invoiceData.invoiceType, success: result.success, apiKeyId: targetKeyId } });

      res.json({
        success: result.success,
        uuid: result.uuid,
        id: result.id,
        hash: result.hash,
        mark: result.mark || null,
        invoiceUid: result.invoiceUid || null,
        statusCode: result.statusCode || null,
        qrUrl: result.qrUrl || null,
        errors: result.errors || [],
        xml: result.xml,
        rawResponse: result.rawResponse || null,
      });
    } catch (err: any) {
      console.error('[Server] Invoice issue-web error:', err.message);
      res.status(400).json({ success: false, errors: [err.message] });
    }
  });

  // Keep the original endpoint for backward compatibility (with optional auth)
  app.post('/api/invoices/issue-public', async (req, res) => {
    try {
      const { credentials, ...invoiceData } = req.body;
      const result = await issueInvoice(invoiceData, credentials);
      res.json({
        success: result.success,
        uuid: result.uuid,
        id: result.id,
        hash: result.hash,
        mark: result.mark || null,
        invoiceUid: result.invoiceUid || null,
        statusCode: result.statusCode || null,
        qrUrl: result.qrUrl || null,
        errors: result.errors || [],
        xml: result.xml,
        rawResponse: result.rawResponse || null,
      });
    } catch (err: any) {
      console.error('[Server] Invoice issue error:', err.message);
      res.status(400).json({ success: false, errors: [err.message] });
    }
  });

  // ============ RESELLER MANAGEMENT ============
  
  // GET /api/resellers - List all resellers
  app.get('/api/resellers', requireAdmin, (_req, res) => {
    try {
      const resellers = getAllResellers();
      res.json({ success: true, resellers });
    } catch (err: any) {
      res.status(500).json({ success: false, errors: [err.message] });
    }
  });

  // POST /api/resellers - Create reseller
  app.post('/api/resellers', requireAdmin, async (req, res) => {
    try {
      const { name, vat_number, email, commission_rate } = req.body;
      if (!name || !vat_number || !email) {
        return res.status(400).json({ success: false, errors: ['name, vat_number, and email are required'] });
      }
      if (commission_rate !== undefined && (!Number.isFinite(Number(commission_rate)) || Number(commission_rate) < 0 || Number(commission_rate) > 100)) {
        return res.status(400).json({ success: false, errors: ['commission_rate must be between 0 and 100'] });
      }
      const result = createReseller({ name, vat_number, email, commission_rate });
      logAudit({ userId: (req as any).userId, action: 'RESELLER_CREATED', entityType: 'reseller', entityId: result.id, details: { name, vat_number } });
      res.status(201).json({ success: true, resellerId: result.id });
    } catch (err: any) {
      res.status(400).json({ success: false, errors: [err.message] });
    }
  });

  // GET /api/resellers/:id - Get reseller by ID
  app.get('/api/resellers/:id', requireAdmin, (req, res) => {
    try {
      const reseller = getResellerById(parseInt(req.params.id, 10));
      if (!reseller) return res.status(404).json({ success: false, errors: ['Reseller not found'] });
      res.json({ success: true, reseller });
    } catch (err: any) {
      res.status(500).json({ success: false, errors: [err.message] });
    }
  });

  // PATCH /api/resellers/:id - Update reseller
  app.patch('/api/resellers/:id', requireAdmin, (req: any, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (!getResellerById(id)) return res.status(404).json({ success: false, errors: ['Reseller not found'] });
      if (req.body.commission_rate !== undefined && (!Number.isFinite(Number(req.body.commission_rate)) || Number(req.body.commission_rate) < 0 || Number(req.body.commission_rate) > 100)) {
        return res.status(400).json({ success: false, errors: ['commission_rate must be between 0 and 100'] });
      }
      updateReseller(id, req.body);
      logAudit({ userId: req.userId, action: 'RESELLER_UPDATED', entityType: 'reseller', entityId: id });
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ success: false, errors: [err.message] });
    }
  });

  // DELETE /api/resellers/:id - Delete reseller
  app.delete('/api/resellers/:id', requireAdmin, (req: any, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      updateReseller(id, { is_active: false });
      logAudit({ userId: req.userId, action: 'RESELLER_DEACTIVATED', entityType: 'reseller', entityId: id });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, errors: [err.message] });
    }
  });

  // ============ USER MANAGEMENT ============
  
  // GET /api/users - List all users
  app.get('/api/users', requireTenantAdmin, (req: any, res) => {
    try {
      const users = getAllUsers().filter(user => canManageUser(req, user));
      // Don't return password hashes
      const safeUsers = users.map(u => { const { password_hash, ...rest } = u; return rest; });
      res.json({ success: true, users: safeUsers });
    } catch (err: any) {
      res.status(500).json({ success: false, errors: [err.message] });
    }
  });

  // GET /api/users/email/:email - Get user by email
  app.get('/api/users/email/:email', requireTenantAdmin, (req: any, res) => {
    try {
      const user = getUserByEmail(req.params.email);
      if (!user) return res.status(404).json({ success: false, errors: ['User not found'] });
      if (!canManageUser(req, user)) return res.status(403).json({ success: false, errors: ['No access to this user'] });
      const { password_hash, ...safe } = user;
      res.json({ success: true, user: safe });
    } catch (err: any) {
      res.status(500).json({ success: false, errors: [err.message] });
    }
  });

  // POST /api/users - Create user
  app.post('/api/users', requireTenantAdmin, async (req: any, res) => {
    try {
      const { email, password_hash, first_name, last_name } = req.body;
      let { role, tenant_id, reseller_id } = req.body;
      if (!email || !password_hash) {
        return res.status(400).json({ success: false, errors: ['email and password_hash are required'] });
      }
      role = role || 'CLIENT_ADMIN';
      if (!['SUPER_ADMIN', 'RESELLER_ADMIN', 'CLIENT_ADMIN', 'USER'].includes(role)) {
        return res.status(400).json({ success: false, errors: ['Invalid user role'] });
      }
      if (req.session.role !== 'SUPER_ADMIN' && role === 'SUPER_ADMIN') {
        return res.status(403).json({ success: false, errors: ['Only a super admin can create super admins'] });
      }
      if (req.session.role === 'CLIENT_ADMIN') {
        if (!['USER', 'CLIENT_ADMIN'].includes(role)) {
          return res.status(403).json({ success: false, errors: ['Client admins cannot create reseller or super admins'] });
        }
        if (tenant_id && Number(tenant_id) !== req.session.tenant_id) {
          return res.status(403).json({ success: false, errors: ['You can only manage users in your tenant'] });
        }
        tenant_id = req.session.tenant_id;
        reseller_id = undefined;
      } else if (req.session.role === 'RESELLER_ADMIN') {
        reseller_id = req.session.reseller_id;
        if (tenant_id) {
          const tenant = getTenantById(Number(tenant_id));
          if (!tenant || tenant.reseller_id !== req.session.reseller_id) {
            return res.status(403).json({ success: false, errors: ['Tenant is outside your reseller'] });
          }
        }
      }
      const existing = getUserByEmail(email);
      if (existing) {
        return res.status(400).json({ success: false, errors: ['Email already registered'] });
      }
      const result = createUser({ email, password_hash, first_name, last_name, role, tenant_id, reseller_id });
      logAudit({ userId: (req as any).userId, action: 'USER_CREATED', entityType: 'user', entityId: result.id, tenantId: tenant_id, details: { email, role } });
      res.status(201).json({ success: true, userId: result.id });
    } catch (err: any) {
      res.status(400).json({ success: false, errors: [err.message] });
    }
  });

  // PUT /api/users/:id - Update user profile and role within the caller's scope.
  app.put('/api/users/:id', requireTenantAdmin, (req: any, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const existing = getUserById(id);
      if (!existing) return res.status(404).json({ success: false, errors: ['User not found'] });
      if (!canManageUser(req, existing)) {
        return res.status(403).json({ success: false, errors: ['No access to this user'] });
      }

      const updates = { ...req.body };
      delete updates.password;
      delete updates.password_hash;
      if (updates.role && !['SUPER_ADMIN', 'RESELLER_ADMIN', 'CLIENT_ADMIN', 'USER'].includes(updates.role)) {
        return res.status(400).json({ success: false, errors: ['Invalid user role'] });
      }
      if (req.session.role !== 'SUPER_ADMIN' && updates.role === 'SUPER_ADMIN') {
        return res.status(403).json({ success: false, errors: ['Only a super admin can assign the super admin role'] });
      }
      if (req.session.role === 'CLIENT_ADMIN') {
        if (updates.role && !['USER', 'CLIENT_ADMIN'].includes(updates.role)) {
          return res.status(403).json({ success: false, errors: ['Client admins cannot assign reseller or super admin roles'] });
        }
        if (updates.tenant_id !== undefined && Number(updates.tenant_id) !== req.session.tenant_id) {
          return res.status(403).json({ success: false, errors: ['You can only manage users in your tenant'] });
        }
        updates.tenant_id = req.session.tenant_id;
        updates.reseller_id = null;
      } else if (req.session.role === 'RESELLER_ADMIN') {
        if (updates.tenant_id) {
          const tenant = getTenantById(Number(updates.tenant_id));
          if (!tenant || tenant.reseller_id !== req.session.reseller_id) {
            return res.status(403).json({ success: false, errors: ['Tenant is outside your reseller'] });
          }
        }
        updates.reseller_id = req.session.reseller_id;
      }
      updateUser(id, updates);
      logAudit({ userId: req.userId, action: 'USER_UPDATED', entityType: 'user', entityId: id, details: { email: updates.email, role: updates.role } });
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ success: false, errors: [err.message] });
    }
  });

  // POST /api/users/login - Login user
  app.post('/api/users/login', (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ success: false, errors: ['email and password are required'] });
      }
      const user = getUserByEmail(email);
      if (!user || !user.is_active) {
        return res.status(401).json({ success: false, errors: ['Invalid credentials'] });
      }
      const expectedHash = createHash('sha256').update(password).digest('hex');
      if (user.password_hash !== expectedHash) {
        return res.status(401).json({ success: false, errors: ['Invalid credentials'] });
      }
      updateUserLastLogin(user.id);
      const { password_hash, ...safe } = user;
      const { token } = createSession(user.id);
      logAudit({ userId: user.id, action: 'USER_LOGIN', entityType: 'user', entityId: user.id, tenantId: user.tenant_id || undefined, details: { email, role: user.role, ip: req.ip } });
      res.json({ success: true, user: safe, token });
    } catch (err: any) {
      res.status(500).json({ success: false, errors: [err.message] });
    }
  });

  // GET /api/users/me - Return the current session's user (for init validation)
  app.get('/api/users/me', (req: any, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, errors: ['Missing token'] });
    }
    const session = validateSession(authHeader.substring(7));
    if (!session) {
      return res.status(401).json({ success: false, errors: ['Session expired or invalid'] });
    }
    const { password_hash, ...safe } = session;
    res.json({ success: true, user: safe });
  });

  // POST /api/users/logout - Logout / destroy session
  app.post('/api/users/logout', (req: any, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const session = validateSession(token);
      destroySession(token);
      if (session) {
        logAudit({ userId: session.user_id, action: 'USER_LOGOUT', entityType: 'session', entityId: 'self', details: { ip: req.ip } });
      }
    }
    res.json({ success: true });
  });

  // GET /api/audit-logs - List audit logs (admin only)
  app.get('/api/audit-logs', requireAdmin, (req: any, res) => {
    try {
      const filters = {
        tenantId: req.query.tenant_id ? parseInt(req.query.tenant_id as string, 10) : undefined,
        userId: req.query.user_id ? parseInt(req.query.user_id as string, 10) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      };
      const logs = getAuditLogs(filters);
      res.json({ success: true, logs });
    } catch (err: any) {
      res.status(500).json({ success: false, errors: [err.message] });
    }
  });

  // PATCH /api/users/:id/password - Update password
  app.patch('/api/users/:id/password', requireTenantAdmin, (req: any, res) => {
    try {
      const { password_hash } = req.body;
      if (!password_hash) {
        return res.status(400).json({ success: false, errors: ['password_hash is required'] });
      }
      const id = parseInt(req.params.id, 10);
      if (!canManageUser(req, getUserById(id))) {
        return res.status(403).json({ success: false, errors: ['No access to this user'] });
      }
      updateUserPassword(id, password_hash);
      logAudit({ userId: req.userId, action: 'USER_PASSWORD_CHANGED', entityType: 'user', entityId: id });
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ success: false, errors: [err.message] });
    }
  });

  // DELETE /api/users/:id - Deactivate user
  app.delete('/api/users/:id', requireTenantAdmin, (req: any, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (!canManageUser(req, getUserById(id))) {
        return res.status(403).json({ success: false, errors: ['No access to this user'] });
      }
      if (id === req.userId) {
        return res.status(400).json({ success: false, errors: ['You cannot deactivate your own account'] });
      }
      deactivateUser(id);
      logAudit({ userId: req.userId, action: 'USER_DEACTIVATED', entityType: 'user', entityId: id });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, errors: [err.message] });
    }
  });

  // ============ WEBHOOK MANAGEMENT ============
  
  // GET /api/tenants/:id/webhooks - List webhooks for tenant
  app.get('/api/tenants/:id/webhooks', (req, res) => {
    try {
      if (!canAccessTenant(req, parseInt(req.params.id, 10))) {
        return res.status(403).json({ success: false, errors: ['No access to this tenant'] });
      }
      const hooks = getWebhookEndpointsByTenant(parseInt(req.params.id, 10));
      res.json({ success: true, webhooks: hooks });
    } catch (err: any) {
      res.status(500).json({ success: false, errors: [err.message] });
    }
  });

  // POST /api/tenants/:id/webhooks - Create webhook endpoint
  app.post('/api/tenants/:id/webhooks', (req, res) => {
    try {
      const tenantId = parseInt(req.params.id, 10);
      if (!canAccessTenant(req, tenantId)) {
        return res.status(403).json({ success: false, errors: ['No access to this tenant'] });
      }
      const { url, secret, events } = req.body;
      if (!url || !secret || !events) {
        return res.status(400).json({ success: false, errors: ['url, secret, and events are required'] });
      }
      const result = createWebhookEndpoint({ tenant_id: tenantId, url, secret, events });
      logAudit({ userId: (req as any).userId, action: 'WEBHOOK_CREATED', entityType: 'webhook', entityId: result.id, tenantId, details: { url } });
      res.status(201).json({ success: true, webhookId: result.id });
    } catch (err: any) {
      res.status(400).json({ success: false, errors: [err.message] });
    }
  });

  // DELETE /api/tenants/:id/webhooks/:webhookId - Deactivate webhook
  app.delete('/api/tenants/:id/webhooks/:webhookId', (req: any, res) => {
    try {
      const tenantId = parseInt(req.params.id, 10);
      if (!canAccessTenant(req, tenantId)) {
        return res.status(403).json({ success: false, errors: ['No access to this tenant'] });
      }
      const id = parseInt(req.params.webhookId, 10);
      if (!getWebhookEndpointsByTenant(tenantId).some(hook => hook.id === id)) {
        return res.status(404).json({ success: false, errors: ['Webhook not found for this tenant'] });
      }
      deactivateWebhookEndpoint(id);
      logAudit({ userId: req.userId, action: 'WEBHOOK_DELETED', entityType: 'webhook', entityId: id, tenantId: parseInt(req.params.id, 10) });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, errors: [err.message] });
    }
  });

  // GET /api/tenants/:id/webhooks/:webhookId/deliveries - Get webhook delivery history
  app.get('/api/tenants/:id/webhooks/:webhookId/deliveries', (req, res) => {
    try {
      const tenantId = parseInt(req.params.id, 10);
      if (!canAccessTenant(req, tenantId)) {
        return res.status(403).json({ success: false, errors: ['No access to this tenant'] });
      }
      if (!getWebhookEndpointsByTenant(tenantId).some(hook => hook.id === parseInt(req.params.webhookId, 10))) {
        return res.status(404).json({ success: false, errors: ['Webhook not found for this tenant'] });
      }
      const deliveries = getWebhookDeliveries(parseInt(req.params.webhookId, 10));
      res.json({ success: true, deliveries });
    } catch (err: any) {
      res.status(500).json({ success: false, errors: [err.message] });
    }
  });

  // ============ TENANT FULL UPDATE ============
  
  // PUT /api/tenants/:id - Full tenant update
  app.put('/api/tenants/:id', requireTenantAdmin, (req: any, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (!canAccessTenant(req, id)) {
        return res.status(403).json({ success: false, errors: ['No access to this tenant'] });
      }
      if (req.session.role === 'RESELLER_ADMIN' && 'reseller_id' in req.body) {
        return res.status(403).json({ success: false, errors: ['Only a super admin can reassign a tenant'] });
      }
      if (req.body.reseller_id != null && !getResellerById(Number(req.body.reseller_id))) {
        return res.status(400).json({ success: false, errors: ['Reseller not found'] });
      }
      updateTenant(id, req.body);
      logAudit({ userId: req.userId, action: 'TENANT_UPDATED', entityType: 'tenant', entityId: id, tenantId: id });
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ success: false, errors: [err.message] });
    }
  });

  // ============ HEALTH ENDPOINTS ============
  
  app.get('/healthz', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.get('/', (_req, res) => {
    res.sendFile(join(publicDir, 'index.html'));
  });

  // Explicit SPA page routes (must come BEFORE wildcard *)
  const pageRoutes = [
    '/dashboard', '/invoices', '/issue', '/tenants', '/users',
    '/api-keys', '/credits', '/webhooks', '/resellers', '/audit', '/settings'
  ];
  for (const route of pageRoutes) {
    app.get(route, (_req, res) => {
      const pageName = route.replace('/', '');
      res.sendFile(join(publicDir, 'pages', pageName + '.html'));
    });
  }

  // SPA fallback for any other client-side routes
  app.get('*', (_req, res) => {
    res.sendFile(join(publicDir, 'index.html'));
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[YPAIES Provider] Running on http://localhost:${PORT}`);
    console.log(`[YPAIES Provider] Mock mode: ${process.env.AADE_MOCK === 'true' ? 'ENABLED' : 'DISABLED'}`);
  }).on('error', (err) => {
    console.error('Server error:', err);
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
