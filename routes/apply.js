const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { sendEmail } = require('../utils/email');
const { sendWhatsApp } = require('../utils/whatsapp');
const { getDestinationEmail } = require('../utils/destinationEmail');
const { escapeHtml } = require('../utils/escapeHtml');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'resumes');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Cross-check both the extension AND the declared mimetype so a file can't
// slip through by lying about one of them (e.g. an .html file renamed to
// .pdf, or a .pdf sent with an unexpected mimetype).
const ALLOWED_RESUME_TYPES = {
  '.pdf': ['application/pdf'],
  '.doc': ['application/msword'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document']
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const randomSuffix = crypto.randomBytes(6).toString('hex');
    cb(null, `resume-${Date.now()}-${randomSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedMimes = ALLOWED_RESUME_TYPES[ext];
    if (!allowedMimes || !allowedMimes.includes(file.mimetype)) {
      return cb(new Error('Only PDF or Word documents are allowed for the resume.'));
    }
    cb(null, true);
  }
});

router.post('/', (req, res) => {
  upload.single('resume')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });

    const { name, email, phone, position, experience, message } = req.body || {};

    if (!name || !email || !position) {
      return res.status(400).json({ error: 'Name, email, and position are required.' });
    }
    if (!EMAIL_RE.test(String(email).trim())) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }
    if (String(name).length > 200 || String(position).length > 200 || String(message || '').length > 5000) {
      return res.status(400).json({ error: 'One of the fields is too long.' });
    }

    const to = getDestinationEmail();
    if (!to) {
      console.error('Apply form: no destination email configured (set Contact email in admin panel or EMAIL_TO in .env)');
      return res.status(500).json({ error: 'This form is not fully configured yet. Please try contacting us another way.' });
    }

    const html = `
      <h3>New Job Application</h3>
      <p><strong>Name:</strong> ${escapeHtml(name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(email)}</p>
      <p><strong>Phone:</strong> ${escapeHtml(phone || '-')}</p>
      <p><strong>Position:</strong> ${escapeHtml(position)}</p>
      <p><strong>Experience:</strong> ${escapeHtml(experience || '-')}</p>
      <p><strong>Message:</strong><br>${escapeHtml(message || '-').replace(/\n/g, '<br>')}</p>
      ${req.file ? `<p><strong>Resume:</strong> attached (${escapeHtml(req.file.originalname)})</p>` : '<p><strong>Resume:</strong> not attached</p>'}
    `;

    const attachments = [];
    if (req.file) {
      attachments.push({ filename: req.file.originalname, path: req.file.path });
    }

    try {
      await sendEmail({
        to,
        subject: `New Job Application: ${position} — ${name}`,
        text: `Name: ${name}\nEmail: ${email}\nPhone: ${phone || '-'}\nPosition: ${position}\nExperience: ${experience || '-'}\n\n${message || ''}`,
        html,
        attachments
      });
      sendWhatsApp(`New job application: ${name} applied for ${position} (${phone || 'no phone'})`).catch(() => {});
      res.json({ success: true, message: 'Application received' });
    } catch (err2) {
      console.error('Apply email failed:', err2.message);
      res.status(500).json({ error: 'Failed to submit your application. Please try again later.' });
    }
  });
});

module.exports = router;
