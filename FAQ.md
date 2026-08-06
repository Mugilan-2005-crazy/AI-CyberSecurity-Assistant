# FAQ

## General

### What is CyberSphere AI?
CyberSphere AI is an autonomous cloud cyber defense platform that combines AI-powered security analysis with traditional security scanning tools to help organizations detect, analyze, and mitigate cybersecurity threats.

### What can I do with it?
- Scan URLs for phishing and malware
- Analyze password strength
- Detect email phishing attempts
- Scan file uploads for malware
- Check QR code safety
- Chat with an AI security assistant
- Threat intelligence lookup
- User behavior analytics (UEBA)
- Cloud and container security posture management

### Is it free?
The platform is open-source under the MIT License. You can self-host it at no cost. Cloud-hosted AI features require API keys for Google Gemini, VirusTotal, and other threat intelligence providers.

## Authentication & Security

### How secure is my password data?
Passwords are never stored, logged, or transmitted. All password analysis happens in-memory using synchronous algorithms. SHA-256 hashing is used for file scans before sending to VirusTotal.

### Is my session secure?
- JWT access tokens are short-lived (15 minutes)
- Refresh tokens are stored in httpOnly cookies with SameSite=Strict
- All tokens are rotated on each refresh
- Cookies are only sent over HTTPS in production

### Does it support 2FA?
Yes, TOTP-based multi-factor authentication is supported with backup codes. Enable it in Settings.

### How are secrets managed?
- All secrets (JWT keys, API keys, database passwords) are loaded from environment variables
- Docker Compose uses `.env` files (not committed to Git)
- Kubernetes uses Secrets (base64-encoded, with ExternalSecrets/Vault recommended for production)
- Gitleaks scans for leaked secrets in CI

## AI & Privacy

### Does AI have access to my data?
- AI requests are processed through a security gate that strips PII
- Prompts are not stored with user identity in logs
- File uploads for analysis are sent to AI providers (Gemini/Ollama) but are never stored in the database
- You can use local Ollama for fully on-premises AI processing

### What AI models are supported?
- Google Gemini (cloud, requires API key)
- Ollama with Llama 3.1 (local, no external calls)
- The system automatically falls back between providers

### Can I use it without internet access?
Yes, you can use Ollama for local AI processing without any external API keys. Threat intelligence lookups will be skipped if API keys are not configured.

## Deployment

### How do I deploy?
```bash
docker compose up -d
docker compose exec backend npm run seed
```

### Can I deploy to Kubernetes?
Yes, Kubernetes manifests are provided in `k8s/`:
```bash
kubectl apply -f k8s/
kubectl apply -f k8s/pdb.yaml
kubectl apply -f k8s/rbac.yaml
```

### What are the system requirements?
- Docker 24+ or Kubernetes 1.28+
- 4GB RAM minimum (8GB recommended with Ollama)
- 10GB free disk space
- External MongoDB and Redis (or use Docker Compose services)

### How do I get HTTPS?
Caddy (included in Docker Compose) handles TLS termination automatically with Let's Encrypt in production. For local development, it uses self-signed certificates.

## Troubleshooting

### I can't log in
- Verify your email is verified (check spam folder)
- If using 2FA, ensure your authenticator app time is synced
- Try the "Forgot Password" flow
- Check that `ADMIN_PASSWORD` is set in your environment

### AI chatbot is not responding
- Verify `GEMINI_API_KEY` is set correctly in `.env`
- If using Ollama, ensure the Ollama container is running
- Check logs: `docker compose logs backend`
- Try restarting: `docker compose restart backend`

### Frontend shows a blank page
- Check that `VITE_API_URL` is set in `frontend/.env`
- Verify backend is healthy: `curl http://localhost:5000/api/health`
- Clear browser cache and cookies
- Check browser console for errors

### MongoDB connection refused
- Wait for the healthcheck: `docker compose ps mongodb`
- Verify `MONGODB_URI` uses the Docker service name (`mongodb`)
- Check that `MONGO_ROOT_PASSWORD` matches between compose and `.env`

### Rate limiting too strict
- Rate limits reset every 15 minutes (auth) or 1 minute (chat/scans)
- For development, set `NODE_ENV=test` temporarily to disable rate limiting
- Consider increasing limits in `rateLimiter.js` for your deployment

### How do I update the platform?
```bash
git pull
docker compose pull
docker compose up -d --build
```

## Contributing

### How do I contribute?
See [CONTRIBUTING.md](CONTRIBUTING.md) for the development workflow.

### How do I report a security vulnerability?
Email security@cybersec.io — do NOT use public GitHub issues for security issues.

### What license is it under?
MIT License. See [LICENSE](LICENSE) for details.
