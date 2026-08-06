# Development Guide — CyberSphere AI v3.1.0

## Setup

### Required Tools

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 18+ (LTS) | Runtime environment |
| npm | 9+ | Package manager |
| MongoDB | 7+ or Atlas | Database |
| Redis | 7+ (optional) | Cache |
| Docker | 24+ (optional) | Containerized deployment |
| Git | 2+ | Version control |

### Node Version

This project requires Node.js 18 or later. Verify your version:

```bash
node --version
```

If you need to switch versions, use `nvm`:

```bash
nvm use 18
```

### Environment Setup

1. Clone the repository
2. Copy environment files:
   ```bash
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env
   ```
3. Install dependencies:
   ```bash
   cd backend && npm install
   cd ../frontend && npm install
   ```
4. Seed the database:
   ```bash
   cd backend
   npm run seed
   ```

### Running the Application

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

## Debugging Guide

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

## Testing Workflow

### Backend Tests

```bash
cd backend
npm test                    # Full suite with coverage (336 tests)
npm run lint                # ESLint check
```

### Frontend Tests

```bash
cd frontend
npm run test                # Vitest unit tests
npm run test:coverage       # Vitest with coverage report
npm run lint                # ESLint check
npm run format              # Prettier format check
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
- **Frontend** — component rendering, user interactions, accessibility, error states, loading states

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
- Write unit tests for new services and controllers

### Frontend

- ESLint + Prettier enforced
- Component-based architecture with React
- Tailwind CSS utility classes for styling
- Use React Testing Library for component tests
- All interactive elements must be keyboard accessible
- All forms must have proper labels and error announcements
- Use semantic HTML elements (`<button>`, `<nav>`, `<article>`, etc.)
- Use `aria-*` attributes for accessibility
- Follow the design system conventions in `src/design-system/`

### Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| Files | camelCase | `myComponent.jsx` |
| Components | PascalCase | `MyComponent` |
| Hooks | camelCase with `use` prefix | `useAuth` |
| Constants | UPPER_SNAKE_CASE | `MAX_FILE_SIZE` |
| Routes | kebab-case | `/scan/url` |
| CSS classes | Tailwind utilities | `bg-primary text-white` |

## Git Hooks

This project uses Husky for git hooks and lint-staged for pre-commit validation.

### Pre-commit Hooks

- **lint-staged**: Runs ESLint on staged files
- **format**: Runs Prettier on staged files

### Available Scripts

```bash
# Development
npm run dev           # Start Vite dev server
npm run build         # Production build
npm run preview       # Preview production build

# Testing
npm run test          # Run Vitest
npm run test:coverage # Run Vitest with coverage
npm run e2e           # Run Playwright E2E tests

# Code quality
npm run lint          # Run ESLint
npm run format        # Run Prettier
npm run audit         # Run npm audit
```

## Pull Request Process

1. Create a feature branch from `develop`
2. Make changes with clear, atomic commits
3. Run tests and linting before committing
4. Push branch and create a pull request against `develop`
5. Fill out the PR template completely
6. PR must be reviewed by at least one maintainer
7. All checks must pass (tests, lint, build)
8. Merge to `develop`, then promote to `main` after staging testing