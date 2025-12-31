// config/email.js  →  Now using Resend instead of Nodemailer
import { Resend } from 'resend';
import logger from './logger.js';

// Only one env var needed now!
const resend = new Resend(process.env.RESEND_API_KEY);

// Verify connection on startup (same as your old .verify())
resend.emails
  .send({
    from: 'Tradeflix Dev <onboarding@resend.dev>',
    to: 'delivered@resend.dev',   // fake address just to test connection
    subject: 'Resend connection test',
    text: 'If you see this in logs, Resend is ready!',
  })
  .then(() => {
    logger.info('Email transporter (Resend) is ready to send emails.');
  })
  .catch((err) => {
    logger.error('Resend connection failed. Check RESEND_API_KEY', err);
  });

// This is your new "transporter" – same shape, different engine
const transporter = {
  sendMail: async (mailOptions) => {
    try {
      const { error, data } = await resend.emails.send({
        from: mailOptions.from || 'Tradeflix <onboarding@resend.dev>',  // fallback
        to: Array.isArray(mailOptions.to) ? mailOptions.to : [mailOptions.to],
        subject: mailOptions.subject,
        html: mailOptions.html,
        text: mailOptions.text || mailOptions.html.replace(/<[^>]*>/g, ''), // auto plain-text fallback
      });

      if (error) throw error;

      return { messageId: data.id }; // mimics Nodemailer response
    } catch (err) {
      throw err; // let your existing catch handle it
    }
  },
};

export default transporter;