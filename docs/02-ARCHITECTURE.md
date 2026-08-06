# Architecture — CyberSphere AI v3.1.0

## System Overview

CyberSphere AI is a full-stack enterprise cyber defense platform built with a microservices-inspired monolithic architecture. The frontend is a React SPA served via Vite, the backend is an Express.js REST API, and data is persisted in MongoDB Atlas with Redis caching.

## High-Level Architecture

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
│  │  UEBA Engine → Anomaly detection & risk scoring            │   │
│  │  Incident Response → AI-powered analysis & reporting       │   │
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

## Frontend Architecture

### Component Structure

```
src/
├── components/
│   ├── ui/              # Design system components
│   │   ├── Button.jsx
│   │   ├── Card.jsx
│   │   ├── Input.jsx
│   │   ├── Modal.jsx
│   │   ├── Badge.jsx
│   │   ├── Alert.jsx
│   │   ├── Loader.jsx
│   │   ├── Skeleton.jsx
│   │   ├── Tooltip.jsx
│   │   └── ...
│   ├── layout/          # App shell components
│   │   ├── Layout.jsx
│   │   ├── Sidebar.jsx
│   │   └── Topbar.jsx
│   ├── common/          # Shared components
│   │   ├── ErrorBoundary.jsx
│   │   └── ProtectedRoute.jsx
│   ├── dashboard/       # Dashboard widgets
│   ├── soc/             # SOC-specific components
│   ├── chat/            # Chat components
│   ├── executive/       # Executive dashboard components
│   └── modules/         # Feature module components
├── pages/               # Route-level page components
│   ├── admin/           # Admin pages
│   ├── modules/         # Feature modules
│   └── ...
├── context/             # React context providers
├── hooks/               # Custom React hooks
├── services/            # API service layer
├── i18n/                # Internationalization
├── design-system/       # Design tokens and system
└── utils/               # Utility functions
```

### State Management

- **AuthContext** — Authentication state, user info, token management
- **ThemeContext** — Dark/light theme toggle
- **Custom Hooks** — `useRealtimeDashboard`, `useNotifications`, `useSocket`, `useUEBA`

### Routing

- React Router v6 with lazy-loaded routes via `React.lazy()`
- Code splitting for optimal bundle size
- Suspense fallback with branded loader
- Protected routes with role-based access

## Backend Architecture

### MVC Pattern

```
Routes → Middleware → Controllers → Services → Models
```

- **Routes**: Define API endpoints and apply middleware
- **Middleware**: Auth, validation, rate limiting, sanitization, error handling
- **Controllers**: Handle HTTP requests/responses, delegate to services
- **Services**: Business logic, external API calls, AI integration
- **Models**: Mongoose schemas and database operations

### Key Middleware

| Middleware | Purpose |
|-----------|---------|
| `auth.js` | JWT verification and user extraction |
| `validate.js` | express-validator input validation |
| `rateLimiter.js` | Per-route rate limiting |
| `sanitize.js` | NoSQL injection prevention |
| `csrf.js` | CSRF protection |
| `tenantIsolation.js` | Multi-tenant data isolation |
| `errorHandler.js` | Centralized error formatting |
| `telemetry.js` | OpenTelemetry request tracing |

### AI Routing

The AI router (`aiRouter.js`) selects the appropriate AI provider:

1. **Gemini** — Cloud-based, used for complex analysis and multimodal tasks
2. **Ollama** — Local Llama 3.1, used for simpler queries and offline mode
3. **Fallback** — Automatic failover if primary provider is unavailable

## Data Flow

### Scan Request Flow

```
User → Frontend → API Call → Auth Middleware → Controller → Service → External API → Store Result → Return to User
```

### AI Analysis Flow

```
User Input → Sanitization → AI Router → Provider Selection → Context Building → AI Processing → Response Formatting → Report Generation → Persistence
```

### Real-Time Flow

```
Backend (Socket.IO) → Event Dispatcher → Room Manager → Connected Clients
```

## Deployment Architecture

### Docker

Single `docker-compose.yml` orchestrates all services:
- Frontend (nginx)
- Backend (Node.js)
- MongoDB
- Redis
- Ollama (optional)
- Grafana
- OTLP Collector

### Kubernetes

Production-grade K8s deployment with:
- Namespace isolation
- ConfigMaps and Secrets
- Deployments with HPA
- Services and Ingress
- Pod Disruption Budgets
- RBAC policies

### CI/CD Pipeline

GitHub Actions workflow runs on every push/PR:
1. Backend tests (Jest, 336 tests)
2. Frontend build (Vite)
3. Docker validation
4. Security audit (`npm audit`)