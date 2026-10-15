// API Calls for AADE myDATA Provider UI

const API_BASE = '/api';
let sessionExpiredNotified = false;

// Attach the current session token to every /api request.
const realFetch = window.fetch.bind(window);
window.fetch = async (url, options = {}) => {
  if (typeof url === 'string' && url.includes(API_BASE)) {
    const saved = localStorage.getItem('ypah_session');
    if (saved) {
      try {
        const s = JSON.parse(saved);
        if (s.token) {
          options.headers = { ...(options.headers || {}) };
          options.headers['Authorization'] = 'Bearer ' + s.token;
        }
      } catch (_) { /* ignore */ }
    }
  }
  const res = await realFetch(url, options);
  if (res.status === 401 && typeof url === 'string' && url.includes(API_BASE)
      && !url.includes('/users/login') && !url.includes('/users/logout')
      && !url.includes('/users/me')) {
    localStorage.removeItem('ypah_session');
    if (!sessionExpiredNotified) {
      sessionExpiredNotified = true;
      window.dispatchEvent(new CustomEvent('session-expired'));
    }
  }
  return res;
};

//Expose api functions to window for Alpine inline code
window.api = {
  fetchConfig,
  validateAFM,
  issueInvoice,
  getInvoices,
  getInvoice,
  getTransmittedDocs,
  getReceiverInfo,
  cancelDeliveryNote,
  cancelReceivingNote,
  sendStatement,
  getStatements,
  recallStatement,
  sendPaymentMethods,
  sendUnsignedInvoices,
  getTenants,
  getTenantById,
  getTenantByVat,
  createTenant,
  updateTenantStatus,
  getTenantCredits,
  getResellers,
  createReseller,
  updateReseller,
  deleteReseller,
  getUsers,
  getUserByEmail,
  createUser,
  loginUser,
  deleteUser,
  getWebhooks,
  createWebhook,
  deleteWebhook,
  getWebhookDeliveries,
  getApiKeys,
  createApiKey,
  deleteApiKey,
  addCreditsToTenant,
  getWallets,
  getApiKeyCredits,
  addCreditsToKey,
  getAuditLogs,
  getMe
};
window.api = {
  fetchConfig,
  validateAFM,
  issueInvoice,
  getInvoices,
  getInvoice,
  getTransmittedDocs,
  getReceiverInfo,
  cancelDeliveryNote,
  cancelReceivingNote,
  sendStatement,
  getStatements,
  recallStatement,
  sendPaymentMethods,
  sendUnsignedInvoices,
  getTenants,
  getTenantById,
  getTenantByVat,
  createTenant,
  updateTenantStatus,
  getTenantCredits,
  getResellers,
  createReseller,
  updateReseller,
  deleteReseller,
  getUsers,
  getUserByEmail,
  createUser,
  loginUser,
  deleteUser,
  getWebhooks,
  createWebhook,
  deleteWebhook,
  getWebhookDeliveries,
  getApiKeys,
  createApiKey,
  deleteApiKey,
  addCreditsToTenant,
  getWallets,
  getApiKeyCredits,
  addCreditsToKey,
  getAuditLogs,
  getMe
};

// Get server config
export async function fetchConfig() {
  const res = await fetch(`${API_BASE}/config`);
  if (!res.ok) throw new Error('Failed to fetch config');
  return res.json();
}

// Validate AFM
export async function validateAFM(afm) {
  const res = await fetch(`${API_BASE}/validate-afm/${encodeURIComponent(afm)}`);
  if (!res.ok) throw new Error('Failed to validate AFM');
  return res.json();
}

// Issue Invoice
export async function issueInvoice(invoiceData) {
  const res = await fetch(`${API_BASE}/invoices/issue-web`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(invoiceData),
  });
  if (!res.ok) throw new Error('Failed to issue invoice');
  return res.json();
}

// Get Invoice History
export async function getInvoices() {
  const res = await fetch(`${API_BASE}/invoices`);
  if (!res.ok) throw new Error('Failed to fetch invoices');
  return res.json();
}

// Get Invoice by ID
export async function getInvoice(id) {
  const res = await fetch(`${API_BASE}/invoices/${id}`);
  if (!res.ok) throw new Error('Failed to fetch invoice');
  return res.json();
}

// Get Transmitted Documents
export async function getTransmittedDocs(params = {}) {
  const query = new URLSearchParams(params).toString();
  const res = await fetch(`${API_BASE}/documents/transmitted?${query}`);
  if (!res.ok) throw new Error('Failed to fetch transmitted docs');
  return res.json();
}

// Get Receiver Info
export async function getReceiverInfo(vatNumber) {
  const res = await fetch(`${API_BASE}/receiver/info?vatNumber=${encodeURIComponent(vatNumber)}`);
  if (!res.ok) throw new Error('Failed to fetch receiver info');
  return res.json();
}

