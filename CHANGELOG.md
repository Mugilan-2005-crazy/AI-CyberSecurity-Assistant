# Changelog — Enterprise Cyber Security Platform

## v2.1.1 — Production Release

### Added
- Production deployment configuration (Vercel, Railway, Render, Cloudflare)
- Cloud deployment documentation and architecture diagrams
- GitHub public release preparation
- Performance benchmarks and monitoring setup
- Professional demo flow documentation

### Changed
- Version bumped to 2.1.1 across all packages
- Production environment configuration hardened
- Security verification completed for HTTPS, CORS, CSP, Helmet, JWT, cookies, CSRF, rate limits, WebSocket auth, MFA, RBAC, tenant isolation

### Security
- No secrets committed to repository
- `.env` files properly gitignored
- Placeholder secrets in k8s manifests clearly marked
- All API keys and credentials loaded via environment variables

## v2.1.0 — Product Release

### Added
- Environment-based configuration (no hardcoded localhost)
- Production deployment architecture (Vercel, Railway, Render)
- Custom domain readiness (HTTPS, CORS, cookies, JWT, WebSocket)
- Product branding: "Enterprise Cyber Security Platform"
- Progressive Web App (PWA) support
  - Web App Manifest
  - Service Worker with offline fallback
  - Installable on desktop and mobile
- Desktop application via Tauri (Windows)
- Comprehensive documentation:
  - ARCHITECTURE.md
  - SECURITY.md
  - DEPLOYMENT.md
  - CHANGELOG.md
  - LICENSE
- `.env.example` at project root
- PWA icons (8 sizes, 72px to 512px)
- Security headers in Vercel configuration
- Production-ready `render.yaml` for backend deployment

### Changed
- Updated README with product branding and architecture diagram
- Updated backend `.env.example` with production documentation
- Updated frontend `.env.example` with VITE_API_URL and VITE_SOCKET_URL
- Updated `vercel.json` with security headers and CSP
- Updated `docker-compose.yml` with production configuration
- Updated CI/CD workflow with security scanning
- CSP `connect-src` now uses dynamic config instead of hardcoded localhost
- Vite proxy target now env-driven instead of hardcoded
- Socket.IO client now uses env-driven URL
- Product name updated across all metadata

### Fixed
- Hardcoded localhost references replaced with environment-based configuration
- Root `.env` file removed (secrets not committed)
- Development vs production environment separation

## v2.0.0 — Enterprise Release

### Added
- AI SOC Analyst module
- Threat Intelligence Center
- UEBA (User Entity Behavior Analytics)
- Cloud Security Posture Management
- Container Security scanning
- Security Knowledge Graph
- AI Incident Response
- Redis Cache integration
- TOTP MFA authentication
- OpenTelemetry observability
- Kubernetes manifests
- SOC2 audit foundation
- 315+ passing tests

## v1.0.0 — Initial Release

### Added
- Core security scanning modules (URL, password, email, file, QR)
- AI chatbot with Gemini and Ollama
- JWT authentication with refresh tokens
- Admin panel
- PDF report generation
- Docker deployment support