# Contributing to CyberSphere AI v3.1.0

Thank you for your interest in contributing to CyberSphere AI! This document outlines the process for contributing to the platform.

## Development Setup

### Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 18+ | Runtime |
| npm | 9+ | Package manager |
| MongoDB | 7+ (or Atlas) | Database |
| Redis | — | Cache (optional for local dev) |
| Git | — | Version control |

### Quick Start

```bash
# Clone the repository
git clone <repository-url>
cd Enterprise-Cyber-Security-Platform

# Backend setup
cd backend
cp .env.example .env
npm install
npm run seed
npm run dev     # http://localhost:5000

# Frontend setup
cd ../frontend
cp .env.example .env
npm install
npm run dev     # http://localhost:5173
```

### Docker Development

```bash
docker compose up --build
```

## Branching Strategy

- `main` — Production-ready code only
- `develop` — Integration branch for features
- `feature/*` — New features (e.g., `feature/url-scanner-enhancement`)
- `fix/*` — Bug fixes (e.g., `fix/auth-token-refresh`)
- `security/*` — Security improvements
- `docs/*` — Documentation updates

## Code Standards

### Backend

- ESLint enforced via `npm run lint`
- Follow existing patterns in `src/`
- Use ES modules (`import/export`)
- Async/await preferred over callbacks
- All routes must have input validation via `express-validator`
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

## Testing

### Running Tests

```bash
# Backend
cd backend
npm test                    # Full suite with coverage
npm run lint                # ESLint check

# Frontend
cd frontend
npm run test                # Vitest unit tests
npm run test:coverage       # Vitest with coverage report
npm run lint                # ESLint check

# E2E
cd frontend
npm run e2e                 # Playwright E2E tests
```

### Test Requirements

- All new features must include unit tests
- Test coverage for critical flows must remain above 80%
- All existing tests must pass before merging
- Use React Testing Library for frontend component tests
- Use semantic testing queries (`getByRole`, `getByLabelText`, etc.)

### Test Categories

- **Auth** — authentication, authorization, session management
- **Alerts** — BOLA, authorization, alert workflow
- **Security** — AI prompt injection, file upload, input validation
- **Service** — threat intel, MITRE mapping, IOC analysis
- **Frontend** — component rendering, user interactions, accessibility, error states, loading states

## Pull Request Process

1. Create a feature branch from `develop`
2. Make changes with clear, atomic commits
3. Run tests and linting before committing
4. Push branch and create a pull request against `develop`
5. Fill out the PR template completely
6. PR must be reviewed by at least one maintainer
7. All checks must pass (tests, lint, build)
8. Merge to `develop`, then promote to `main` after staging testing

### PR Checklist

- [ ] Tests pass (`npm test`)
- [ ] Lint passes (`npm run lint`)
- [ ] Build succeeds (`npm run build`)
- [ ] New tests added for new functionality
- [ ] Documentation updated if needed
- [ ] No breaking changes (or documented)
- [ ] Security review completed for auth/authz changes

## Security Disclosures

**Do NOT report security vulnerabilities in public GitHub issues.**

Email security@cybersec.io with:
- Description of the issue
- Steps to reproduce
- Affected versions
- Your contact information

## Code of Conduct

Please read our [Code of Conduct](CODE_OF_CONDUCT.md) before contributing.

## Documentation

When contributing code changes, update relevant documentation:
- API changes → [API Reference](docs/04-API_REFERENCE.md)
- Architecture changes → [Architecture Guide](docs/02-ARCHITECTURE.md)
- New features → [Getting Started](docs/01-GETTING_STARTED.md)
- UI changes → [UI Guide](docs/08-UI_GUIDE.md)