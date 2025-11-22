# Tradeflix MVP - Backend

This is the complete, production-ready authentication backend for the Tradeflix MVP, built with Node.js, Express, MongoDB, and Passport.js.

## ✨ Features

- Email/Password Registration
- Secure Email Verification (JWT-based)
- Google OAuth 2.0 Signin/Signup
- Secure Login (bcrypt)
- Forgot/Reset Password Flow
- Session Management (Rotating Refresh Tokens)
- Secure, `HttpOnly`, `SameSite=Strict` cookies
- Route Protection
- Session Listing & Revocation
- Rate Limiting & Security Headers (`helmet`)
- Input Validation (`joi`)
- Structured Logging (`pino`)
- Unified API Responses and Error Handling
- Ready for Render deployment

---

## 🛠️ Setup & Running Locally

### 1. Prerequisites

- Node.js (v18+)
- MongoDB (local or Atlas)
- Git

### 2. Clone & Install

```bash
git clone <your-repo-url>
cd tradeflix-mvp
npm install
```

---

## API Response Format

All API endpoints now use a consistent JSON shape.

- Success:
  ```json
  {
    "success": true,
    "message": "optional message",
    "data": { /* endpoint-specific payload */ }
  }
  ```

- Error (production):
  ```json
  {
    "success": false,
    "error": {
      "code": "ERROR_CODE",
      "message": "Human-readable message",
      "details": [
        { "field": "optional.field", "message": "validation message" }
      ]
    }
  }
  ```

- Error (development) additionally includes `stack` for debugging.

### Common Error Codes

- `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `BAD_REQUEST`, `CONFLICT`, `INTERNAL_ERROR`
- Auth-specific: `INVALID_CREDENTIALS`, `EMAIL_NOT_VERIFIED`, `NO_TOKEN`, `INVALID_TOKEN`, `TOKEN_EXPIRED`, `NO_REFRESH_TOKEN`, `INVALID_REFRESH_TOKEN`, `USER_NOT_FOUND`
- Validation: `VALIDATION_ERROR`, `MODEL_VALIDATION_ERROR`, `INVALID_ID`, `DUPLICATE_KEY`

### Endpoint Examples

- POST ` /api/v1/auth/register`
  - Success:
    ```json
    { "success": true, "message": "Registration successful. Please check your email to verify your account." }
    ```
  - Notes: Verification token is sent via email, not returned in API.

- POST ` /api/v1/auth/login`
  - Success:
    ```json
    {
      "success": true,
      "data": {
        "accessToken": "...",
        "user": { "id": "...", "name": "...", "email": "..." }
      }
    }
    ```
  - Notes: A `refreshToken` is set as an `HttpOnly` cookie.

- POST ` /api/v1/auth/refresh-token`
  - Success: same shape as Login.
  - Errors: `NO_REFRESH_TOKEN`, `INVALID_REFRESH_TOKEN`.

- POST ` /api/v1/auth/logout`
  - Success:
    ```json
    { "success": true, "message": "Logged out successfully" }
    ```

- POST ` /api/v1/auth/forgot-password`
  - Success (always):
    ```json
    { "success": true, "message": "If an account with that email exists, a reset link has been sent." }
    ```

- POST ` /api/v1/auth/reset-password?token=...`
  - Success:
    ```json
    { "success": true, "message": "Password reset successful. Please log in." }
    ```
  - Errors: `MISSING_TOKEN`, `INVALID_TOKEN`, `TOKEN_EXPIRED`, `USER_NOT_FOUND`.

- GET ` /api/v1/user/me` (protected)
  - Success:
    ```json
    {
      "success": true,
      "data": { "id": "...", "email": "...", "name": "...", "isVerified": true }
    }
    ```

- GET ` /api/v1/user/sessions` (protected)
  - Success:
    ```json
    { "success": true, "data": [ { "userAgent": "...", "createdAt": "...", "expiresAt": "..." } ] }
    ```

- POST ` /api/v1/user/sessions/:id/revoke` (protected)
  - Success:
    ```json
    { "success": true, "message": "Session revoked successfully" }
    ```
  - Errors: `SESSION_NOT_FOUND`, `SESSION_ALREADY_REVOKED`.

### Notes

- `GET /api/v1/auth/verify-email` redirects to the client with status indicators. It does not return JSON.
- In production, error responses never include stack traces; development includes `stack` for debugging.