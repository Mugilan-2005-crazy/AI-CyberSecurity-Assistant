# CyberSphere AI v4.0 — Enterprise Cloud Cyber Defense Platform

[![CI/CD](https://github.com/Mugilan-2005-crazy/AI-CyberSecurity-Assistant/actions/workflows/ci.yml/badge.svg)](https://github.com/Mugilan-2005-crazy/AI-CyberSecurity-Assistant/actions/workflows/ci.yml)
[![Security Scan](https://github.com/Mugilan-2005-crazy/AI-CyberSecurity-Assistant/actions/workflows/security.yml/badge.svg)](https://github.com/Mugilan-2005-crazy/AI-CyberSecurity-Assistant/actions/workflows/security.yml)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue?logo=docker)](https://github.com/Mugilan-2005-crazy/AI-CyberSecurity-Assistant)
[![Kubernetes](https://img.shields.io/badge/Kubernetes-Ready-blue?logo=kubernetes)](https://github.com/Mugilan-2005-crazy/AI-CyberSecurity-Assistant)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/Mugilan-2005-crazy/AI-CyberSecurity-Assistant/blob/main/LICENSE)
[![Version](https://img.shields.io/badge/Version-4.0-blue)](https://github.com/Mugilan-2005-crazy/AI-CyberSecurity-Assistant)

> **CyberSphere AI v4.0** — A production-ready, cloud-native enterprise cyber defense platform with AI-powered SOC analysis, threat intelligence, UEBA, cloud security posture management, container security, security knowledge graphs, incident response, Redis caching, TOTP MFA, OpenTelemetry observability, and comprehensive CI/CD pipeline.

---

## Professional Introduction

CyberSphere AI v4.0 is a full-stack enterprise security operations platform built to demonstrate advanced software engineering, security architecture, and DevOps practices. The project unifies traditional security scanning (URL, password, email, file, QR) with AI-powered analysis, real-time threat intelligence, behavioral analytics, and automated incident response. It is designed for SOC teams, security engineers, and enterprise security programs that need scalable, observable, and compliant security tooling.

---

## Project Overview

CyberSphere AI provides comprehensive cyber defense capabilities across five pillars:

1. **AI-Powered Security Analysis** — Real-time threat analysis using Google Gemini and Ollama with multi-provider routing, prompt injection protection, and multimodal file analysis.
2. **Threat Intelligence** — IOC correlation across VirusTotal, AbuseIPDB, OTX, and NVD with MITRE ATT&CK mapping and Redis-backed caching.
3. **User Entity Behavior Analytics (UEBA)** — Anomaly detection, behavioral profiling, risk scoring, and timeline analysis for insider threat detection.
4. **Cloud & Container Security** — Multi-cloud posture management (AWS, Azure, GCP) with automated compliance analysis, Docker image scanning, and Kubernetes cluster monitoring.
5. **Incident Response & Knowledge Graphs** — AI-generated incident reports, attack path analysis via security knowledge graphs, and automated remediation recommendations.

---

## Architecture

```
Frontend (React 18 / Vite 5 / Tailwind)
    │
    ▼
API Gateway (Express.js / JWT + RBAC / Rate Limiting)
    │
    ├──▶ Security Core (Controllers + Middleware)
    │       ├── Authentication (JWT + TOTP MFA + Refresh Tokens)
    │       ├── Authorization (RBAC: admin, security_manager, user)
    │       └── Input Validation (express-validator + Mongoose sanitization)
    │
    ├──▶ AI Pipeline (AI Router → Gemini / Ollama)
    │       ├── Input Sanitization & Prompt Injection Detection
    │       ├── PII Redaction & Security Classification
    │       ├── Context Building (scan history + threat intel)
    │       └── Response Formatting & Report Generation
    │
    ├──▶ Security Modules
    │       ├── URL Scanner / Password Analyzer / Email Phishing
    │       ├── File Malware Scanner / QR Safety Checker
    │       ├── Threat Intelligence Center (VirusTotal, AbuseIPDB, OTX, NVD)
    │       ├── UEBA Engine (anomaly detection + risk scoring)
    │       ├── Cloud Security (AWS / Azure / GCP posture)
    │       ├── Container Security (Docker / Kubernetes scanning)
    │       └── Knowledge Graph (attack path analysis)
    │
    ├──▶ Data Layer
    │       ├── MongoDB Atlas (encrypted at rest, 28 Mongoose models)
    │       └── Redis Cloud (caching, session management, rate limiting)
    │
    └──▶ Observability
            ├── OpenTelemetry (distributed tracing)
            ├── Prometheus (metrics collection)
            └── Grafana (visualization + alerting)
```

### Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, Vite 5, Tailwind CSS, Framer Motion, Chart.js, React Router, Socket.IO, i18next |
| **Backend** | Node.js 18+, Express.js, MVC Architecture, Mongoose, JWT, express-validator, Zod |
| **Database** | MongoDB Atlas (encryption at rest) |
| **Cache** | Redis Cloud / Upstash |
| **AI** | Google Gemini (`@google/generative-ai`), Ollama (local Llama 3.1) |
| **Threat Intel** | VirusTotal API, AbuseIPDB, OTX, NVD |
| **Auth** | JWT access + refresh tokens, httpOnly cookies, bcrypt (12 rounds), TOTP MFA |
| **Security** | Helmet, CORS, rate limiting, input validation, NoSQL sanitization, prompt injection detection, CSP |
| **Observability** | OpenTelemetry, Prometheus, Grafana |
| **Deploy** | Vercel (frontend), Docker Compose, Kubernetes (Helm charts) |
| **Desktop** | Tauri (Windows) |
| **Testing** | Jest (backend), Vitest (frontend), Playwright (E2E) |

---

## Features

### AI SOC Analyst
- Real-time security analysis with multimodal support (text, images, PDFs, videos)
- Multi-provider AI routing (Gemini cloud + Ollama local) with automatic failover
- Streaming responses with security report cards, risk levels, and confidence scores
- Prompt injection detection and PII redaction before AI processing

### Threat Intelligence Center
- IOC correlation across multiple providers with Redis-backed caching
- CVE search and MITRE ATT&CK mapping
- Threat correlation engine with rate limiting and timeout handling

### User Entity Behavior Analytics (UEBA)
- Anomaly detection across user behavior patterns
- Risk scoring and ranking with behavioral profiling
- Timeline analysis and self-service UEBA for end users

### Cloud Security Posture Management
- Multi-cloud provider support (AWS, Azure, GCP)
- Automated security scanning with compliance impact analysis
- Remediation planning with cloud knowledge graphs

### Container Security
- Docker image scanning and runtime analysis
- Kubernetes cluster scanning and monitoring
- Container runtime security with vulnerability detection

### Security Knowledge Graph
- Entity and relationship modeling for attack path analysis
- Graph-based threat correlation with interactive visualization

### Incident Response
- AI-powered incident analysis with response recommendations
- Automated incident report generation with PDF export
- Response history tracking and continuous improvement

---

## Security Architecture

### Authentication & Authorization
- **JWT Tokens**: Short-lived access tokens (15m) + refresh tokens (30d) in httpOnly cookies
- **Token Identification**: Each token includes a unique `jti` claim for revocation support
- **Role-Based Access Control (RBAC)**: Admin, security_manager, user roles with middleware enforcement
- **Password Hashing**: bcrypt with 12 rounds
- **TOTP MFA**: RFC 6238 compliant with backup codes and AES-256 encrypted secrets
- **Account Lockout**: Configurable (default: 5 attempts, 15-minute lockout)

### Request Protection
- **AI Request Timeouts**: 30-second timeout on all AI provider requests
- **Input Validation**: express-validator on all sensitive routes
- **Rate Limiting**: Per-route limiters (auth: 10/15min, chat: 20/min, scans: 30/min, uploads: 5/min)
- **NoSQL Injection Prevention**: Mongoose sanitization middleware
- **XSS Prevention**: Input sanitization, no unsafe `innerHTML`
- **Request Correlation IDs**: Unique ID for every request

### Transport & Headers
- **Helmet Security Headers**: HSTS, CSP, X-Frame-Options, Permissions-Policy
- **CORS Protection**: Restricted to configured client origin
- **Secure Cookies**: `httpOnly`, `secure` in production, `sameSite: 'strict'`

### Data Protection
- **Sensitive Data Exclusion**: MongoDB `select: false` on password, tokens, refresh tokens
- **No Token Leakage**: Reset tokens never returned in API responses
- **File Security**: Type validation, size limits, blocked extensions
- **Prompt Injection Detection**: Server-side sanitization before AI calls

### Infrastructure Security
- **Container Security**: Non-root users, read-only filesystems, dropped capabilities
- **Network Security**: Network policies in Kubernetes
- **Supply Chain Security**: SBOM generation, dependency scanning, secret scanning
- **Continuous Monitoring**: Real-time security posture assessment

---

## AI Pipeline

```
User Input → Input Sanitization → AI Routing → Context Building → AI Processing → Response Formatting → Report Generation → Persistence
```

1. **User Input** — User sends a message or uploads a file
2. **Input Sanitization** — Backend sanitizes the prompt, strips control characters, and detects potential prompt injection attempts
3. **AI Routing** — `aiRouter.js` decides between Gemini (cloud) and Ollama (local) based on message complexity
4. **Context Building** — Fetches recent scan history and relevant document chunks for context-aware responses
5. **AI Processing** — Selected provider generates a response with security analysis
6. **Response Formatting** — Markdown rendering, category detection, suggestions, and provider badges
7. **Report Generation** — Security report card with risk level, threats, confidence score, and PDF download
8. **Persistence** — Chat turns and analysis results are saved to MongoDB

---

## Folder Structure

```
├── backend/
│   ├── src/
│   │   ├── app.js                 # Express app initialization
│   │   ├── server.js              # Server entry point
│   │   ├── config/                # Database, environment, Swagger config
│   │   ├── controllers/           # Request handlers (16 controllers)
│   │   ├── middleware/            # Auth, validation, rate limiting, upload
│   │   ├── models/                # Mongoose schemas (28 models)
│   │   ├── routes/                # API route definitions
│   │   ├── services/              # Business logic (23 service domains)
│   │   ├── socket/                # WebSocket handlers
│   │   └── utils/                 # Helpers (ApiError, logger, email, etc.)
│   ├── tests/                     # Jest test suite (23 test files)
│   ├── Dockerfile                 # Multi-stage production build
│   └── package.json               # Backend dependencies
├── frontend/
│   ├── src/
│   │   ├── App.jsx                # Root component with routing
│   │   ├── main.jsx               # React entry point
│   │   ├── components/            # Reusable UI components
│   │   │   ├── ui/                # Design system (Button, Card, Input, Modal)
│   │   │   ├── layout/            # Layout shell (Sidebar, Topbar)
│   │   │   ├── chat/              # AI chat interface
│   │   │   └── modules/           # Feature module components
│   │   ├── pages/                 # Route-level components (16 pages)
│   │   ├── context/               # React Context (Auth, etc.)
│   │   ├── hooks/                 # Custom hooks
│   │   ├── services/              # API clients and endpoints
│   │   ├── utils/                 # Frontend utilities
│   │   ├── i18n/                  # Internationalization
│   │   ├── design-system/         # Design tokens and components
│   │   ├── tests/                 # Vitest unit tests (11 test files)
│   │   └── index.css              # Global styles
│   ├── e2e/                       # Playwright E2E tests (3 spec files)
│   ├── Dockerfile                 # Nginx production build
│   ├── vite.config.js             # Vite configuration with code splitting
│   └── package.json               # Frontend dependencies
├── docs/                          # 11 documentation files
├── k8s/                           # Kubernetes manifests (8 files)
├── grafana/                       # Grafana dashboards and provisioning
├── prometheus/                    # Prometheus configuration
├── docker-compose.yml             # Production stack (10 services)
├── otel-collector.yaml            # OpenTelemetry configuration
├── package.json                   # Root workspace config
└── LICENSE                        # MIT License
```

---

## Installation

### Prerequisites
- Node.js 18+ and npm 9+
- MongoDB Atlas connection string (or local MongoDB)
- Google Gemini API key
- Redis (Cloud or local)

### Quick Start

```bash
# Clone the repository
git clone https://github.com/Mugilan-2005-crazy/AI-CyberSecurity-Assistant.git
cd AI-CyberSecurity-Assistant

# Install dependencies
npm install

# Backend setup
cd backend
cp .env.example .env
npm install
npm run seed            # Create admin account
npm run dev             # Starts on http://localhost:5000

# Frontend setup (new terminal)
cd ../frontend
cp .env.example .env
npm install
npm run dev             # Starts on http://localhost:5173
```

---

## Environment Setup

### Backend (`backend/.env.example`)

| Variable | Description | Required |
|----------|-------------|----------|
| `NODE_ENV` | `development` or `production` | Yes |
| `PORT` | Backend port (default: `5000`) | No |
| `MONGODB_URI` | MongoDB connection string | Yes |
| `JWT_SECRET` | Secret for access token signing | Yes |
| `JWT_REFRESH_SECRET` | Secret for refresh token signing | Yes |
| `CLIENT_ORIGIN` | Allowed frontend origin for CORS | Yes |
| `GEMINI_API_KEY` | Google Gemini API key | Yes |
| `REDIS_HOST` | Redis host (default: `localhost`) | No |
| `REDIS_PASSWORD` | Redis password | No |
| `ENCRYPTION_KEY` | AES-256 key for TOTP MFA secrets | Yes |
| `SMTP_HOST` | SMTP server host | No |
| `SMTP_USER` | SMTP username | No |
| `SMTP_PASS` | SMTP password | No |
| `EMAIL_FROM` | Sender email address | No |

### Frontend (`frontend/.env.example`)

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_API_URL` | Backend API base URL | No (proxied in dev) |

---

## Deployment

### Docker Compose

```bash
# Start all services
docker compose up -d

# Verify health
curl http://localhost/api/health

# View logs
docker compose logs -f

# Stop services
docker compose down
```

**Services included:**
- MongoDB 7 (with health checks and resource limits)
- Redis 7-alpine (with AOF persistence)
- Backend (Node.js LTS Alpine, read-only filesystem, non-root user)
- Frontend (Nginx Alpine)
- Caddy (HTTPS/TLS reverse proxy)
- OpenTelemetry Collector
- Prometheus
- Grafana
- MongoDB Exporter

### Kubernetes

```bash
# Create namespace
kubectl apply -f k8s/namespace.yaml

# Deploy configuration
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secrets.yaml

# Deploy application
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/ingress.yaml
kubectl apply -f k8s/hpa.yaml
kubectl apply -f k8s/pdb.yaml
kubectl apply -f k8s/rbac.yaml
```

---

## Testing

### Backend Tests (Jest)

```bash
cd backend
npm test                    # Full suite with coverage
```

**Test coverage:** 324 test cases across 23 test suites covering authentication, authorization, security modules, AI pipeline, threat intelligence, UEBA, cloud security, container security, knowledge graphs, and incident response.

### Frontend Tests (Vitest)

```bash
cd frontend
npm run test                # Unit tests
npm run test:coverage       # Coverage report
```

**Test coverage:** 58 test cases covering component rendering, user interactions, accessibility, and error states.

### E2E Tests (Playwright)

```bash
cd frontend
npm run e2e                 # Playwright end-to-end tests
```

**Test coverage:** 37 test cases covering critical user journeys: auth flow, security modules (URL scanner, email phishing, file scanner, QR checker, AI chatbot), dashboard, and responsive design.

---

## Performance Highlights

- **Code Splitting**: 36 route-level lazy-loaded chunks via React.lazy/Suspense
- **Vendor Chunking**: Manual chunk splitting in Vite (react, socket, chart, motion, i18n, axios, ui)
- **Memoization**: Strategic useMemo/useCallback and React.memo for pure components
- **Redis Caching**: Threat intelligence caching, session management, rate limiting with graceful fallback
- **Database Optimization**: Indexed fields, lean queries, aggregation pipelines
- **Container Hardening**: Read-only filesystems, non-root users, resource limits, pinned base images

---

## Security Features

- OWASP Top 10 compliance with defense-in-depth architecture
- JWT access + refresh tokens with rotation and revocation
- TOTP MFA (RFC 6238) with backup codes
- bcrypt password hashing (12 rounds)
- Helmet security headers + CSP
- Rate limiting with Redis backing and memory fallback
- Prompt injection detection and PII redaction
- NoSQL injection prevention via Mongoose sanitization
- File upload validation (type, size, extension blocking)
- Secure error handling (no stack traces in production)
- Automated security scanning (Gitleaks, Trivy, Semgrep) in CI/CD
- SBOM generation with Syft
- Non-root container execution with dropped capabilities

---

## Monitoring & Observability

- **OpenTelemetry**: Distributed tracing across all services
- **Prometheus**: Metrics collection on port 9464
- **Grafana**: Visualization dashboards on port 3001
- **Winston**: Structured JSON logging
- **Health Checks**: `/api/health` endpoint with dependency status
- **Key Metrics**: Request latency (p50, p95, p99), error rates, AI provider response times, scan throughput, auth success/failure rates, MongoDB pool usage, Redis cache hit ratio

---

## Future Roadmap

- **Phase 15**: Advanced ML-based anomaly detection for UEBA
- **Phase 16**: SOAR integration with automated playbook execution
- **Phase 17**: Multi-tenant architecture with organization isolation
- **Phase 18**: GraphQL API layer for flexible querying
- **Phase 19**: Mobile application (React Native)
- **Phase 20**: Blockchain-based audit logging for immutable compliance records

---

## License

Distributed under the MIT License. See `LICENSE` for more information.

---

## Author

**Mugilan**  
B.Tech Information Technology

---

<p align="center">Built with dedication for cybersecurity awareness and education</p>
<p align="center"><strong>CyberSphere AI v4.0 — Enterprise Excellence</strong></p>
