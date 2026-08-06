# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 4.0.x   | :white_check_mark: |
| 3.x.x   | :x:                |
| 2.x.x   | :x:                |
| 1.x.x   | :x:                |

## Reporting a Vulnerability

**Do NOT report security vulnerabilities through public GitHub issues.**

If you discover a security vulnerability in CyberSphere AI, please report it responsibly via email to **security@cybersec.io** with the following information:

- Description of the issue
- Steps to reproduce
- Affected versions
- Your contact information

We will acknowledge receipt within 48 hours and provide a detailed response within 7 days. Please do not disclose the vulnerability publicly until we have had a chance to address it.

## Security Measures

CyberSphere AI implements defense-in-depth security controls including:

- JWT authentication with refresh token rotation
- TOTP MFA (RFC 6238) with backup codes
- Role-based access control (RBAC)
- Rate limiting with Redis backing
- Prompt injection detection for AI pipeline
- PII redaction
- Input validation and NoSQL injection prevention
- Helmet security headers + CSP
- Container hardening (non-root, read-only filesystems)
- Automated security scanning in CI/CD (Gitleaks, Trivy, Semgrep)

See [SECURITY.md](SECURITY.md) for the complete security posture documentation.
