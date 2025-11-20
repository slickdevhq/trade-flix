import nodemailer from 'nodemailer';
import logger from './logger.js';

const transporter = nodemailer.createTransport({
   service: 'Gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});


// Verify connection configuration
transporter
  .verify()
  .then(() => logger.info('Email transporter is ready to send emails.'))
  .catch((err) =>
    logger.warn('Email transporter verification failed. Check SMTP config.', err)
  );

export default transporter;