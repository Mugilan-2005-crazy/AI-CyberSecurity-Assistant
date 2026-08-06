# INTERVIEW PREPARATION GUIDE — CyberSphere AI v4.0

---

## Project Explanation (30-Second Version)

CyberSphere AI v4.0 is an enterprise-grade cloud cyber defense platform that combines AI-powered threat detection with comprehensive security operations. It provides real-time security analysis, threat intelligence, behavioral analytics, cloud/container security, and automated incident response — all built with defense-in-depth security principles and production-ready infrastructure.

---

## Project Explanation (2-Minute Version)

CyberSphere AI is a full-stack security operations platform built with React 18, Vite 5, Node.js 18+, and Express.js. It unifies traditional security scanning (URL, password, email, file, QR) with AI-powered analysis using Google Gemini and Ollama. The platform includes threat intelligence across 4 providers, user behavior analytics, cloud security posture management, container security, security knowledge graphs, and AI-generated incident reports. It's deployed with Docker Compose and Kubernetes, monitored with OpenTelemetry and Prometheus, and secured with JWT + TOTP MFA, RBAC, rate limiting, and prompt injection protection.

---

## Architecture Explanation

### High-Level Architecture

```
┌──────────────┐     ┌──────────────────┐     ┌───────────────────────────┐
│   Frontend   │────▶│  Express Backend  │────▶│      MongoDB Atlas        │
│  React 18    │     │  Node.js 18+      │     │  (Document Store)         │
│  Vite 5      │     │  MVC Architecture │     │                           │
│  Tailwind    │     │  JWT Auth + RBAC  │     │  ┌─────────────────────┐  │
│  PWA/Tauri   │     │  express-validator│     │  │ 28 Mongoose Models   │  │
└──────────────┘     └────────┬──────────┘     │  └─────────────────────┘  │
                              │                └───────────────────────────┘
                              ▼
                    ┌─────────────────┐
                    │   AI Router     │
                    │  Gemini + Ollama│
                    └────────┬────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │   Redis Cloud   │
                    │  (Cache + Rate) │
                    └─────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ OpenTelemetry   │
                    │ Prometheus+     │
                    │ Grafana         │
                    └─────────────────┘
```

### Request Lifecycle

1. **Frontend** — User interacts with React component (e.g., URL Scanner)
2. **API Client** — Axios sends request with JWT cookie to `/api/scan/url`
3. **Middleware Chain**:
   - `cors` — Validates origin
   - `cookie-parser` — Parses cookies
   - `protect` — Verifies JWT from httpOnly cookie, attaches user to `req.user`
   - `authorize` — Checks user role against route requirements
   - `scanLimiter` — Rate limits via Redis (30 requests/minute)
   - `validate` — Validates input with express-validator
   - `sanitize` — Strips MongoDB operators to prevent NoSQL injection
4. **Controller** — `scanUrlRoute` handles HTTP logic, calls service
5. **Service** — `urlScanner.js` performs pure synchronous analysis
6. **Model** — `recordScan` persists result to MongoDB (gracefully handles DB downtime)
7. **Response** — JSON returned with `success`, `result`, `persisted`, `scanId`
8. **Frontend** — Displays result with `VerdictBadge` and `RiskLevel` components

### AI Pipeline Lifecycle

```
User Input → sanitizePrompt → aiSecurity (PII redact) → aiRouter → Provider (Gemini/Ollama) → Format Response → Security Validate → Report Generate → Persist
```

---

## Security Explanation

### Defense-in-Depth Layers

**Layer 1: Authentication**
- JWT access tokens (15m expiry) + refresh tokens (30d) in httpOnly cookies
- bcrypt password hashing with 12 rounds
- TOTP MFA (RFC 6238) with 10 backup codes
- Account lockout after 5 failed attempts

**Layer 2: Authorization**
- RBAC with 3 roles: admin, security_manager, user
- Route-level middleware enforcement
- Resource ownership checks

**Layer 3: Input Validation**
- express-validator on all sensitive endpoints
- Mongoose sanitization middleware
- File type/size validation with blocked extensions
- Control character stripping

**Layer 4: Transport Security**
- Helmet security headers (HSTS, CSP, X-Frame-Options)
- CORS restricted to configured origin
- Secure, httpOnly, sameSite=strict cookies

