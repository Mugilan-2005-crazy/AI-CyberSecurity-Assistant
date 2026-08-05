# Demo Experience — Enterprise Cyber Security Platform v2.1

## Overview

This document provides a professional demo flow for showcasing the Enterprise Cyber Security Platform.

## Demo Flow

### 1. Login
- Navigate to the application URL
- Enter admin credentials
- Complete TOTP MFA verification (if enabled)
- Land on the Executive Dashboard

### 2. Executive Dashboard
- View real-time security posture metrics
- Risk gauges and compliance scores
- Country heat map of threat sources
- Executive summary cards with key KPIs
- Recent security incidents feed

### 3. AI SOC Assistant
- Open the AI SOC Analyst module
- Ask a security question (e.g., "What are the top threats today?")
- Show AI-powered analysis with risk assessment
- Demonstrate multimodal file analysis
- Show streaming response with security report card

### 4. Threat Intelligence Center
- Search for a known CVE
- Analyze an IOC (IP, domain, hash)
- Show threat correlation results
- Display multi-provider threat feeds

### 5. UEBA (User Entity Behavior Analytics)
- View user risk scores
- Show anomaly detection timeline
- Demonstrate behavioral profiling
- Display risk ranking

### 6. Cloud Security
- Show cloud posture assessment
- Display compliance impact analysis
- Demonstrate remediation planning
- Show multi-cloud provider support

### 7. Incident Report
- Generate an AI-powered incident report
- Show response recommendations
- Export report as PDF
- Display response history

### 8. Monitoring
- Show real-time Socket.IO updates
- Display OpenTelemetry metrics
- View Prometheus/Grafana dashboards
- Show system health indicators

## Feature Showcase

### Core Security Modules
| Module | Key Feature | Demo Value |
|--------|------------|------------|
| URL Scanner | Phishing detection | Scan a suspicious URL |
| Password Analyzer | Entropy analysis | Test password strength |
| Email Phishing | AI explanation | Analyze a phishing email |
| File Scanner | VirusTotal integration | Scan a test file |
| QR Checker | Live camera scanning | Scan a QR code |

### Enterprise Features
| Feature | Description | Demo Value |
|---------|------------|------------|
| AI SOC Analyst | Real-time AI security analysis | Ask security questions |
| Threat Intelligence | Multi-provider IOC analysis | Search for threats |
| UEBA | Behavioral anomaly detection | Show risk scoring |
| Cloud Security | Multi-cloud posture management | Show compliance |
| Container Security | Docker/K8s scanning | Show container risks |
| Knowledge Graph | Attack path analysis | Show graph visualization |
| Incident Response | AI-powered response | Generate incident report |

## Screenshots

Screenshots should be captured for each major screen and placed in `docs/screenshots/`:

1. `landing-page.png` — Landing page hero
2. `login.png` — Login form
3. `dashboard.png` — Executive dashboard
4. `ai-soc.png` — AI SOC Analyst
5. `threat-intel.png` — Threat Intelligence Center
6. `ueba.png` — UEBA dashboard
7. `cloud-security.png` — Cloud security posture
8. `incident-report.png` — Incident report generator
9. `monitoring.png` — Monitoring/observability
10. `pwa-install.png` — PWA install prompt
11. `desktop-app.png` — Tauri desktop application

## Demo Script

### Opening (30 seconds)
"Welcome to the Enterprise Cyber Security Platform — an AI-powered security operations platform that combines threat detection, behavioral analytics, and incident response in one unified solution."

### Login & Dashboard (1 minute)
"Let me log in to the platform. You can see the executive dashboard with real-time security metrics, risk assessment, and compliance status."

### AI SOC Analyst (2 minutes)
"The AI SOC Analyst provides real-time security analysis. Let me ask it about today's top threats... You can see it's analyzing the threat landscape and providing actionable recommendations."

### Threat Intelligence (1 minute)
"The Threat Intelligence Center aggregates data from multiple providers including VirusTotal, AbuseIPDB, and NVD to provide comprehensive threat analysis."

### UEBA (1 minute)
"UEBA monitors user behavior patterns and detects anomalies that could indicate compromised accounts or insider threats."

### Cloud & Container Security (1 minute)
"We can assess cloud security posture across AWS, Azure, and GCP, and scan container images for vulnerabilities."

### Incident Response (1 minute)
"The incident response module uses AI to analyze security incidents and generate comprehensive reports with remediation steps."

### Closing (30 seconds)
"The platform is available as a web application, installable PWA, and native desktop application. It's production-ready with 315+ passing tests and comprehensive security controls."

## Installation Demo

### PWA Installation
1. Open the application in Chrome/Edge
2. Click the install icon in the address bar
3. Show the app installed on desktop/mobile

### Desktop App (Tauri)
1. Run `npm run desktop:build` in the frontend directory
2. Install the generated NSIS installer
3. Launch the desktop application
4. Show the native window with the full platform

## Environment Setup for Demo

### Development
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

### Production
```bash
# Deploy backend to Railway/Render
# Deploy frontend to Vercel/Cloudflare Pages
# Configure MongoDB Atlas and Redis Cloud
# Set environment variables
# Access via custom domain