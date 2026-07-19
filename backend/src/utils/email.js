/**
 * utils/email.js
 * ------------------------------------------------------------
 * Nodemailer transport wrapper. Sends verification and
 * password-reset emails using SMTP credentials from config.
 * Failures are logged but do not crash the request flow.
 */
import nodemailer from 'nodemailer';
import config from '../config/index.js';
import logger from './logger.js';

const transport = nodemailer.createTransport({
  host: config.email.host,
  port: config.email.port,
  secure: config.email.port === 465,
  auth: { user: config.email.user, pass: config.email.pass },
});

export const sendEmail = async ({ to, subject, html }) => {
  try {
    await transport.sendMail({
      from: config.email.from,
      to,
      subject,
      html,
    });
    logger.info(`Email sent to ${to}: ${subject}`);
  } catch (error) {
    logger.error(`Email failed to ${to}: ${error.message}`);
  }
};

const baseUrl = (path) => `${config.clientOrigin}${path}`;

export const sendVerificationEmail = (email, token) =>
  sendEmail({
    to: email,
    subject: 'Verify your email',
    html: `<p>Welcome! Verify your account by clicking the link below:</p>
           <a href="${baseUrl(`/verify-email?token=${token}`)}">Verify Email</a>
           <p>This link expires in 24 hours.</p>`,
  });

export const sendPasswordResetEmail = (email, token) =>
  sendEmail({
    to: email,
    subject: 'Reset your password',
    html: `<p>You requested a password reset. Click the link below:</p>
           <a href="${baseUrl(`/reset-password?token=${token}`)}">Reset Password</a>
           <p>This link expires in 1 hour. If you did not request this, ignore the email.</p>`,
  });

export default { sendEmail, sendVerificationEmail, sendPasswordResetEmail };
