# Administrator Guide

## Overview

The admin dashboard provides centralized control over the CyberSphere AI platform, including user management, system analytics, security operations, and infrastructure monitoring.

**Access**: Admin role required. Navigate to `/admin/users`, `/admin/analytics`, `/admin/soc`, etc.

## User Management

### Viewing Users
- Navigate to **Admin → Users**
- View all registered users with: email, name, role, status, last login, created date
- Users are displayed in a paginated table with search and filtering

### Editing Users
- Click the edit icon on any user row
- Modify: name, email, role, active status, security questions
- Role options: `user`, `security_analyst`, `security_manager`, `admin`, `auditor`, `devops`, `cloud_admin`, `container_admin`

### Deactivating Users
- Toggle the "Active" switch to deactivate/reactivate a user
- Deactivated users cannot log in or access the platform
- Reactivation re-enables the account without data loss

### Resetting Passwords
- Admins can reset user passwords via the lock icon
- A password reset email is sent to the user

## Analytics Dashboard

### Platform Metrics
- Total users, active sessions, scan volume
- Threat detection rates by module
- AI usage and provider distribution
- Storage and resource utilization

### Security Trends
- Threat activity over time (24h, 7d, 30d)
- Module usage distribution
- Most common threat types

## SOC Dashboard

### Real-time Monitoring
- Live threat feed from integrated providers (VirusTotal, AbuseIPDB, OTX, NVD)
- Socket.IO real-time updates for security events
- Alert triage with severity filtering

### Incident Management
- View, assign, and track security incidents
- AI-powered incident analysis and response recommendations
- Incident report generation (PDF export)
- Response history tracking

## Executive Dashboard

### Risk Overview
- Enterprise-wide risk score
- Compliance status (SOC 2, GDPR, ISO 27001)
- Top threat vectors
- Resource allocation recommendations

### Compliance Reporting
- Automated compliance scorecards
- Gap analysis
- Audit-ready reports

## Cloud Security Dashboard

### Multi-cloud Posture
- AWS, Azure, and GCP security posture
- IAM permission analysis
- Network security group review
- Storage bucket public access checks

### Container Security
- Docker image vulnerability scanning
- Running container analysis
- Kubernetes cluster security posture
- Kubernetes Dashboard access

## Observability Dashboard

### Health Monitoring
- Backend service health
- Database connection status
- Redis cache status
- External API provider status (Gemini, Ollama, threat intel)

### Metrics & Traces
- Prometheus metrics endpoint
- OpenTelemetry distributed traces
- Grafana dashboards
- Alert configuration

## Configuration

### Environment Variables
All configuration is via environment variables (see `.env.example`):

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | Yes | Access token signing key (≥32 chars) |
| `JWT_REFRESH_SECRET` | Yes | Refresh token signing key (≥32 chars) |
| `ENCRYPTION_KEY` | Yes | AES-256 key for TOTP secrets |
| `MONGODB_URI` | Yes | MongoDB connection string |
| `REDIS_PASSWORD` | Yes | Redis authentication password |
| `ADMIN_PASSWORD` | Yes | Bootstrap admin password |
| `GEMINI_API_KEY` | No | Google Gemini AI key |
| `SMTP_*` | No | Email service credentials |

### Kubernetes Deployment
Apply manifests:
```bash
kubectl apply -f k8s/
kubectl apply -f k8s/pdb.yaml
kubectl apply -f k8s/rbac.yaml
```

Verify:
```bash
kubectl get pods -n cybersec-platform
kubectl get svc -n cybersec-platform
kubectl get ingress -n cybersec-platform
```

## Maintenance

### Backup
- MongoDB: Daily dumps via cron job or MongoDB Atlas snapshots
- Redis: AOF persistence enabled, RDB snapshots available
- See [BACKUP_RECOVERY.md](BACKUP_RECOVERY.md) for details

### Updates
1. Deploy new Docker images
2. Run database migrations if applicable
3. Monitor health checks
4. Verify all services healthy

### Monitoring
- Health endpoint: `GET /api/health`
- Metrics endpoint: Prometheus scrape on port 9464
- Logs: Structured JSON with correlation IDs
- Alerts: Configure in Grafana

## Security Administration

### Rate Limits
| Endpoint | Limit |
|----------|-------|
| Global | 1000 per 15 min |
| Auth | 10 per 15 min |
| Chat | 20 per min |
| Scans | 30 per min |
| Uploads | 5 per min |

### Audit Logging
All security-relevant events are logged:
- Authentication (login, logout, failures)
- Authorization failures (403 responses)
- Data access (admin actions)
- Rate limit violations
- AI prompt injection attempts
- File upload violations

Logs include: timestamp, userId, IP address, correlation ID, event details.
