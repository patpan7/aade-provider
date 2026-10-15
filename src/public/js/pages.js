// Page components for the multi-page UI
import * as api from './api.js';
import { VAT_RATES, calculateLineVAT, calculateTotals, generateHash, validateGreekAFM, getGreeceDate, formatNumber } from './utils.js';
console.log('[pages] loaded');
window.__pagesLoaded = true;
console.log('[pages] imports resolved, api=', typeof api, 'dashboardPage=', typeof window.dashboardPage);

// ============ ISSUE INVOICE ============
function issuePage() {
  return {
    invoice: null,
    includeCounterpart: true,
    issuing: false,
    result: null,
    computedHash: '',
    selectedKeyId: null,
    apiKeys: [],
    totals: { totalNet: 0, totalVat: 0, totalGross: 0, vatCategoryTotals: [] },
    invoiceTypes: [
      { value: '1.1', label: '1.1 Τιμολόγιο Πώλησης (B2B)' },
      { value: '1.2', label: '1.2 Τιμολόγιο Πώλησης / Ενδοκοινοτικές Παραδόσεις' },
      { value: '1.3', label: '1.3 Τιμολόγιο Έξοδου' },
      { value: '1.4', label: '1.4 Τιμολόγιο Τρίτες Χώρες' },
      { value: '2.1', label: '2.1 Τιμολόγιο Υπηρεσιών' },
      { value: '2.2', label: '2.2 Υπηρεσιών Ενδοκοινοτικές' },
      { value: '2.3', label: '2.3 Υπηρεσιών Τρίτες Χώρες' },
      { value: '5.1', label: '5.1 Πιστωτικό Πώλησης' },
      { value: '5.2', label: '5.2 Πιστωτικό Πώλησης Ενδοκοινοτ.' },
      { value: '5.3', label: '5.3 Πιστωτικό Πώλησης Έξοδος' },
      { value: '5.4', label: '5.4 Πιστωτικό Ενδ.' },
      { value: '5.5', label: '5.5 Πιστωτικό Αλλασσόμενη' },
      { value: '11.1', label: '11.1 Λιανική Αποδείξις (POS)' },
      { value: '11.2', label: '11.2 Λιανική Αποδείξις (E-Receipt)' },
    ],
    RETAIL: ['11.1','11.2','11.3','11.4','11.5'],
    dash: null,
    generatePDF: function() {
      if (!this.invoice) {
        alert('Δεν έχουμε δεδομένα για εκτύπωση');
        return;
      }
      // Call the API to issue the invoice
      this.issue();
    },
    generatePDF: function() {
      // Generate PDF from the current invoice
      // This function will be called when the user clicks the PDF button
      // It will trigger the API call to generate the invoice
      // and display the PDF in a new window or modal
      if (!this.invoice) {
        alert('Δεν έχουμε παρوّرisoInvoice, ώστε να εμφανιστεί κάτι');
        return;
      }
      // Trigger the issue function to generate the invoice
      this.issue();
    },

    get dashboard() {
      // Access shared dashboard state (for currentUser/tenant scoping)
      const el = document.querySelector('[x-data="dashboard()"]');
      return window.__dashboard || null;
    },
    get myTenant() {
      const d = window.__dashboard;
      if (this.tenantData) return this.tenantData;
      return d?.currentUser?.tenant_id ? (d.tenants?.find(t => t.id === d.currentUser.tenant_id) || null) : null;
    },
    get isRetail() { return this.RETAIL.includes(this.invoice.invoiceType); },
    get issuerVatValid() { return !this.invoice.issuer.vatNumber || validateGreekAFM(this.invoice.issuer.vatNumber).valid; },
    get counterpartVatValid() { return !this.invoice.counterpart.vatNumber || validateGreekAFM(this.invoice.counterpart.vatNumber).valid; },

    defaultInvoice() {
      const tenant = this.myTenant;
      return {
        invoiceType: '1.1',
        series: 'A',
        aa: 1,
        issueDate: getGreeceDate(),
        issueTime: '',
        currency: 'EUR',
        issuer: { vatNumber: tenant?.vat_number || '', country: tenant?.country || 'GR', branch: 0, name: tenant?.company_name || '', address: tenant?.address || '', postalCode: tenant?.postal_code || '', city: tenant?.city || '' },
        counterpart: { vatNumber: '', country: 'GR', branch: 0, name: '', address: '', postalCode: '', city: '' },
        paymentMethods: [{ type: '1', amount: 0, info: 'Τραπεζικός Λογαριασμός' }],
        lineItems: [{
          lineNum: 1,
          description: 'Πώληση Εμπορευμάτων',
          netValue: 100,
          vatCategory: '1',
          quantity: 1,
          measurementUnit: 1,
          incomeClassifications: [{ type: 'E3_561_001', category: 'category1_1', amount: 100 }]
        }]
      };
    },

    async init() {
      this.invoice = this.defaultInvoice();
      this.recalcTotals();
      // Load API keys for credit wallet selection
      const d = window.__dashboard;
      const tid = d?.currentUser?.tenant_id;
      if (tid) {
        try {
          const res = await api.getApiKeys(tid);
          this.apiKeys = res.keys || [];
        } catch(_) {}
        // Always load own tenant data for issuer pre-fill
        try {
          const tr = await api.getTenantById(tid);
          if (tr?.tenant) {
            this.tenantData = tr.tenant;
            this.setIssuerFromTenant(tr.tenant);
          }
        } catch(_) {}
      }
    },

    setIssuerFromTenant(tenant) {
      if (!tenant) return;
      const isGreek = (tenant.country || 'GR') === 'GR';
      this.invoice.issuer.vatNumber = tenant.vat_number || '';
      this.invoice.issuer.country = tenant.country || 'GR';
      // Greek issuers must NOT include name (AADE code 219) — only populate for foreign
      if (!isGreek) this.invoice.issuer.name = tenant.company_name || '';
      // Always populate display fields for printing
      this.invoice.issuer.address = tenant.address || '';
      this.invoice.issuer.postalCode = tenant.postal_code || '';
      this.invoice.issuer.city = tenant.city || '';
      this.recalcTotals();
    },

onTypeChange() {
      this.includeCounterpart = !this.isRetail;
    },

    onKeyChange() {
      if (!this.selectedKeyId) return;
      const key = this.apiKeys.find(k => k.id === this.selectedKeyId);
      if (!key) return;
      // Auto-fill series and branch from key config
      if (key.default_series) this.invoice.series = key.default_series;
      this.invoice.aade_branch = key.aade_branch ?? 0;
      this.recalcTotals();
    },

    loadPreset(type) {
      this.invoice = this.defaultInvoice();
      this.invoice.invoiceType = type;
      this.includeCounterpart = !this.isRetail;
      this.recalcTotals();
    },

    addLine() {
      const n = this.invoice.lineItems.length;
      this.invoice.lineItems.push({
        lineNum: n + 1,
        description: '',
        netValue: 0,
        vatCategory: '1',
        quantity: 1,
        measurementUnit: 1,
        incomeClassifications: [{ type: 'E3_561_001', category: 'category1_1', amount: 0 }]
      });
    },

    addClassification(lineIdx) {
      this.invoice.lineItems[lineIdx].incomeClassifications.push({ type: 'E3_561_001', category: 'category1_1', amount: 0 });
    },

    recalcLine(idx) {
      const line = this.invoice.lineItems[idx];
      const { vatAmount, grossValue } = calculateLineVAT(line.netValue || 0, line.vatCategory);
      line.vatAmount = vatAmount;
      line.grossValue = grossValue;
      // Keep classification amount in sync
      if (line.incomeClassifications.length) {
        line.incomeClassifications[0].amount = line.netValue || 0;
      }
      this.recalcTotals();
    },

    recalcTotals() {
      this.totals = calculateTotals(this.invoice.lineItems);
      if (this.invoice.paymentMethods[0]) {
        this.invoice.paymentMethods[0].amount = this.totals.totalGross;
      }
      this.scheduleHash();
    },

    scheduleHash() {
      clearTimeout(this._hashTimer);
      this._hashTimer = setTimeout(async () => {
        try {
          this.computedHash = await generateHash(this.invoice, this.totals);
        } catch(_) { this.computedHash = ''; }
      }, 250);
    },

    formatNumber,
    api,

    async issue() {
      this.issuing = true;
      this.result = null;
      try {
        const payload = {
          ...this.invoice,
          aa: Number(this.invoice.aa),
          issueDate: this.invoice.issueDate,
          lineItems: this.invoice.lineItems.map((l, i) => ({ ...l, lineNum: i + 1 })),
          paymentMethods: this.invoice.paymentMethods,
        };
        if (this.isRetail) {
          delete payload.counterpart;
          delete payload.counterpartVat;
        } else if (this.includeCounterpart) {
          payload.counterpart = this.invoice.counterpart;
        }
        if (this.selectedKeyId != null) {
          payload.api_key_id = this.selectedKeyId;
        }
        const res = await api.issueInvoice(payload);
        this.result = res;
      } catch (e) {
        this.result = { success: false, errors: [e.message] };
      } finally {
        this.issuing = false;
      }
    }
  };
}
window.issuePage = issuePage;

