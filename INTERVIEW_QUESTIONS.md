# INTERVIEW READINESS — CYBERSPHERE AI v4.0

## Top 25 Project-Specific Interview Questions

### Architecture & Design

1. **Walk me through the request lifecycle in CyberSphere AI. Starting from when a user clicks "Scan URL" in the frontend, what happens until the result is displayed?**
   - Expected answer: Frontend `UrlScanner.jsx` → API call via `endpoints.js` → axios interceptor adds JWT → `/api/scan/url` → `protect` middleware verifies JWT → `scanLimiter` rate limit → `validate` middleware → `scanUrlRoute` controller → external API calls (VirusTotal/AbuseIPDB) → result stored in MongoDB → response returned → frontend displays result with `VerdictBadge` and `RiskLevel`

2. **How did you structure the frontend for scalability, and why did you choose React.lazy + Suspense for routing?**
   - Expected answer: 36 lazily-loaded route chunks via React.lazy, Suspense fallback with branded Loader, manual vendor chunking in vite.config.js (react-vendor, socket-vendor, chart-vendor, etc.), reducing initial bundle and improving caching

3. **Explain the backend MVC pattern you implemented. How does a request flow through routes, middleware, controllers, and services?**
   - Expected answer: `routes/` defines endpoints with middleware chain → `middleware/` handles auth, validation, rate limiting, sanitization → `controllers/` handle HTTP logic → `services/` contain business logic and external integrations → `models/` define Mongoose schemas

4. **Why did you choose MongoDB Atlas over PostgreSQL for this project? What trade-offs did you consider?**
   - Expected answer: Document model fits security scan results and threat intelligence naturally, flexible schema for evolving security data, horizontal scaling via Atlas, global distribution, encryption at rest. Trade-off: less strict consistency than SQL, but acceptable for security analytics use case

5. **How does the AI Router decide between Gemini and Ollama? What factors influence the routing decision?**
   - Expected answer: `aiRouter.js` checks message length (>300 chars → Gemini), regex patterns for analysis-heavy requests (analyze, interpret, explain scan, etc.), Ollama availability via `isOllamaAvailable()`, fallback to other provider if primary fails

### Security Implementation

6. **Describe the complete authentication flow in CyberSphere AI. How do you handle login, MFA, session management, and logout?**
   - Expected answer: `/api/auth/login` validates credentials with bcrypt → issues JWT access token (15m) + refresh token (30d) in httpOnly cookies → optional TOTP MFA via `/api/auth/2fa/verify` using signed 2FA token (no userId in body) → `/api/auth/refresh` rotates refresh tokens → `/api/auth/logout` revokes refresh tokens → auth middleware verifies JWT on each request

7. **How do you prevent prompt injection attacks against your AI pipeline? Walk me through the defense layers.**
   - Expected answer: `sanitizePrompt.js` strips control characters, enforces 2000 char limit, detects injection patterns → `aiSecurity.js` redacts PII (email, SSN, credit card, phone, API keys), detects enhanced injection patterns, implements per-user rate limiting via Redis, filters output for system instruction leaks → `aiRouter.js` provides provider failover

8. **Explain your RBAC implementation. How do you enforce role-based access at the route level?**
   - Expected answer: `protect` middleware verifies JWT and attaches user to `req.user` → `authorize(...roles)` middleware checks `req.user.role` against allowed roles → routes use `router.use(protect, authorize('admin'))` or `authorize(['admin', 'security_manager'])` → 403 returned for unauthorized access

9. **How do you secure file uploads? What validation do you perform before accepting a user upload?**
   - Expected answer: `upload.js` middleware validates file type against allowlist (PDF, images, videos, documents), blocks executable extensions (exe, bat, cmd, js, sh, ps1), enforces 25MB size limit, generates unique filenames, stores outside web root → VirusTotal scan for malware → backend stores only hash, never returns raw file in responses

