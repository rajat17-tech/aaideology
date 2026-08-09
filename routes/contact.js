const express = require('express');
const router = express.Router();
const { sendEmail } = require('../utils/email');
const { sendWhatsApp } = require('../utils/whatsapp');
const { getDestinationEmail } = require('../utils/destinationEmail');
const { escapeHtml } = require('../utils/escapeHtml');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_LEN = 5000;

router.post('/', async (req, res) => {
  const { name, email, phone, subject, message } = req.body || {};

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Name, email, and message are required.' });
  }
  if (!EMAIL_RE.test(String(email).trim())) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }
  if (String(name).length > 200 || String(message).length > MAX_LEN || String(subject || '').length > 300) {
    return res.status(400).json({ error: 'One of the fields is too long.' });
  }

  const to = await getDestinationEmail();
  if (!to) {
    console.error('Contact form: no destination email configured (set Contact email in admin panel or EMAIL_TO in .env)');
    return res.status(500).json({ error: 'This form is not fully configured yet. Please try contacting us another way.' });
  }

  const html = `
    <h3>New Contact Form Submission</h3>
    <p><strong>Name:</strong> ${escapeHtml(name)}</p>
    <p><strong>Email:</strong> ${escapeHtml(email)}</p>
    <p><strong>Phone:</strong> ${escapeHtml(phone || '-')}</p>
    <p><strong>Subject:</strong> ${escapeHtml(subject || '-')}</p>
    <p><strong>Message:</strong><br>${escapeHtml(message).replace(/\n/g, '<br>')}</p>
  `;

  try {
    await sendEmail({
      to,
      subject: `New Contact Message: ${subject || 'Website Enquiry'}`,
      text: `Name: ${name}\nEmail: ${email}\nPhone: ${phone || '-'}\nSubject: ${subject || '-'}\n\n${message}`,
      html
    });
    sendWhatsApp(`New contact message from ${name} (${email}):\n${message}`).catch(() => {});
    res.json({ success: true, message: 'Message sent' });
  } catch (err) {
    console.error('Contact email failed:', err.message);
    res.status(500).json({ error: 'Failed to send your message. Please try again later.' });
  }
});

module.exports = router;
