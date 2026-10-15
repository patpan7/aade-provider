import swaggerUi from 'swagger-ui-express';

export const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'AADE myDATA Provider API',
    version: '1.0.0',
    description: 'Full-featured REST API for electronic invoice transmission to Greek AADE myDATA platform',
  },
  servers: [{ url: '/api' }],
  paths: {
    '/config': {
      get: { summary: 'Get AADE configuration status', responses: { 200: { description: 'OK' } } },
    },
    '/validate-afm/{afm}': {
      get: {
        summary: 'Validate Greek AFM (Modulo-11)',
        parameters: [{ name: 'afm', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Validation result' } },
      },
    },
    '/invoices/issue': {
      post: {
        summary: 'Issue & submit invoice (API Key auth)',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/InvoiceRequest' } } } },
        responses: {
          '200': { description: 'Success or partial with errors' },
          '400': { description: 'Bad request' },
          '401': { description: 'Invalid/expired key' },
          '402': { description: 'Insufficient credits' },
        },
      },
    },
    '/invoices/issue-web': {
      post: {
        summary: 'Issue invoice (Web session auth)',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Success or partial with errors' },
          '401': { description: 'Session invalid' },
          '402': { description: 'Insufficient credits' },
        },
      },
    },
    '/invoices/issue-public': {
      post: {
        summary: 'Issue invoice (public, no auth)',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/InvoiceRequest' } } } },
        responses: { '200': { description: 'Result' } },
      },
    },
    '/invoices/unsigned': {
      post: {
        summary: 'Submit unsigned invoices',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Success' } },
      },
    },
    '/invoices': {
      get: { summary: 'List invoices', security: [{ bearerAuth: [] }], responses: { 200: { description: 'OK' } } },
    },
    '/invoices/{id}': {
      get: {
        summary: 'Get invoice by ID',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'OK' } },
      },
    },
    '/documents/transmitted': {
      get: {
        summary: 'Query transmitted documents',
        parameters: [
          { name: 'issuerVat', in: 'query', schema: { type: 'string' } },
          { name: 'mark', in: 'query', schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'OK' } },
      },
    },
    '/receiver/info': {
      get: {
        summary: 'Get recipient delivery channels',
        parameters: [{ name: 'vatNumber', in: 'query', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'OK' } },
      },
    },
    '/delivery-notes/cancel': {
      get: {
        summary: 'Cancel delivery note',
        parameters: [
          { name: 'mark', in: 'query', required: true, schema: { type: 'string' } },
          { name: 'entityVatNumber', in: 'query', required: true, schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'OK' } },
      },
    },
    '/receiving-notes/cancel': {
      get: {
        summary: 'Cancel receiving note',
        parameters: [
          { name: 'mark', in: 'query', required: true, schema: { type: 'string' } },
          { name: 'entityVatNumber', in: 'query', required: true, schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'OK' } },
      },
    },
    '/statements': {
      post: { summary: 'Submit B2B statement', security: [{ bearerAuth: [] }], responses: { 200: { description: 'OK' } } },
      get: {
        summary: 'Query statements',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'entityVatNumber', in: 'query', schema: { type: 'string' } },
          { name: 'providerVatNumber', in: 'query', schema: { type: 'string' } },
          { name: 'fromDate', in: 'query', schema: { type: 'string' } },
          { name: 'toDate', in: 'query', schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'OK' } },
      },
    },
    '/statements/recall': {
      get: {
        summary: 'Recall a statement',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'stmtId', in: 'query', required: true, schema: { type: 'string' } },
          { name: 'entityVatNumber', in: 'query', required: true, schema: { type: 'string' } },
          { name: 'recallStatus', in: 'query', required: true, schema: { type: 'integer' } },
          { name: 'recallDate', in: 'query', schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'OK' } },
      },
    },
    '/payment-methods': {
      post: { summary: 'Register payment methods', security: [{ bearerAuth: [] }], responses: { 200: { description: 'OK' } } },
    },
    '/tenants': {
      get: { summary: 'List tenants (scoped)', security: [{ bearerAuth: [] }], responses: { 200: { description: 'OK' } } },
      post: { summary: 'Create tenant', security: [{ bearerAuth: [] }], responses: { 201: { description: 'Created' } } },
    },
    '/tenants/{id}': {
      get: { summary: 'Get tenant by ID', security: [{ bearerAuth: [] }], responses: { 200: { description: 'OK' } } },
      put: { summary: 'Update tenant', security: [{ bearerAuth: [] }], responses: { 200: { description: 'OK' } } },
    },
    '/tenants/vat/{vatNumber}': {
      get: { summary: 'Get tenant by VAT', responses: { 200: { description: 'OK' } } },
    },
    '/tenants/pending-approvals': {
      get: { summary: 'Get pending approvals (admin)', security: [{ bearerAuth: [] }], responses: { 200: { description: 'OK' } } },
    },
    '/tenants/{id}/approve': {
      patch: { summary: 'Approve tenant (admin)', security: [{ bearerAuth: [] }], responses: { 200: { description: 'OK' } } },
    },
    '/tenants/{id}/reject': {
      patch: { summary: 'Reject tenant (admin)', security: [{ bearerAuth: [] }], responses: { 200: { description: 'OK' } } },
    },
    '/tenants/{id}/status': {
      patch: { summary: 'Update tenant status', security: [{ bearerAuth: [] }], responses: { 200: { description: 'OK' } } },
    },
    '/tenants/{id}/credits': {
      get: { summary: 'Get credit wallets', security: [{ bearerAuth: [] }], responses: { 200: { description: 'OK' } } },
    },
    '/tenants/{id}/credits/add': {
      post: { summary: 'Add tenant credits', security: [{ bearerAuth: [] }], responses: { 200: { description: 'OK' } } },
    },
    '/tenants/{id}/credit-transactions': {
      get: { summary: 'Get credit transactions', security: [{ bearerAuth: [] }], responses: { 200: { description: 'OK' } } },
    },
    '/tenants/{id}/api-keys': {
      get: { summary: 'List API keys', security: [{ bearerAuth: [] }], responses: { 200: { description: 'OK' } } },
      post: { summary: 'Create API key', security: [{ bearerAuth: [] }], responses: { 201: { description: 'Created' } } },
    },
    '/tenants/{id}/api-keys/{keyId}': {
      delete: { summary: 'Deactivate API key', security: [{ bearerAuth: [] }], responses: { 200: { description: 'OK' } } },
      patch: { summary: 'Update API key metadata', security: [{ bearerAuth: [] }], responses: { 200: { description: 'OK' } } },
    },
    '/tenants/{id}/api-keys/{keyId}/credits': {
      get: { summary: 'Per-key credit balance', security: [{ bearerAuth: [] }], responses: { 200: { description: 'OK' } } },
    },
    '/tenants/{id}/api-keys/{keyId}/credits/add': {
      post: { summary: 'Add credits to key wallet', security: [{ bearerAuth: [] }], responses: { 200: { description: 'OK' } } },
    },
    '/tenants/{id}/webhooks': {
      get: { summary: 'List webhooks', security: [{ bearerAuth: [] }], responses: { 200: { description: 'OK' } } },
      post: { summary: 'Create webhook endpoint', security: [{ bearerAuth: [] }], responses: { 201: { description: 'Created' } } },
    },
    '/tenants/{id}/webhooks/{webhookId}': {
      delete: { summary: 'Delete webhook', security: [{ bearerAuth: [] }], responses: { 200: { description: 'OK' } } },
    },
    '/tenants/{id}/webhooks/{webhookId}/deliveries': {
      get: { summary: 'Get webhook deliveries', security: [{ bearerAuth: [] }], responses: { 200: { description: 'OK' } } },
    },
    '/resellers': {
      get: { summary: 'List resellers (admin)', security: [{ bearerAuth: [] }], responses: { 200: { description: 'OK' } } },
      post: { summary: 'Create reseller (admin)', security: [{ bearerAuth: [] }], responses: { 201: { description: 'Created' } } },
    },
    '/resellers/{id}': {
      get: { summary: 'Get reseller', security: [{ bearerAuth: [] }], responses: { 200: { description: 'OK' } } },
      patch: { summary: 'Update reseller', security: [{ bearerAuth: [] }], responses: { 200: { description: 'OK' } } },
      delete: { summary: 'Deactivate reseller', security: [{ bearerAuth: [] }], responses: { 200: { description: 'OK' } } },
    },
    '/users': {
      get: { summary: 'List users', security: [{ bearerAuth: [] }], responses: { 200: { description: 'OK' } } },
      post: { summary: 'Create user', security: [{ bearerAuth: [] }], responses: { 201: { description: 'Created' } } },
    },
    '/users/email/{email}': {
      get: { summary: 'Get user by email', security: [{ bearerAuth: [] }], responses: { 200: { description: 'OK' } } },
    },
    '/users/login': {
      post: { summary: 'Login (returns session token)', responses: { 200: { description: 'OK' } } },
    },
    '/users/me': {
      get: { summary: 'Current user profile', security: [{ bearerAuth: [] }], responses: { 200: { description: 'OK' } } },
    },
    '/users/logout': {
      post: { summary: 'Logout / destroy session', security: [{ bearerAuth: [] }], responses: { 200: { description: 'OK' } } },
    },
    '/users/{id}': {
      put: { summary: 'Update user', security: [{ bearerAuth: [] }], responses: { 200: { description: 'OK' } } },
      delete: { summary: 'Deactivate user', security: [{ bearerAuth: [] }], responses: { 200: { description: 'OK' } } },
    },
    '/users/{id}/password': {
      patch: { summary: 'Change password', security: [{ bearerAuth: [] }], responses: { 200: { description: 'OK' } } },
    },
    '/audit-logs': {
      get: { summary: 'Audit logs (admin)', security: [{ bearerAuth: [] }], responses: { 200: { description: 'OK' } } },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'Token',
        description: 'Session token (web) or API Key (pk_live_... / pk_test_...)',
      },
    },
    schemas: {
      InvoiceRequest: {
        type: 'object',
        required: ['invoiceType', 'series', 'aa', 'issueDate', 'issuer', 'lineItems'],
        properties: {
          invoiceType: { type: 'string', description: '1.1, 1.2, 2.1, 5.1, 11.1, etc.' },
          series: { type: 'string' },
          aa: { type: 'integer' },
          issueDate: { type: 'string', format: 'date' },
          issuer: { $ref: '#/components/schemas/Party' },
          counterpart: { $ref: '#/components/schemas/Party' },
          lineItems: { type: 'array', items: { $ref: '#/components/schemas/LineItem' } },
          paymentMethods: { type: 'array', items: { $ref: '#/components/schemas/PaymentMethod' } },
        },
      },
      Party: {
        type: 'object',
        properties: {
          vatNumber: { type: 'string' },
          country: { type: 'string' },
          branch: { type: 'integer' },
          name: { type: 'string' },
        },
      },
      LineItem: {
        type: 'object',
        properties: {
          netValue: { type: 'number' },
          vatCategory: { type: 'string' },
          description: { type: 'string' },
          incomeClassifications: { type: 'array' },
        },
      },
      PaymentMethod: {
        type: 'object',
        properties: {
          type: { type: 'string' },
          amount: { type: 'number' },
          info: { type: 'string' },
        },
      },
    },
  },
};