10. **What measures do you take to prevent NoSQL injection attacks?**
    - Expected answer: `sanitize.js` middleware strips dangerous MongoDB operators (`$where`, `$gt`, `$lt`, `$ne`, `$regex`, `$exists`, `__proto__`, `constructor`, `prototype`) from req.body/query/params → express-validator enforces types and formats → Mongoose schemas define strict types → never use `$where` in queries

### AI & Machine Learning

11. **How does the multimodal AI analysis work? What happens when a user uploads a file to the AI Chatbot?**
    - Expected answer: `AIChatbot.jsx` captures file via attachment menu → validates type/size → sends as FormData to `/chat/upload` → `multimodalAI.js` processes based on MIME type: images use Gemini Vision, PDFs use pdf-parse + text extraction, videos extract frames → content sent to `aiRouter.js` → selected provider analyzes with security focus → response formatted as security report card with risk level and confidence score

12. **What is the AI security pipeline? How do you ensure AI responses don't leak sensitive information?**
    - Expected answer: Input sanitization → security classification → provider routing → context building → AI processing → response formatting → security validation → report generation. Security validation includes: output filtering for system instruction leaks, PII redaction, policy compliance checking, response verification

13. **How do you handle AI provider failures? What is your fallback strategy?**
    - Expected answer: `aiRouter.js` implements graceful failover: if Gemini fails (quota, network, invalid key), automatically switches to Ollama with explanatory message → if Ollama fails, returns fallback reply with security tips → if both fail, returns `FALLBACK_REPLY` with basic security recommendations

### Database & Caching

14. **Explain your MongoDB indexing strategy. Which indexes did you create and why?**
    - Expected answer: User: email (unique), email verification/password reset expiry (TTL), role+isActive, text search on name/email. ScanHistory: user+createdAt, user+type+createdAt, verdict+createdAt. ThreatIntel: user+createdAt, ioc+iocType (unique), reputationScore, text search on ioc/threatCategory. SecurityAlert: userId+createdAt, severity+status. Plus indexes on ChatLog, BehaviorTimeline, AttachmentAnalysis, AIAnalysis, AgentMemory, UserRiskEvent, UserBehaviorProfile, SecurityIncident, SecurityAuditLog, ContainerImage, CloudResource, CloudProvider, KubernetesResource, IncidentResponse, IncidentReport, NoteChatLog, Notification, GraphEntity, GraphRelationship, Document, SocketConnection

15. **How does your Redis caching layer work? What data do you cache and why?**
    - Expected answer: `cacheManager.js` provides unified async interface → `redisClient.js` connects to Redis with graceful fallback to MemoryFallback → caches: threat intelligence results (1hr TTL), AI responses, session data, rate limit counters → uses key prefixing, JSON serialization, TTL support, cache invalidation patterns → `getOrSet` for atomic fetch-or-compute

16. **What is your database query optimization strategy? How do you avoid N+1 queries?**
    - Expected answer: Use `.lean()` for read-only queries to get plain JS objects → `.select()` to project only needed fields → `.populate()` for controlled population → `Promise.all()` for parallel independent queries → aggregation pipelines with `$facet` for pagination → limit result sets (`.limit(20)`, `.limit(50)`) → indexes on frequently queried fields

### Deployment & Infrastructure

17. **Walk me through your Docker setup. How do you ensure container security?**
    - Expected answer: Multi-stage builds (deps + runtime) → `node:18.20.4-alpine3.20` base image → non-root user (nodejs, UID 1001) → `cap_drop: ALL` → `security_opt: no-new-privileges:true` → read-only root filesystem with tmpfs for writable paths → health checks → resource limits → no secrets in images (all via env vars)

18. **How does your Kubernetes deployment ensure high availability and scalability?**
    - Expected answer: Deployment with 2 replicas, RollingUpdate strategy (maxSurge: 1, maxUnavailable: 0) → HPA scales backend 2-10 replicas on CPU/memory, frontend 2-6 on CPU, Redis 1-3 on memory → PodDisruptionBudgets for availability → NetworkPolicies for pod-to-pod communication → RBAC with least-privilege service accounts → ConfigMaps/Secrets for configuration → startup/liveness/readiness probes

