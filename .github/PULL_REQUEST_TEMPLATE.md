# Pull Request — Enterprise Cyber Security Platform

## Summary
<!-- What does this PR change and why? -->

## Type of change
- [ ] Bug fix (non-breaking)
- [ ] New feature (non-breaking)
- [ ] Security hardening
- [ ] Documentation
- [ ] DevSecOps / CI pipeline
- [ ] Refactoring (no functional change)
- [ ] Breaking change (please explain)

## Security review checklist
- [ ] No secrets, credentials, or tokens added/committed
- [ ] No hardcoded passwords / API keys
- [ ] No `localhost` production dependency introduced
- [ ] Dependency scan (`npm audit`) clean for this change
- [ ] Container images scanned with Trivy (no CRITICAL)
- [ ] Gitleaks scan passes (no secret findings)
- [ ] Changes validated locally: `docker compose up -d` healthy

## Testing
  - [ ] Backend tests pass: `npm test` (336 tests)
  - [ ] Frontend tests pass: `npm run test`
  - [ ] Frontend builds: `npm run build`
- [ ] Manual validation of affected endpoints
- [ ] `docker compose ps` all services healthy

## Screenshots / logs
<!-- Attach before/after evidence where relevant -->

## Related
<!-- Closes #123, docs/SECURITY.md, etc. -->
