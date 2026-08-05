# Architecture — Enterprise Cyber Security Platform v2.1

## Overview

The Enterprise Cyber Security Platform is a full-stack application designed for modern security operations centers (SOCs). It combines AI-powered threat detection, real-time monitoring, behavioral analytics, and incident response into a unified platform.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Layer                               │
│  ┌──────────┐  ┌──────────────┐  ┌─────────────────────────┐  │
│  │ Browser   │  │ PWA Install  │  │ Desktop App (Tauri)     │  │
│  │ (React)   │  │ (Manifest)   │  │ (Windows)               │  │
│  └─────┬─────┘  └──────┬───────┘  └────────────┬────────────┘  │
└────────┼────────────────┼────────────────────────┼──────────────┘
         │                │                        │
         ▼                ▼                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CDN / Edge Layer                             │
│              Cloudflare CDN (TLS termination)                   │
└────────────────────────┬────────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
┌────────────────┐ ┌──────────────┐ ┌──────────────────────────┐
│  Frontend Host │ │  Backend API │ │  AI Providers            │
│  (Vercel /     │ │  (Railway /  │ │  • Google Gemini         │
│   Cloudflare   │ │   Render)    │ │  • Ollama (local)        │
│   Pages)       │ │              │ │  • VirusTotal            │
│                │ │  Express.js  │ │  • AbuseIPDB             │
│  React + Vite  │ │  Node.js     │ │  • OTX                   │
│  Tailwind CSS  │ │  Mongoose    │ │  • NVD                   │
│  Socket.IO     │ │              │ │                          │
│  client        │ │              │ │                          │
└────────────────┘ └──────┬───────┘ └──────────────────────────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
     ┌────────────┐ ┌──────────┐ ┌──────────────┐
     │ MongoDB    │ │  Redis   │ │ OpenTelemetry│
     │ Atlas      │ │ Cloud    │ │ + Prometheus │
     │ (Primary)  │ │ (Cache)  │ │ + Grafana    │
     └────────────┘ └──────────┘ └──────────────┘
```

## Backend Architecture

### Core Stack
- **Runtime**: Node.js 18+
- **Framework**: Express.js with MVC pattern
- **Database**: MongoDB Atlas (Mongoose ODM)
- **Cache**: Redis Cloud / Upstash
- **Real-time**: Socket.IO (namespaced `/security`)
- **Observability**: OpenTelemetry + Prometheus + Grafana

### Key Modules
| Module | Path | Description |
|--------|------|-------------|
| Auth | `src/services/auth/` | JWT, TOTP MFA, session management |
| AI | `src/services/ai/` | AI router, Gemini, Ollama integration |
| Cache | `src/services/cache/` | Redis client with resilience |
| Observability | `src/services/observability/` | OpenTelemetry tracing & metrics |
| Security | `src/services/security/` | URL, password, email, file scanning |
| SOC | `src/services/soc/` | Incident tracking, analytics |
| Threat Intel | `src/services/threatIntel/` | IOC analysis, threat feeds |
| UEBA | `src/services/ueba/` | Anomaly detection, risk scoring |
| Response | `src/services/response/` | AI incident response |
| RAG | `src/services/rag/` | Retrieval augmented generation |
| Audit | `src/services/audit/` | SOC2 audit logging |

### Configuration
All configuration is environment-driven via `backend/src/config/index.js`. No hardcoded secrets or URLs.

## Frontend Architecture

### Core Stack
- **Framework**: React 18 with Vite
- **Styling**: Tailwind CSS
- **Routing**: React Router DOM (lazy-loaded routes)
- **State**: React Context (Auth, Theme)
- **HTTP**: Axios with interceptors
- **Real-time**: Socket.IO client
- **PWA**: Web App Manifest + Service Worker

### Key Patterns
- Environment variables (`VITE_API_URL`, `VITE_SOCKET_URL`) for all external URLs
- API client with auto token refresh
- Protected routes with role-based access
- Internationalization (i18next) with EN, HI, TA, TANGISH support
- Responsive design with mobile-first Tailwind classes

## Security Architecture

### Authentication & Authorization
- JWT access tokens (15m expiry) + refresh tokens (30d, httpOnly cookies)
- TOTP-based MFA with backup codes
- Role-Based Access Control (RBAC)
- Account lockout after configurable failed attempts

### Transport Security
- HTTPS enforced at CDN/reverse proxy level
- HSTS headers (1 year)
- Secure cookies in production
- CORS restricted to configured origin

### Application Security
- Helmet for security headers
- CSP with dynamic connect-src
- Rate limiting per route
- Input validation (express-validator)
- NoSQL injection prevention (Mongoose sanitization)
- Prompt injection detection for AI inputs
- Request correlation IDs for tracing

## Deployment Architecture

### Development
```
Frontend (localhost:5173) → Vite Proxy → Backend (localhost:5000)
                                          → MongoDB (localhost:27017)
                                          → Redis (localhost:6379)
                                          → Ollama (localhost:11434)
```

### Production
```
User → Cloudflare CDN → Vercel (Frontend)
                        → Railway/Render (Backend)
                                          → MongoDB Atlas
                                          → Redis Cloud
                                          → AI Providers
```

### Kubernetes (Optional)
- Namespace: `cybersec-platform`
- Ingress with TLS termination
- Horizontal Pod Autoscaling
- ConfigMap + Secret for configuration
- Health probes on all services