import nodemailer from 'nodemailer';

let transporter;

const getTransporter = () => nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true' || Number(process.env.SMTP_PORT) === 465,
  requireTLS: true,
  pool: true,
  family: 4,
  tls: {
    rejectUnauthorized: false,
    minVersion: 'TLSv1.2',
  },
  maxConnections: 2,
  maxMessages: 100,
  connectionTimeout: 15000,
  greetingTimeout: 15000,
  socketTimeout: 30000,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

const getReusableTransporter = () => {
  if (!transporter) {
    transporter = getTransporter();
  }

  return transporter;
};

export const verifySmtpConnection = async () => {
  if (!isSmtpConfigured()) {
    console.warn('SMTP is not configured. Add SMTP settings to backend/.env.');
    return false;
  }

  try {
    await getReusableTransporter().verify();
    console.log('SMTP connected successfully');
    return true;
  } catch (error) {
    console.error(`SMTP connection failed: ${error.message}`);
    return false;
  }
};

export const isSmtpConfigured = () => Boolean(
  process.env.SMTP_HOST
  && process.env.SMTP_USER
  && process.env.SMTP_PASSWORD
  && process.env.SMTP_FROM
);

export const sendEmail = async ({ to, subject, text, html, headers, attachments, replyTo }) => {
  if (!isSmtpConfigured()) {
    throw new Error('SMTP is not configured');
  }

  return getReusableTransporter().sendMail({
    from: process.env.SMTP_FROM,
    to,
    replyTo,
    subject,
    text,
    html,
    headers,
    attachments,
  });
};
