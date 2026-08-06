# Production Runbook

## Overview

This runbook covers operational procedures for the CyberSphere AI v3.2.0 production deployment. It includes startup/shutdown procedures, monitoring, troubleshooting, and incident response.

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    CyberSphere AI v3.2.0                │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐ │
│  │ Frontend  │  │ Backend  │  │   Database (MongoDB) │ │
│  │ React 18  │  │ Express  │  │   + Redis Cache      │ │
│  │ Vite 5    │  │ Node 18+ │  │   + OpenTelemetry    │ │
│  │ Tauri     │  │ JWT Auth │  │   + Prometheus       │ │
│  └─────┬─────┘  └────┬─────┘  └──────────┬───────────┘ │
│        │              │                    │             │
│        └──────────────┼────────────────────┘             │
│                       │                                  │
│              ┌────────▼────────┐                         │
│              │   Grafana       │                         │
│              │   Prometheus    │                         │
│              └─────────────────┘                         │
└─────────────────────────────────────────────────────────┘
```

## Startup Procedures

### Prerequisites

- Docker Engine 24+
- Docker Compose v2+
- Node.js 18+ (for local development)
- At least 4GB RAM (8GB+ recommended)

### Docker Compose Startup

```bash
# Clone the repository
git clone <repository-url>
cd Enterprise-Cyber-Security-Platform

# Copy environment file
cp .env.example .env

# Edit .env with your production values
# - JWT_SECRET (64+ char hex)
# - JWT_REFRESH_SECRET (64+ char hex)
# - MONGO_ROOT_PASSWORD (strong password)
# - ENCRYPTION_KEY (64+ char hex)

# Start all services
docker compose up -d

# Verify all services are healthy
docker compose ps
docker compose logs -f backend
```

### Local Development Startup

```bash
# Backend
cd backend
cp .env.example .env
npm install
npm run seed
npm run dev

# Frontend
cd ../frontend
cp .env.example .env
npm install
npm run dev
```

## Monitoring

### Health Check

```bash
curl http://localhost:5000/api/health
```

Expected response:
```json
{
  "success": true,
  "status": "healthy",
  "uptime": 12345,
  "services": {
    "mongodb": "connected",
    "redis": "connected"
  }
}
```

### Grafana Dashboards

- **URL**: http://localhost:3001
- **CyberSphere AI Security Dashboard**: Primary operations dashboard
- **Refresh Interval**: 15 seconds

### Key Metrics to Monitor

1. **Error Rate**: Should be <1%
2. **API Latency (p95)**: Should be <500ms
3. **Failed Login Rate**: Alert if >10/min
4. **Threat Detections**: Normal baseline varies by traffic
5. **Database Connections**: Should be <80% of pool size
6. **AI Request Latency**: Should be <5s

## Troubleshooting

### Backend Won't Start

1. Check logs: `docker compose logs backend`
2. Verify MongoDB is healthy: `docker compose ps mongodb`
3. Ensure `JWT_SECRET` and `JWT_REFRESH_SECRET` are set
4. Verify `MONGODB_URI` is correct and reachable
5. Check port 5000 is not already in use

### Frontend Shows Blank Page

1. Check nginx logs: `docker compose logs frontend`
2. Verify backend healthcheck passes: `docker compose ps backend`
3. Ensure `CLIENT_ORIGIN` matches the frontend URL in production
4. Check the build succeeded: `docker compose logs frontend`

### MongoDB Connection Refused

1. Wait for MongoDB healthcheck to pass: `docker compose ps mongodb`
2. Verify `MONGODB_URI` uses Docker Compose service name (`mongodb`)
3. Check credentials match `MONGO_INITDB_ROOT_USERNAME` / `MONGO_INITDB_ROOT_PASSWORD`

### Ollama Not Responding

1. Check health: `docker compose ps ollama`
2. For GPU acceleration, ensure GPU resources are allocated
3. Ensure sufficient RAM (4GB minimum, 8GB+ recommended)

### AI Chatbot Not Responding

1. Verify `GEMINI_API_KEY` is set correctly
2. Ensure Ollama is running locally if using local AI
3. Check network connectivity for external API calls
4. Review Winston logs for detailed error messages

### High Error Rate

1. Check Grafana Error Rate dashboard panel
2. Review backend logs: `docker compose logs backend --tail=100`
3. Check MongoDB connectivity: `docker compose exec backend curl mongodb:27017`
4. Verify Redis is healthy: `docker compose exec backend redis-cli ping`

## Security Operations

### Authentication

- JWT access tokens expire in 15 minutes
- JWT refresh tokens expire in 30 days
- TOTP MFA is enforced for admin accounts
- Failed login attempts are tracked and rate-limited

### RBAC Roles

| Role | Permissions |
|------|-------------|
| admin | Full access to all features |
| security_manager | Security operations, reports, analytics |
| analyst | Scan operations, viewing reports |
| auditor | Read-only access to audit logs |
| user | Basic scan operations, own data |

### Rate Limiting

- General API: 100 requests per 15 minutes per IP
- Auth endpoints: 10 requests per 15 minutes per IP
- Scan endpoints: 30 requests per 15 minutes per IP
- AI endpoints: 20 requests per 15 minutes per IP

## Backup & Recovery

### Database Backup

```bash
# Manual backup
docker compose exec mongodb mongodump --out /backup/

# Automated backup is configured in docker-compose.yml
```

### Configuration Backup

```bash
# Backup environment file
cp .env .env.backup.$(date +%Y%m%d)

# Backup Grafana dashboards
docker compose exec grafana grafana-cli admin reset-admin-password
```

## Scaling

### Horizontal Scaling

1. Increase backend replicas in `docker-compose.yml`
2. Update Redis for shared session state
3. Configure load balancer (nginx/HAProxy)
4. Scale MongoDB with replica sets

### Vertical Scaling

1. Increase container resource limits
2. Adjust MongoDB `wiredTigerCacheSizeGB`
3. Increase Redis `maxmemory`
4. Scale Node.js worker threads

## Known Limitations

1. Ollama requires local GPU for optimal performance
2. VirusTotal API has rate limits on free tier
3. Email verification requires SMTP configuration
4. TOTP MFA requires user device with authenticator app

## Future Roadmap

- [ ] Multi-region deployment support
- [ ] Advanced AI threat prediction
- [ ] Automated incident response playbooks
- [ ] SOC2 Type II compliance certification
- [ ] Real-time collaboration features
- [ ] Mobile application (React Native)