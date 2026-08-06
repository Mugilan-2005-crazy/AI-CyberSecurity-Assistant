# Developer Guide

## Getting Started

### Prerequisites
- Node.js 18.20+ (LTS)
- npm 9+
- Docker 24+ (for containerized development)
- MongoDB 7+ (local or Atlas)
- Redis 7+ (local or cloud)

### Repository Structure
```
Enterprise-Cyber-Security-Platform/
├── backend/
│   ├── src/
│   │   ├── config/          # Configuration & database
│   │   ├── controllers/     # Request handlers (19 controllers)
│   │   ├── middleware/      # Express middleware (auth, rate limiting, security)
│   │   ├── models/          # Mongoose schemas
│   │   ├── routes/          # API route definitions (18 route files)
│   │   ├── services/        # Business logic (AI, security, cache, observability)
│   │   ├── utils/           # Helpers (logger, JWT, error handling)
│   │   ├── socket/          # Socket.IO server
│   │   ├── app.js           # Express app assembly
│   │   └── server.js        # Entry point
│   ├── tests/               # 336 tests across 22 suites
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── pages/           # Route pages (38 pages)
│   │   ├── context/         # React context (auth, theme)
│   │   ├── hooks/           # Custom hooks
│   │   ├── services/        # API client, i18n
│   │   ├── i18n/            # Localization (en, ta, hi, tanglish)
│   │   └── App.jsx          # Router with code-splitting
│   ├── Dockerfile
│   └── package.json
├── k8s/                     # Kubernetes manifests
├── docker-compose.yml
├── otel-collector.yaml
├── prometheus/
├── grafana/
└── .github/workflows/
```

## Backend Development

### Architecture Pattern
The backend follows **MVC** architecture:
- **Models** — Mongoose schemas with `select: false` on sensitive fields
- **Controllers** — Request handlers with input validation and error handling
- **Routes** — Route definitions with middleware chains
- **Services** — Business logic, external API integrations, security modules

### Key Services
| Service | Purpose |
|---------|---------|
| `services/ai/` | AI routing (Gemini + Ollama), security gates |
| `services/security/` | MITRE mapping, prompt sanitization |
| `services/cache/` | Redis client with in-memory fallback |
| `services/observability/` | OpenTelemetry (traces + Prometheus metrics) |
| `services/threatIntel/` | IOC analysis, CVE lookup, reputation |
| `services/ueba/` | User behavior analytics |
| `services/audit/` | SOC2 audit logging |

### Development Commands
```bash
cd backend
npm run dev          # Start with nodemon (file watching)
npm test             # Run all 336 tests
npm run lint         # ESLint
npm run seed         # Create admin account
```

### Testing
```bash
# Run specific test suite
npx jest tests/auth.test.mjs --runInBand

# Run with coverage
npm test

# Watch mode
npx jest --watch
```

### Security Testing
```bash
# Run auth security tests
npx jest tests/auth.test.mjs --testNamePattern="security"

# Run AI security tests
npx jest tests/aiSecurity.test.mjs
```

## Frontend Development

### Architecture
- **React 18** with hooks
- **Vite** for bundling with code-splitting
- **Tailwind CSS** with custom cyber theme
- **Framer Motion** for animations
- **React Router v6** for routing
- **Axios** for API client with auto token refresh
- **i18next** for localization (English, Tamil, Hindi, Tanglish)

### State Management
- **AuthContext** — JWT token, user object, login/register/logout
- **ThemeContext** — light/dark mode persistence

### Component Structure
```
src/components/
├── ui/          # Reusable UI primitives (Button, Modal, Input, etc.)
├── layout/      # Sidebar, Topbar, Layout
├── dashboard/   # Dashboard widget components
├── soc/         # SOC dashboard components
├── executive/   # Executive dashboard components
├── modules/     # Scanner module shells
├── common/      # ErrorBoundary, etc.
└── chat/        # AI chatbot components
```

### Frontend Commands
```bash
cd frontend
npm run dev        # Start dev server (port 5173)
npm run build      # Production build
npm run lint       # ESLint
npm run preview    # Preview production build
```

## Code Standards

### Backend
- ESLint with auto-fix: `npm run lint -- --fix`
- ES modules (`import/export`)
- JSDoc comments on all functions
- Input validation with express-validator
- Never use `console.log` — use `logger.js`

### Frontend
- ESLint: `npm run lint`
- Components use PascalCase
- Props are documented with JSDoc
- Use `<Suspense>` for lazy-loaded routes
- Always use `useTranslation` hook for text

### Git Workflow
```bash
# Create feature branch
git checkout -b feature/new-feature

# Make changes, then commit
git add .
git commit -m "feat: description"

# Push and create PR
git push origin feature/new-feature
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for full workflow.
