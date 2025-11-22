import nodemailer from 'nodemailer';
import logger from './logger.js';

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST, // Will use smtp.gmail.com
  port: Number(process.env.EMAIL_PORT), // Will use 587
  secure: process.env.EMAIL_SECURE === 'true', // Will be false for port 587
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Verify connection configuration
transporter
  .verify()
  .then(() => logger.info('✅ Email transporter is ready to send emails.'))
  .catch((err) =>
    logger.error('❌ Email transporter verification failed. Check SMTP config.', err)
  );

export default transporter;