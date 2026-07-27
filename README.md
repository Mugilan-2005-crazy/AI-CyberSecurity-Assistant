# 🛡️ Cyber Security Assistant

> Production-ready, AI-powered Cyber Security Assistant — full-stack (React + Vite / Node + Express / MongoDB Atlas) with JWT auth, 7 security modules, an AI chatbot with multimodal analysis, admin panel, and PDF reporting.

---

## 📋 About The Project

The **Cyber Security Assistant** is a full-stack web application that combines traditional security scanning tools with advanced Artificial Intelligence to help users assess, detect, and mitigate cybersecurity threats. Built with **React + Vite** on the frontend and **Node.js + Express** on the backend, it integrates **Google Gemini** (cloud) and **Ollama** (local) for AI-driven threat analysis, recommendations, and conversational security guidance.

**Key Capabilities:**
- 🔍 Scan URLs, passwords, emails, files, and QR codes for security threats
- 🤖 AI-powered security chatbot with multimodal file analysis (PDF, images, videos)
- 📊 Visual security reports with PDF export
- 🧠 Real-time threat intelligence via web search integration
- 🌐 Multilingual support (English, Tamil, Tanglish, Hindi)
- 🎤 Voice input and text-to-speech output
- 👑 Admin panel for user management and platform analytics

---

## 📖 Project Overview

The Cyber Security Assistant is a comprehensive web application designed to help users assess and improve their cybersecurity posture. It combines traditional security scanning tools with advanced AI capabilities to provide intelligent analysis, threat detection, and actionable security guidance.

The platform supports multiple input types — URLs, passwords, emails, files, QR codes — and augments each scan with AI-driven insights. The integrated AI chatbot can analyze uploaded files (PDF, images, videos), perform web searches for threat intelligence, and engage in context-aware multi-turn conversations about security topics.

---

## ✨ Features

**Authentication & User Management**
- Register, Login, Forgot/Reset Password, Email Verification
- JWT access + refresh tokens, httpOnly cookies
- Profile management with account statistics
- Admin panel for user management and platform analytics

**Security Modules**
1. **URL Scanner** — HTTPS/SSL check, suspicious TLDs, URL shorteners, brand impersonation (typosquatting)
2. **Password Analyzer** — Shannon entropy, crack-time estimates, breach awareness, suggestions
3. **Email Phishing Detector** — heuristic scan + optional Gemini AI explanation
4. **File Malware Scanner** — SHA-256 + VirusTotal API
5. **AI Security Chatbot** — Gemini/Ollama multi-turn chat with multimodal analysis
6. **QR Code Safety Checker** — live camera decode (jsQR) + safety verdict
7. **Report Generator** — PDF export via PDFKit

**AI Chatbot Capabilities**
- Text chat with Gemini and Ollama providers
- Multimodal file analysis (PDF, images, videos)
- Web search integration for threat intelligence
- Text-to-speech output
- Voice input support
- Markdown rendering with code blocks
- Security report visualization cards
- Copy / Listen / Regenerate message actions
- Chat history with session management
- Multilingual support (English, Tamil, Tanglish, Hindi)
- Prompt injection protection

---

## 🧱 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React + Vite)                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  Pages   │  │ Components│  │ Services │  │ Contexts │   │
│  │ (Views)  │  │ (UI/UX)  │  │ (API)    │  │ (State)  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│         │             │             │             │         │
│         └─────────────┴──────┬──────┴─────────────┘         │
│                              ▼                              │
│                    Framer Motion / i18n                     │
└─────────────────────────────────────────────────────────────┘
                              │
                         HTTPS / REST
                              │
┌──────────────────────────────▼──────────────────────────────┐
│                  Backend (Node + Express)                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Routes   │  │Controllers│  │ Services │  │ Middleware│   │
│  │ (API)    │  │ (Logic)  │  │ (AI/IO)  │  │ (Auth)   │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│         │             │             │             │         │
│         └─────────────┴──────┬──────┴─────────────┘         │
│                              ▼                              │
│                    Mongoose / Gemini / Ollama               │
└─────────────────────────────────────────────────────────────┘
                              │
                          Mongoose
                              │
