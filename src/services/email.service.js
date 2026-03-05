import transporter from '../config/email.js'; // The one we just made
import logger from '../config/logger.js';

const FROM_EMAIL = process.env.FROM_EMAIL || 'Tradeflix <test@tradeflix.com>';
const CLIENT_URL = process.env.CLIENT_URL;
const API_URL = process.env.API_URL;

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

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome to Tradeflix, ${name}!</h2>
        <p>Thank you for signing up. Please verify your email address to get started.</p>
        <p>
          <a href="${verificationUrl}" 
             style="display: inline-block; padding: 12px 24px; background-color: #4F46E5; 
                    color: white; text-decoration: none; border-radius: 6px;">
            Verify Email
          </a>
        </p>
        <p style="color: #6B7280; font-size: 14px;">
          This link will expire in 24 hours. If you didn't create an account, you can ignore this email.
        </p>
        <p style="color: #6B7280; font-size: 12px;">
          Or copy and paste this URL into your browser:<br>
          ${verificationUrl}
        </p>
      </div>
    `;

    await this.sendEmail(email, 'Verify Your Email - Tradeflix', html);
  }

  async sendEmailChangeVerification(email, name, token) {
    const verificationUrl = `${API_URL}/api/v1/settings/email/confirm?token=${token}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Confirm Email Change</h2>
        <p>Hi ${name},</p>
        <p>You requested to change your email address. Please click the button below to confirm this change.</p>
        <p>
          <a href="${verificationUrl}" 
             style="display: inline-block; padding: 12px 24px; background-color: #4F46E5; 
                    color: white; text-decoration: none; border-radius: 6px;">
            Confirm Email Change
          </a>
        </p>
        <p style="color: #6B7280; font-size: 14px;">
          This link will expire in 1 hour. If you didn't request this change, please ignore this email.
        </p>
        <p style="color: #6B7280; font-size: 12px;">
          Or copy and paste this URL into your browser:<br>
          ${verificationUrl}
        </p>
      </div>
    `;

    await this.sendEmail(email, 'Confirm Email Change - Tradeflix', html);
  }

  // ──────────────────────────────────────────────────────────────────
  // Password Reset
  // ──────────────────────────────────────────────────────────────────

  async sendPasswordResetEmail(email, name, token) {
    const resetUrl = `${CLIENT_URL}/reset-password?token=${token}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Password Reset Request</h2>
        <p>Hi ${name},</p>
        <p>We received a request to reset your password. Click the button below to create a new password.</p>
        <p>
          <a href="${resetUrl}" 
             style="display: inline-block; padding: 12px 24px; background-color: #4F46E5; 
                    color: white; text-decoration: none; border-radius: 6px;">
            Reset Password
          </a>
        </p>
        <p style="color: #6B7280; font-size: 14px;">
          This link will expire in 1 hour. If you didn't request this, you can safely ignore this email.
        </p>
        <p style="color: #6B7280; font-size: 12px;">
          Or copy and paste this URL into your browser:<br>
          ${resetUrl}
        </p>
      </div>
    `;

    await this.sendEmail(email, 'Password Reset Request - Tradeflix', html);
  }

  // ──────────────────────────────────────────────────────────────────
  // Account Deletion
  // ──────────────────────────────────────────────────────────────────

  async sendAccountDeletionConfirmation(email, name, token) {
    const confirmUrl = `${API_URL}/api/v1/settings/account/confirm-delete?token=${token}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #DC2626;">Confirm Account Deletion</h2>
        <p>Hi ${name},</p>
        <p><strong>You requested to permanently delete your Tradeflix account.</strong></p>
        <p>This action will:</p>
        <ul style="color: #6B7280;">
          <li>Delete all your trades</li>
          <li>Delete all your journal entries</li>
          <li>Delete all your goals and habits</li>
          <li>Remove all your personal data</li>
        </ul>
        <p style="color: #DC2626; font-weight: bold;">This action cannot be undone.</p>
        <p>
          <a href="${confirmUrl}" 
             style="display: inline-block; padding: 12px 24px; background-color: #DC2626; 
                    color: white; text-decoration: none; border-radius: 6px;">
            Confirm Deletion
          </a>
        </p>
        <p style="color: #6B7280; font-size: 14px;">
          This link will expire in 1 hour. If you didn't request this, please ignore this email and secure your account.
        </p>
      </div>
    `;

    await this.sendEmail(email, 'Confirm Account Deletion - Tradeflix', html);
  }

  // ──────────────────────────────────────────────────────────────────
  // Notification Emails
  // ──────────────────────────────────────────────────────────────────

  async sendPasswordChangedNotification(email, name) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Password Changed</h2>
        <p>Hi ${name},</p>
        <p>Your password was successfully changed. All active sessions have been logged out for security.</p>
        <p style="color: #6B7280; font-size: 14px;">
          If you didn't make this change, please contact support immediately.
        </p>
      </div>
    `;

    await this.sendEmail(email, 'Password Changed - Tradeflix', html);
  }

  async sendEmailChangedNotification(oldEmail, newEmail, name) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Email Address Changed</h2>
        <p>Hi ${name},</p>
        <p>Your email address was successfully changed from <strong>${oldEmail}</strong> to <strong>${newEmail}</strong>.</p>
        <p style="color: #6B7280; font-size: 14px;">
          If you didn't make this change, please contact support immediately.
        </p>
      </div>
    `;

    await this.sendEmail(oldEmail, 'Email Address Changed - Tradeflix', html);
  }
}

export const emailService = new EmailService();