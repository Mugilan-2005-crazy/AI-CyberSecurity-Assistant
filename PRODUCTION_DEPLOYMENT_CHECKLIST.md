# Production Deployment Checklist — CyberSphere AI v3.1.0

## Before Deployment

### Environment Preparation
- [ ] Node.js 18+ installed on all servers
- [ ] Docker 24+ and Docker Compose 2.20+ installed
- [ ] MongoDB Atlas cluster created and accessible
- [ ] Redis Cloud instance created and accessible
- [ ] Google Gemini API key obtained
- [ ] VirusTotal API key obtained (optional)
- [ ] SMTP credentials configured (optional)
- [ ] Domain name registered and DNS configured
- [ ] SSL/TLS certificates obtained (Let's Encrypt or commercial)

### Configuration
- [ ] `backend/.env` configured with production values
- [ ] `frontend/.env` configured with production API URL
- [ ] `.env.example` updated if new variables added
- [ ] `CLIENT_ORIGIN` set to production frontend URL
- [ ] `JWT_SECRET` is a 64+ character random string
- [ ] `JWT_REFRESH_SECRET` is a 64+ character random string
- [ ] `MONGODB_URI` points to production MongoDB Atlas
- [ ] `REDIS_HOST` and `REDIS_PASSWORD` set correctly
- [ ] `GEMINI_API_KEY` set correctly
- [ ] No placeholder values remain in production `.env`

### Security
- [ ] All secrets are stored in environment variables (not in code)
- [ ] `.env` files are in `.gitignore`
- [ ] No API keys or passwords committed to repository
- [ ] Docker images scanned with Trivy (no CRITICAL vulnerabilities)
- [ ] Container images use non-root user
- [ ] TLS/HTTPS enforced at reverse proxy level
- [ ] Firewall rules configured for required ports only
- [ ] Database credentials are strong and rotated regularly

### Infrastructure
- [ ] Docker Compose file validated: `docker compose config`
- [ ] Kubernetes manifests validated: `kubectl apply --dry-run=all`
- [ ] Ingress TLS configured with cert-manager or equivalent
- [ ] Resource limits set in Kubernetes deployments
- [ ] Health checks configured for all services
- [ ] Monitoring and alerting configured (Prometheus + Grafana)
- [ ] Log aggregation configured (Winston → centralized logging)

### Backup
- [ ] MongoDB Atlas automated backups enabled
- [ ] Redis persistence configured (AOF or RDB)
- [ ] Backup restoration procedure tested
- [ ] Disaster recovery plan documented

---

## During Deployment

### Docker Deployment
- [ ] Pull latest images or build fresh: `docker compose build`
- [ ] Start services: `docker compose up -d`
- [ ] Verify all services are healthy: `docker compose ps`
- [ ] Check backend logs: `docker compose logs backend`
- [ ] Check frontend logs: `docker compose logs frontend`
- [ ] Verify health endpoint: `curl http://localhost/api/health`
- [ ] Verify frontend is accessible: `curl http://localhost`

### Kubernetes Deployment
- [ ] Apply namespace: `kubectl apply -f k8s/namespace.yaml`
- [ ] Apply configmap: `kubectl apply -f k8s/configmap.yaml`
- [ ] Apply secrets: `kubectl apply -f k8s/secrets.yaml`
- [ ] Apply deployments: `kubectl apply -f k8s/deployment.yaml`
- [ ] Apply services: `kubectl apply -f k8s/service.yaml`
- [ ] Apply ingress: `kubectl apply -f k8s/ingress.yaml`
- [ ] Apply HPA: `kubectl apply -f k8s/hpa.yaml`
- [ ] Apply PDB: `kubectl apply -f k8s/pdb.yaml`
- [ ] Apply RBAC: `kubectl apply -f k8s/rbac.yaml`
- [ ] Verify pods running: `kubectl get pods -n cybersec`
- [ ] Verify services: `kubectl get svc -n cybersec`
- [ ] Verify ingress: `kubectl get ingress -n cybersec`

### Seed Database
- [ ] Run seed command: `docker compose exec backend npm run seed`
- [ ] Verify admin user created
- [ ] Verify database indexes created

---

## After Deployment

### Verification
- [ ] Frontend accessible at configured domain
- [ ] Backend API accessible at configured URL
- [ ] Login functionality works
- [ ] All scanner modules work (URL, Password, Email, File, QR)
- [ ] AI Chatbot works
- [ ] Dashboard loads with data
- [ ] Reports can be generated
- [ ] Admin panel accessible (if applicable)

### Monitoring
- [ ] Prometheus scraping metrics from backend (`:9464/metrics`)
- [ ] Grafana dashboards showing data
- [ ] Alert rules configured and firing correctly
- [ ] Log aggregation working
- [ ] Error rates within acceptable thresholds
- [ ] Response times within acceptable thresholds

### Security Verification
- [ ] HTTPS enforced (no HTTP access)
- [ ] Security headers present (HSTS, CSP, X-Frame-Options)
- [ ] CORS restricted to production origin
- [ ] Rate limiting active
- [ ] No sensitive data exposed in API responses
- [ ] No stack traces in production error responses

### Performance
- [ ] Frontend build optimized (minified, tree-shaken)
- [ ] Backend running in production mode (`NODE_ENV=production`)
- [ ] Database connections pooled
- [ ] Redis cache working
- [ ] CDN caching configured (if applicable)

---

## Rollback Procedure

### Docker Compose Rollback
```bash
# Revert to previous image version
docker compose rollback

# Or manually revert to previous compose file version
git checkout previous-version/docker-compose.yml
docker compose up -d
```

### Kubernetes Rollback
```bash
# Rollback backend deployment
kubectl rollout undo deployment/cybersec-backend -n cybersec

# Rollback frontend deployment
kubectl rollout undo deployment/cybersec-frontend -n cybersec

# Check rollout status
kubectl rollout status deployment/cybersec-backend -n cybersec
kubectl rollout status deployment/cybersec-frontend -n cybersec
```

### Database Rollback
```bash
# Restore from MongoDB Atlas backup
# Use Atlas UI or mongodump/mongorestore
mongorestore --uri="<production-uri>" --archive=<backup-file>
```

### Full Rollback
1. Identify the last known good version
2. Rollback Kubernetes deployments or Docker Compose services
3. Restore database from backup if needed
4. Verify all services are healthy
5. Update DNS if necessary
6. Communicate rollback to stakeholders

---

## Post-Deployment Checklist

- [ ] All services running and healthy
- [ ] All endpoints responding correctly
- [ ] Authentication and authorization working
- [ ] All scanner modules functional
- [ ] AI features working
- [ ] Monitoring and alerting active
- [ ] Logs flowing to centralized system
- [ ] Backups verified and working
- [ ] Security scan clean
- [ ] Performance acceptable
- [ ] Documentation updated
- [ ] Team notified of deployment