# AADE myDATA Provider - Scaling & Production Hardening Plan

## Current Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| **Runtime** | Node.js | 20+ (ESM) |
| **Language** | TypeScript | 5.5 (strict) |
| **Web Framework** | Express.js | 4.19 |
| **Database** | SQLite via sql.js (WASM) | 1.10 |
| **XML Parsing** | fast-xml-parser | 4.4 |
| **Frontend** | Alpine.js 3 + Tailwind CSS (CDN) | Single HTML |
| **Build** | tsc + custom copy script | - |
| **Testing** | Native Node assert | - |

---

## Scaling Assessment: Current State

### ❌ NOT Ready for High Throughput (1000+ req/min)

| Bottleneck | Current State | Impact at Scale |
|------------|---------------|-----------------|
| **Database** | sql.js loads entire DB in RAM; single writer; file sync on every write | OOM at >10k invoices; write contention; fsync blocks event loop |
| **AADE HTTP Client** | Native `fetch` per request; new TCP/TLS each time; no pool | CPU/TLS overhead; socket exhaustion; no retry/backoff |
| **Express** | Single process; sync DB writes block event loop | CPU core underutilized; latency spikes under load |
| **XML Generation** | Full string in memory per request | Memory pressure; GC pauses |
| **Rate Limiting** | None | AADE 429 errors; subscription key ban risk |
| **Observability** | console.log only | No visibility in production |

### AADE Rate Limits (Critical)
- **Sandbox**: ~10-30 req/sec per subscription key
- **Production**: Higher but strictly enforced
- **Must implement**: Token bucket per key + exponential backoff + circuit breaker

---

## Production Hardening Roadmap

### Phase 1: Foundation (Week 1-2) - **Do First, Low Refactor Risk**

| Task | Effort | Refactor Risk | Description |
|------|--------|---------------|-------------|
| **PostgreSQL Migration** | Medium | Low | Replace sql.js with `pg` + connection pool. Keep same `database.ts` interface. |
| **HTTP Agent Pool** | Low | Low | Add `undici` dispatcher with keep-alive. Wrap in `aadeHttpClient.ts`. |
| **Token Bucket Rate Limiter** | Low | Low | Per-subscription-key limiter. Middleware + AADE service integration. |
| **Structured Logging** | Low | Low | Replace console.log with `pino`. Add request IDs. |
| **Health/Ready Endpoints** | Low | None | `/healthz`, `/readyz` for k8s/PM2. |

### Phase 2: Concurrency (Week 2-3) - **Do Before Load Test**

| Task | Effort | Refactor Risk | Description |
|------|--------|---------------|-------------|
| **PM2 Cluster Mode** | Low | None | `pm2 start ecosystem.config.js -i max`. Zero code change. |
| **Worker Thread for XML/DB** | Medium | Medium | Move `buildInvoicesDocXML` + `insertInvoice` to worker. Keep async API. |
| **Streaming XML to AADE** | Medium | Medium | Build XML as stream → pipe to `fetch` body. Reduces memory. |

### Phase 3: Resilience (Week 3-4) - **Do Before Go-Live**

| Task | Effort | Refactor Risk | Description |
|------|--------|---------------|-------------|
| **Retry + Circuit Breaker** | Medium | Low | Wrap AADE calls. Handle 429/5xx with exponential backoff + jitter. |
| **Idempotency Keys** | Medium | Medium | Client sends `Idempotency-Key`; store + dedupe in PG. |
| **Metrics (Prometheus)** | Low | Low | `prom-client` counters: requests, latency, errors, AADE status codes. |
| **Distributed Tracing** | Low | Low | OpenTelemetry + Jaeger/Graf Tempo. |

### Phase 4: Operations (Ongoing)

| Task | Effort | Description |
|------|--------|-------------|
| **Dockerfile + Compose** | Low | Multi-stage build; non-root user; healthchecks. |
| **CI/CD Pipeline** | Medium | GitHub Actions: lint → test → build → docker push → deploy. |
| **Backup/Restore** | Low | PG dump cron + S3; test restore quarterly. |
| **Load Testing** | Medium | k6 script: ramp to 500 req/min; verify p99 < 2s, error rate < 0.1%. |

---

## Migration Difficulty Assessment

| Component | Current → Target | Difficulty | Can Defer? |
|-----------|------------------|------------|------------|
| **Database** | sql.js → PostgreSQL | **Medium** - Interface same, implementation swap | ❌ No - blocks everything |
| **HTTP Client** | fetch → undici pool | **Low** - Wrapper pattern | ❌ No - AADE will ban without it |
| **Rate Limiter** | None → Token bucket | **Low** - Middleware | ❌ No - Production requirement |
| **Clustering** | Single → PM2 cluster | **None** - Config only | ✅ Yes - Can add later |
| **Worker Threads** | Sync → Async worker | **Medium** - API stays same | ✅ Yes - Optimization |
| **Streaming XML** | String → Stream | **Medium** - Internal only | ✅ Yes - Memory optimization |
| **Observability** | console → pino/Prom | **Low** - Drop-in | ✅ Yes - Add anytime |

### Key Insight: **Database and HTTP client MUST be done first**. They are hard requirements for production, not optimizations. The rest can be incremental.

---

## Recommended: Do Phase 1 Now (Before Live)

**Reasoning:**
1. **Database migration** touches `database.ts` only - 4 functions, clean interface. 2-3 hours.
2. **HTTP pool + rate limiter** are new files (`aadeHttpClient.ts`, `rateLimiter.ts`) - zero touch to business logic.
3. **Logging** is search/replace `console.log` → `logger.info`.
4. **Total effort**: ~1-2 days for rock-solid foundation.
5. **Deferring** means rewriting under pressure later.

### Minimal Phase 1 Implementation Plan

```bash
# 1. Add dependencies
npm i pg undici pino pino-pretty
npm i -D @types/pg

# 2. Create files (new, no existing code changes):
# src/db/postgres.ts          - PG pool + same interface as database.ts
# src/services/aadeHttpClient.ts - undici dispatcher + fetch wrapper
# src/middleware/rateLimiter.ts  - Token bucket per AADE key
# src/logger.ts               - pino setup

# 3. Update imports (5 files):
# src/server.ts, src/services/invoice.service.ts, src/services/aade.service.ts
```

---

## File: `ecosystem.config.js` (for PM2 - add when ready)

```javascript
module.exports = {
  apps: [{
    name: 'aade-mydata-provider',
    script: 'dist/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 8000
    },
    error_file: '/var/log/aade/error.log',
    out_file: '/var/log/aade/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    kill_timeout: 5000,
    wait_ready: true,
    listen_timeout: 10000
  }]
};
```

---

## Decision

**Do Phase 1 now** (Database + HTTP Pool + Rate Limiter + Logging). 
- ~1-2 days work
- Zero logic changes
- Removes all "will fail in production" risks
- Remaining phases are optimizations, not requirements

**Phase 2+ can wait** until you have real load data.