// ============ DASHBOARD ============
function dashboardPage() {
  return {
    stats: { tenants: 0, invoices: 0, users: 0, pending: 0, credits: 0 },
    recentInvoices: [],
    lowCredit: [],
    formatNumber,
    api,
    async init() {
      const d = window.__dashboard;
      if (!d) return;
      try {
        const isSuper = d.isSuperAdmin;
        const isReseller = d.currentUser?.role === 'RESELLER_ADMIN';
        const tid = d.currentUser?.tenant_id;

        // invoices
        const invRes = await api.getInvoices();
        const allInv = invRes.invoices || invRes || [];
        const visibleInv = isSuper || isReseller
          ? allInv
          : allInv.filter(i => i.tenant_id === tid);
        this.recentInvoices = visibleInv.slice(0, 10);

        if (isSuper || isReseller) {
          const tRes = await api.getTenants();
          const tenants = tRes.tenants || [];
          this.stats.tenants = tenants.length;
          if (isSuper) {
            try {
              const p = await api.getPendingApprovals();
              this.stats.pending = (p.tenants || []).length;
            } catch(_) {}
          }
          // low credit wallets
          for (const t of tenants) {
            try {
              const w = await api.getTenantCredits(t.id);
              const bal = w.credits?.balance ?? 0;
              if (bal < 20) this.lowCredit.push({ tenant: t, balance: bal });
            } catch(_) {}
          }
        } else {
          this.stats.tenants = tid ? 1 : 0;
          try {
            const w = await api.getTenantCredits(tid);
            this.stats.credits = w.credits?.balance ?? 0;
          } catch(_) {}
        }

        if (isSuper || isReseller) {
          try {
            const uRes = await api.getUsers();
            this.stats.users = (uRes.users || []).length;
          } catch(_) {}
        }
        this.stats.invoices = visibleInv.length;
      } catch (e) {
        console.error('[dashboard-page]', e);
      }
    }
  };
}
window.dashboardPage = dashboardPage;

