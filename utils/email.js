const nodemailer = require('nodemailer');

function getTransporter() {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_APP_PASSWORD;
  if (!user || !pass || user.includes('your-') || pass.includes('your-')) return null;
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass }
  });
}

async function sendEmail({ to, subject, text, html, attachments = [] }) {
  const transporter = getTransporter();
  const recipient = to || process.env.EMAIL_TO;

  if (!transporter) {
    console.log(`[Email SKIPPED - EMAIL_USER/EMAIL_APP_PASSWORD not configured in .env] Would have sent "${subject}" to ${recipient}`);
    return { skipped: true };
  }
  if (!recipient) {
    throw new Error('No recipient email configured (set a Contact email in the admin panel or EMAIL_TO in .env)');
  }

  const mailOptions = {
    from: `"Aaideology" <${process.env.EMAIL_USER}>`,
    to: recipient,
    subject,
    text,
    html,
    attachments
  };

  return transporter.sendMail(mailOptions);
}

module.exports = { sendEmail };
