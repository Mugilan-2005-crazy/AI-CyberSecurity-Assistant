# Operations Manual

## Service Architecture

```
Client → Caddy (TLS) → Frontend (nginx) → Backend (Node.js)
                                      → MongoDB Atlas
                                      → Redis Cloud
                                      → OpenTelemetry Collector → Prometheus + Grafana
```

## Monitoring

### Health Checks
- Backend: `GET /api/health` — returns `{"success": true, "message": "..."}`
- Docker healthcheck: `wget -qO- http://127.0.0.1:5000/api/health`
- K8s liveness probe: HTTP GET `/api/health` (initialDelay 60s)
- K8s readiness probe: HTTP GET `/api/health` (initialDelay 15s)
- K8s startup probe: HTTP GET `/api/health` (failureThreshold 30)

### Metrics
- OpenTelemetry Prometheus exporter on port 9464
- Prometheus scrapes backend at `backend:9464`
- OTEL Collector receives OTLP at port 4318
- OTEL self-metrics on port 8889
- Grafana dashboards on port 3001

### Logs
- Winston structured logging (JSON in production)
- Each request has a correlation ID (`X-Request-ID` header)
- Log format: `{ timestamp, level, message, ...metadata }`
- All security events logged with userId and IP

## Scaling

### Horizontal Scaling
- Docker Compose: `docker compose up --scale backend=3`
- Kubernetes: HPA scales backend (min 2, max 10) based on CPU 70% / memory 80%

### Resource Limits (Docker Compose)
| Service | Memory Limit | CPU Limit |
|---------|-------------|-----------|
| Backend | 1G | 2 cores |
| Redis | 256M | 0.5 cores |
| MongoDB | 512M | 1 core |
| Grafana | — | — |
| OTEL Collector | — | — |

## Routine Maintenance

### Log Rotation
Logs are written to stdout/stderr. In Docker, use:
```bash
docker compose logs --tail=100 backend
docker system prune -f   # clean old containers/images
```

### Database Maintenance
```bash
# Compact MongoDB
docker compose exec mongodb mongosh --eval "db.runCommand({ compact: 'cybersec' })"

# Check collection sizes
docker compose exec mongodb mongosh --eval "db.stats()"
```

### Redis Maintenance
```bash
# Check Redis info
docker compose exec redis redis-cli INFO memory

# Flush cache (if needed)
docker compose exec redis redis-cli FLUSHALL
```

## Emergency Procedures

### High CPU on Backend
1. Check metrics: `curl http://localhost:9464/metrics`
2. Identify slow endpoints
3. Scale horizontally: `docker compose up --scale backend=5`

### Database Unreachable
1. Check: `docker compose ps mongodb`
2. Verify health: `docker compose exec mongodb mongosh --eval "db.adminCommand('ping')"`
3. Check connection string in `.env`

### Redis Unreachable
- Application degrades gracefully to in-memory cache
- Rate limiting falls back to MemoryStore (single instance only)
- Check: `docker compose ps redis`
- Verify password: `docker compose exec redis redis-cli -a $REDIS_PASSWORD ping`

## Backups

- MongoDB: Use `mongodump` or MongoDB Atlas backup
- Redis: RDB snapshots + AOF persistence (`--appendonly yes`)
- Configuration: Version-controlled in Git
- See [BACKUP_RECOVERY.md](BACKUP_RECOVERY.md) for details