// ============ INVOICES ============
function invoicesPage() {
  return {
    invoices: [],
    filter: '',
    status: '',
    selected: null,
    api,
    async init() {
      await this.load();
    },
    async load() {
      try {
        const d = window.__dashboard;
        const isSuper = d.isSuperAdmin;
        const isReseller = d.currentUser?.role === 'RESELLER_ADMIN';
        const tid = d?.currentUser?.tenant_id;
        const res = await api.getInvoices();
        let list = res.invoices || res || [];
        if (!isSuper && !isReseller && tid) list = list.filter(i => i.tenant_id === tid);
        this.invoices = list;
      } catch (e) { console.error(e); }
    },
    get filtered() {
      let list = this.invoices;
      if (this.status) list = list.filter(i => (i.status || '').toUpperCase() === this.status.toUpperCase());
      if (this.filter) {
        const f = this.filter.toLowerCase();
        list = list.filter(i =>
          (i.issuer_vat || '').includes(f) ||
          (i.counterpart_vat || '').includes(f) ||
          (i.mark || '').toLowerCase().includes(f) ||
          (i.uuid || '').toLowerCase().includes(f) ||
          String(i.series || '') + String(i.aa || '').includes(f)
        );
      }
      return list;
    },
async view(id) {
      try {
        const res = await api.getInvoice(id);
        this.selected = res.invoice || res;
      } catch (_) {}
    },
    /**
     * Opens the print dialog for the selected invoice
     */
    async printInvoice(id) {
      try {
        const res = await api.getInvoice(id);
        const invoice = res.invoice || res;
        if (!invoice) {
          alert('Δεν βρέθηκε το παραστατικό');
          return;
        }
        // Create print window with formatted invoice
        const printWindow = window.open('', '_blank', 'width=800,height=600');
        if (!printWindow) {
          alert('Απαιτείται άδεια για ανοιχτά παράθυρα');
          return;
        }
        const formatDate = (d) => d ? new Date(d).toLocaleDateString('el-GR') : '—';
        const formatNum = (n) => n ? Number(n).toFixed(2) + ' €' : '0.00 €';
        
        printWindow.document.write(`
<!DOCTYPE html>
<html lang="el">
<head>
  <meta charset="UTF-8">
  <title>Εκτύπωση Παραστατικού #${invoice.id}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
    h1 { font-size: 20px; border-bottom: 2px solid #333; padding-bottom: 10px; }
    .header { display: flex; justify-content: space-between; margin-bottom: 30px; }
    .party { width: 48%; }
    .party h3 { margin: 0 0 10px 0; font-size: 14px; color: #666; }
    .party p { margin: 4px 0; font-size: 13px; }
    .party .vat { font-size: 11px; color: #888; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 12px; }
    th { background: #f5f5f5; padding: 8px; text-align: left; border: 1px solid #ddd; }
    td { padding: 8px; border: 1px solid #ddd; }
    .totals { text-align: right; margin-top: 20px; font-size: 14px; }
    .totals .row { margin: 5px 0; }
    .totals .total { font-size: 16px; font-weight: bold; }
    .meta { font-size: 11px; color: #888; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 10px; }
    @media print { body { margin: 0; } .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom:20px;">
    <button onclick="window.print()" style="padding:10px 20px;font-size:14px;cursor:pointer;">Εκτύπωση</button>
    <button onclick="window.close()" style="padding:10px 20px;font-size:14px;cursor:pointer;">Κλείσιμο</button>
  </div>
  <h1>Τιμολόγιο #${invoice.series || ''}/${invoice.aa || ''}</h1>
  <div class="header">
    <div class="party">
      <h3>Εκδότης</h3>
      <p><strong>${invoice.issuer_name || invoice.issuer_vat || '—'}</strong></p>
      <p>${invoice.issuer_address ? invoice.issuer_address + (invoice.issuer_postal_code ? ' ' + invoice.issuer_postal_code : '') + (invoice.issuer_city ? ' ' + invoice.issuer_city : '') : invoice.issuer_vat || '—'}</p>
      <p class="vat">ΑΦΜ: ${invoice.issuer_vat || '—'}</p>
    </div>
    <div class="party" style="text-align:right;">
      <h3>Λήπτης</h3>
      <p><strong>${invoice.counterpart_name || invoice.counterpart_vat || '—'}</strong></p>
      <p style="text-align:right;">${invoice.counterpart_address ? invoice.counterpart_address + (invoice.counterpart_postal_code ? ' ' + invoice.counterpart_postal_code : '') + (invoice.counterpart_city ? ' ' + invoice.counterpart_city : '') : invoice.counterpart_vat || '—'}</p>
      <p class="vat" style="text-align:right;">ΑΦΜ: ${invoice.counterpart_vat || '—'}</p>
    </div>
  </div>
  <table>
    <thead>
      <tr><th>Περιγραφή</th><th>Ποσότητα</th><th>Τμ.Τιμή</th><th>ΦΠΑ %</th><th>Σύνολο</th></tr>
    </thead>
    <tbody>
      ${(invoice.line_items || []).map(item => `
      <tr>
        <td>${item.description || '—'}</td>
        <td>${item.quantity || 0}</td>
        <td>${formatNum(item.unit_price)}</td>
        <td>${item.vat_rate || 0}%</td>
        <td>${formatNum(item.total)}</td>
      </tr>`).join('')}
    </tbody>
  </table>
  <div class="totals">
    <div class="row">Καθ.Αξία: ${formatNum(invoice.total_net)}</div>
    <div class="row">ΦΠΑ: ${formatNum(invoice.total_vat)}</div>
    <div class="row total">Σύνολο: ${formatNum(invoice.total_gross)}</div>
  </div>
  <div class="meta">
    <p>Ημ/νία: ${formatDate(invoice.issue_date)} | Τύπος: ${invoice.invoice_type || '—'} | Status: ${invoice.status || '—'}</p>
    ${invoice.uuid ? `<p>UUID: ${invoice.uuid}</p>` : ''}
    ${invoice.mark ? `<p>Mark: ${invoice.mark}</p>` : ''}
  </div>
</body>
</html>`);
        printWindow.document.close();
      } catch (e) {
        console.error('[printInvoice] Error:', e);
        alert('Σφάλμα εκτύπωσης: ' + e.message);
      }
    },
    formatNumber
  };
}
window.invoicesPage = invoicesPage;

