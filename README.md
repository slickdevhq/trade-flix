# Tradeflix MVP - Backend

This is the complete, production-ready authentication backend for the Tradeflix MVP, built with Node.js, Express, MongoDB, and Passport.js.

## ✨ Features

* Email/Password Registration
* Secure Email Verification (JWT-based)
* Google OAuth 2.0 Signin/Signup
* Secure Login (bcrypt)
* Forgot/Reset Password Flow
* Session Management (Rotating Refresh Tokens)
* Secure, `HttpOnly`, `SameSite=Strict` cookies
* Route Protection
* Session Listing & Revocation
* Rate Limiting & Security Headers (`helmet`)
* Input Validation (`joi`)
* Structured Logging (`pino`)
* Ready for Render deployment

---

## 🛠️ Setup & Running Locally

### 1. Prerequisites

* [Node.js](https://nodejs.org/) (v18+)
* [MongoDB](https://www.mongodb.com/) (running locally or a free-tier Atlas cluster)
* [Git](https://git-scm.com/)

### 2. Clone & Install

```bash
git clone <your-repo-url>
cd tradeflix-mvp
npm install