**Layer 5: AI Security**
- Prompt injection detection before AI calls
- PII redaction (email, SSN, credit card, phone, API keys)
- 30-second AI request timeouts
- Automatic provider failover

**Layer 6: Infrastructure Security**
- Non-root container execution
- Read-only filesystems where possible
- Dropped Linux capabilities
- Network policies in Kubernetes
- Automated vulnerability scanning (Trivy, Gitleaks, Semgrep)

---

## Database Explanation

### MongoDB Atlas
- **Models:** 28 Mongoose schemas covering users, scans, threats, incidents, reports, documents, cloud resources, containers, knowledge graphs, UEBA profiles, audit logs, and more
- **Indexing:** Strategic indexes on frequently queried fields (userId, createdAt, status, type)
- **Aggregation:** Complex pipelines for dashboard aggregations and analytics
- **Encryption:** Encryption at rest via MongoDB Atlas
- **Resilience:** Graceful degradation — application continues without DB for non-critical operations

### Redis Cloud
- **Session Management:** Refresh token storage with TTL
- **Rate Limiting:** Per-route throttling with sliding window algorithm
- **Threat Intel Cache:** Cached IOC lookups with configurable TTL
- **Fallback:** Automatic in-memory store when Redis is unavailable

---

## Authentication Explanation

### Complete Auth Flow

```
Login → bcrypt compare → JWT access (15m) + refresh (30d) in httpOnly cookies
    → Optional TOTP MFA (signed 2FA token, no userId in body)
    → Subsequent requests: cookies sent automatically
    → Middleware verifies JWT, extracts role
    → RBAC middleware checks route permissions
    → Token refresh: POST /api/auth/refresh (rotates refresh token)
    → Logout: POST /api/auth/logout (revokes refresh token)
```

### Key Design Decisions
- **httpOnly cookies** prevent XSS-based token theft
- **sameSite=strict** prevents CSRF attacks
- **Short-lived access tokens** (15m) limit damage from token theft
- **Refresh token rotation** on each use prevents replay attacks
- **JTI claims** enable per-token revocation

---

## Caching Explanation

### Redis Usage

**Session Management**
- Refresh tokens stored with 30-day TTL
- Automatic cleanup on logout or password change

**Rate Limiting**
- Per-route sliding window counters
- Graceful fallback to in-memory store when Redis is down

**Threat Intelligence**
- IOC results cached with 1-hour TTL (configurable)
- Reduces external API calls and improves response time

**AI Response Caching**
- Similar queries can be cached (implementation-dependent)

### Cache Resilience
- Redis connection failures don't crash the application
- Rate limiter falls back to memory store
- Application logs cache degradation events

---

## Redis Explanation

Redis serves three primary purposes in CyberSphere AI:

1. **Rate Limiting** — `express-rate-limit` with `rate-limit-redis` store implements per-route throttling. When Redis is unavailable, the system falls back to an in-memory store.

2. **Session Management** — Refresh tokens are stored in Redis with TTL. This enables distributed session management across multiple backend instances.

3. **Threat Intelligence Cache** — Results from external APIs (VirusTotal, AbuseIPDB, OTX, NVD) are cached to reduce API costs, respect rate limits, and improve response times.

**Configuration:**
- Host: Configurable via `REDIS_HOST` env var
- Port: 6379
- DB: 0
- Password: Configurable via `REDIS_PASSWORD`
- Key prefix: `cybersec:` for namespacing

---

## Docker Explanation

### Multi-Service Architecture

CyberSphere AI uses Docker Compose to orchestrate 10 services:

| Service | Image | Purpose |
|---------|-------|---------|
| mongodb | mongo:7 | Primary database |
| redis | redis:7-alpine | Cache and session store |
| backend | node:lts-alpine (custom build) | Express API server |
| frontend | nginx:1.27.4-alpine (custom build) | Static asset server |
| caddy | caddy:2.8.4-alpine | HTTPS reverse proxy |
| prometheus | prom/prometheus:v2.53.0 | Metrics collection |
| grafana | grafana:11.1.0 (custom build) | Metrics visualization |
| otel-collector | otel/opentelemetry-collector:0.104.0 | Telemetry hub |
| mongodb-exporter | quay.io/prometheus/mongodb-exporter:0.23.0 | MongoDB metrics |
| ollama | ollama/ollama:0.3.38 | Local AI provider |