// ============ TENANTS ============
function tenantsPage() {
  return {
    tenants: [],
    showModal: false,
    editingId: null,
    form: { company_name: '', vat_number: '', email: '', trade_title: '', tax_office: '', address: '', number: '', postal_code: '', city: '', country: 'GR', phone: '', reseller_id: '' },
    resellers: [],
    busy: false,
    api,
    async init() {
      const d = window.__dashboard;
      if (d?.isSuperAdmin) {
        try {
          const r = await api.getResellers();
          this.resellers = r.resellers || [];
        } catch(_) {}
      }
      await this.load();
    },
    async load() {
      try {
        const res = await api.getTenants();
        this.tenants = res.tenants || [];
      } catch (e) { console.error(e); }
    },
    async create() {
      this.busy = true;
      try {
        const payload = { ...this.form };
        // Merge address + number into single address field for backend
        if (payload.address && payload.number) {
          payload.address = payload.address + ' ' + payload.number;
        } else if (payload.number) {
          payload.address = payload.number;
        }
        delete payload.number;
        if (payload.reseller_id === '' || payload.reseller_id == null) delete payload.reseller_id;
        else payload.reseller_id = Number(payload.reseller_id);
        if (this.editingId) await api.updateTenant(this.editingId, payload);
        else await api.createTenant(payload);
        this.showModal = false;
        this.editingId = null;
        this.form = { company_name: '', vat_number: '', email: '', trade_title: '', tax_office: '', address: '', number: '', postal_code: '', city: '', country: 'GR', phone: '', reseller_id: '' };
        await this.load();
      } catch (e) { alert(e.message); }
      finally { this.busy = false; }
    },
    edit(tenant) {
      this.editingId = tenant.id;
      this.form = {
        company_name: tenant.company_name || '', vat_number: tenant.vat_number || '', email: tenant.email || '',
        trade_title: tenant.trade_title || '', tax_office: tenant.tax_office || '',
        address: tenant.address || '', number: '', postal_code: tenant.postal_code || '',
        city: tenant.city || '', country: tenant.country || 'GR',
        phone: tenant.phone || '', reseller_id: tenant.reseller_id == null ? '' : String(tenant.reseller_id),
      };
      this.showModal = true;
    },
    async approve(id) {
      try { await api.approveTenant(id); await this.load(); } catch (e) { alert(e.message); }
    },
    async reject(id) {
      if (!confirm('Απόρριψη tenant #'+id+';')) return;
      try { await api.rejectTenant(id); await this.load(); } catch (e) { alert(e.message); }
    },
    statusClass(s) {
      return {
        'ACTIVE': 'bg-green-900/60 text-green-300',
        'PENDING': 'bg-amber-900/60 text-amber-300',
        'REJECTED': 'bg-red-900/60 text-red-300',
        'SUSPENDED': 'bg-gray-700 text-gray-300',
      }[s] || 'bg-gray-700 text-gray-300';
    },
    formatNumber
  };
}
window.tenantsPage = tenantsPage;