┌──────────────────────────────▼──────────────────────────────┐
│                    MongoDB Atlas                             │
│              (Users, ScanHistory, ChatLog, etc.)            │
└─────────────────────────────────────────────────────────────┘
```

---

## 🤖 AI Workflow

1. **User Input** — User sends a message or uploads a file in the AI Chatbot
2. **Input Sanitization** — Backend sanitizes the prompt, strips control characters, and detects potential prompt injection attempts
3. **AI Routing** — `aiRouter.js` decides between Gemini (cloud) and Ollama (local) based on message complexity
4. **Context Building** — Fetches recent scan history and relevant document chunks for context-aware responses
5. **AI Processing** — Selected provider generates a response with security analysis
6. **Response Formatting** — Markdown rendering, category detection, suggestions, and provider badges
7. **Multimodal Analysis** — For file uploads, runs visual/content analysis via Gemini Vision or fallback analyzer
8. **Report Generation** — Security report card with risk level, threats, confidence score, and PDF download
9. **Persistence** — Chat turns and analysis results are saved to MongoDB

---

## 🛠 Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18, Vite, Tailwind CSS, Framer Motion, Chart.js, React Router |
| Backend | Node.js, Express, MVC, Mongoose, JWT, express-validator |
| Database | MongoDB Atlas |
| AI | Google Gemini (`@google/generative-ai`), Ollama (local Llama 3.1) |
| Threat Intel | VirusTotal API |
| PDF | jsPDF (frontend), PDFKit (backend) |
| Auth | JWT access + refresh tokens, httpOnly cookies, bcrypt |
| Security | Helmet, CORS, rate limiting, input validation, NoSQL sanitization, prompt injection detection |
| Deploy | Vercel (frontend), Render (backend), Docker optional |

---

## 📁 Project Structure

```
cs assistant/
├── backend/
│   ├── src/
│   │   ├── config/        # env loader, db connection
│   │   ├── models/        # User, ScanHistory, Report, Notification, ChatLog, AttachmentAnalysis
│   │   ├── controllers/   # auth, scan, chat, admin, aiUpload, document
│   │   ├── routes/        # auth, scan, chat, admin, aiUpload, document
│   │   ├── middleware/    # auth, validate, rateLimiter, sanitize, upload, error, languageDetector
│   │   ├── services/      # security (url/password/email/file/qr/gemini/ollama), scan, report, search, vectorStore, document, ai
│   │   ├── utils/         # logger, jwt, tokens, email, ApiError, catchAsync, seed, sanitizePrompt
│   │   ├── app.js         # Express assembly
│   │   └── server.js      # Entry point
│   ├── scripts/           # Utility scripts
│   ├── Dockerfile / render.yaml / .env.example
│   └── package.json
└── frontend/
    ├── src/
    │   ├── components/    # layout, ui, chat, modules
    │   ├── context/       # AuthContext, ThemeContext
    │   ├── pages/         # auth, dashboard, modules/*, admin/*
    │   ├── services/      # api client, endpoints
    │   ├── hooks/         # useSpeechRecognition, useTextToSpeech
    │   ├── i18n/          # translations (en, ta, hi, tanglish)
    │   ├── utils/         # markdown renderer
    │   ├── App.jsx / main.jsx / index.css
    ├── vercel.json / .env.example / tailwind.config.js / vite.config.js
    └── package.json
```

---

## 🚀 Installation

### Prerequisites
- Node.js 18+
- MongoDB Atlas connection string (or local MongoDB)
- Google Gemini API key
- VirusTotal API key (optional, for file scanner)
- SMTP credentials (optional, for email)
- Ollama (optional, for local AI)

### 1. Backend
```bash
cd backend
cp .env.example .env      # fill in your values
npm install
npm run seed              # create admin account
npm run dev               # http://localhost:5000
```

### 2. Frontend
```bash
cd frontend
cp .env.example .env      # VITE_API_URL (or use proxy in dev)
npm install
npm run dev               # http://localhost:5173
```

> In dev, `/api` is proxied to `localhost:5000` (see `vite.config.js`), so no `VITE_API_URL` is needed.

---

## 🔐 Environment Variables

### Backend (`backend/.env.example`)
| Variable | Description |
|----------|-------------|
| `NODE_ENV` | Application environment (`development` / `production`) |
| `PORT` | Backend port (default: `5000`) |
| `API_PREFIX` | API route prefix (default: `/api`) |
| `MONGODB_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | Secret for access token signing |
| `JWT_EXPIRE` | Access token expiry (default: `7d`) |
| `JWT_REFRESH_SECRET` | Secret for refresh token signing |
| `JWT_REFRESH_EXPIRE` | Refresh token expiry (default: `30d`) |
| `CLIENT_ORIGIN` | Allowed frontend origin for CORS |
| `SMTP_HOST` | SMTP server host |
| `SMTP_PORT` | SMTP server port |
| `SMTP_USER` | SMTP username |
| `SMTP_PASS` | SMTP password / app password |
| `EMAIL_FROM` | Sender email address |
| `GEMINI_API_KEY` | Google Gemini API key |
| `VIRUSTOTAL_API_KEY` | VirusTotal API key |
| `ADMIN_EMAIL` | Bootstrap admin email |
| `ADMIN_PASSWORD` | Bootstrap admin password |
| `ADMIN_NAME` | Bootstrap admin display name |

