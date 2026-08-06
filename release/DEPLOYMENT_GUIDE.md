# Deployment Guide — CyberSphere AI v3.1.0

## Overview

This guide covers deployment of CyberSphere AI v3.1.0 to production environments.

## Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| Docker | 24+ | For containerized deployment |
| Docker Compose | 2.20+ | Or Docker Desktop |
| Kubernetes | 1.24+ | For K8s deployment |
| kubectl | Latest | For K8s management |
| Node.js | 18+ | For local development |

## Quick Start (Docker)

```bash
# Clone and configure
git clone <repository-url>
cd Enterprise-Cyber-Security-Platform

# Copy environment files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
cp .env.example .env

# Edit backend/.env with your production values
# Set at minimum:
# - JWT_SECRET (64+ char random string)
# - JWT_REFRESH_SECRET (64+ char random string)
# - GEMINI_API_KEY
# - MONGODB_URI (Atlas connection string)
# - CLIENT_ORIGIN (production frontend URL)
# - REDIS_HOST, REDIS_PASSWORD

# Start the stack
docker compose up -d

# Seed admin user
docker compose exec backend npm run seed

# Verify health
curl http://localhost/api/health
```

## Kubernetes Deployment

```bash
# Create namespace
kubectl apply -f k8s/namespace.yaml

# Create configmap and secret
kubectl apply -f k8s/configmap.yaml
kubectl create secret generic cybersec-secrets \
  --from-literal=JWT_SECRET=<your-secret> \
  --from-literal=MONGODB_URI=<your-uri> \
  --from-literal=GEMINI_API_KEY=<your-key>

# Deploy
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/ingress.yaml
kubectl apply -f k8s/hpa.yaml
kubectl apply -f k8s/pdb.yaml
kubectl apply -f k8s/rbac.yaml
```

## Environment Variables Reference

### Required for Production

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Application environment | `production` |
| `MONGODB_URI` | MongoDB Atlas connection string | `mongodb+srv://user:pass@cluster/cybersec` |
| `JWT_SECRET` | JWT signing secret (64+ chars) | `a1b2c3...` |
| `JWT_REFRESH_SECRET` | Refresh token secret (64+ chars) | `d4e5f6...` |
| `CLIENT_ORIGIN` | Allowed CORS origin | `https://app.yourdomain.com` |
| `ADMIN_PASSWORD` | Bootstrap admin password | `SecureP@ss123` |

### Optional for Production

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Backend port | `5000` |
| `API_PREFIX` | API route prefix | `/api` |
| `GEMINI_API_KEY` | Google Gemini API key | *(required for AI)* |
| `REDIS_HOST` | Redis host | `localhost` |
| `REDIS_PASSWORD` | Redis password | *(empty)* |
| `REDIS_TLS` | Enable Redis TLS | `false` |
| `OTEL_ENABLED` | Enable OpenTelemetry | `true` |

## Health Checks

### Backend
```bash
curl https://api.yourdomain.com/api/health
# Expected: {"success": true, "message": "Enterprise Cyber Security Platform API running"}
```

### Frontend
```bash
curl https://app.yourdomain.com
# Expected: HTML response with React app
```

### Redis
```bash
redis-cli -h <redis-host> -p 6379 PING
# Expected: PONG
```

### MongoDB
```bash
mongosh "mongodb+srv://<cluster>/cybersec" --eval "db.adminCommand('ping')"
# Expected: { ok: 1 }
```

## Rollback Procedure

### Docker Compose
```bash
# Revert to previous image version
docker compose rollback
```

### Kubernetes
```bash
# Rollback to previous deployment
kubectl rollout undo deployment/cybersec-backend
kubectl rollout undo deployment/cybersec-frontend
```

### Vercel
```bash
# Revert to previous deployment
vercel rollback
```