// ============ USERS ============
function usersPage() {
  return {
    users: [],
    tenants: [],
    showModal: false,
    editingId: null,
    form: { email: '', password: '', first_name: '', last_name: '', role: 'USER', tenant_id: '' },
    api,
    async init() {
      const d = window.__dashboard;
      if (d?.isAdmin) {
        try { const r = await api.getTenants(); this.tenants = r.tenants || []; } catch(_) {}
      }
      await this.load();
    },
    async load() {
      try {
        const res = await api.getUsers();
        this.users = res.users || [];
      } catch (e) { console.error(e); }
    },
    async create() {
      try {
        const payload = {
          email: this.form.email,
          first_name: this.form.first_name,
          last_name: this.form.last_name,
          role: this.form.role,
          tenant_id: this.form.tenant_id === '' ? null : Number(this.form.tenant_id),
        };
        if (this.editingId) {
          await api.updateUser(this.editingId, payload);
        } else {
          if (!this.form.password) throw new Error('Ο κωδικός είναι υποχρεωτικός.');
          payload.password_hash = await sha256Hex(this.form.password);
          await api.createUser(payload);
        }
        this.showModal = false;
        this.editingId = null;
        this.form = { email: '', password: '', first_name: '', last_name: '', role: 'USER', tenant_id: '' };
        await this.load();
      } catch (e) { alert(e.message); }
    },
    edit(user) {
      this.editingId = user.id;
      this.form = {
        email: user.email || '', password: '', first_name: user.first_name || '', last_name: user.last_name || '',
        role: user.role || 'USER', tenant_id: user.tenant_id == null ? '' : String(user.tenant_id),
      };
      this.showModal = true;
    },
    async deactivate(id) {
      if (!confirm('Απενεργοποίηση χρήστη #' + id + ';')) return;
      try { await api.deleteUser(id); await this.load(); } catch (e) { alert(e.message); }
    },
    roleClass(r) {
      return {
        'SUPER_ADMIN': 'bg-purple-900/60 text-purple-300',
        'RESELLER_ADMIN': 'bg-blue-900/60 text-blue-300',
        'CLIENT_ADMIN': 'bg-green-900/60 text-green-300',
        'USER': 'bg-gray-700 text-gray-300',
      }[r] || 'bg-gray-700 text-gray-300';
    }
  };
}
window.usersPage = usersPage;

