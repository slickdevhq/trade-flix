import transporter from '../config/email.js';
import logger from '../config/logger.js';

const FROM_EMAIL = process.env.FROM_EMAIL || 'Tradeflix <test@tradeflix.com>';
const CLIENT_URL = process.env.CLIENT_URL;
const API_URL = process.env.API_URL;

// ──────────────────────────────────────────────────────────────────
// Shared Template Builder
// ──────────────────────────────────────────────────────────────────

const buildEmailShell = ({ title, previewText, bodyContent }) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${title}</title>
  <!--[if mso]>
  <noscript>
    <xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
  </noscript>
  <![endif]-->
  <style>
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background-color: #0d0f12; margin: 0; padding: 0; -webkit-text-size-adjust: 100%; }
    .email-wrapper { background-color: #0d0f12; padding: 40px 16px; font-family: 'DM Sans', Arial, sans-serif; }
    .email-container { max-width: 580px; margin: 0 auto; }

    /* Header */
    .email-header {
      padding: 32px 40px 24px;
      background: linear-gradient(135deg, #111318 0%, #161a22 100%);
      border-radius: 16px 16px 0 0;
      border: 1px solid #1e2330;
      border-bottom: none;
      text-align: left;
    }
    .logo-lockup { display: flex; align-items: center; gap: 10px; }
    .logo-icon {
      width: 36px; height: 36px;
      background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%);
      border-radius: 9px;
      display: inline-flex; align-items: center; justify-content: center;
      font-size: 18px; line-height: 1;
    }
    .logo-text {
      font-family: 'DM Sans', Arial, sans-serif;
      font-size: 18px; font-weight: 600; letter-spacing: -0.3px;
      color: #f1f5f9;
    }
    .logo-text span { color: #3b82f6; }

    /* Body */
    .email-body {
      background: #111318;
      border: 1px solid #1e2330;
      border-top: none;
      border-bottom: none;
      padding: 36px 40px;
    }

    /* Typography */
    .email-eyebrow {
      font-family: 'DM Mono', monospace;
      font-size: 11px; font-weight: 500; letter-spacing: 1.5px;
      text-transform: uppercase; color: #3b82f6;
      margin-bottom: 12px;
    }
    .email-title {
      font-size: 26px; font-weight: 600; line-height: 1.25;
      letter-spacing: -0.5px; color: #f1f5f9;
      margin-bottom: 16px;
    }
    .email-body p {
      font-size: 15px; line-height: 1.7; color: #94a3b8;
      margin-bottom: 16px;
    }
    .email-body p strong { color: #cbd5e1; font-weight: 500; }

    /* CTA Button */
    .cta-wrapper { margin: 32px 0; }
    .cta-button {
      display: inline-block;
      padding: 14px 28px;
      background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%);
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 10px;
      font-family: 'DM Sans', Arial, sans-serif;
      font-size: 15px; font-weight: 600; letter-spacing: -0.1px;
      box-shadow: 0 4px 20px rgba(99, 102, 241, 0.35);
      transition: opacity 0.2s;
    }
    .cta-button-danger {
      background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
      box-shadow: 0 4px 20px rgba(239, 68, 68, 0.35);
    }

    /* Divider */
    .divider {
      border: none; border-top: 1px solid #1e2330;
      margin: 28px 0;
    }

    /* Info box */
    .info-box {
      background: #0d0f12;
      border: 1px solid #1e2330;
      border-left: 3px solid #3b82f6;
      border-radius: 6px;
      padding: 14px 16px;
      margin: 24px 0;
    }
    .info-box.danger { border-left-color: #ef4444; }
    .info-box p { margin-bottom: 0; font-size: 13px; color: #64748b; }

    /* URL copy block */
    .url-block {
      background: #0d0f12;
      border: 1px solid #1e2330;
      border-radius: 8px;
      padding: 12px 16px;
      margin-top: 8px;
    }
    .url-block p {
      font-family: 'DM Mono', monospace;
      font-size: 11px; color: #475569;
      word-break: break-all; margin-bottom: 0; line-height: 1.6;
    }

    /* List */
    .styled-list { list-style: none; margin: 16px 0; padding: 0; }
    .styled-list li {
      display: flex; align-items: flex-start; gap: 10px;
      font-size: 14px; color: #94a3b8;
      padding: 7px 0;
      border-bottom: 1px solid #1a1f2b;
    }
    .styled-list li:last-child { border-bottom: none; }
    .styled-list li::before {
      content: '—';
      color: #ef4444; font-weight: 600; flex-shrink: 0;
      margin-top: 1px;
    }

    /* Warning badge */
    .warning-badge {
      display: inline-flex; align-items: center; gap: 7px;
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.25);
      border-radius: 6px;
      padding: 8px 14px;
      font-size: 13px; font-weight: 500; color: #f87171;
      margin: 16px 0;
    }

    /* Footer */
    .email-footer {
      background: #0d0f12;
      border: 1px solid #1e2330;
      border-top: none;
      border-radius: 0 0 16px 16px;
      padding: 24px 40px;
      text-align: center;
    }
    .email-footer p {
      font-size: 12px; color: #334155; line-height: 1.6;
      margin-bottom: 4px;
    }
    .email-footer a { color: #475569; text-decoration: none; }

    /* Notification success */
    .success-icon {
      width: 48px; height: 48px;
      background: rgba(59, 130, 246, 0.1);
      border: 1px solid rgba(59, 130, 246, 0.2);
      border-radius: 12px;
      display: inline-flex; align-items: center; justify-content: center;
      font-size: 22px; margin-bottom: 20px;
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="email-container">

      <!-- Header -->
      <div class="email-header">
        <div class="logo-lockup">
          <div class="logo-icon">📈</div>
          <div class="logo-text">Trade<span>flix</span></div>
        </div>
      </div>

      <!-- Body -->
      <div class="email-body">
        ${bodyContent}
      </div>

      <!-- Footer -->
      <div class="email-footer">
        <p>You received this email because you have a Tradeflix account.</p>
        <p>© ${new Date().getFullYear()} Tradeflix · <a href="${CLIENT_URL}">Visit site</a> · <a href="${CLIENT_URL}/settings">Manage preferences</a></p>
      </div>

    </div>
  </div>
</body>
</html>
`;

// ──────────────────────────────────────────────────────────────────
// Email Service Class
// ──────────────────────────────────────────────────────────────────

class EmailService {
  async sendEmail(to, subject, html) {
    try {
      const mailOptions = {
        from: FROM_EMAIL,
        to: Array.isArray(to) ? to.join(', ') : to,
        subject,
        html,
        text: html.replace(/<[^>]*>/g, ''),
      };

      const info = await transporter.sendMail(mailOptions);
      logger.info(`Email captured by Mailtrap: ${info.messageId}`);
      return info;
    } catch (error) {
      logger.error(`Failed to send email to ${to}:`, error);
      throw error;
    }
  }

  // ──────────────────────────────────────────────────────────────────
  // Verification Emails
  // ──────────────────────────────────────────────────────────────────

  async sendVerificationEmail(email, name, token) {
    const verificationUrl = `${API_URL}/api/v1/auth/verify-email?token=${token}`;

    const html = buildEmailShell({
      title: 'Verify Your Email – Tradeflix',
      bodyContent: `
        <p class="email-eyebrow">Account Setup</p>
        <h1 class="email-title">Welcome aboard, ${name} 👋</h1>
        <p>Thanks for joining Tradeflix. Before you start tracking your trades, we need to confirm your email address.</p>
        <p>Hit the button below — it only takes a second.</p>

        <div class="cta-wrapper">
          <a href="${verificationUrl}" class="cta-button">Verify my email</a>
        </div>

        <hr class="divider" />

        <div class="info-box">
          <p>⏱ This link expires in <strong style="color:#94a3b8">24 hours</strong>. If you didn't create this account, you can safely ignore this email.</p>
        </div>

        <p style="font-size:13px; color:#475569; margin-top:20px;">Can't click the button? Copy and paste this link:</p>
        <div class="url-block"><p>${verificationUrl}</p></div>
      `,
    });

    await this.sendEmail(email, 'Verify Your Email – Tradeflix', html);
  }

  async sendEmailChangeVerification(email, name, token) {
    const verificationUrl = `${API_URL}/api/v1/settings/email/confirm?token=${token}`;

    const html = buildEmailShell({
      title: 'Confirm Email Change – Tradeflix',
      bodyContent: `
        <p class="email-eyebrow">Account Security</p>
        <h1 class="email-title">Confirm your new email</h1>
        <p>Hi ${name},</p>
        <p>We received a request to update your Tradeflix email address. Click the button below to approve this change.</p>

        <div class="cta-wrapper">
          <a href="${verificationUrl}" class="cta-button">Confirm email change</a>
        </div>

        <hr class="divider" />

        <div class="info-box">
          <p>⏱ This link expires in <strong style="color:#94a3b8">1 hour</strong>. If you didn't request this, you can safely ignore this email — your address will remain unchanged.</p>
        </div>

        <p style="font-size:13px; color:#475569; margin-top:20px;">Can't click the button? Copy and paste this link:</p>
        <div class="url-block"><p>${verificationUrl}</p></div>
      `,
    });

    await this.sendEmail(email, 'Confirm Email Change – Tradeflix', html);
  }

  // ──────────────────────────────────────────────────────────────────
  // Password Reset
  // ──────────────────────────────────────────────────────────────────

  async sendPasswordResetEmail(email, name, token) {
    const resetUrl = `${CLIENT_URL}/reset-password?token=${token}`;

    const html = buildEmailShell({
      title: 'Reset Your Password – Tradeflix',
      bodyContent: `
        <p class="email-eyebrow">Password Reset</p>
        <h1 class="email-title">Forgot your password?</h1>
        <p>Hi ${name},</p>
        <p>No worries — it happens. Click the button below to choose a new password for your Tradeflix account.</p>

        <div class="cta-wrapper">
          <a href="${resetUrl}" class="cta-button">Reset my password</a>
        </div>

        <hr class="divider" />

        <div class="info-box">
          <p>⏱ This link expires in <strong style="color:#94a3b8">1 hour</strong>. If you didn't request a reset, you can ignore this email — your current password is still active.</p>
        </div>

        <p style="font-size:13px; color:#475569; margin-top:20px;">Can't click the button? Copy and paste this link:</p>
        <div class="url-block"><p>${resetUrl}</p></div>
      `,
    });

    await this.sendEmail(email, 'Reset Your Password – Tradeflix', html);
  }

  // ──────────────────────────────────────────────────────────────────
  // Account Deletion
  // ──────────────────────────────────────────────────────────────────

  async sendAccountDeletionConfirmation(email, name, token) {
    const confirmUrl = `${API_URL}/api/v1/settings/account/confirm-delete?token=${token}`;

    const html = buildEmailShell({
      title: 'Confirm Account Deletion – Tradeflix',
      bodyContent: `
        <p class="email-eyebrow" style="color:#ef4444;">Destructive Action</p>
        <h1 class="email-title">Delete your account?</h1>
        <p>Hi ${name},</p>
        <p>We received a request to <strong>permanently delete</strong> your Tradeflix account. Before you confirm, here's what will be removed:</p>

        <ul class="styled-list">
          <li>All your recorded trades</li>
          <li>All journal entries and notes</li>
          <li>All goals and habits</li>
          <li>All personal data and settings</li>
        </ul>

        <div class="warning-badge">⚠️ This action is permanent and cannot be undone.</div>

        <div class="cta-wrapper">
          <a href="${confirmUrl}" class="cta-button cta-button-danger">Yes, delete my account</a>
        </div>

        <hr class="divider" />

        <div class="info-box danger">
          <p>⏱ This link expires in <strong style="color:#94a3b8">1 hour</strong>. If you didn't request this, please ignore this email and consider changing your password immediately.</p>
        </div>
      `,
    });

    await this.sendEmail(email, 'Confirm Account Deletion – Tradeflix', html);
  }

  // ──────────────────────────────────────────────────────────────────
  // Notification Emails
  // ──────────────────────────────────────────────────────────────────

  async sendPasswordChangedNotification(email, name) {
    const html = buildEmailShell({
      title: 'Password Changed – Tradeflix',
      bodyContent: `
        <div class="success-icon">🔐</div>
        <p class="email-eyebrow">Security Notice</p>
        <h1 class="email-title">Your password was changed</h1>
        <p>Hi ${name},</p>
        <p>This is a confirmation that your Tradeflix password was successfully updated. For your security, all active sessions have been signed out.</p>

        <hr class="divider" />

        <div class="info-box danger">
          <p>🚨 Didn't make this change? Please <a href="${CLIENT_URL}/reset-password" style="color:#f87171; text-decoration:none; font-weight:500;">reset your password</a> immediately and contact our support team.</p>
        </div>
      `,
    });

    await this.sendEmail(email, 'Password Changed – Tradeflix', html);
  }

  async sendEmailChangedNotification(oldEmail, newEmail, name) {
    const html = buildEmailShell({
      title: 'Email Address Updated – Tradeflix',
      bodyContent: `
        <div class="success-icon">✉️</div>
        <p class="email-eyebrow">Security Notice</p>
        <h1 class="email-title">Email address updated</h1>
        <p>Hi ${name},</p>
        <p>Your Tradeflix login email has been changed:</p>

        <div class="info-box" style="margin:24px 0;">
          <p style="margin-bottom:8px !important;">From: <strong style="color:#94a3b8;">${oldEmail}</strong></p>
          <p>To: <strong style="color:#94a3b8;">${newEmail}</strong></p>
        </div>

        <hr class="divider" />

        <div class="info-box danger">
          <p>🚨 Didn't make this change? Please <a href="${CLIENT_URL}/reset-password" style="color:#f87171; text-decoration:none; font-weight:500;">secure your account</a> right away and contact our support team.</p>
        </div>
      `,
    });

    await this.sendEmail(oldEmail, 'Email Address Updated – Tradeflix', html);
  }
}

export const emailService = new EmailService();