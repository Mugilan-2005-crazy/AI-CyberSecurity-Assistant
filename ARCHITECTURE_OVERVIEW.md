# Architecture Overview — CyberSphere AI v3.1.0

## System Architecture

CyberSphere AI v3.1.0 is a full-stack enterprise cyber defense platform with a microservices-inspired monolithic architecture.

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Client Layer                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ React SPA │  │ PWA      │  │ Tauri    │  │ Mobile Browser   │  │
│  │ (Vite 5)  │  │ (SW)     │  │ Desktop  │  │                  │  │
│  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘  └────────┬───────┘  │
└────────┼───────────────┼───────────────┼─────────────────┼──────────┘
         │               │               │                 │
         ▼               ▼               ▼                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         CDN / Reverse Proxy                          │
│  Cloudflare CDN / nginx / Caddy (TLS termination)                   │
└────────────────────────┬────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Backend Layer (Express.js)                    │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Routes → Middleware → Controllers → Services → Models      │   │
│  │                                                             │   │
│  │  Auth Routes    Scan Routes    AI Routes    Admin Routes    │   │
│  │  Chat Routes    Alert Routes   SOC Routes   UEBA Routes     │   │
│  │  Cloud Routes   Container Routes  KG Routes  Response Routes│   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  AI Router → Gemini (cloud) / Ollama (local)                │   │
│  │  Security Modules → URL Scanner, Email Phishing, File Scan  │   │
│  │                    QR Scanner, Password Analyzer             │   │
│  │  SOC Analyst → Real-time analysis with AI insights          │   │
│  │  Threat Intel → Multi-provider IOC correlation              │   │
│  │  UEBA Engine → Anomaly detection & risk scoring             │   │
│  │  Incident Response → AI-powered analysis & reporting        │   │
│  └─────────────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────────────┘
                         │
            ┌────────────┼────────────┐
            ▼            ▼            ▼
┌─────────────────┐ ┌───────────┐ ┌──────────────────┐
│   MongoDB Atlas  │ │ Redis Cloud│ │ OpenTelemetry    │
│   (Primary DB)   │ │ (Cache)    │ │ (Tracing/Metrics)│
│                  │ │            │ │                  │
│  ┌─────────────┐ │ │ ┌────────┐ │ │ ┌─────────────┐ │
│  │ Users       │ │ │ │ Session│ │ │ │ Spans       │ │
│  │ Scans       │ │ │ │ Cache  │ │ │ │ Metrics     │ │
│  │ AI Analysis │ │ │ │ Rate   │ │ │ │ Logs        │ │
│  │ Reports     │ │ │ │ Limits │ │ │ │ Alerts      │ │
│  │ Incidents   │ │ │ └────────┘ │ │ └─────────────┘ │
│  │ Knowledge   │ │ │            │ │                  │
│  │ Graph       │ │ │            │ │                  │
│  └─────────────┘ │ │            │ │                  │
└─────────────────┘ └───────────┘ └──────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, Vite 5, Tailwind CSS, Framer Motion, Chart.js, React Router, PWA, Tauri Desktop |
| **Backend** | Node.js 18+, Express 4, MVC, Mongoose, JWT, express-validator |
| **Database** | MongoDB Atlas (with encryption at rest) |
| **Cache** | Redis Cloud / Upstash |
| **AI** | Google Gemini, Ollama (local Llama 3.1) |
| **Threat Intel** | VirusTotal API, AbuseIPDB, OTX, NVD |
| **PDF** | jsPDF (frontend), PDFKit (backend) |
| **Auth** | JWT access + refresh tokens, httpOnly cookies, bcrypt, TOTP MFA |
| **Security** | Helmet, CORS, rate limiting, input validation, NoSQL sanitization, prompt injection detection, CSP |
| **Observability** | OpenTelemetry, Prometheus, Grafana |
| **Deploy** | Vercel (frontend), Railway/Render (backend), Docker, Kubernetes |
| **Desktop** | Tauri (Windows) |

## Key Design Decisions

1. **Monolithic Backend** — Simplifies deployment and maintenance while maintaining clear module boundaries
2. **Lazy-Loaded Routes** — React.lazy with Suspense for optimal bundle size
3. **Design System** — Standardized components ensure consistency across the platform
4. **AI Router** — Automatic failover between cloud (Gemini) and local (Ollama) AI providers
5. **Graceful Degradation** — Application continues without MongoDB for non-critical operations
6. **WCAG 2.2 AA** — Accessibility built into every component and page