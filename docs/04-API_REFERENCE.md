# API Reference — CyberSphere AI v3.1.0

## Base URL

```
Development: http://localhost:5000/api
Production:  https://api.yourdomain.com/api
```

## Authentication

All authenticated endpoints require a valid JWT access token sent via httpOnly cookie. The cookie is set automatically during login.

### Register

```
POST /api/auth/register
```

**Request Body:**
```json
{
  "name": "string",
  "email": "string",
  "password": "string"
}
```

**Response:** `201 Created` with user object (excluding password).

### Login

```
POST /api/auth/login
```

**Request Body:**
```json
{
  "email": "string",
  "password": "string"
}
```

**Response:** `200 OK` with access token and user object.

### Refresh Token

```
POST /api/auth/refresh
```

**Headers:** Cookie with refresh token (httpOnly).

**Response:** `200 OK` with new access token.

### Get Current User

```
GET /api/auth/me
```

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK` with user profile.

### Logout

```
POST /api/auth/logout
```

**Response:** `200 OK`. Clears refresh token cookie.

## Security Scans

### URL Scan

```
POST /api/scan/url
```

**Request Body:**
```json
{
  "url": "https://example.com"
}
```

**Response:**
```json
{
  "success": true,
  "result": {
    "verdict": "safe" | "suspicious" | "malicious",
    "threats": [],
    "confidence": 0.95
  }
}
```

### Password Analysis

```
POST /api/scan/password
```

**Request Body:**
```json
{
  "password": "string"
}
```

**Response:**
```json
{
  "success": true,
  "result": {
    "score": 85,
    "strength": "strong",
    "crackTime": "centuries",
    "issues": []
  }
}
```

### Email Phishing Detection

```
POST /api/scan/email
```

**Request Body:**
```json
{
  "email": "string"
}
```

**Response:**
```json
{
  "success": true,
  "result": {
    "verdict": "safe" | "suspicious" | "phishing",
    "indicators": [],
    "aiExplanation": "string"
  }
}
```

### File Malware Scan

```
POST /api/scan/file
```

**Content-Type:** `multipart/form-data`

**Body:** File upload (max 25MB).

**Response:**
```json
{
  "success": true,
  "result": {
    "verdict": "clean" | "suspicious" | "malicious",
    "sha256": "string",
    "virusTotalResults": {}
  }
}
```

### QR Code Check

```
POST /api/scan/qr
```

**Request Body:**
```json
{
  "text": "string"
}
```

**Response:**
```json
{
  "success": true,
  "result": {
    "verdict": "safe" | "suspicious" | "malicious",
    "decodedContent": "string",
    "analysis": {}
  }
}
```

### Generate Report

```
POST /api/scan/report
```

**Request Body:**
```json
{
  "scanIds": ["string"],
  "format": "pdf"
}
```

**Response:** PDF file download.

### List Reports

```
GET /api/scan/reports
```

**Response:**
```json
{
  "success": true,
  "reports": []
}
```

## AI Chatbot

### Send Message

```
POST /api/chat/message
```

**Request Body:**
```json
{
  "message": "string",
  "sessionId": "string"
}
```

**Response:**
```json
{
  "success": true,
  "reply": "string",
  "category": "string",
  "suggestions": [],
  "provider": "gemini" | "ollama"
}
```

### Upload File for AI Analysis

```
POST /api/chat/upload
```

**Content-Type:** `multipart/form-data`

**Body:** File upload.

**Response:** Multimodal analysis result.

### Web Search for Threats

```
POST /api/chat/web-search
```

**Request Body:**
```json
{
  "query": "string"
}
```

**Response:**
```json
{
  "success": true,
  "results": [],
  "summary": "string"
}
```

### Chat History

```
GET /api/chat/history
```

**Response:**
```json
{
  "success": true,
  "sessions": []
}
```

### Clear Chat History

```
DELETE /api/chat/history
```

### AI Provider Status

```
GET /api/chat/status
```

**Response:**
```json
{
  "success": true,
  "providers": {
    "gemini": { "available": true },
    "ollama": { "available": false }
  }
}
```

## Security Notes AI

### Supported Formats

```
GET /api/notes/formats
```

### Supported Languages

```
GET /api/notes/languages
```

### List Documents

```
GET /api/notes/documents
```

### Upload Document

```
POST /api/notes/upload
```

**Content-Type:** `multipart/form-data`

### Get Document

```
GET /api/notes/:id
```

### Delete Document

```
DELETE /api/notes/:id
```

### Chat with Document

```
POST /api/notes/chat
```

### Document Chat History

```
GET /api/notes/history/:documentId
```

## Admin

### List Users

```
GET /api/admin/users
```

### Update User

```
PATCH /api/admin/users/:id
```

### Delete User

```
DELETE /api/admin/users/:id
```

### Platform Analytics

```
GET /api/admin/analytics
```

### Scan Logs

```
GET /api/admin/logs
```

### User Notifications

```
GET /api/admin/notifications
```

## Error Responses

All error responses follow this format:

```json
{
  "success": false,
  "message": "Error description",
  "code": "ERROR_CODE",
  "requestId": "uuid"
}
```

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | OK |
| 201 | Created |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not Found |
| 429 | Too Many Requests |
| 500 | Internal Server Error |