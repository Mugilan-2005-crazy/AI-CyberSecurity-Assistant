# Development Guide — CyberSphere AI v3.1.0

## Setup

### Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 18+ | Runtime environment |
| npm | 9+ | Package manager |
| MongoDB Atlas | — | Database (or local MongoDB 7+) |
| Redis | — | Cache (optional for local dev) |
| Docker | 24+ | Containerized deployment |
| Git | — | Version control |

### Clone and Install

```bash
git clone <repository-url>
cd Enterprise-Cyber-Security-Platform

# Backend
cd backend
cp .env.example .env
npm install
npm run seed

# Frontend
cd ../frontend
cp .env.example .env
npm install
```

### Running in Development Mode

```bash
# Terminal 1 — Backend
cd backend
npm run dev
# http://localhost:5000

# Terminal 2 — Frontend
cd frontend
npm run dev
# http://localhost:5173
```

## Environment Configuration

### Backend Environment Variables

Copy `backend/.env.example` to `backend/.env` and configure:

| Variable | Required | Description |
|----------|----------|-------------|
| `NODE_ENV` | Yes | `development` or `production` |
| `PORT` | No | Backend port (default: 5000) |
| `MONGODB_URI` | Yes | MongoDB connection string |
| `JWT_SECRET` | Yes | Long random string (64+ chars) |
| `JWT_REFRESH_SECRET` | Yes | Long random string (64+ chars) |
| `GEMINI_API_KEY` | Yes* | Google Gemini API key |
| `CLIENT_ORIGIN` | Yes | Allowed CORS origin |

*Required for AI features. Ollama can be used as a local alternative.

### Frontend Environment Variables

Copy `frontend/.env.example` to `frontend/.env`:

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | No | Backend API URL (dev proxy handles this) |

## Debugging

### Backend Debugging

1. **Console Logging**: Winston logs to console in development and structured JSON in production
2. **Request Tracing**: Every request includes a correlation ID in the `X-Request-ID` header
3. **Error Stack Traces**: Available in development mode; hidden in production
4. **MongoDB Debugging**: Enable Mongoose debug mode by setting `MONGO_DEBUG=true` in `.env`

### Frontend Debugging

1. **Browser DevTools**: React DevTools extension for component inspection
2. **Vite Dev Server**: Hot module replacement (HMR) enabled by default
3. **Network Tab**: Inspect API requests and responses
4. **Console**: Check for warnings and errors from the application

### Debugging AI Issues

1. Check `GET /api/chat/status` to verify AI provider availability
2. Review Winston logs for AI provider errors
3. Verify API keys are correctly set in `.env`
4. Check network connectivity to external AI providers

## Testing

### Backend Tests

```bash
cd backend
npm test                    # Full suite with coverage
npm run lint                # ESLint check
```

### Frontend Tests

```bash
cd frontend
npm run test                # Vitest unit tests
npm run test:coverage       # Vitest with coverage report
npm run lint                # ESLint check
```

### E2E Tests

```bash
cd frontend
npm run e2e                 # Playwright end-to-end tests
```

### Test Categories

- **Auth** — authentication, authorization, session management
- **Alerts** — BOLA, authorization, alert workflow
- **Security** — AI prompt injection, file upload, input validation
- **Service** — threat intel, MITRE mapping, IOC analysis
- **Frontend** — component rendering, user interactions, accessibility

## Code Standards

### Backend

- ESLint enforced via `npm run lint`
- Follow existing patterns in `src/`
- Use ES modules (`import/export`)
- Async/await preferred over callbacks
- All routes must have input validation
- All errors must be handled via the global error handler
- Use `catchAsync` wrapper for async route handlers
- Include correlation IDs in all log statements

### Frontend

- ESLint + Prettier enforced
- Component-based architecture
- Tailwind CSS utility classes
- Use React Testing Library for component tests
- All interactive elements must be keyboard accessible
- All forms must have proper labels and error announcements
- Use semantic HTML elements

### Naming Conventions

- **Files**: camelCase (`myComponent.jsx`)
- **Components**: PascalCase (`MyComponent`)
- **Hooks**: camelCase with `use` prefix (`useAuth`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_FILE_SIZE`)
- **Routes**: kebab-case (`/scan/url`)

## Git Workflow

1. Create a feature branch from `develop`
2. Make changes with clear, atomic commits
3. Run tests and linting before committing
4. Push branch and create a pull request
5. PR must be reviewed by at least one maintainer
6. Merge to `develop`, then promote to `main` after staging testing

## Useful Scripts

### Backend

```bash
npm run dev       # Start development server with nodemon
npm start         # Start production server
npm run seed      # Seed admin user
npm test          # Run test suite with coverage
npm run lint      # Run ESLint
```

### Frontend

```bash
npm run dev       # Start Vite dev server
npm run build     # Production build
npm run preview   # Preview production build
npm run test      # Run Vitest
npm run test:coverage  # Run Vitest with coverage
npm run lint      # Run ESLint
npm run format    # Run Prettier
npm run e2e       # Run Playwright E2E tests
```