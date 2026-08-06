# PERFORMANCE AUDIT

**Date:** 2026-08-06  
**Auditor:** Kilo (automated)  
**Scope:** Build performance, bundle size, test execution time, coverage metrics  

---

## 1. Build Performance

### Frontend Build
```bash
cd frontend && npm run build
```
**Output:**
```
✓ built in 15.37s
```

**Verdict:** PASS — build completes in under 20s.

### Backend Test Execution
```bash
cd backend && npm test -- --coverage
```
**Output:**
```
Test Suites: 23 passed, 23 total
Tests:       337 passed, 337 total
Time:        88.8 s
```
**Verdict:** PASS — 337 tests execute in ~89s.

---

## 2. Bundle Size Analysis (Frontend)

Largest uncompressed chunks:

| File | Size | Gzipped |
|------|------|---------|
| exceljs.min | 938.44 kB | 271.02 kB |
| jspdf.es.min | 390.11 kB | 128.75 kB |
| index-mcrqkuZy.js | 345.88 kB | 100.38 kB |
| SecurityKnowledgeGraphCenter | 196.81 kB | 64.89 kB |
| html2canvas.esm | 201.41 kB | 48.03 kB |
| chart-vendor | 208.62 kB | 71.51 kB |

**Verdict:** PENDING — exceljs and jspdf are large but acceptable for enterprise reporting features. Code-splitting is in use (route-level chunks). Consider lazy-loading exceljs/jspdf for on-demand export paths.

---

## 3. Code Coverage

### Backend
```
All files                        |   44.32 |    31.71 |    40.21 |    45.77 |
```

| Metric | Value |
|--------|-------|
| Statements | 44.32% |
| Branches | 31.71% |
| Functions | 40.21% |
| Lines | 45.77% |

**Verdict:** PENDING — coverage is moderate. Critical paths (models, auth middleware, alert controller) have high coverage. Observability, knowledge graph, and scan services have low coverage and should be prioritized.

### Frontend
No coverage report generated (vitest configured without coverage in package.json).

**Verdict:** PENDING — frontend coverage is unverified.

---

## 4. Lint Performance

```bash
cd backend && npm run lint
cd frontend && npm run lint
```
**Output:** Both exit cleanly with no errors.

**Verdict:** PASS.

---

## 5. Unverified / Pending Items

- [ ] Docker image layer sizes (`docker images` output)
- [ ] API p95/p99 latency under load (no load test executed)
- [ ] Frontend Lighthouse scores
- [ ] Database query profiling (MongoDB explain plans)
- [ ] Memory heap snapshot during peak load

---

## 6. Evidence Summary

| Check | Status | Command / Output |
|-------|--------|------------------|
| Frontend build time | PASS | `npm run build` → 15.37s |
| Backend test time | PASS | `npm test -- --coverage` → 88.8s |
| Lint (backend) | PASS | `npm run lint` → 0 errors |
| Lint (frontend) | PASS | `npm run lint` → 0 errors |
| Backend coverage | PENDING | 44.32% stmts — moderate |
| Frontend coverage | PENDING | Not collected |
| Bundle size | PENDING | Large vendor chunks noted |
| Load test | PENDING | Not executed |
| Docker image size | PENDING | Not measured |
