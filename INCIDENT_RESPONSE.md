# Incident Response Plan

## 1. Preparation

### Roles & Responsibilities
- **Incident Commander**: Leads the response, coordinates communication
- **Security Analyst**: Investigates root cause, collects evidence
- **SRE/DevOps**: Contains the incident, implements fixes
- **Legal/Compliance**: Handles regulatory reporting if required

### Contact List
| Role | Contact |
|------|---------|
| Security Team | security@cybersec.io |
| DevOps Team | devops@cybersec.io |
| Legal | legal@cybersec.io |
| Executive | exec@cybersec.io |

### Tools
- **Logs**: `docker compose logs backend --grep <indicator>`
- **Metrics**: Grafana dashboards at `http://localhost:3001`
- **SIEM**: Forward logs to SIEM (Splunk/ELK/Datadog)
- **Forensics**: `docker commit` for container state capture

## 2. Detection & Analysis

### Alert Triage
| Alert Type | Severity | Response Time |
|------------|----------|---------------|
| Auth brute force (>10 attempts) | High | 15 min |
| AI prompt injection detected | High | 15 min |
| JWT token reuse (jti collision) | Critical | 5 min |
| File upload violation | Medium | 1 hour |
| Rate limit exceeded (1000+) | Medium | 1 hour |
| SQL injection attempt | Critical | 5 min |
| Privilege escalation attempt | Critical | 5 min |

### Log Analysis Commands
```bash
# Find failed logins
docker compose logs backend --grep "Failed login" --since 1h

# Find admin access
docker compose logs backend --grep "Admin access" --since 24h

# Find rate limit violations
docker compose logs backend --grep "rate limit" --since 1h

# Find AI security blocks
docker compose logs backend --grep "malicious prompt\|PII\|injection" --since 24h

# Find file upload rejections
docker compose logs backend --grep "invalid file type\|blocked" --since 24h
```

### Correlation ID Tracking
Every request includes `X-Request-ID` in response headers and `x-request-id` in logs. Use this to trace full request lifecycle:
```bash
docker compose logs backend --grep "req-<correlation-id>"
```

## 3. Containment

### Immediate Actions
1. **Isolate**: Block attacker IP at Caddy level
2. **Disable**: Suspend compromised user accounts
3. **Rotate**: JWT secrets, API keys if token compromise suspected
4. **Snapshot**: `docker commit` affected containers for forensics

### Network Containment
```bash
# Add to Caddyfile to block IP
@blocked {
  remote 1.2.3.4
}
respond @blocked "Forbidden" 403
```

## 4. Eradication

### Account Compromise
1. Reset password for affected user
2. Revoke all active sessions (delete refresh tokens from user document)
3. Force re-verification of email
4. Notify user of security event

### JWT Compromise
1. Rotate `JWT_SECRET` and `JWT_REFRESH_SECRET` in environment
2. Restart backend pods (all tokens invalidated)
3. Users must re-authenticate

### AI Prompt Injection
1. Review `sanitizePrompt.js` detection patterns
2. Add new patterns for discovered injection vectors
3. Review recent AI responses for data leakage
4. Audit `multimodalAI.js` for bypass vectors

## 5. Recovery

### Steps
1. Remove containment measures (firewall rules, account suspensions)
2. Deploy fixes via CI/CD pipeline
3. Verify with test suite: `npm test`
4. Monitor closely for 72 hours post-recovery
5. Validate all functionality via health checks

### Verification Checklist
- [ ] All services healthy (`docker compose ps`)
- [ ] No error logs in last 15 minutes
- [ ] Auth flow working (login, refresh, logout)
- [ ] Scan functionality working (URL, file, email)
- [ ] AI chatbot responding (timeout < 30s)
- [ ] Metrics endpoint accessible
- [ ] Rate limiting functional
- [ ] Audit logging functional

## 6. Post-Incident

### Report Contents
1. **Executive Summary** — What happened, impact, resolution
2. **Timeline** — Chronological sequence of events
3. **Root Cause** — Technical explanation of the vulnerability
4. **Impact Assessment** — Data potentially exposed
5. **Remediation** — What was fixed
6. **Lessons Learned** — What could be improved

### Timeline Template
| Time | Action | Actor | Notes |
|------|--------|-------|-------|
| T+0 | Alert detected | Monitoring | |
| T+5 | Triage started | Security Analyst | |
| T+15 | Containment applied | SRE | |
| T+30 | Root cause identified | Security Analyst | |
| T+60 | Fix deployed | DevOps | |
| T+90 | Service verified | SRE | |

### Follow-up Actions
- Update threat model
- Add regression tests
- Improve runbooks
- Review and adjust alerting thresholds
- Update security documentation