### Frontend (`frontend/.env.example`)
| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend API base URL |

---

## 📡 API Modules

### Authentication
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | — | Register new user |
| POST | `/api/auth/login` | — | Login |
| GET | `/api/auth/verify-email` | — | Verify email address |
| POST | `/api/auth/forgot-password` | — | Request password reset |
| POST | `/api/reset-password` | — | Reset password |
| POST | `/api/auth/refresh` | — | Refresh access token |
| GET | `/api/auth/me` | ✅ | Current user profile |
| PATCH | `/api/auth/me` | ✅ | Update profile |
| POST | `/api/auth/change-password` | ✅ | Change password |

### Security Scans
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/scan/dashboard` | ✅ | Dashboard aggregate data |
| POST | `/api/scan/url` | ✅ | URL safety scan |
| POST | `/api/scan/password` | ✅ | Password strength analysis |
| POST | `/api/scan/email` | ✅ | Email phishing detection |
| POST | `/api/scan/file` | ✅ | File malware scan |
| POST | `/api/scan/qr` | ✅ | QR code safety check |
| POST | `/api/scan/report` | ✅ | Generate PDF report |
| GET | `/api/scan/reports` | ✅ | List previous reports |

### AI Chatbot
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/chat/message` | ✅ | Text chat message |
| POST | `/api/chat/upload` | ✅ | Multimodal file analysis |
| POST | `/api/chat/web-search` | ✅ | Web search for threats |
| GET | `/api/chat/history` | ✅ | Chat history sessions |
| DELETE | `/api/chat/history` | ✅ | Clear chat history |
| GET | `/api/chat/status` | ✅ | AI provider health |

### Admin
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/admin/users` | 👑 | List all users |
| PATCH | `/api/admin/users/:id` | 👑 | Update user |
| DELETE | `/api/admin/users/:id` | 👑 | Delete user |
| GET | `/api/admin/analytics` | 👑 | Platform analytics |
| GET | `/api/admin/logs` | 👑 | Scan logs |
| GET | `/api/admin/notifications` | ✅ | User notifications |

---

## 🎨 Frontend Features

- **Responsive Design** — Mobile-first layout with sidebar drawers
- **Dark Mode** — System-aware theme switching
- **Animations** — Framer Motion for smooth transitions
- **Markdown Rendering** — Headings, bold, lists, code blocks, inline code
- **Multilingual** — English, Tamil, Tanglish, Hindi support
- **Voice Features** — Text-to-speech and speech-to-text
- **Drag & Drop** — File upload with visual feedback
- **Chat History** — Persistent conversation management
- **Security Reports** — Visual report cards with PDF export

---

## 🔒 Security

- Helmet.js for HTTP security headers
- CORS with configurable origins
- Rate limiting on all sensitive routes
- Input validation via express-validator
- NoSQL injection sanitization
- bcrypt password hashing
- JWT with httpOnly refresh tokens
- Prompt injection detection
- SHA-256 file hash generation
- File type validation and blocking
- Secure environment variable management

---

## 🧪 Running Tests

```bash
# Backend syntax check
node --check src/server.js

# Frontend build
cd frontend
npm run build
```

---

## 📸 Screenshots

> Screenshots showcase the key interfaces of the Cyber Security Assistant. Add actual screenshots in the `screenshots/` directory and reference them below.

| Module | Screenshot |
|--------|------------|
| **Dashboard** | ![Dashboard](screenshots/dashboard.png) |
| **AI Chatbot** | ![AI Chatbot](screenshots/ai-chatbot.png) |
| **URL Scanner** | ![URL Scanner](screenshots/url-scanner.png) |
| **Password Analyzer** | ![Password Analyzer](screenshots/password-analyzer.png) |
| **Email Phishing Detector** | ![Email Phishing Detector](screenshots/email-phishing.png) |
| **QR Security Checker** | ![QR Security Checker](screenshots/qr-checker.png) |
| **Security Report** | ![Security Report](screenshots/security-report.png) |

---

## 📝 License

Distributed under the MIT License. See `LICENSE` for more information.

---

## 👨‍💻 Author

**Mugilan**  
B.Tech Information Technology

[![GitHub](https://img.shields.io/badge/GitHub-Profile-blue?logo=github)](https://github.com/Mugilan-2005-crazy)  
[![Email](https://img.shields.io/badge/Email-Contact-red?logo=gmail)](mailto:mugilan@example.com)

---

<p align="center">Built with ❤️ for cybersecurity awareness and education</p>