19. **Explain your CI/CD pipeline. What security gates do you have in place?**
    - Expected answer: GitHub Actions triggers on push/PR to main/master → CI: backend tests (336 Jest tests), frontend tests/build, compose config validation → Security Pipeline: Gitleaks secret scanning, npm audit (fail on high/critical), Trivy container scanning (critical only), Syft SBOM generation, Semgrep code security scanning → all security failures BLOCK the release

20. **How do you manage secrets in production? What is your secrets management strategy?**
    - Expected answer: Never commit secrets to Git → `.env` files gitignored → `.env.example` contains placeholders only → production secrets via environment variables → Kubernetes Secrets with external secret management → Docker Compose uses `${VARIABLE}` substitution → JWT secrets, API keys, database passwords all environment-driven → config fails fast in production if required vars missing

### Testing & Quality

21. **Describe your testing strategy. What types of tests do you have and how do you ensure quality?**
    - Expected answer: Backend: 336+ Jest tests with 95% coverage (auth, alerts, security, service layers) → Frontend: 90+ Vitest tests with React Testing Library (component rendering, user interactions, accessibility) → E2E: 150+ Playwright tests (auth flow, security modules, dashboard, responsive design) → CI runs all tests on every PR → ESLint + Prettier for code quality → Husky pre-commit hooks

22. **How do you handle test isolation and avoid test pollution?**
    - Expected answer: Backend uses mongodb-memory-server for isolated test database → test environment disables rate limiting (`NODE_ENV=test`) → each test suite gets fresh data → `beforeEach/afterEach` cleanup → Jest `--runInBand` for sequential execution → unique test user credentials per run

### Observability & Monitoring

23. **How do you monitor the application in production? What metrics do you track?**
    - Expected answer: OpenTelemetry SDK exports traces to OTLP collector → Prometheus scrapes metrics from `/metrics` endpoint → Grafana dashboards show: request latency (p50/p95/p99), error rates, AI provider response times, scan throughput, authentication success/failure rates, MongoDB connection pool, Redis cache hit ratio → Winston structured logging with correlation IDs → health check endpoint at `/api/health`

24. **Explain your alerting strategy. What alerts do you have and how do you respond to them?**
    - Expected answer: Grafana alerts for: error rate >5%, authentication failure spikes, threat detection anomalies, database connection pool exhaustion, AI service unavailability, container restarts, high memory usage → alerts routed to on-call via Slack/email → runbooks in `docs/11-PRODUCTION_RUNBOOK.md` define response procedures → incident response playbooks in `docs/INCIDENT_RESPONSE.md`

### System Design & Trade-offs

25. **If you were to redesign this system today, what would you change? What are the biggest trade-offs you made?**
    - Expected answer: Trade-offs made: MongoDB chosen over SQL for flexibility but less strict consistency → JWT chosen over sessions for statelessness but requires careful revocation handling → Redis used for caching but adds operational complexity → Monolithic Express instead of microservices for simplicity but limits independent scaling → Would consider: PostgreSQL for critical transactional data, service mesh for microservices, event-driven architecture for decoupling

---

## Question Categories by Interview Type

### System Design Interview
- Questions 1, 3, 4, 16, 17, 18, 19, 20, 25

### Security Engineering Interview
- Questions 6, 7, 8, 9, 10, 11, 12, 13

### Backend Engineering Interview
- Questions 1, 3, 14, 15, 16, 21, 22, 23, 24

### Frontend Engineering Interview
- Questions 2, 11

### DevOps/SRE Interview
- Questions 17, 18, 19, 20, 23, 24

### AI/ML Engineering Interview
- Questions 5, 11, 12, 13

### Database Engineering Interview
- Questions 14, 15, 16

### Full-Stack General Interview
- Questions 1, 3, 6, 11, 17, 21, 25

---

*Interview Readiness — CyberSphere AI v4.0*
*Generated: August 6, 2026*
*Purpose: Technical interview preparation*
