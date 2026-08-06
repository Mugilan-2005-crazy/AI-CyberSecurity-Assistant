# API Reference

All API endpoints are relative to `http://host:5000/api/`.

## Authentication

### Register
```http
POST /api/auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePass!123",
  "language": "en"
}
```
**Response** `201`:
```json
{
  "success": true,
  "accessToken": "...",
  "user": { "id": "...", "name": "John Doe", "email": "john@example.com", "role": "user" }
}
```
**Errors**: `409` duplicate email, `422` validation failed, `400` invalid password

### Login
```http
POST /api/auth/login
Content-Type: application/json

{ "email": "john@example.com", "password": "SecurePass!123" }
```
**Response** `200`:
```json
{
  "success": true,
  "accessToken": "...",
  "user": { "id": "...", "email": "...", "role": "user", "isEmailVerified": true }
}
```
Cookies: `refreshToken` (httpOnly, secure, sameSite=strict)

### Login Enhanced (with device tracking)
```http
POST /api/auth/login-enhanced
Content-Type: application/json

{ "email": "...", "password": "...", "device": "Desktop", "location": "Unknown" }
```
Returns `requires2FA: true` if TOTP enabled.

### Refresh Token
```http
POST /api/auth/refresh
Content-Type: application/json
```
Uses httpOnly refresh token cookie. Returns:
```json
{ "accessToken": "...", "refreshToken": "..." }
```

### Logout
```http
POST /api/auth/logout
```
Clears refresh token cookie.

### Verify Email
```http
GET /api/auth/verify-email?token=<token>
```

### Forgot Password
```http
POST /api/auth/forgot-password
Content-Type: application/json

{ "email": "john@example.com" }
```

### Reset Password
```http
POST /api/auth/reset-password
Content-Type: application/json

{ "token": "...", "password": "NewSecurePass!123" }
```

### Change Password
```http
POST /api/auth/change-password
Authorization: Bearer <accessToken>
Content-Type: application/json

{ "currentPassword": "...", "newPassword": "..." }
```

### Get Current User
```http
GET /api/auth/me
Authorization: Bearer <accessToken>
```

### 2FA Verification
```http
POST /api/auth/2fa/verify
Authorization: Bearer <accessToken>
Content-Type: application/json

{ "token": "123456", "trustDevice": true }
```

## Security Scans

### URL Scan
```http
POST /api/scan/url
Authorization: Bearer <accessToken>
Content-Type: application/json

{ "url": "https://example.com" }
```
**Response**: Security verdict, threat details, recommendations

### Password Analysis
```http
POST /api/scan/password
Authorization: Bearer <accessToken>
Content-Type: application/json

{ "password": "myPassword123" }
```
**Response**: Entropy, crack-time estimate, breach check, improvement tips

### Email Phishing Detection
```http
POST /api/scan/email
Authorization: Bearer <accessToken>
Content-Type: application/json

{ "emailContent": "Dear user, click here..." }
```
**Response**: Phishing score, suspicious indicators, AI explanation

### File Scan
```http
POST /api/scan/file
Authorization: Bearer <accessToken>
Content-Type: multipart/form-data

file: <uploaded_file>
```
**Response**: VirusTotal results, hash, malware detection

### QR Code Analysis
```http
POST /api/scan/qr
Authorization: Bearer <accessToken>
Content-Type: application/json

{ "text": " decoded QR content or text " }
```

### Dashboard
```http
GET /api/scan/dashboard
Authorization: Bearer <accessToken>
```
**Response**: Aggregate stats, recent activity, security tips

### Report Generation
```http
POST /api/scan/report
Authorization: Bearer <accessToken>
Content-Type: application/json

{ "scanId": "...", "format": "pdf" }
```

### List Reports
```http
GET /api/scan/reports
Authorization: Bearer <accessToken>
```

## AI Chatbot

### Send Message
```http
POST /api/chat/message
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "message": "How do I detect phishing?",
  "sessionId": "optional-session-id",
  "language": "en"
}
```
**Response**: AI response with risk level, threats, confidence score

### Upload File for Analysis
```http
POST /api/chat/upload
Authorization: Bearer <accessToken>
Content-Type: multipart/form-data

file: <file>
message: "Analyze this report"
```

### Web Search
```http
POST /api/chat/web-search
Authorization: Bearer <accessToken>
Content-Type: application/json

{ "query": "CVE-2024-21762" }
```

### Chat History
```http
GET /api/chat/history?sessionId=<id>
Authorization: Bearer <accessToken>
```

### AI Status
```http
GET /api/chat/status
Authorization: Bearer <accessToken>
```
Returns provider health (Gemini, Ollama)

## Admin

### List Users
```http
GET /api/admin/users?page=1&limit=20
Authorization: Bearer <accessToken> (admin only)
```

### Update User
```http
PATCH /api/admin/users/:id
Authorization: Bearer <accessToken> (admin only)
Content-Type: application/json

{ "name": "...", "role": "...", "isActive": true }
```

### Delete User
```http
DELETE /api/admin/users/:id
Authorization: Bearer <accessToken> (admin only)
```

### Analytics
```http
GET /api/admin/analytics
Authorization: Bearer <accessToken> (admin only)
```

## Threat Intelligence

### IOC Analysis
```http
POST /api/threat-intel/analyze
Authorization: Bearer <accessToken>
Content-Type: application/json

{ "ioc": "1.2.3.4", "type": "ip" }
```

### CVE Search
```http
GET /api/threat-intel/cve?q=fortios
Authorization: Bearer <accessToken>
```

### CVE Details
```http
GET /api/threat-intel/cve/CVE-2024-21762
Authorization: Bearer <accessToken>
```

## Health

### API Health
```http
GET /api/health
```
**Response**: `{ "success": true, "message": "Enterprise Cyber Security Platform API running" }`

### Root Health
```http
GET /health
```
**Response**: `{ "status": "ok", "env": "production" }`

## WebSockets

### Socket.IO
Connect to: `http://host:5000/api/socket.io` with Bearer token:
```js
const socket = io('http://host:5000', {
  auth: { token: 'Bearer <accessToken>' },
  path: '/api/socket.io'
});
```

Events:
- `connect` — Connection established
- `disconnect` — Disconnected
- `threat_update` — New threat detected
- `scan_progress` — Scan progress update
- `system_alert` — System-wide alert

## Error Responses

All errors follow this format:
```json
{
  "success": false,
  "message": "Error description",
  "requestId": "correlation-id",
  "stack": "..."  (development only)
}
```

Status codes:
| Code | Meaning |
|------|---------|
| 400 | Bad request |
| 401 | Unauthorized (invalid/missing token) |
| 403 | Forbidden (insufficient role) |
| 404 | Resource not found |
| 409 | Conflict (duplicate resource) |
| 422 | Validation error |
| 429 | Rate limit exceeded |
| 500 | Internal server error |
