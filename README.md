# 🛡️ Cyber Security Assistant

> Production-ready, AI-powered Cyber Security Assistant — full-stack (React + Vite / Node + Express / MongoDB Atlas) with JWT auth, 7 security modules, an AI chatbot, admin panel, and PDF reporting.

---

## ✨ Features

**Authentication**
- Register, Login, Forgot/Reset Password, Email Verification (JWT access + refresh tokens, httpOnly cookies)

**Dashboard**
- Total scans, threat score, recent activity, module-usage + verdict charts, rotating security tips

**Security Modules**
1. **URL Scanner** — HTTPS/SSL check, suspicious TLDs, URL shorteners, brand impersonation (typosquatting)
2. **Password Analyzer** — Shannon entropy, crack-time estimates, breach awareness, suggestions
3. **Email Phishing Detector** — heuristic scan + optional Gemini AI explanation
4. **File Malware Scanner** — SHA-256 + VirusTotal API
5. **AI Security Chatbot** — Google Gemini multi-turn chat
6. **QR Code Safety Checker** — live camera decode (jsQR) + safety verdict
7. **Report Generator** — PDF export via PDFKit

**Admin**
- User management (role/active toggles, delete), platform analytics, in-app notifications

**Security**
- Helmet, CORS, rate limiting, input validation, NoSQL sanitization, bcrypt password hashing, JWT, secure env vars

---

## 🧱 Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18, Vite, Tailwind CSS, Framer Motion, Chart.js, React Router |
| Backend | Node.js, Express, MVC, Mongoose, JWT, express-validator |
| DB | MongoDB Atlas |
| AI | Google Gemini (`@google/generative-ai`) |
| Threat Intel | VirusTotal API |
| Deploy | Vercel (frontend), Render (backend), Docker optional |

---

## 📁 Project Structure

```
cs assistant/
├── backend/
│   ├── src/
│   │   ├── config/        # env loader, db connection
│   │   ├── models/        # User, ScanHistory, Report, Notification
│   │   ├── controllers/   # auth, scan, chat, admin
│   │   ├── routes/        # auth, scan, chat, admin
│   │   ├── middleware/    # auth, validate, rateLimiter, sanitize, upload, error
│   │   ├── services/      # security (url/password/email/file/qr/gemini), scan, report
│   │   ├── utils/         # logger, jwt, tokens, email, ApiError, catchAsync, seed
│   │   ├── app.js         # Express assembly
│   │   └── server.js      # Entry point
│   ├── Dockerfile / render.yaml / .env.example
│   └── package.json
└── frontend/
    ├── src/
    │   ├── components/    # layout, ui, ProtectedRoute
    │   ├── context/       # AuthContext, ThemeContext
    │   ├── pages/         # auth, dashboard, modules/*, admin/*
    │   ├── services/      # api client
    │   ├── App.jsx / main.jsx / index.css
    ├── vercel.json / .env.example / tailwind.config.js / vite.config.js
    └── package.json
```

---

## 🚀 Local Development

### Prerequisites
- Node.js 18+
- MongoDB Atlas connection string (or local MongoDB)
- Google Gemini API key
- VirusTotal API key (optional, for the file scanner)
- SMTP credentials (optional, for email)

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

## 🌐 Production Deployment

### Backend (Render)
1. Create a new **Web Service** from this repo (root: `backend`).
2. Build command: `npm install`; Start command: `npm start`.
3. Add all `backend/.env` variables as **Environment Variables** (including `MONGODB_URI`, `JWT_SECRET`, `GEMINI_API_KEY`, etc.).
4. Use `render.yaml` or set the start command manually.

### Frontend (Vercel)
1. Import the repo, set **Root Directory** to `frontend`.
2. Build command: `npm run build`; Output: `dist`.
3. Set env var `VITE_API_URL=https://<your-backend>.onrender.com/api`.
4. `vercel.json` handles SPA rewrites.

### Docker (optional)
```bash
cd backend
docker build -t cybersec-backend .
docker run -p 5000:5000 --env-file .env cybersec-backend
```

---

## 🔐 Environment Variables

See `backend/.env.example` for the full list. **Never commit real secrets.**

---

## 🧪 API Summary

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | — | Register |
| POST | `/api/auth/login` | — | Login |
| GET | `/api/auth/verify-email` | — | Verify email |
| POST | `/api/auth/forgot-password` | — | Request reset |
| POST | `/api/auth/reset-password` | — | Reset password |
| POST | `/api/auth/refresh` | — | Refresh access token |
| GET | `/api/auth/me` | ✅ | Current user |
| GET | `/api/scan/dashboard` | ✅ | Dashboard data |
| POST | `/api/scan/url` | ✅ | URL scan |
| POST | `/api/scan/password` | ✅ | Password analysis |
| POST | `/api/scan/email` | ✅ | Email phishing scan |
| POST | `/api/scan/file` | ✅ | File malware scan |
| POST | `/api/scan/qr` | ✅ | QR safety check |
| POST | `/api/scan/report` | ✅ | Generate PDF report |
| POST | `/api/chat/message` | ✅ | AI chatbot |
| GET | `/api/admin/users` | 👑 | List users |
| PATCH | `/api/admin/users/:id` | 👑 | Update user |
| DELETE | `/api/admin/users/:id` | 👑 | Delete user |
| GET | `/api/admin/analytics` | 👑 | Platform analytics |
| GET | `/api/admin/logs` | 👑 | Scan logs |
| GET | `/api/admin/notifications` | ✅ | User notifications |

---

## 📝 License
MIT
