# Getting Started — CyberSphere AI v3.1.0

## Overview

This guide walks you through setting up CyberSphere AI on your local machine or deploying it to the cloud. By the end, you'll have a running instance with all core modules operational.

## Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| Node.js | 18+ | LTS recommended |
| npm | 9+ | Comes with Node.js |
| MongoDB Atlas | — | Or local MongoDB 7+ |
| Google Gemini API key | — | Required for AI features |
| Docker | 24+ | Optional, for containerized deployment |
| Docker Compose | 2.20+ | Optional |

## Quick Start (Local Development)

### 1. Clone the Repository

```bash
git clone <repository-url>
cd Enterprise-Cyber-Security-Platform
```

### 2. Configure Environment

```bash
# Backend
cd backend
cp .env.example .env
# Edit .env with your values

# Frontend
cd ../frontend
cp .env.example .env
# Edit .env if needed
```

### 3. Install Dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 4. Seed the Database

```bash
cd backend
npm run seed
```

This creates the admin account using credentials from `backend/.env`.

### 5. Start the Application

```bash
# Terminal 1 — Backend
cd backend
npm run dev
# Server starts on http://localhost:5000

# Terminal 2 — Frontend
cd ../frontend
npm run dev
# Client starts on http://localhost:5173
```

### 6. Verify Installation

Open http://localhost:5173 in your browser. You should see the landing page. Navigate to /login and sign in with the admin credentials you seeded.

## Docker Deployment (Local)

### Quick Start

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
# - CLIENT_ORIGIN

# Start the stack
docker compose up -d

# Seed admin user
docker compose exec backend npm run seed

# Verify health
curl http://localhost/api/health
```

### Docker Compose Commands

```bash
# Start all services
docker compose up -d

# Stop all services
docker compose down

# View logs
docker compose logs -f

# Rebuild after changes
docker compose build
```

## First Login

1. Navigate to http://localhost:5173
2. Click "Sign In"
3. Enter the admin email and password from your `.env` file
4. If MFA is enabled, enter the TOTP code
5. You'll be redirected to the Dashboard

## Key Modules

| Module | Path | Description |
|--------|------|-------------|
| Dashboard | `/dashboard` | Security overview and analytics |
| URL Scanner | `/scan/url` | Analyze URLs for threats |
| Password Analyzer | `/scan/password` | Evaluate password strength |
| Email Phishing | `/scan/email` | Detect phishing emails |
| File Scanner | `/scan/file` | Scan files for malware |
| QR Checker | `/scan/qr` | Analyze QR codes |
| AI Chatbot | `/dashboard/ai-chatbot` | Conversational AI assistant |
| Threat Intel | `/threat-intel` | Threat intelligence center |
| Reports | `/reports` | Generate and view reports |
| Admin | `/admin/*` | Platform administration |

## Next Steps

- Read the [Architecture Guide](02-ARCHITECTURE.md) for system design details
- Review the [Security Model](03-SECURITY_MODEL.md) for security features
- Explore the [API Reference](04-API_REFERENCE.md) for endpoint documentation
- See [Troubleshooting](06-TROUBLESHOOTING.md) for common issues