// Cancel Delivery Note
export async function cancelDeliveryNote(mark, entityVatNumber) {
  const res = await fetch(`${API_BASE}/delivery-notes/cancel?mark=${encodeURIComponent(mark)}&entityVatNumber=${encodeURIComponent(entityVatNumber)}`);
  if (!res.ok) throw new Error('Failed to cancel delivery note');
  return res.json();
}

// Cancel Receiving Note
export async function cancelReceivingNote(mark, entityVatNumber) {
  const res = await fetch(`${API_BASE}/receiving-notes/cancel?mark=${encodeURIComponent(mark)}&entityVatNumber=${encodeURIComponent(entityVatNumber)}`);
  if (!res.ok) throw new Error('Failed to cancel receiving note');
  return res.json();
}

// Send Statement
export async function sendStatement(params) {
  const res = await fetch(`${API_BASE}/statements`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error('Failed to send statement');
  return res.json();
}

// Get Statements
export async function getStatements(params = {}) {
  const query = new URLSearchParams(params).toString();
  const res = await fetch(`${API_BASE}/statements?${query}`);
  if (!res.ok) throw new Error('Failed to fetch statements');
  return res.json();
}

// Recall Statement
export async function recallStatement(params) {
  const query = new URLSearchParams(params).toString();
  const res = await fetch(`${API_BASE}/statements/recall?${query}`);
  if (!res.ok) throw new Error('Failed to recall statement');
  return res.json();
}

// Send Payment Methods
export async function sendPaymentMethods(methods) {
  const res = await fetch(`${API_BASE}/payment-methods`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ methods }),
  });
  if (!res.ok) throw new Error('Failed to send payment methods');
  return res.json();
}

// Send Unsigned Invoices
export async function sendUnsignedInvoices(invoiceData) {
  const res = await fetch(`${API_BASE}/invoices/unsigned`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(invoiceData),
  });
  if (!res.ok) throw new Error('Failed to send unsigned invoices');
  return res.json();
}

// ============ TENANT MANAGEMENT ============

// Get All Tenants
export async function getTenants() {
  const res = await fetch(`${API_BASE}/tenants`);
  if (!res.ok) throw new Error('Failed to fetch tenants');
  return res.json();
}

// Get Tenant by ID
export async function getTenantById(id) {
  const res = await fetch(`${API_BASE}/tenants/${id}`);
  if (!res.ok) throw new Error('Failed to fetch tenant');
  return res.json();
}

// Get Tenant by VAT
export async function getTenantByVat(vatNumber) {
  const res = await fetch(`${API_BASE}/tenants/vat/${encodeURIComponent(vatNumber)}`);
  if (!res.ok) throw new Error('Failed to fetch tenant');
  return res.json();
}

// Create Tenant
export async function createTenant(tenantData) {
  const res = await fetch(`${API_BASE}/tenants`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(tenantData),
  });
  if (!res.ok) throw new Error('Failed to create tenant');
  return res.json();
}

