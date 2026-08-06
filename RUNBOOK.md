# Runbook

## Daily Operations

### Health Check
```bash
# Verify all services are running
docker compose ps

# Check backend health
curl http://localhost/api/health

# Check Prometheus
curl http://localhost:9090/-/healthy

# Check Grafana
curl http://localhost:3001/api/health
```

### Log Review
```bash
# Tail backend logs (last 1 hour)
docker compose logs backend --since 1h

# Search for errors
docker compose logs backend --grep "error\|ERROR"

# Check auth failures
docker compose logs backend --grep "Failed login\|Account locked"
```

## Incident Response Playbook

### 1. Brute Force Attack Detected
**Symptoms**: High number of failed logins, rate limit violations

**Steps**:
1. Check logs: `docker compose logs backend --grep "Failed login"`
2. Identify source IP from rate limit headers
3. Temporarily reduce auth rate limit: modify `authLimiter` in `rateLimiter.js`
4. Block IP at Caddy level if persistent
5. Notify affected users if accounts were targeted

### 2. AI Prompt Injection Detected
**Symptoms**: `aiSecurity.js` blocks requests, unusual AI response patterns

**Steps**:
1. Check logs: `docker compose logs backend --grep "malicious prompt"`
2. Review the blocked prompt content
3. Update `sanitizePrompt.js` patterns if new injection vectors found
4. Review recent AI responses for leaked information
5. Rotate any exposed API keys if data was exfiltrated

### 3. File Upload Violation
**Symptoms**: Upload rejected with MIME type error

**Steps**:
1. Check logs: `docker compose logs backend --grep "invalid file type"`
2. Verify the MIME allowlist in `upload.js`
3. If legitimate file was blocked, add the MIME type to the allowlist
4. Scan the uploaded file with VirusTotal if suspicious

### 4. Container Security Alert
**Symptoms**: Unauthorized container access, unexpected processes

**Steps**:
1. Audit running containers: `docker ps`
2. Check for exposed Docker socket mounts
3. Verify no container is running as root
4. Run Trivy scan: `trivy image csassistant-backend:latest`
5. Review container logs for suspicious activity

## Scaling Procedures

### Scale Backend
```bash
docker compose up -d --scale backend=5
```

### Scale Redis
For Redis Cluster mode, use K8s deployment with StatefulSet.

## Deployment Verification

After every deployment:

1. **Health**: `curl http://localhost/api/health` returns `{"success":true}`
2. **Auth**: Login with admin credentials works
3. **Scan**: URL scan returns results
4. **AI**: Chatbot responds within 30s timeout
5. **Metrics**: Prometheus endpoint responds
6. **Logs**: No ERROR entries in last 5 minutes

## Rollback Procedure

### Docker Compose
```bash
# Stop services
docker compose down

# Checkout previous version
git checkout <previous-tag>

# Rebuild and restart
docker compose build --no-cache
docker compose up -d
```

### Kubernetes
```bash
# Rollback deployment
kubectl rollout undo deployment/cybersec-backend -n cybersec-platform

# Monitor rollout
kubectl rollout status deployment/cybersec-backend -n cybersec-platform
```

## Certificate Renewal

Caddy handles TLS automatically with Let's Encrypt. To check cert status:
```bash
docker compose exec caddy caddy list-certificates
```

Manual renewal if needed:
```bash
docker compose exec caddy caddy fmt --overwrite
docker compose exec caddy caddy reload
```
