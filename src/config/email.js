import nodemailer from 'nodemailer';
import logger from './logger.js';

const transporter = nodemailer.createTransport({
  service: "gmail", // Gmail service
      host: "smtp.gmail.com",
      port: 587,
      secure: false, // true for port 465, false for port 587
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