# Monitoring & Observability Guide

## Overview

CyberSphere AI v3.2.0 provides comprehensive monitoring through Prometheus metrics and Grafana dashboards. The observability stack covers application health, API performance, security events, and AI service metrics.

## Architecture

```
Application → OpenTelemetry SDK → OTLP Exporter → Collector → Prometheus + Grafana
     │                    │
     └── Logs (Winston)   └── Metrics (Prometheus)
                                 │
                                 └── Dashboards (Grafana)
```

## Prometheus Metrics

### Security Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `security_scan_total` | counter | Total security scans performed |
| `threat_detection_total` | counter | Total threat detections |
| `failed_login_total` | counter | Total failed login attempts |
| `ai_request_total` | counter | Total AI requests processed |

### Application Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `http_requests_total` | counter | Total HTTP requests by method/route/status |
| `http_request_duration_seconds` | histogram | Request latency distribution |
| `ai_requests_total` | counter | Total AI provider requests |
| `ai_errors_total` | counter | AI request errors |
| `ai_cache_hits_total` | counter | AI cache hit count |
| `ai_tokens_used_total` | counter | Tokens consumed by AI |

### Infrastructure Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `mongodb_connections_current` | gauge | Active MongoDB connections |
| `system_uptime_seconds` | counter | Server uptime |
| `error_total` | counter | Total application errors |
| `alerts_total` | counter | Total security alerts |
| `alerts_active` | gauge | Currently active alerts |

## Grafana Dashboards

### CyberSphere AI Security Dashboard

The primary security dashboard (`cybersphere-security`) includes:

- **Application Health**: Service uptime and availability
- **API Latency (p95)**: Response time percentiles
- **Request Count**: Incoming request rate
- **Error Rate**: 5xx error percentage
- **Authentication Failures**: Failed login attempts over time
- **Threat Detections**: Threat detection rate
- **AI Requests**: AI service request volume
- **Scanner Usage**: Security scan throughput
- **Database Health**: MongoDB connection count and query latency
- **Security Scans by Type**: Pie chart of scan categories
- **Threat Detection by Category**: Pie chart of threat types

### Accessing Dashboards

1. Navigate to Grafana: `http://localhost:3001`
2. Select the "CyberSphere AI Security Dashboard" from the dashboard list
3. Dashboards auto-refresh every 15 seconds

## Key Metrics

- Request latency (p50, p95, p99)
- Error rate by endpoint
- AI provider response times
- Scan throughput
- Authentication success/failure rates
- Memory and CPU utilization
- MongoDB connection pool usage
- Redis cache hit ratio

## Health Check

The backend exposes a health check endpoint:

```
GET /api/health
```

Returns the current status of all services including MongoDB, Redis, and AI providers.

## Alerting

Grafana alerts can be configured for:
- High error rates (>5%)
- Authentication failure spikes
- Threat detection anomalies
- Database connection pool exhaustion
- AI service unavailability