// ============ API KEYS ============
function apiKeysPage() {
  return {
    tenants: [],
    selectedTenantId: null,
    keys: [],
    newName: '',
    newBranch: 0,
    newSeries: '',
    newEnv: 'LIVE',
    showNew: false,
    showEdit: false,
    editForm: null,
    editingKey: false,
    api,
    async init() {
      const d = window.__dashboard;
      const tid = d?.currentUser?.tenant_id;
      try {
        if (tid && !d.isSuperAdmin && d.currentUser?.role !== 'RESELLER_ADMIN') {
          this.tenants = [{ id: tid, company_name: 'Το Tenant μου', vat_number: '—' }];
          this.selectedTenantId = tid;
        } else {
          const r = await api.getTenants();
          this.tenants = r.tenants || [];
          this.selectedTenantId = this.tenants[0]?.id || null;
        }
        if (this.selectedTenantId) await this.loadKeys();
      } catch (e) { console.error(e); }
    },
    async loadKeys() {
      if (!this.selectedTenantId) return;
      try {
        const res = await api.getApiKeys(this.selectedTenantId);
        this.keys = res.keys || [];
      } catch (e) { console.error(e); }
    },
    async createKey() {
      if (!this.newName) return;
      try {
        const res = await api.createApiKey(this.selectedTenantId, {
          name: this.newName,
          environment: this.newEnv,
          aade_branch: this.newBranch,
          default_series: this.newSeries || undefined,
        });
        alert('Σώστε το key τώρα (δεν θα εμφανιστεί ξανά):\n\n' + res.apiKey.key);
        this.newName = '';
        this.newBranch = 0;
        this.newSeries = '';
        this.newEnv = 'LIVE';
        this.showNew = false;
        await this.loadKeys();
      } catch (e) { alert(e.message); }
    },
    async deleteKey(id) {
      if (!confirm('Απενεργοποίηση key #' + id + ';')) return;
      try { await api.deleteApiKey(this.selectedTenantId, id); await this.loadKeys(); } catch (e) { alert(e.message); }
    },
    async addKeyCredits(id) {
      const amount = parseInt(prompt('Credit units να προστεθούν στο key #' + id + ':', '10'));
      if (!amount || amount <= 0) return;
      try { await api.addCreditsToKey(this.selectedTenantId, id, amount); await this.loadKeys(); } catch (e) { alert(e.message); }
    },
    editKey(k) {
      this.editForm = {
        id: k.id,
        name: k.name || '',
        aade_branch: k.aade_branch ?? 0,
        default_series: k.default_series || '',
        environment: k.environment || 'LIVE',
      };
      this.showEdit = true;
    },
    async saveKey() {
      if (!this.editForm || !this.editForm.id) return;
      this.editingKey = true;
      try {
        const updates = {};
        if (this.editForm.name !== undefined) updates.name = this.editForm.name;
        if (this.editForm.aade_branch !== undefined) updates.aade_branch = this.editForm.aade_branch;
        if (this.editForm.default_series !== undefined) updates.default_series = this.editForm.default_series || null;
        if (this.editForm.environment !== undefined) updates.environment = this.editForm.environment;
        await api.updateApiKey(this.selectedTenantId, this.editForm.id, updates);
        this.showEdit = false;
        this.editForm = null;
        await this.loadKeys();
      } catch (e) { alert(e.message); }
      finally { this.editingKey = false; }
    }
  };
}
window.apiKeysPage = apiKeysPage;

