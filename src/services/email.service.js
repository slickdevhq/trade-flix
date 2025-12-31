import transporter from '../config/email.js';
import logger from '../config/logger.js';

console.log(process.env.EMAIL_FROM)
const sendEmail = async (to, subject, html) => {
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to,
    subject,
    html,
  };

  try {
    await transporter.sendMail(mailOptions);
    logger.info(`Email sent to ${to} with subject "${subject}"`);
  } catch (err) {
    console.error('The email disturbing error 🔥', err)
    logger.error(`Error sending email to ${to}:`, err.message);
    // Do not throw here, just log. Email failure shouldn't crash the app.
  }
};

export const emailService = {
  /**
   * Sends a verification email to a new user.
   */
  sendVerificationEmail: async (to, name, token) => {
    const subject = 'Welcome to Tradeflix! Please Verify Your Email';
    const verificationUrl = `${process.env.CLIENT_URL}/email-verification?token=${token}`;
    const html = `
      <h1>Welcome, ${name}!</h1>
      <p>Thanks for signing up for Tradeflix. Please verify your email address by clicking the link below:</p>
      <a href="${verificationUrl}" style="padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Verify Email</a>
      <p>This link will expire in 1 day.</p>
      <p>If you did not sign up for this account, you can ignore this email.</p>
    `;
    await sendEmail(to, subject, html);
  },

  /**
   * Test run an email.
   */
  sendTestEmail: async (to, name) => {
    const subject = 'Testing email';
    const html = `
      <h1>Welcome, ${name}!</h1>
      <p>Thanks for signing up for Tradeflix. Please verify your email address by clicking the link below:</p>
      <a href="" style="padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Verify Email</a>
      <p>This link will expire in 1 day.</p>
      <p>If you did not sign up for this account, you can ignore this email.</p>
    `;
    await sendEmail(to, subject, html);
  },

  /**
   * Sends a password reset email.
   */
  sendPasswordResetEmail: async (to, name, token) => {
    const subject = 'Tradeflix Password Reset Request';
    const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${token}`;
    const html = `
      <h1>Hi, ${name}</h1>
      <p>Someone (hopefully you) requested a password reset for your Tradeflix account.</p>
      <p>Click the link below to reset your password:</p>
      <a href="${resetUrl}" style="padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Reset Password</a>
      <p>This link will expire in 1 hour.</p>
      <p>If you did not request this, please ignore this email.</p>
    `;
    await sendEmail(to, subject, html);
  },
};