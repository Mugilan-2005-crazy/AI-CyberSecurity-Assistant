# Contributing to Enterprise Cyber Security Platform

Thank you for your interest in contributing! This document outlines the process for contributing to the CyberSphere AI platform.

## Development Setup

### Prerequisites
- Node.js 18+
- npm 9+
- MongoDB (local or Atlas)
- Redis (local or cloud)

### Quick Start
```bash
# Clone & install
git clone https://github.com/Mugilan-2005-crazy/AI-CyberSecurity-Assistant.git
cd AI-CyberSecurity-Assistant/backend
cp .env.example .env
npm install
npm run seed    # create admin account
npm run dev     # http://localhost:5000

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

- `main` — production-ready code only
- `feature/*` — new features
- `fix/*` — bug fixes
- `security/*` — security improvements

## Code Standards

### Backend
- ESLint enforced via `npm run lint`
- Follow existing patterns in `src/`
- Use ES modules (`import/export`)
- Async/await preferred over callbacks

### Frontend
- ESLint + Prettier
- Component-based architecture
- Tailwind CSS utility classes

## Testing

All tests must pass before merge:
```bash
cd backend
npm test                          # full suite with coverage
node --experimental-vm-modules node_modules/jest/bin/jest.js --runInBand
```

### Test Categories
- **Auth** — authentication, authorization, session management
- **Alerts** — BOLA, authorization, alert workflow
- **Security** — AI prompt injection, file upload, input validation
- **Service** — threat intel, MITRE mapping, IOC analysis

## Pull Request Process

1. Ensure tests pass (`npm test`, `npm run lint`)
2. Update documentation if needed
3. Add tests for new functionality
4. Security review for any auth/authz changes
5. PR must be reviewed by at least 1 maintainer
6. Merge to `main` after approval

## Security Disclosures

**Do NOT report security vulnerabilities in public GitHub issues.**

Email security@cybersec.io with:
- Description of the issue
- Steps to reproduce
- Affected versions
- Your contact information

## Code of Conduct

Please read our [Code of Conduct](CODE_OF_CONDUCT.md) before contributing.
