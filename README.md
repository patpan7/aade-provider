# AADE myDATA Provider Engine

Node.js/TypeScript Provider Engine για Υπηρεσίες Παρόχου Ηλεκτρονικής Έκδοσης Στοιχείων (ΥΠΑΗΕΣ) — πλήρης ενσωμάτωση με το myDATA της ΑΑΔΕ v2.0.2.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## Contents

- [Features](#features)
- [Architecture](#architecture)
- [Installation](#installation)
- [Configuration](#configuration)
- [API Endpoints](#api-endpoints)
- [Invoice Types](#invoice-types)
- [Authentication](#authentication)
- [Database Schema](#database-schema)
- [Web Dashboard](#web-dashboard)
- [Security Features](#security-features)
- [Testing](#testing)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

---

## Features

### Invoice Support (myDATA v2.0.2)

| Type | Description |
|------|-------------|
| `1.1` | Τιμολόγιο Πώλησης (B2B) |
| `1.2` | Τιμολόγιο Πώλησης / Ενδοκοινοτικές Παραδόσεις |
| `2.1` | Τιμολόγιο Παροχής Υπηρεσιών (ΤΠΥ - B2B) |
| `5.1` | Πιστωτικό Τιμολόγιο Πώλησης |
| `5.2` | Πιστωτικό Τιμολόγιο Παροχής Υπηρεσιών |
| `11.1` | Απόδειξη Λιανικής Πώλησης (ΑΛΠ - B2C) |
| `11.2` | Απόδειξη Παροχής Υπηρεσιών (ΑΠΥ - B2C) |
| `10.1` | Απόδειξη Παράδοσης (Delivery Note) |
| `10.2` | Απόδειξη Παραλαβής (Receiving Note) |
| `20.1` | Δήλωση Συμβεβλημένων Μεταφορέων (B2B Statements) |

### Core Platform

- **Multi-Tenancy** — Tenants (εταιρείες), Resellers (μεταπωλητές), Users (χρήστες) με πλήρη scoping βάσει ρόλων
- **API Key System** — SHA-256 hashed keys, Bearer auth, per-key credit wallets
- **Credit System** — Wallet-based ledger with expiry support; 1 credit per invoice
- **Auto-increment Series** — Atomic per tenant/branch/type counter
- **Webhooks** — HMAC-signed delivery to tenant URLs, full delivery history
- **AADE Client** — Connection pooling, token bucket rate limiting, retry with exponential backoff

### Web Dashboard

Interactive web UI at `http://localhost:8000` for managing tenants, users, API keys, invoices, credits, and monitoring.

---

## Architecture

```
src/
├── server.ts                  # Express app, routes, middleware
├── config/
│   ├── aade.config.ts         # AADE connection settings
│   └── swagger.ts             # OpenAPI spec
├── db/
│   └── database.ts            # SQL.js database initialization + helpers
├── types/
│   └── mydata.types.ts        # TypeScript interfaces
└── services/
    ├── aade/                  # AADE v2.0.2 client & endpoints
    │   ├── client.ts
    │   ├── aadeHttpClient.ts
    │   └── endpoints/
    │       ├── invoices.ts
    │       ├── cancellations.ts
    │       ├── statements.ts
    │       ├── payments.ts
    │       ├── receiver.ts
    │       └── unsigned.ts
    ├── invoice/               # Invoice business logic
    │   ├── calculation/
    │   ├── issuance/
    │   ├── shared/
    │   ├── types/             # Per-invoice-type serializers
    │   └── validation/
    ├── xml/                   # XML builders & parser for AADE payloads
    ├── encryption/            # AES-GCM field encryption
    ├── hash.service.ts        # Greek VAT (AFM) validation
    ├── logging/               # Structured audit logging
    ├── qseal/                 # Q-Seal digital signature
    ├── tls/                   # TLS certificate manager
    └── worm/                  # WORM (Write Once Read Many) storage
```

---

## Installation

### Prerequisites

- Node.js >= 20
- npm >= 10

### Steps

```bash
# Clone the repository
git clone https://github.com/patpan7/aade-provider.git
cd aade-provider

# Install dependencies
npm install

# Build TypeScript
npm run build
```

---

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and fill in the required values:

```bash
cp .env.example .env
```

| Variable | Description | Required |
|----------|-------------|----------|
| `AADE_USER_ID` | AADE myDATA user ID (from sandbox) | Yes |
| `AADE_SUBSCRIPTION_KEY` | OCP APIM subscription key | Yes |
| `AADE_MOCK` | Set `true` for mock mode (no real API calls) | No |
| `AADE_API_URL` | AADE API endpoint URL | No |
| `AADE_QR_BASE_URL` | QR code base URL | No |
| `DB_PATH` | SQLite database file path | No (default: `./data/provider.db`) |
| `PORT` | Server port | No (default: `8000`) |
| `NODE_ENV` | `development` / `production` | No |

### AADE Sandbox Credentials

Register at [https://www.aade.gr/mydata/develop/](https://www.aade.gr/mydata/develop/) to obtain sandbox credentials.

---

## API Endpoints

### Authentication

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/users/login` | Login with email/password → returns session token |
| `POST` | `/api/users/logout` | Destroy current session |
| `GET` | `/api/users/me` | Get current user from session |

### Invoices

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/invoices/issue` | API Key | Issue & transmit invoice to myDATA |
| `POST` | `/api/invoices/issue-web` | Session | Issue invoice via web dashboard |
| `POST` | `/api/invoices/issue-public` | None | Direct issuance (for testing) |
| `POST` | `/api/invoices/unsigned` | Session | Submit unsigned invoices |
| `GET` | `/api/invoices` | Session | List all invoices |
| `GET` | `/api/invoices/:id` | Session | Get invoice details |

### Documents (v2.0.2)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/documents/transmitted` | Session | Query transmitted documents |
| `GET` | `/api/receiver/info` | Session | Get recipient delivery channels |

### Cancellations (v2.0.2)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/delivery-notes/cancel` | Session | Cancel delivery note |
| `GET` | `/api/receiving-notes/cancel` | Session | Cancel receiving note |

### Statements (v2.0.2)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/statements` | Session | Submit B2B transaction statements |
| `GET` | `/api/statements` | Session | Query submitted statements |
| `GET` | `/api/statements/recall` | Session | Recall a statement |

### Payments (v2.0.2)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/payment-methods` | Session | Register payment methods |

### Tenants

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/tenants` | Session | List tenants (role-scoped) |
| `GET` | `/api/tenants/pending-approvals` | Admin | List pending tenants |
| `GET` | `/api/tenants/:id` | Session | Get tenant by ID |
| `GET` | `/api/tenants/vat/:vatNumber` | Session | Get tenant by VAT number |
| `POST` | `/api/tenants` | Admin | Create new tenant |
| `PATCH` | `/api/tenants/:id/approve` | Admin | Approve pending tenant |
| `PATCH` | `/api/tenants/:id/reject` | Admin | Reject pending tenant |
| `PATCH` | `/api/tenants/:id/status` | Admin | Update tenant status |
| `GET` | `/api/tenants/:id/credits` | Session | Get credit wallets |
| `POST` | `/api/tenants/:id/credits/add` | Admin | Add credits |
| `GET` | `/api/tenants/:id/credit-transactions` | Session | Get transaction ledger |

### API Keys

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/tenants/:id/api-keys` | Session | List API keys |
| `POST` | `/api/tenants/:id/api-keys` | Tenant Admin | Create API key |
| `DELETE` | `/api/tenants/:id/api-keys/:keyId` | Tenant Admin | Deactivate API key |
| `PATCH` | `/api/tenants/:id/api-keys/:keyId` | Tenant Admin | Update API key |
| `GET` | `/api/tenants/:id/api-keys/:keyId/credits` | Session | Get key credit balance |
| `POST` | `/api/tenants/:id/api-keys/:keyId/credits/add` | Admin | Add credits to key wallet |

### Resellers

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/resellers` | Admin | List resellers |
| `POST` | `/api/resellers` | Admin | Create reseller |
| `GET` | `/api/resellers/:id` | Admin | Get reseller |
| `PATCH` | `/api/resellers/:id` | Admin | Update reseller |
| `DELETE` | `/api/resellers/:id` | Admin | Deactivate reseller |

### Users

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/users` | Tenant Admin | List users |
| `POST` | `/api/users` | Tenant Admin | Create user |
| `PUT` | `/api/users/:id` | Tenant Admin | Update user |

### System

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/config` | AADE config status |
| `GET` | `/api/validate-afm/:afm` | Validate Greek VAT number |
| `GET` | `/healthz` | Health check |
| `GET` | `/api/security/health` | Security subsystem status |
| `GET` | `/api-docs` | Swagger UI |

---

## Authentication

### Session-Based (Web Dashboard)

Use `Bearer <token>` in the `Authorization` header. Obtain token via `/api/users/login`.

### API Key-Based (External Systems)

Use `Bearer <api-key>` in the `Authorization` header. API keys are generated per tenant via the dashboard or `/api/tenants/:id/api-keys`.

### Role Hierarchy

| Role | Scope |
|------|-------|
| `SUPER_ADMIN` | All tenants, all operations |
| `RESELLER_ADMIN` | Own reseller's tenants |
| `CLIENT_ADMIN` | Own tenant only |
| `USER` | Own tenant (read-only on some endpoints) |

---

## Database Schema

Schema migrations are in `db/migrations/`:

| Migration | Tables Created |
|-----------|---------------|
| `001_series_counters_initial.sql` | `series_counters` |
| `002_tenants_initial.sql` | `tenants`, `resellers`, `users`, `sessions`, `audit_log` |
| `003_api_keys_and_credits.sql` | `api_keys`, `credit_wallets`, `credit_transactions`, `webhook_endpoints`, `webhook_deliveries` |

Additional tables created at runtime: `invoices`, `invoice_payments`

---

## Web Dashboard

The web dashboard provides a full GUI for:

- **Dashboard** — Overview statistics
- **Tenants** — Create, approve, manage tenants
- **Resellers** — Manage reseller accounts
- **Users** — User management per tenant
- **API Keys** — Generate and manage API keys
- **Invoices** — View issued invoices
- **Credits** — Credit wallets and transactions
- **Webhooks** — Configure webhook endpoints
- **Audit** — Audit log viewer

Access at: `http://localhost:8000`

---

## Security Features

| Feature | Description |
|---------|-------------|
| **AES-GCM Encryption** | Sensitive fields (passwords, API keys) encrypted at rest |
| **SHA-256 Hashing** | Passwords and API keys hashed before storage |
| **WORM Storage** | Invoices written once, immutable — prevents tampering |
| **QSeal Signing** | Digital signature support for enhanced integrity |
| **TLS Manager** | Auto-generates self-signed certificates when available |
| **HMAC Webhooks** | All webhook payloads signed with HMAC-SHA256 |
| **Rate Limiting** | Token bucket per AADE subscription key |
| **Role-Based Access** | Full scoping by user role and tenant |

---

## Testing

```bash
# Run test suite
npm test

# Development with hot reload
npm run dev

# Build for production
npm run build
```

Test files:
- `test-suite.mjs` — Full integration test suite
- `test-login.mjs` — Login flow tests
- `test-parser.mjs` — XML parser tests
- `test-server.mjs` — Server endpoint tests
- `test-pdf.js` — PDF generation tests

---

## Deployment

### Docker (optional)

Create a `Dockerfile`:

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist/ dist/
COPY src/public/ src/public/
EXPOSE 8000
CMD ["node", "dist/server.js"]
```

### PM2

```bash
npm run build
pm2 start dist/server.js --name aade-provider
pm2 save
```

---

## Project Structure Reference

```
aade-provider/
├── src/                    # TypeScript source
│   ├── server.ts
│   ├── config/
│   ├── db/
│   ├── types/
│   ├── services/
│   └── public/             # Web dashboard (HTML/CSS/JS)
├── db/migrations/          # SQL schema migrations
├── scripts/                # Build & utility scripts
├── test-*.mjs              # Test files
├── .env.example            # Environment template
├── package.json
├── tsconfig.json
└── README.md
```

---

## License

MIT
