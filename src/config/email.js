// config/email.js
import nodemailer from 'nodemailer';
import logger from './logger.js';

// These will come from your Render Env Variables
const transporter = nodemailer.createTransport({
  host: "sandbox.smtp.mailtrap.io",
  port: 2525,
  auth: {
    user: process.env.MAILTRAP_USER, 
    pass: process.env.MAILTRAP_PASS  
  }
});

// Verify connection
transporter.verify((error, success) => {
  if (error) {
    logger.error('Mailtrap connection failed. Check your credentials.', error);
  } else {
    logger.info('Email transporter (Mailtrap) is ready to catch emails!');
  }
});

export default transporter;