---
name: aade-mydata-provider-agent
description: Expert agent for AADE myDATA Provider Engine extension and maintenance. Knows the codebase architecture, AADE v2.0.2 specs, and implementation patterns.
version: 1.0.0
---

# AADE myDATA Provider Agent

## Purpose
Expert agent for extending and maintaining the AADE myDATA Provider Engine & Web Sandbox. Use this agent when you need to:
- Add new AADE endpoints or modify existing ones
- Extend DTOs/schemas for v2.0.2 compliance
- Implement invoice type/classification logic
- Fix validation or AADE error code handling
- Understand the codebase without reading everything

---

## Quick Context

### Project Structure
```
src/
├── server.ts                 # Express app, all routes, auth middleware
├── config/
│   ├── aade.config.ts       # AADE credentials & URLs
│   └── swagger.ts           # OpenAPI spec
├── db/
│   └── database.ts          # SQLite (sql.js) - ALL persistence
├── services/
│   ├── aade/                # AADE API client (9 endpoints)
│   ├── invoice/             # Invoice processing & validation
│   ├── xml/                 # XML generation (v2.0.2 XSD)
│   └── hash.service.ts      # SHA-256 & AFM Modulo-11
├── types/
│   └── mydata.types.ts      # TypeScript interfaces
└── public/                  # Alpine.js + Tailwind dashboard
```

### Key Files to Know
| File | Purpose |
|------|---------|
| `src/server.ts` | ALL routes, auth (API key + session), role-based access |
| `src/db/database.ts` | ALL SQL, CRUD, credit system, series counters |
| `src/services/invoice/validation/validation.ts` | AADE error codes (228, 236, 238, 245, 288) |
| `src/services/xml/builders/*.ts` | XML generation per XSD v2.0.2 |
| `src/types/mydata.types.ts` | All TypeScript interfaces |
| `src/public/js/pages.js` | Dashboard page components (issue, invoices, tenants, etc.) |
| `src/public/pages/issue.html` | Invoice builder UI |

---

## AADE v2.0.2 Critical Knowledge

### Endpoints Implemented
| Endpoint | Method | Path | Auth |
|----------|--------|------|------|
| SendInvoices | POST | `/api/invoices/issue` | API Key |
| SendInvoices (web) | POST | `/api/invoices/issue-web` | Session |
| CancelInvoice | POST | `/api/invoices/cancel` | API Key |
| RequestTransmittedDocs | GET | `/api/documents/transmitted` | Session |
| RequestReceiverInfo | GET | `/api/receiver/info` | Session |
| Statements | POST/GET | `/api/statements` | Session |
| Payment Methods | POST | `/api/payment-methods` | Session |

### AADE Error Codes (MUST Handle)
| Code | Meaning | When |
|------|---------|------|
| 228 | UID duplicate | UID already exists |
| 236 | Sender VAT ≠ Issuer VAT | Provider vs issuer mismatch |
| 238 | Issue date ≠ today | Date validation |
| 245 | Provider not authorized | Provider auth failed |
| 288 | TransmissionFlag=4 not supported | Invalid flag |

### Invoice Types (17 total)
| Category | Codes |
|----------|-------|
| Sales | 1.1, 1.2, 1.3, 1.4 |
| Services | 2.1, 2.2, 2.3 |
| Credit Notes | 5.1, 5.2, 5.3, 5.4, 5.5 |
| Retail | 11.1, 11.2, 11.3, 11.4, 11.5 |

### Classification Rules
- **Income (E3_561_xxx, category1_x)**: Per invoice type valid combinations in `syndiasmoi_xaraktirismwn_v2.0.2.pdf`
- **Expense (E3_102_xxx, category2_x)**: Per expense category
- **VAT Categories**: 1(24%), 2(13%), 3(6%), 4(17%), 5(9%), 6(4%), 7(0%), 8(Exempt)
- **VAT Exemption (1-32)**: Mandatory for VAT 7/8

---

## Database Schema (SQLite)

### Core Tables
- `tenants` - Companies, VAT, AADE auth status
- `api_keys` - Per-tenant keys with `aade_branch`, `default_series`, `environment`, credits
- `credit_wallets` / `credit_transactions` - 1 credit = 1 invoice
- `series_counters` - Atomic AA numbering per tenant/branch/type/series
- `invoices` - Full invoice + AADE response (mark, uid, qr, hash)
- `users` - Roles: SUPER_ADMIN, RESELLER_ADMIN, CLIENT_ADMIN, USER
- `webhook_endpoints` / `webhook_deliveries` - HMAC signed events

### Credit System
- 1 credit = 1 invoice issued
- Per-tenant wallet + per-API-key wallets
- Auto-deduct on `/api/invoices/issue`
- Expiry check on issuance

---

## Authentication

### API Key (M2M)
```
Authorization: Bearer pk_live_xxx...
```
- Per-key credits, branch, series, environment
- Used by ERP/POS/e-shop integrations

### Session (Web Dashboard)
```
Authorization: Bearer <session_token>
```
- Login via `/api/users/login`
- Role-based access: SUPER_ADMIN > RESELLER_ADMIN > CLIENT_ADMIN > USER
- Scoped to tenant (USER/CLIENT_ADMIN see only their tenant)

---

## Extension Patterns

### Adding New Endpoint
1. Add route in `server.ts` with proper auth middleware
2. Add DB function in `database.ts` if needed
3. Add service logic in `services/`
4. Update Swagger in `config/swagger.ts`

### Adding Invoice Type
1. Add to `invoiceTypes` in `pages.js`
2. Add preset in `loadPreset()`
3. Add classification rules from reference doc
3. Update `RETAIL` array if retail type
4. Update validation in `validation.ts`

### Adding Classification
- Check `AADE_v2.0.2_REFERENCE.md` for valid combinations
- Update `incomeClassifications` / `expensesClassifications` in DTOs
- Add validation in `validation.ts`

---

## Reference Files
- `AADE_v2.0.2_REFERENCE.md` - Full extracted docs (165 pages)
- `scema.md` - Database schema design
- `PROVIDER_DOCUMENTATION.md` - Project overview
- `src/types/mydata.types.ts` - TypeScript interfaces

---

## Common Tasks

### "Add Cancel Invoice endpoint"
→ See server.ts line ~246 for existing cancel, add new route with mark parameter

### "Fix classification validation for 11.1"
→ Check REFERENCE.md for valid E3 codes for 11.1, update validation.ts

### "Add new field to ProviderInvoiceDTO"
→ Edit `src/types/mydata.types.ts`, update XML builder, update validation

### "Fix AADE error 238"
→ Check `validation.ts` line for issue date validation

---

## Quick Commands
```bash
npm run dev          # Dev server with hot reload
npm run build        # TypeScript compile + copy assets
npm test             # Run 12 tests (AFM, calculations, hash, XML, AADE live)
npm run start        # Production server
```

---

## Notes for AI Tools
- **Don't re-read entire codebase** - Use this agent + REFERENCE.md
- **Check REFERENCE.md first** for AADE specs before implementing
- **Follow existing patterns** in server.ts, database.ts, services/
- **Run tests** after changes: `npm test`
- **Build before deploy**: `npm run build`

---

*Generated for AADE myDATA Provider Engine v2.0.2*