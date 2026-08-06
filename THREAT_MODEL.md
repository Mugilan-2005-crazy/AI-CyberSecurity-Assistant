# Threat Model

## System Overview

CyberSphere AI is an autonomous cloud cyber defense platform providing:
- Security scanning (URL, password, email, file, QR)
- AI-powered SOC analysis (Gemini + Ollama)
- Threat intelligence correlation (VirusTotal, AbuseIPDB, OTX, NVD)
- UEBA (User Entity Behavior Analytics)
- Cloud and container security posture management
- Incident response automation

## Assets

| Asset | Sensitivity | Protection |
|-------|------------|------------|
| User credentials (passwords) | Critical | bcrypt 12 rounds, never stored in plaintext |
| JWT access tokens | High | Short-lived (15m), HS256 signed, jti for revocation |
| JWT refresh tokens | High | 30-day lifetime, stored in httpOnly cookies, rotated on use |
| TOTP secrets | Critical | AES-256-GCM encrypted at rest |
| Scan results & reports | Medium | MongoDB with user-scoped queries (RBAC) |
| API keys (Gemini, VT, etc.) | Critical | Environment variables, never in code |
| Uploaded files | Medium | MIME allowlist, size limits, no execution |
| AI prompts & responses | Medium | PII redaction, prompt injection detection |

## Trust Boundaries

```
┌─────────────────────────────────────────────────────┐
│  Internet (Untrusted)                               │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │  Caddy Reverse Proxy (TLS termination)        │  │
│  │  - HSTS, CSP, X-Frame-Options                │  │
│  │  - HTTP→HTTPS redirect (308)                 │  │
│  └────────────┬─────────────────────────────────┘  │
│               │                                      │
│  ┌────────────┴─────────────────────────────────┐  │
│  │  Frontend (nginx)                           │  │
│  │  - Static assets, security headers          │  │
│  └────────────┬─────────────────────────────────┘  │
│               │ API calls (/api/*)                   │
│  ┌────────────┴─────────────────────────────────┐  │
│  │  Backend (Node.js)                         │  │
│  │  - JWT validation                           │  │
│  │  - Rate limiting (Redis)                     │  │
│  │  - Input sanitization                        │  │
│  └────────────┬─────────────────────────────────┘  │
│               │                                      │
│  ┌────────────┴─────────────────────────────────┐  │
│  │  Internal Services (Trusted)                │  │
│  │  • MongoDB Atlas                             │  │
│  │  • Redis Cloud                               │  │
│  │  • Google Gemini API                         │  │
│  │  • VirusTotal / OTX / AbuseIPDB / NVD        │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

## Threat Actors

| Actor | Motivation | Capability | Mitigations |
|-------|-----------|------------|-------------|
| External attacker | Reconnaissance, exploitation | Network access, basic tooling | WAF, rate limiting, WAF |
| Authenticated user | Privilege escalation, data exfiltration | Valid JWT, API access | RBAC, BOLA checks, field selection |
| Malicious file uploader | Malware distribution | File upload capability | MIME allowlist, VT scanning |
| AI prompt injection attacker | LLM manipulation, data exfiltration | Malicious prompts | aiSecurity.js: 6-layer protection |
| Insider threat | Data theft, sabotage | Higher privileges | RBAC, audit logs, MFA |
| Supply chain attacker | Compromise dependencies | npm/Docker image access | Dependabot, Trivy, Gitleaks, SBOM |

## STRIDE Threat Analysis

### Spoofing
- **Threat**: JWT token forgery
- **Mitigation**: HS256 with strong secret, algorithm pinned
- **Threat**: Impersonation via stolen refresh token
- **Mitigation**: Token rotation, jti revocation, httpOnly cookies

### Tampering
- **Threat**: NoSQL injection via query params
- **Mitigation**: sanitize.js middleware strips `$` operators
- **Threat**: Prototype pollution via JSON body
- **Mitigation**: `express.urlencoded({ extended: false })`, sanitize middleware

### Repudiation
- **Threat**: User denies performing action
- **Mitigation**: Structured audit logging with correlation IDs, immutable logs

### Information Disclosure
- **Threat**: Sensitive fields returned in API responses
- **Mitigation**: MongoDB `select: false` on passwords/tokens
- **Threat**: Error messages leak stack traces
- **Mitigation**: Production error handler hides internals

### Denial of Service
- **Threat**: Brute force login attempts
- **Mitigation**: Account lockout (5 attempts), rate limiting
- **Threat**: Large payload DoS
- **Mitigation**: `requestSizeLimit(10MB)`, `express.json({ limit: '10mb' })`

### Elevation of Privilege
- **Threat**: Regular user accesses other users' data
- **Mitigation**: BOLA checks in controllers, RBAC middleware
- **Threat**: User escalates to admin role
- **Mitigation**: Server-side role enforcement, no client-side trust

## Attack Surfaces

### 1. Authentication Endpoints (`/api/auth/*`)
- Protected by: rate limiting (10/15min), input validation, bcrypt
- Audit events: login success/failure, password changes, 2FA attempts

### 2. AI Endpoints (`/api/chat/*`, `/api/ai/soc/*`)
- Protected by: aiSecurity.js 6-layer gate (input validation, PII redaction, prompt injection detection, Redis rate limiting, output filtering, audit logging)

### 3. File Upload Endpoints (`/api/scan/file`, `/api/ai/upload`)
- Protected by: MIME allowlist (14 types), size limit (25MB), filename sanitization

### 4. Admin Endpoints (`/api/admin/*`)
- Protected by: `authorize('admin')` middleware, RBAC, all operations audited

### 5. Container/Docker API (`/api/container-security/*`)
- Protected by: JWT auth, no Docker socket access, read-only operations only

## Risk Assessment

| Threat | Likelihood | Impact | Risk Level | Status |
|--------|-----------|--------|------------|--------|
| JWT secret compromise | Low | Critical | High | Mitigated (32+ char secrets, rotation support) |
| BOLA on alerts | Medium | High | High | Fixed (userId filtering for non-admin users) |
| AI prompt injection | Medium | Medium | Medium | Mitigated (aiSecurity.js gate) |
| Rate limit bypass | Low | Medium | Medium | Mitigated (Redis-backed store) |
| Container escape | Low | Critical | Medium | Mitigated (non-root, read-only FS, cap_drop) |
| Supply chain attack | Medium | High | High | Mitigated (Dependabot, Trivy, Gitleaks, Semgrep) |
