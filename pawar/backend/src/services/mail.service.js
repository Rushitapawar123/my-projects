const nodemailer = require('nodemailer');
const env = require('../config/env');

let transporter;
const getTransporter = () => {
  if (!env.SMTP_HOST) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    });
  }
  return transporter;
};

const sendMail = async ({ to, subject, text, html }) => {
  const t = getTransporter();
  if (!t) {
    if (env.isProd) {
      console.error('SMTP is not configured, email was not sent');
      return;
    }
    // Development without SMTP: print the email in the server console
    console.log(`\n[mail:dev] To: ${to}\n[mail:dev] Subject: ${subject}\n[mail:dev] ${text}\n`);
    return;
  }
  await t.sendMail({ from: env.MAIL_FROM, to, subject, text, html });
};

const sendPasswordResetEmail = (to, link) =>
  sendMail({
    to,
    subject: 'Reset your Pawar password',
    text: `We received a request to reset your Pawar password.\n\nReset it here (valid for 1 hour):\n${link}\n\nIf you did not request this, you can ignore this email.`,
    html: `<p>We received a request to reset your Pawar password.</p><p><a href="${link}">Reset password</a> (valid for 1 hour)</p><p>If you did not request this, you can ignore this email.</p>`,
  });

module.exports = { sendMail, sendPasswordResetEmail };
