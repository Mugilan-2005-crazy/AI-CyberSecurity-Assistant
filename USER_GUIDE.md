# User Guide

## Getting Started

### Account Setup

1. **Register** — Visit the login page and click "Register" to create an account with your email, name, and password.
2. **Email Verification** — Check your email for a verification link. Click it to verify your account.
3. **Login** — Use your email and password to log in. If 2FA is enabled, enter the verification code.

### Dashboard

The dashboard provides an at-a-glance overview of your security posture:

- **Security Score** — A 0-100 score based on your scan history and threat activity
- **Quick Actions** — Run common scans (URL, password, file, email, QR) with one click
- **Threat Activity** — View recent threats and anomalies in a timeline
- **AI Assistant** — Get instant security insights and recommendations from the AI chatbot
- **Notifications** — View security alerts and system notifications

### Security Scanning Modules

#### URL Scanner
Enter any URL to check for:
- Phishing indicators
- Malware distribution
- Insecure transport (HTTP without TLS)
- Brand impersonation
- Suspicious TLDs

#### Password Analyzer
Enter a password to analyze:
- Shannon entropy
- Crack-time estimation
- Breach awareness (common password database)
- Actionable improvement tips

**Note:** Passwords are never stored or transmitted.

#### Email Phishing Detector
Paste email content to detect:
- Suspicious senders
- Urgency-based manipulation tactics
- Malicious links
- Malicious attachments (via SHA-256 hash)
- AI-powered explanation of findings

#### File Malware Scanner
Upload a file (up to 25MB) to scan for:
- Malware signatures via VirusTotal
- Suspicious file types
- SHA-256 hash reputation

Supported formats: PDF, images, documents, archives.

#### QR Code Scanner
- Camera-based QR code scanning
- Text-based QR code input
- Analysis of decoded content (URLs, actions, payloads)

### AI Chatbot

Ask the AI security assistant:
- "How do I detect phishing?"
- "What are the risks of this password: password123?"
- "Analyze this CVE: CVE-2024-21762"
- Upload files for multimodal analysis

Upload files (PDF, images, documents) for AI analysis alongside text queries.

### Reports

Generate professional PDF security reports:
- Risk assessment summaries
- Threat analysis with remediation steps
- Compliance checklists
- Evidence and recommendations

### Threat Intelligence Center

Search for threats by:
- **IP addresses** — Reputation, geolocation, ASN
- **Domains** — WHOIS, DNS records, reputation
- **URLs** — Phishing, malware, suspicious patterns
- **Hashes** — MD5, SHA-1, SHA-256 file reputation
- **CVEs** — Vulnerability details, severity, impacted systems

### UEBA (User Behavior Analytics)

View your security activity timeline:
- Login events
- Scan history
- Anomaly detection
- Risk scoring

### Settings

Manage your profile:
- Change password
- Configure 2FA (TOTP)
- Update language preference
- Manage API keys
- Configure notification preferences

## Best Practices

1. **Use strong passwords** — Generate unique, random passwords for all accounts
2. **Enable 2FA** — Protect your account with time-based one-time passwords
3. **Verify URLs** — Always check URLs before clicking, even from trusted sources
4. **Scan files** — Scan all untrusted file downloads before opening
5. **Review reports** — Regularly review your security reports for emerging threats
6. **Update software** — Keep your browser and OS updated with latest security patches
