import nodemailer from 'nodemailer';
import logger from './logger.js';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_PORT == 465, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Verify connection configuration
transporter
  .verify()
  .then(() => logger.info('Email transporter is ready to send emails.'))
  .catch((err) =>
    logger.warn('Email transporter verification failed. Check SMTP config.', err)
  );

export default transporter;