### Security Hardening
- Non-root users (`nodejs` UID 1001)
- Read-only filesystems where possible
- `cap_drop: ALL` — drops all Linux capabilities
- `security_opt: no-new-privileges:true`
- Resource limits (memory, CPU)
- Health checks on all services
- Temporary filesystems for `/tmp` and uploads

---

## Kubernetes Explanation

### Manifests Structure

| File | Purpose |
|------|---------|
| `namespace.yaml` | Isolated namespace for CyberSphere AI |
| `configmap.yaml` | Non-sensitive configuration |
| `secrets.yaml` | Encrypted secrets (JWT, DB credentials, API keys) |
| `deployment.yaml` | Backend and frontend deployments with resource limits |
| `service.yaml` | ClusterIP services for internal communication |
| `ingress.yaml` | Ingress with TLS termination and path routing |
| `hpa.yaml` | Horizontal Pod Autoscaler for backend |
| `pdb.yaml` | Pod Disruption Budget for high availability |
| `rbac.yaml` | Service accounts and RBAC policies |

### Production Features
- **HPA:** Auto-scales backend pods based on CPU/memory utilization
- **PDB:** Ensures minimum pods available during disruptions
- **NetworkPolicy:** Restricts pod-to-pod communication
- **RBAC:** Least-privilege service accounts
- **Health Probes:** Startup, liveness, and readiness probes for all deployments
- **Resource Limits:** Memory and CPU constraints for all containers

---

## OpenTelemetry Explanation

### Observability Architecture

```
Application → OpenTelemetry SDK → OTLP Exporter → Collector → Prometheus + Grafana
     │                    │
     ▼                    ▼
  Logs (Winston)    Metrics (Prometheus)
  Traces (OTel)     Dashboards (Grafana)
```

### Components

**OpenTelemetry SDK (Backend)**
- Auto-instrumentation for Express.js HTTP handlers
- Custom spans for AI provider calls, database queries, scan operations
- Context propagation across async boundaries

**OTLP Exporter**
- Exports traces and metrics to OpenTelemetry Collector via HTTP

**OpenTelemetry Collector**
- Receives OTLP data from backend
- Processes and routes to Prometheus
- Exposes self-metrics on `:8889`

**Prometheus**
- Scrapes metrics from backend (`:9464/metrics`) and collector
- Stores time-series data
- Configurable retention and alerting rules

**Grafana**
- Visualizes metrics with pre-configured dashboards
- Alerts on security-relevant thresholds
- Available on port 3001

### Key Metrics Tracked
- Request latency (p50, p95, p99)
- Error rate by endpoint
- AI provider response times
- Scan throughput
- Authentication success/failure rates
- Memory and CPU utilization
- MongoDB connection pool usage
- Redis cache hit ratio

---

## AI Pipeline Explanation

### Provider Routing Logic

The AI Router (`aiRouter.js`) selects between Gemini and Ollama based on:

1. **Message Length**: >300 characters → Gemini (complex analysis)
2. **Pattern Matching**: Regex patterns for analysis-heavy requests (analyze, interpret, explain scan, etc.)
3. **Availability**: `isOllamaAvailable()` checks Ollama health
4. **Fallback**: If primary fails, automatically switches to secondary

### Security Guardrails

**Before AI Processing:**
- `sanitizePrompt.js`: Strips control characters, enforces 2000 char limit, detects injection patterns
- `aiSecurity.js`: Redacts PII (email, SSN, credit card, phone, API keys), detects enhanced injection patterns, implements per-user rate limiting via Redis

**After AI Processing:**
- Output filtering for system instruction leaks
- Policy compliance checking
- Response verification

### Response Formatting

AI responses are formatted as security report cards containing:
- Risk level (Low, Medium, High, Critical)
- Threats identified
- Confidence score
- Recommendations
- Provider badge (Gemini/Ollama)

---

## Expected Interview Questions

### Architecture & Design

**Q1: Walk me through the request lifecycle when a user scans a URL.**
> Expected answer: Frontend component → Axios with JWT cookie → Express middleware chain (CORS, protect, authorize, rate limit, validate, sanitize) → Controller → Service → Model → MongoDB → Response → Frontend displays with VerdictBadge and RiskLevel

