# Deployment — Enterprise Cyber Security Platform v2.1

## Deployment Options

### 1. Vercel + Railway (Recommended)

#### Frontend (Vercel)
1. Connect your GitHub repository to Vercel
2. Set environment variables:
   - `VITE_API_URL=https://api.yourdomain.com`
   - `VITE_SOCKET_URL=https://api.yourdomain.com`
3. Deploy on every push to `main`

#### Backend (Railway)
1. Connect your GitHub repository to Railway
2. Set environment variables (see `.env.example`)
3. Railway auto-detects Node.js and deploys
4. Set health check: `GET /api/health`

#### Database (MongoDB Atlas)
1. Create a MongoDB Atlas cluster
2. Whitelist Railway's IP ranges
3. Get connection string: `mongodb+srv://<user>:<password>@<cluster>/cybersec`
4. Set `MONGODB_URI` in Railway environment

#### Cache (Redis Cloud)
1. Create a Redis Cloud account
2. Get connection URL
3. Set `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_TLS=true`

### 2. Docker Compose (Self-Hosted)

#### Prerequisites
- Docker 24+
- Docker Compose 2.20+
- At least 4GB RAM (8GB recommended for Ollama)

#### Quick Start
```bash
# Copy environment files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
cp .env.example .env

# Edit backend/.env with your values
# Set at minimum:
# - JWT_SECRET (long random string)
# - JWT_REFRESH_SECRET (long random string)
# - GEMINI_API_KEY
# - MONGODB_URI
# - CLIENT_ORIGIN=https://app.yourdomain.com
# - REDIS_HOST, REDIS_PASSWORD (for Redis Cloud)

# Start the stack
docker compose up -d

# Seed admin user
docker compose exec backend npm run seed
```

#### Production Docker Compose
```bash
# Set production environment variables
export CLIENT_ORIGIN=https://app.yourdomain.com
export NODE_ENV=production

# Start with production config
docker compose -f docker-compose.yml up -d
```

### 3. Kubernetes

#### Prerequisites
- Kubernetes cluster (1.24+)
- kubectl configured
- Helm 3+ (optional)

#### Deployment
```bash
# Create namespace
kubectl apply -f k8s/namespace.yaml

# Create configmap and secret
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secrets.yaml  # Create with your actual secrets

# Deploy
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/ingress.yaml
kubectl apply -f k8s/hpa.yaml
```

#### Ingress Configuration
- TLS certificate managed by cert-manager
- Domain: `app.yourdomain.com` (frontend), `api.yourdomain.com` (backend)
- SSL redirect enabled

### 4. Cloud Provider Specific

#### AWS
- **Frontend**: AWS Amplify or CloudFront + S3
- **Backend**: AWS ECS Fargate or AWS App Runner
- **Database**: Amazon DocumentDB or MongoDB Atlas
- **Cache**: Amazon ElastiCache (Redis)

#### GCP
- **Frontend**: Google Cloud Run or Firebase Hosting
- **Backend**: Google Cloud Run
- **Database**: MongoDB Atlas or Firestore
- **Cache**: Memorystore (Redis)

#### Azure
- **Frontend**: Azure Static Web Apps
- **Backend**: Azure Container Apps
- **Database**: MongoDB Atlas
- **Cache**: Azure Cache for Redis

## Environment Variables Reference

### Required for Production
| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Application environment | `production` |
| `MONGODB_URI` | MongoDB connection string | `mongodb+srv://user:pass@cluster/cybersec` |
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
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OTLP endpoint | `http://localhost:4318` |

## SSL/TLS Configuration

### Using Cloudflare (Recommended)
1. Add your domain to Cloudflare
2. Update DNS records to point to your origin
3. Enable SSL/TLS (Full strict mode)
4. Configure CDN caching rules
5. Enable security features (WAF, rate limiting)

### Using Let's Encrypt (Self-Hosted)
```bash
# Install certbot
sudo apt install certbot

# Obtain certificate
sudo certbot certonly --standalone -d app.yourdomain.com

# Configure nginx to use the certificate
# See nginx.conf for SSL configuration
```

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

## Monitoring

### Prometheus Metrics
- Endpoint: `https://api.yourdomain.com/metrics`
- Port: `9464`
- Scrape interval: 15s

### Grafana Dashboards
- URL: `https://grafana.yourdomain.com`
- Pre-built dashboards for:
  - Application metrics
  - Security events
  - AI performance
  - Infrastructure health
  - UEBA analytics

## Rollback

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