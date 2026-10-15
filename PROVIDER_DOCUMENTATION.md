# AADE myDATA Provider - ΥΠΑΗΕΣ (v2.0.2)

Complete TypeScript/Node.js implementation of an AADE myDATA Provider Engine with Web Sandbox GUI for electronic invoice transmission to the Greek Independent Authority for Public Revenue (ΑΑΔΕ).

## Overview

This project implements a fully compliant AADE myDATA Provider (ΥΠΑΗΕΣ) according to the v2.0.2 specification. It includes:

- **Backend**: Node.js/TypeScript REST API with Express
- **Frontend**: Single-page Alpine.js + Tailwind CSS dashboard
- **Database**: SQLite (sql.js) for invoice persistence
- **Testing**: Comprehensive test suite (12/12 passing)

## Architecture

```
├── src/
│   ├── server.ts                 # Express server entry point
│   ├── config/
│   │   └── aade.config.ts       # AADE configuration management
│   ├── db/
│   │   └── database.ts          # SQLite (sql.js) persistence layer
│   ├── services/
│   │   ├── aade.service.ts      # AADE API client (9 endpoints)
│   │   ├── hash.service.ts      # SHA-256 & AFM validation
│   │   ├── invoice.service.ts   # Invoice processing & validation
│   │   ├── xml.service.ts       # XML generation (v2.0.2 XSD)
│   │   └── hash.service.ts      # SHA-256 & AFM Modulo-11
│   ├── types/
│   │   └── mydata.types.ts      # TypeScript interfaces
│   └── public/
│       └── index.html           # Alpine.js + Tailwind dashboard
├── test-suite.mjs               # Comprehensive test suite (12 tests)
├── package.json
└── tsconfig.json
```

## Implemented AADE Provider Endpoints (v2.0.2)

### Core Invoice Endpoints
| Endpoint | Method | Path | Description |
|----------|--------|------|-------------|
| **SendInvoices** | POST | `/myDataProvider/SendInvoices` | Submit invoices to AADE |
| **RequestTransmittedDocs** | GET | `/myDataProvider/RequestTransmittedDocs` | Query submitted invoices |
| **RequestReceiverInfo** | GET | `/myDataProvider/RequestReceiverInfo` | Get recipient delivery channels |

### Document Cancellation (v2.0.2)
| Endpoint | Method | Path | Description |
|----------|--------|------|-------------|
| **CancelDeliveryNote** | GET | `/myDataProvider/CancelDeliveryNote` | Cancel delivery notes (10.1, 10.2) |
| **CancelReceivingNote** | GET | `/myDataProvider/CancelReceivingNote` | Cancel receiving notes (10.1, 10.2) |

### Statements & Payments
| Endpoint | Method | Path | Description |
|----------|--------|------|-------------|
| **SendStatement** | POST | `/myDataProvider/SendStatement` | Submit B2B transaction statements |
| **RequestStatements** | GET | `/myDataProvider/RequestStatements` | Query submitted statements |
| **RecallStatement** | GET | `/myDataProvider/RecallStatement` | Recall submitted statements |
| **SendPaymentsMethod** | POST | `/myDataProvider/SendPaymentsMethod` | Register payment methods |

### Other
| Endpoint | Method | Path | Description |
|----------|--------|------|-------------|
| **SendUnsignedInvoices** | POST | `/myDataProvider/SendUnsignedInvoices` | Submit unsigned invoices |

## REST API Endpoints (Local)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/config` | AADE configuration status |
| GET | `/api/validate-afm/:afm` | Validate Greek AFM (Modulo-11) |
| POST | `/api/invoices/issue` | Issue & submit invoice |
| GET | `/api/invoices` | List all invoices |
| GET | `/api/invoices/:id` | Get invoice details |
| GET | `/api/documents/transmitted` | Query transmitted documents |
| GET | `/api/receiver/info` | Get recipient delivery channels |
| GET | `/api/delivery-notes/cancel` | Cancel delivery note (10.1/10.2) |
| GET | `/api/receiving-notes/cancel` | Cancel receiving note (v2.0.2) |
| POST | `/api/statements` | Submit B2B statement |
| GET | `/api/statements` | Query submitted statements |
| GET | `/api/statements/recall` | Recall statement |
| POST | `/api/payment-methods` | Register payment methods |
| POST | `/api/invoices/unsigned` | Submit unsigned invoices |

## Supported Invoice Types (17 Types)

| Category | Types | Description |
|----------|-------|-------------|
| **Sales Invoices** | 1.1, 1.2, 1.3, 1.4 | B2B sales, Intra-community, Export, Services |
| **Service Invoices** | 2.1, 2.2, 2.3 | B2B services, Intra-community, Export |
| **Credit Notes** | 5.1, 5.2, 5.3, 5.4, 5.5 | Sales, Services, Export, Intra-community, Mixed |
| **Retail Receipts** | 11.1, 11.2, 11.3, 11.4, 11.5 | B2C sales, Services, Export, Intra-community, Mixed |

