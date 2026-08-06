# Demo Guide — CyberSphere AI v3.1.0

## Demo Overview

This guide provides a professional demo workflow for showcasing CyberSphere AI v3.1.0 to stakeholders, customers, and technical audiences.

## Demo Environment Setup

```bash
# Clone and start
git clone <repository-url>
cd Enterprise-Cyber-Security-Platform

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

Access the application at http://localhost:5173

## Demo Flow

### 1. User Authentication

**Purpose:** Demonstrate secure login with JWT auth and TOTP MFA

**Input:**
- Navigate to http://localhost:5173/login
- Enter admin credentials from `.env`
- If MFA enabled, enter TOTP code

**Expected Output:**
- Successful authentication
- Redirect to Dashboard
- Security status indicators visible

**Business Value:** Demonstrates enterprise-grade authentication with MFA support

---

### 2. Security Dashboard

**Purpose:** Show the enterprise SOC dashboard with real-time security metrics

**Input:**
- Click on Dashboard in the sidebar
- Observe the security overview cards

**Expected Output:**
- Security score gauge (animated)
- Total scans, threats detected, safe scans metrics
- AI provider status indicators
- System health indicators
- Quick actions panel
- Module risk levels

**Business Value:** Provides a centralized view of organizational security posture

---

### 3. Threat Overview

**Purpose:** Demonstrate threat detection and risk visualization

**Input:**
- Review the threat activity chart
- Examine the threat distribution breakdown
- Check the AI Security Agent recommendations

**Expected Output:**
- Weekly threat trend chart
- Safe vs risky breakdown
- AI-generated security recommendations with priority levels
- Risk level indicators

**Business Value:** Enables proactive threat identification and response

---

### 4. URL Scanner

**Purpose:** Demonstrate URL security analysis

**Input:**
- Navigate to Scan > URL
- Enter a test URL (e.g., `https://example.com`)
- Click Scan

**Expected Output:**
- Security score (RiskMeter)
- Verdict badge (safe/suspicious/malicious)
- Security checks (HTTPS, TLD, URL shortener, etc.)
- Issues and recommendations

**Business Value:** Protects users from phishing and malicious URLs

---

### 5. Email Phishing Detection

**Purpose:** Demonstrate AI-powered email phishing analysis

**Input:**
- Navigate to Scan > Email
- Enter sender and email body
- Click Analyze

**Expected Output:**
- Risk score and verdict
- Spam detection
- Urgency signals analysis
- Credential request detection
- AI explanation of findings

**Business Value:** Defends against social engineering and phishing attacks

---

### 6. Malware Scanner

**Purpose:** Demonstrate file malware detection

**Input:**
- Navigate to Scan > File
- Upload a test file
- Click Scan

**Expected Output:**
- SHA-256 hash
- VirusTotal detection results
- Risk score and verdict
- Engine detection count

**Business Value:** Prevents malware ingestion through file uploads

---

### 7. AI Security Assistant

**Purpose:** Demonstrate conversational AI for security guidance

**Input:**
- Navigate to AI Chatbot
- Ask a security question (e.g., "What are the top threats today?")
- Observe the AI response

**Expected Output:**
- Streaming AI response
- Security analysis with risk assessment
- Provider badge (Gemini/Ollama)
- Security report card with recommendations

**Business Value:** Provides instant, AI-powered security guidance

---

### 8. Security Report Generation

**Purpose:** Demonstrate automated report generation

**Input:**
- Navigate to Reports
- Click Generate Report
- Wait for PDF generation

**Expected Output:**
- Comprehensive PDF security report
- Downloadable report with scan history
- Risk assessment summary

**Business Value:** Enables compliance reporting and audit trails

---

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

---

## Closing

"The CyberSphere AI v3.1.0 platform is production-ready with 337+ passing tests, enterprise-grade security, WCAG 2.2 AA accessibility, and comprehensive documentation. It's available as a web application, installable PWA, and native desktop application."

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
```