# Security — Enterprise Cyber Security Platform v2.1.1

## Security Posture

This document outlines the security measures implemented in the Enterprise Cyber Security Platform.

## Authentication & Authorization

### JWT Tokens
- **Access Tokens**: Short-lived (15 minutes), signed with HMAC-SHA256
- **Refresh Tokens**: Long-lived (30 days), stored in httpOnly cookies
- **Token Rotation**: Refresh tokens are rotated on each use
- **Token Revocation**: Refresh tokens are tracked per-user and can be revoked

### Multi-Factor Authentication (MFA)
- **TOTP-based MFA** using RFC 6238 compliant algorithm (SHA-1, 30-second window)
- **Backup Codes**: 10 one-time-use backup codes per user
- **Rate Limiting**: 5 verification attempts per 60-second window
- **TOTP Secret Encryption**: Secrets are encrypted at rest using AES-256

### Password Security
- **Hashing**: bcrypt with 12 rounds
- **Strength Analysis**: Shannon entropy, crack-time estimation, breach awareness
- **Account Lockout**: Configurable (default: 5 attempts, 15-minute lockout)

### Session Management
- **httpOnly Cookies**: Refresh tokens cannot be accessed by JavaScript
- **SameSite=Strict**: CSRF protection
- **Secure Flag**: Cookies only sent over HTTPS in production
- **Token Binding**: Access tokens include JTI for revocation support

## Transport Security

### HTTPS Enforcement
- HSTS header with `max-age=31536000; includeSubDomains; preload`
- All production deployments must use HTTPS
- Cloudflare CDN provides TLS termination

### CORS Configuration
- Restricted to configured `CLIENT_ORIGIN` in production
- Credentials enabled for authenticated requests
- Development allows `http://localhost:5173`

### Cookie Security
- `httpOnly`: Prevents XSS-based token theft
- `secure`: Only sent over HTTPS in production
- `sameSite=strict`: Prevents CSRF attacks
- `maxAge=30d`: Reasonable session lifetime

## Application Security

### Input Validation
- **express-validator** on all sensitive endpoints
- **Zod schema validation** for configuration
- **Mongoose sanitization** for NoSQL injection prevention
- **File type validation** with blocked extensions list
- **File size limits** (10MB max upload)

### Content Security Policy (CSP)
- `default-src 'self'`: Only load resources from same origin
- `script-src 'self'`: No inline scripts, no external scripts
- `style-src 'self' 'unsafe-inline'`: Allow inline styles for Tailwind
- `connect-src 'self'`: Restrict fetch/XHR to same origin
- `object-src 'none'`: No Flash/embeds
- `frame-ancestors 'none'`: No clickjacking

### Rate Limiting
- **Global**: 1000 requests per 15 minutes
- **Auth routes**: 10 requests per 15 minutes
- **Chat routes**: 20 requests per minute
- **Scan routes**: 30 requests per minute
- **Upload routes**: 5 requests per minute

### AI Security
- **Prompt Injection Detection**: Server-side sanitization before AI calls
- **Input Sanitization**: Control characters stripped, dangerous patterns detected
- **AI Request Timeouts**: 30-second timeout on all AI provider requests
- **Graceful Fallback**: Automatic failover between AI providers

### Error Handling
- **Secure Error Responses**: Internal errors hidden in production
- **No Stack Traces**: Production errors return generic messages
- **Request Correlation IDs**: Every request has a unique ID for tracing

## Data Protection

### Sensitive Data Handling
- **Passwords**: Never stored in plaintext, hashed with bcrypt
- **Tokens**: Never returned in API responses
- **Reset Tokens**: Single-use, time-limited, never stored in plaintext
- **MongoDB Projection**: `select: false` on password, tokens, refresh tokens
- **File Security**: Type validation, size limits, blocked extensions

### Encryption
- **At Rest**: MongoDB Atlas encryption at rest
- **In Transit**: TLS 1.2+ for all connections
- **TOTP Secrets**: AES-256 encryption at rest

## Infrastructure Security

### Docker Security
- **Non-root user**: Backend runs as `nodejs` (UID 1001)
- **Read-only filesystem**: Where possible
- **No privileged containers**: `allowPrivilegeEscalation: false`
- **Image scanning**: Trivy integration in CI/CD

### Kubernetes Security
- **Network Policies**: Restrict pod-to-pod communication
- **RBAC**: Least-privilege service accounts
- **Secrets**: Kubernetes Secrets with external secret management
- **TLS**: Ingress with automatic certificate provisioning

## Audit & Compliance

### SOC2 Foundation
- **Audit Logging**: All security-relevant events logged
- **Access Logs**: Every API request logged with correlation ID
- **User Actions**: Login, logout, permission changes, data access
- **Retention**: Audit logs retained per compliance requirements

### OpenTelemetry
- **Tracing**: Distributed tracing across all services
- **Metrics**: Prometheus metrics endpoint on port 9464
- **Alerting**: Grafana dashboards with security alerts

## Security Checklist

- [x] JWT access + refresh tokens with short expiry
- [x] TOTP MFA with backup codes
- [x] bcrypt password hashing (12 rounds)
- [x] httpOnly + secure + sameSite cookies
- [x] Helmet security headers
- [x] CSP with restrictive defaults
- [x] Rate limiting on all routes
- [x] Input validation on all endpoints
- [x] NoSQL injection prevention
- [x] Prompt injection detection
- [x] Request correlation IDs
- [x] Secure error handling in production
- [x] TLS enforcement
- [x] CORS restricted to origin
- [x] File upload validation
- [x] Non-root container execution
- [x] Image vulnerability scanning
- [x] Audit logging
- [x] OpenTelemetry observability