const express = require('express');
const router = express.Router();
const { sendEmail } = require('../utils/email');
const { sendWhatsApp } = require('../utils/whatsapp');
const { getDestinationEmail } = require('../utils/destinationEmail');
const { escapeHtml } = require('../utils/escapeHtml');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/', async (req, res) => {
  const { companyName, contactName, email, phone, positions, requirements } = req.body || {};

  if (!companyName || !contactName || !email) {
    return res.status(400).json({ error: 'Company name, contact name, and email are required.' });
  }
  if (!EMAIL_RE.test(String(email).trim())) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }
  if (String(companyName).length > 200 || String(contactName).length > 200 || String(requirements || '').length > 5000) {
    return res.status(400).json({ error: 'One of the fields is too long.' });
  }

  const to = await getDestinationEmail();
  if (!to) {
    console.error('Hire form: no destination email configured (set Contact email in admin panel or EMAIL_TO in .env)');
    return res.status(500).json({ error: 'This form is not fully configured yet. Please try contacting us another way.' });
  }

  const html = `
    <h3>New Hiring Request</h3>
    <p><strong>Company:</strong> ${escapeHtml(companyName)}</p>
    <p><strong>Contact Person:</strong> ${escapeHtml(contactName)}</p>
    <p><strong>Email:</strong> ${escapeHtml(email)}</p>
    <p><strong>Phone:</strong> ${escapeHtml(phone || '-')}</p>
    <p><strong>Number of Positions:</strong> ${escapeHtml(positions || '-')}</p>
    <p><strong>Requirements:</strong><br>${escapeHtml(requirements || '').replace(/\n/g, '<br>')}</p>
  `;

  try {
    await sendEmail({
      to,
      subject: `New Hiring Request from ${companyName}`,
      text: `Company: ${companyName}\nContact: ${contactName}\nEmail: ${email}\nPhone: ${phone || '-'}\nPositions: ${positions || '-'}\n\n${requirements || ''}`,
      html
    });
    sendWhatsApp(`New hiring request from ${companyName} (${contactName}, ${phone || 'no phone'})`).catch(() => {});
    res.json({ success: true, message: 'Hiring request received' });
  } catch (err) {
    console.error('Hire email failed:', err.message);
    res.status(500).json({ error: 'Failed to submit your request. Please try again later.' });
  }
});

module.exports = router;
