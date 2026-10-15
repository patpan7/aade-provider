Technology Stack
Layer	Technology
Runtime	Node.js (ESM modules)
Language	TypeScript (strict mode)
Framework	Express.js
Database	SQLite via sql.js (WASM) - in-memory with file persistence
XML	fast-xml-parser (streaming SAX parser)
Frontend	Alpine.js + Tailwind CDN (single HTML file)
Build	tsc + custom asset copy script
Testing	Native Node.js assert (no framework)
Scaling Assessment: NOT ready for thousands req/min
Critical Bottlenecks
Component	Issue	Fix Needed
Database	sql.js loads entire DB into memory; single writer; no connection pooling	Migrate to PostgreSQL + pg pool or SQLite with WAL mode + better locking
AADE HTTP	Sequential fetch per request; no connection reuse; no rate limiting	Add undici/agentkeepalive pool; implement token bucket rate limiter (AADE has strict limits)
Express	Single-threaded; no clustering; sync DB writes block event loop	Add PM2 cluster mode or worker_threads for DB; move XML build to worker
Memory	Full XML strings in memory; no streaming response	Stream XML directly to AADE via fetch body stream
Caching	None for config, classifications, AFM validation	Add Redis or in-memory LRU for hot data
Observability	console.log only	Structured logging (pino), metrics (Prometheus), tracing
AADE-Specific Limits
Sandbox: ~10-30 req/sec per subscription key
Production: Higher but requires throttling + retry with exponential backoff
Must handle 429 Too Many Requests gracefully
Minimal Production Hardening (Priority Order)
PostgreSQL + connection pool (replace sql.js)
Rate limiter (token bucket per AADE subscription)
PM2 cluster mode (utilize all CPU cores)
Worker thread for XML building + DB writes
Structured logging + health endpoint
Dockerfile + docker-compose for orchestration