**Q2: Why did you choose MongoDB over PostgreSQL?**
> Expected answer: Document model fits security scan results naturally, flexible schema for evolving security data, horizontal scaling via Atlas, global distribution. Trade-off: less strict consistency, but acceptable for security analytics.

**Q3: How does your frontend code splitting work?**
> Expected answer: React.lazy + Suspense for 36 route-level chunks, manual vendor chunking in Vite (react-vendor, socket-vendor, chart-vendor, motion-vendor, i18n-vendor, axios-vendor, ui-vendor) reducing initial bundle and improving caching.

### Security

**Q4: How do you prevent prompt injection attacks?**
> Expected answer: Multi-layer defense: sanitizePrompt strips control characters and detects injection patterns → aiSecurity redacts PII and detects enhanced patterns → per-user rate limiting via Redis → output filtering for system instruction leaks → provider failover.

**Q5: Explain your RBAC implementation.**
> Expected answer: protect middleware verifies JWT and attaches user → authorize middleware checks role against allowed roles → routes use authorize(['admin', 'security_manager']) → 403 for unauthorized access.

**Q6: How do you secure file uploads?**
> Expected answer: upload.js validates type against allowlist, blocks executable extensions, enforces 25MB size limit, generates unique filenames, stores outside web root → VirusTotal scan for malware → backend stores only hash.

### AI & Machine Learning

**Q7: How does the AI Router work?**
> Expected answer: Checks message length (>300 chars → Gemini), regex patterns for analysis-heavy requests, Ollama availability via isOllamaAvailable(), automatic failover to other provider if primary fails.

**Q8: What happens when both AI providers fail?**
> Expected answer: Returns FALLBACK_REPLY with basic security recommendations. The system degrades gracefully without crashing.

### Database & Caching

**Q9: How does Redis improve performance?**
> Expected answer: Caches threat intelligence results (1-hour TTL), manages refresh token sessions with TTL, implements per-route rate limiting with sliding window. Falls back to in-memory store when Redis is down.

**Q10: How do you handle MongoDB outages?**
> Expected answer: Graceful degradation — application continues without DB for non-critical operations. Scan results return with persisted: false when DB is offline. All non-critical DB operations use try/catch with fallback.

### DevOps

**Q11: What happens in your CI/CD pipeline?**
> Expected answer: Backend tests run with Jest → Frontend builds with Vite → Docker images built and validated → Security scans: npm audit, ESLint, Trivy container scan, Gitleaks secret scan, Semgrep code analysis → Codecov uploads coverage.

**Q12: How do you handle secrets in production?**
> Expected answer: Environment variables injected via Docker Compose or Kubernetes Secrets. Never committed to repo. Gitleaks scans in CI/CD prevent accidental commits. Rotated regularly.

---

## Strong Sample Answers

### Q: Why did you build this project?

"I wanted to build a project that demonstrates full-stack engineering at an enterprise level, not just a CRUD app. CyberSphere AI combines my interests in security, AI, and distributed systems into a cohesive platform. Every component — from the AI security pipeline to the Kubernetes deployment — was designed with production-readiness in mind."

### Q: What was the hardest technical challenge?

"Implementing the AI security pipeline was the most complex. I needed to detect prompt injection attacks before they reached the AI provider, redact PII from both inputs and outputs, and ensure the system failed gracefully when AI providers were unavailable. The solution involved multiple sanitization layers, regex-based pattern detection, Redis-backed rate limiting per user, and automatic provider failover."

### Q: How do you approach security in your projects?

"Security-first design. I start by identifying threat vectors, then implement defense-in-depth controls at each layer: authentication (JWT + MFA), authorization (RBAC), input validation, transport security (Helmet + CSP), AI security (prompt injection detection), and infrastructure security (container hardening, network policies). I also automate security scanning in CI/CD with Gitleaks, Trivy, and Semgrep."

### Q: Tell me about a bug you fixed.

"The AI provider timeout was causing hanging requests. I implemented a 30-second timeout on all AI provider calls, added automatic failover to the secondary provider, and created a fallback response for when both providers are unavailable. This required coordinating changes across the AI Router, middleware, and frontend loading states."