// ============ CREDITS ============
function creditsPage() {
  return {
    tenants: [],
    selectedTenantId: null,
    wallets: [],
    addAmount: 10,
    api,
    async init() {
      const d = window.__dashboard;
      const tid = d?.currentUser?.tenant_id;
      try {
        if (tid && !d.isSuperAdmin && d.currentUser?.role !== 'RESELLER_ADMIN') {
          this.tenants = [{ id: tid, company_name: 'Το Tenant μου' }];
          this.selectedTenantId = tid;
        } else {
          const r = await api.getTenants();
          this.tenants = r.tenants || [];
          this.selectedTenantId = this.tenants[0]?.id || null;
        }
        if (this.selectedTenantId) await this.load();
      } catch (e) { console.error(e); }
    },
    async load() {
      if (!this.selectedTenantId) return;
      try {
        const res = await api.getWallets(this.selectedTenantId);
        this.wallets = res.wallets || [];
      } catch (e) { console.error(e); }
    },
    async addTenantCredits() {
      try {
        await api.addCreditsToTenant(this.selectedTenantId, this.addAmount);
        await this.load();
      } catch (e) { alert(e.message); }
    },
    async addKeyCredits(keyId) {
      const amount = parseInt(prompt('Credit units για key #' + keyId + ':', String(this.addAmount)));
      if (!amount || amount <= 0) return;
      try { await api.addCreditsToKey(this.selectedTenantId, keyId, amount); await this.load(); } catch (e) { alert(e.message); }
    }
  };
}
window.creditsPage = creditsPage;