// Update Tenant Status
export async function updateTenantStatus(id, status) {
  const res = await fetch(`${API_BASE}/tenants/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error('Failed to update tenant status');
  return res.json();
}

export async function updateTenant(id, data) {
  const res = await fetch(`${API_BASE}/tenants/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update tenant');
  return res.json();
}

// Get Tenant Credits
export async function getTenantCredits(id) {
  const res = await fetch(`${API_BASE}/tenants/${id}/credits`);
  if (!res.ok) throw new Error('Failed to fetch tenant credits');
  return res.json();
}

// ============ RESELLER MANAGEMENT ============

export async function getResellers() {
  const res = await fetch(`${API_BASE}/resellers`);
  if (!res.ok) throw new Error('Failed to fetch resellers');
  return res.json();
}

export async function createReseller(data) {
  const res = await fetch(`${API_BASE}/resellers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create reseller');
  return res.json();
}

export async function updateReseller(id, data) {
  const res = await fetch(`${API_BASE}/resellers/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update reseller');
  return res.json();
}

export async function deleteReseller(id) {
  const res = await fetch(`${API_BASE}/resellers/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete reseller');
  return res.json();
}

// ============ USER MANAGEMENT ============

export async function getUsers() {
  const res = await fetch(`${API_BASE}/users`);
  if (!res.ok) throw new Error('Failed to fetch users');
  return res.json();
}

export async function getUserByEmail(email) {
  const res = await fetch(`${API_BASE}/users/email/${encodeURIComponent(email)}`);
  if (!res.ok) throw new Error('Failed to fetch user');
  return res.json();
}

export async function createUser(data) {
  const res = await fetch(`${API_BASE}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create user');
  return res.json();
}

export async function updateUser(id, data) {
  const res = await fetch(`${API_BASE}/users/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update user');
  return res.json();
}

export async function loginUser(data) {
  const res = await fetch(`${API_BASE}/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Login failed');
  const result = await res.json();
  if (result.success) sessionExpiredNotified = false;
  return result;
}

// Validate the current session token and return the user (used on init/reload)
export async function getMe() {
  const res = await fetch(`${API_BASE}/users/me`);
  if (!res.ok) throw new Error('Session invalid');
  return res.json();
}

export async function deleteUser(id) {
  const res = await fetch(`${API_BASE}/users/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete user');
  return res.json();
}

// ============ WEBHOOK MANAGEMENT ============

export async function getWebhooks(tenantId) {
  const res = await fetch(`${API_BASE}/tenants/${tenantId}/webhooks`);
  if (!res.ok) throw new Error('Failed to fetch webhooks');
  return res.json();
}

export async function createWebhook(tenantId, data) {
  const res = await fetch(`${API_BASE}/tenants/${tenantId}/webhooks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create webhook');
  return res.json();
}

export async function deleteWebhook(tenantId, webhookId) {
  const res = await fetch(`${API_BASE}/tenants/${tenantId}/webhooks/${webhookId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete webhook');
  return res.json();
}

export async function getWebhookDeliveries(webhookId) {
  const res = await fetch(`${API_BASE}/tenants/${webhookId}/webhooks/${webhookId}/deliveries`);
  if (!res.ok) throw new Error('Failed to fetch deliveries');
  return res.json();
}

// ============ API KEY MANAGEMENT ============

export async function getApiKeys(tenantId) {
  const res = await fetch(`${API_BASE}/tenants/${tenantId}/api-keys`);
  if (!res.ok) throw new Error('Failed to fetch API keys');
  return res.json();
}

export async function createApiKey(tenantId, data) {
  const res = await fetch(`${API_BASE}/tenants/${tenantId}/api-keys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create API key');
  return res.json();
}

export async function deleteApiKey(tenantId, keyId) {
  const res = await fetch(`${API_BASE}/tenants/${tenantId}/api-keys/${keyId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to deactivate API key');
  return res.json();
}

export async function updateApiKey(tenantId, keyId, data) {
  const res = await fetch(`${API_BASE}/tenants/${tenantId}/api-keys/${keyId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update API key');
  return res.json();
}

// ============ CREDIT MANAGEMENT ============

export async function addCreditsToTenant(tenantId, amount) {
  const res = await fetch(`${API_BASE}/tenants/${tenantId}/credits/add`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount }),
  });
  if (!res.ok) throw new Error('Failed to add credits');
  return res.json();
}

// ============ RESSELLER / APPROVALS ============

export async function getPendingApprovals() {
  const res = await fetch(`${API_BASE}/tenants/pending-approvals`);
  if (!res.ok) throw new Error('Failed to fetch pending approvals');
  return res.json();
}

export async function approveTenant(tenantId) {
  const res = await fetch(`${API_BASE}/tenants/${tenantId}/approve`, { method: 'PATCH' });
  if (!res.ok) throw new Error('Failed to approve tenant');
  return res.json();
}

export async function rejectTenant(tenantId) {
  const res = await fetch(`${API_BASE}/tenants/${tenantId}/reject`, { method: 'PATCH' });
  if (!res.ok) throw new Error('Failed to reject tenant');
  return res.json();
}

// ============ PER-KEY CREDITS ============

export async function getWallets(tenantId) {
  const res = await fetch(`${API_BASE}/tenants/${tenantId}/credits`);
  if (!res.ok) throw new Error('Failed to fetch wallets');
  return res.json();
}

export async function getApiKeyCredits(tenantId, keyId) {
  const res = await fetch(`${API_BASE}/tenants/${tenantId}/api-keys/${keyId}/credits`);
  if (!res.ok) throw new Error('Failed to fetch key credits');
  return res.json();
}

export async function addCreditsToKey(tenantId, keyId, amount) {
  const res = await fetch(`${API_BASE}/tenants/${tenantId}/api-keys/${keyId}/credits/add`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount }),
  });
  if (!res.ok) throw new Error('Failed to add credits to key');
  return res.json();
}

// ============ AUDIT LOG ============

export async function getAuditLogs(filters = {}) {
  const query = new URLSearchParams(filters).toString();
  const res = await fetch(`${API_BASE}/audit-logs${query ? '?' + query : ''}`);
  if (!res.ok) throw new Error('Failed to fetch audit logs');
  return res.json();
}

// Make all API functions available on window for Alpine inline code
window.api = {
  fetchConfig,
  validateAFM,
  issueInvoice,
  getInvoices,
  getInvoice,
  getTransmittedDocs,
  getReceiverInfo,
  cancelDeliveryNote,
  cancelReceivingNote,
  sendStatement,
  getStatements,
  recallStatement,
  sendPaymentMethods,
  sendUnsignedInvoices,
  getTenants,
  getTenantById,
  getTenantByVat,
  createTenant,
  updateTenantStatus,
  getTenantCredits,
  getResellers,
  createReseller,
  updateReseller,
  deleteReseller,
  getUsers,
  getUserByEmail,
  createUser,
  loginUser,
  deleteUser,
  getWebhooks,
  createWebhook,
  deleteWebhook,
  getWebhookDeliveries,
  getApiKeys,
  createApiKey,
  deleteApiKey,
  addCreditsToTenant,
  getWallets,
  getApiKeyCredits,
  addCreditsToKey,
  getAuditLogs,
  getMe,
};