## Key Features

### Validation Engine
- **Provider-specific rules** (Error codes 228, 236, 238, 245, 288)
- **Issue date validation** - Uses Greece local date (Europe/Athens timezone)
- **UID uniqueness** enforcement
- **Issue date = today** enforcement (Error 238)
- **Sender VAT ≠ Issuer VAT** (Error 236)
- **Provider authorization** check (Error 245)
- **TransmissionFlag=4** support (Error 288)
- **UID uniqueness** per provider (Error 228)

### Invoice Validation
- **VAT Categories**: 1-8 (24%, 13%, 6%, 17%, 9%, 4%, 0%, Exempt)
- **VAT Exemption Categories** (1-32) mandatory for VAT 7/8
- **Classification validation** per invoice type
- **Amount reconciliation** (line totals = invoice totals)
- **Payment method** sum = invoice total

### XML Generation (v2.0.2 XSD)
- Correct element ordering per XSD sequence
- Proper namespaces (icls, ecls)
- All v2.0.2 fields: `quantity15`, `otherMeasurementUnit*`, `notVAT195`, `vatExemptDescr*`, `movePurposeLine*`, `movePurpDescrLine*`
- Conditional element omission (empty optional fields omitted)
- Proper boolean handling (`true` only)

### Security & Compliance
- **SHA-256 Hash** per AADE spec: `issuerVat|issueDate|invoiceType|series|aa|totalNet|totalVat|totalGross`
- **QR Code** generation: `https://mydataapidev.aade.gr/TimologioQR/QRInfo?q={hash}&mark={mark}`
- **AFM Validation** - Modulo-11 algorithm
- **HTTPS/TLS** enforcement
- **Provider authentication** via headers

## Web Dashboard Features

- **Invoice Builder** with real-time validation
- **17 Invoice Type Selector** with color-coded categories
- **Live XML Preview** with syntax highlighting
- **Live SHA-256 Hash** computation
- **QR Code** generation & verification link
- **Invoice History** with modal detail view
- **Preset Templates** for all 17 invoice types
- **v2.0.2 Fields** support (all new fields)
- **Real-time Validation** feedback

## Testing

```bash
# Run all tests
npm test

# Run with custom env
NODE_ENV=test npm test
```

**Test Coverage (12/12 passing):**
1. Greek AFM Validation (Modulo-11)
2. Line Item & Financial Calculations
3. SHA-256 Hash Generation
5. XML Generation & myDATA Compliance
5. AADE XML Response Parsing
6. Database & Invoice Issuance Workflow (live AADE sandbox)

## Configuration

`.env` file:
```env
# AADE Sandbox Credentials
AADE_USER_ID=your_provider_id
AADE_SUBSCRIPTION_KEY=your_subscription_key

# Sandbox Endpoints
AADE_API_URL=https://mydataapidev.aade.gr/myDATAProvider/SendInvoices
AADE_QR_BASE_URL=https://mydataapidev.aade.gr/open

# Database
DB_PATH=./data/provider.db

# Server
PORT=8000
NODE_ENV=development
```

## Quick Start

```bash
# Install dependencies
npm install

# Configure .env with your AADE credentials
cp .env.example .env
# Edit .env with your credentials

# Build
npm run build

# Development (hot reload)
npm run dev

# Production
npm run build && npm start

# Testing
npm test
```

## API Usage Example

```typescript
import { issueInvoice } from './dist/services/invoice.service.js';

const result = await issueInvoice({
  invoiceType: '1.1',
  issuer: { vatNumber: '094014201', country: 'GR', branch: 0 },
  counterpart: { vatNumber: '054909468', country: 'GR', branch: 0 },
  series: 'A',
  aa: 1,
  issueDate: new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Athens' }),
  lineItems: [{
    lineNum: 1,
    netValue: 100,
    vatCategory: '1',
    incomeClassifications: [{ type: 'E3_561_001', category: 'category1_1', amount: 100 }]
  }],
  paymentMethods: [{ type: '1', amount: 124, info: 'Bank transfer' }]
});

if (result.success) {
  console.log('Invoice submitted:', result.mark, result.qrUrl);
}
```

## Compliance

- **AADE myDATA v2.0.2** specification compliant
- **XSD v2.0.2** schema validation
- **Greek Tax Law** compliance (Α.1138/2020, Α.1128/2020)
- **GDPR** compliant data handling
- **TypeScript** strict mode for type safety

## License

MIT License - See LICENSE file for details.

## Support

- AADE myDATA Documentation: https://www.aade.gr/mydata
- Technical Specifications: https://www.aade.gr/mydata/technical-specifications
- Provider Registration: https://www.aade.gr/mydata/providers