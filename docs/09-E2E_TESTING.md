# E2E Testing Guide

## Overview

CyberSphere AI v3.2.0 includes comprehensive Playwright end-to-end tests that validate critical user journeys across authentication, security modules, and the dashboard.

## Test Structure

```
frontend/e2e/
├── auth.spec.js           # Authentication flow tests
├── security-modules.spec.js  # Security module tests
└── dashboard.spec.js      # Dashboard and reporting tests
```

## Running E2E Tests

### Local Development

```bash
cd frontend
npm run e2e
```

This starts the dev server and runs Playwright against `http://localhost:5173`.

### CI Pipeline

E2E tests run automatically in the GitHub Actions pipeline via `.github/workflows/e2e.yml`.

The pipeline:
1. Installs dependencies
2. Starts the backend
3. Starts the frontend
4. Runs Playwright tests
5. Uploads screenshots/videos on failure

## Test Coverage

### Authentication Flow
- User registration
- Email verification screen
- Login with valid credentials
- Login with invalid credentials
- Logout and session cleanup
- Landing page accessibility

### Security Modules
- URL Scanner: page load, empty state, validation, scan execution
- Email Phishing Detector: page load, input, scan execution
- File Scanner: page load, upload area, file selection
- QR Checker: page load, scanner UI, empty state
- AI Security Chatbot: page load, welcome message, input/send
- AI Analyzer: page load

### Dashboard
- Security score loading
- Threat indicators display
- Reports section access
- Loading states
- Empty states
- Error states
- Responsive design (mobile, tablet)

## Selectors Strategy

Tests use stable, accessible selectors:
- `getByRole()` for buttons, links, and form elements
- `getByLabel()` for form inputs
- `getByText()` for content verification
- `getByPlaceholder()` for input fields

## CI Compatibility

- Tests run in a single worker (`workers: 1` in CI)
- 2 retries on failure in CI
- HTML reporter for detailed failure analysis
- Screenshots and videos uploaded on failure
- Test results uploaded as artifacts

## Best Practices

1. Always use `getByRole` over CSS selectors for stability
2. Use `await` for all async operations
3. Handle loading states with explicit waits
4. Use `page.waitForURL` for navigation assertions
5. Keep tests independent and idempotent