// ============ WEBHOOKS ============
function webhooksPage() {
  return {
    tenants: [],
    selectedTenantId: null,
    webhooks: [],
    showModal: false,
    form: { url: '', secret: '', events: 'invoice.issued' },
    api,
    async init() {
      const d = window.__dashboard;
      const tid = d?.currentUser?.tenant_id;
      try {
        if (tid && !d.isSuperAdmin && d.currentUser?.role !== 'RESELLER_ADMIN') {
          this.tenants = [{ id: tid, company_name: 'Το Tenant μου' }];
          this.selectedTenantId = tid;
        } else {
          const r = await api.getTenants();
          this.tenants = r.tenants || [];
          this.selectedTenantId = this.tenants[0]?.id || null;
        }
        if (this.selectedTenantId) await this.load();
      } catch (e) { console.error(e); }
    },
    async load() {
      if (!this.selectedTenantId) return;
      try {
        const res = await api.getWebhooks(this.selectedTenantId);
        this.webhooks = res.webhooks || [];
      } catch (e) { console.error(e); }
    },
    async create() {
      try {
        await api.createWebhook(this.selectedTenantId, {
          url: this.form.url,
          secret: this.form.secret || ('secret_' + Math.random().toString(36).substring(2, 10)),
          events: this.form.events.split(',').map(s => s.trim()).filter(Boolean),
        });
        this.showModal = false;
        this.form = { url: '', secret: '', events: 'invoice.issued' };
        await this.load();
      } catch (e) { alert(e.message); }
    },
    async remove(id) {
      if (!confirm('Διαγραφή webhook #' + id + ';')) return;
      try { await api.deleteWebhook(this.selectedTenantId, id); await this.load(); } catch (e) { alert(e.message); }
    }
  };
}
window.webhooksPage = webhooksPage;

// ============ RESELLERS (admin) ============
function resellersPage() {
  return {
    resellers: [],
    showModal: false,
    editingId: null,
    form: { name: '', vat_number: '', email: '', commission_rate: 0 },
    api,
    async init() { await this.load(); },
    async load() {
      try {
        const res = await api.getResellers();
        this.resellers = res.resellers || [];
      } catch (e) { console.error(e); }
    },
    async create() {
      try {
        if (this.form.commission_rate < 0 || this.form.commission_rate > 100) {
          throw new Error('Το commission rate πρέπει να είναι μεταξύ 0 και 100.');
        }
        if (this.editingId) await api.updateReseller(this.editingId, this.form);
        else await api.createReseller(this.form);
        this.showModal = false;
        this.editingId = null;
        this.form = { name: '', vat_number: '', email: '', commission_rate: 0 };
        await this.load();
      } catch (e) { alert(e.message); }
    },
    edit(reseller) {
      this.editingId = reseller.id;
      this.form = {
        name: reseller.name || '', vat_number: reseller.vat_number || '', email: reseller.email || '',
        commission_rate: Number(reseller.commission_rate || 0), is_active: !!reseller.is_active,
      };
      this.showModal = true;
    },
    async remove(id) {
      if (!confirm('Διαγραφή reseller #' + id + ';')) return;
      try { await api.deleteReseller(id); await this.load(); } catch (e) { alert(e.message); }
    }
  };
}
window.resellersPage = resellersPage;

// ============ AUDIT LOG (admin) ============
function auditPage() {
  return {
    logs: [],
    filterTenant: '',
    loaded: false,
    api,
    async init() { await this.load(); },
    async load() {
      try {
        const filters = {};
        if (this.filterTenant) filters.tenant_id = this.filterTenant;
        const res = await api.getAuditLogs(filters);
        this.logs = res.logs || [];
        this.loaded = true;
      } catch (e) { console.error(e); }
    }
  };
}
window.auditPage = auditPage;

// ============ SETTINGS (admin) ============
function settingsPage() {
  return {
    config: null,
    api,
    async init() {
      try { this.config = await api.fetchConfig(); } catch(_) {}
    },
    async pingHealthz() {
      try {
        const r = await fetch('/healthz');
        const j = await r.json();
        alert('Server: ' + j.status + ' @ ' + j.timestamp);
      } catch(e) {
        alert('Error: ' + e.message);
      }
    }
  };
}
window.settingsPage = settingsPage;
console.log('[pages] all page components registered, dashboardPage=', typeof window.dashboardPage);

// Let the router know that all Alpine page factories are available.
window.dispatchEvent(new Event('page-components-ready'));
console.log('[pages] page-components-ready dispatched');

// ============ HELPERS ============
async function sha256Hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

