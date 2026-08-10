const express = require('express');
const router = express.Router();
const { sendEmail } = require('../utils/email');
const { sendWhatsApp } = require('../utils/whatsapp');
const { getDestinationEmail } = require('../utils/destinationEmail');
const { escapeHtml } = require('../utils/escapeHtml');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+]?[\d\s\-().]{7,20}$/;

router.post('/', async (req, res) => {
  const {
    companyName, contactName, email, phone, positions, requirements,
    // Extended fields
    companyWebsite, industry, jobTitle, employmentType, workMode,
    experienceRequired, requiredSkills, salaryRange, hiringTimeline,
    jobDescription, additionalInfo
  } = req.body || {};

  // Required field validation
  if (!companyName || !contactName || !email) {
    return res.status(400).json({ error: 'Company name, contact name, and email are required.' });
  }
  if (!EMAIL_RE.test(String(email).trim())) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }
  if (phone && !PHONE_RE.test(String(phone).trim())) {
    return res.status(400).json({ error: 'Please enter a valid phone number.' });
  }
  if (!jobTitle) {
    return res.status(400).json({ error: 'Position / Job Title is required.' });
  }
  if (!positions) {
    return res.status(400).json({ error: 'Number of positions is required.' });
  }
  if (!jobDescription && !requirements) {
    return res.status(400).json({ error: 'Job description / requirements is required.' });
  }

  // Length limits
  const maxShort = 200;
  const maxMedium = 500;
  const maxLong = 5000;
  if (String(companyName).length > maxShort || String(contactName).length > maxShort ||
      String(jobTitle || '').length > maxShort || String(companyWebsite || '').length > maxMedium ||
      String(industry || '').length > maxShort || String(requiredSkills || '').length > maxMedium ||
      String(salaryRange || '').length > maxShort || String(hiringTimeline || '').length > maxShort ||
      String(experienceRequired || '').length > maxShort ||
      String(requirements || '').length > maxLong || String(jobDescription || '').length > maxLong ||
      String(additionalInfo || '').length > maxLong) {
    return res.status(400).json({ error: 'One of the fields is too long.' });
  }

  const to = await getDestinationEmail();
  if (!to) {
    console.error('Hire form: no destination email configured (set Contact email in admin panel or EMAIL_TO in .env)');
    return res.status(500).json({ error: 'This form is not fully configured yet. Please try contacting us another way.' });
  }

  // Build a professional email with all submitted fields
  const row = (label, value) => value ? `<tr><td style="padding:8px 12px;font-weight:600;color:#333;white-space:nowrap;vertical-align:top;border-bottom:1px solid #eee;">${label}</td><td style="padding:8px 12px;color:#555;border-bottom:1px solid #eee;">${escapeHtml(value)}</td></tr>` : '';
  const multiRow = (label, value) => value ? `<tr><td style="padding:8px 12px;font-weight:600;color:#333;white-space:nowrap;vertical-align:top;border-bottom:1px solid #eee;">${label}</td><td style="padding:8px 12px;color:#555;border-bottom:1px solid #eee;">${escapeHtml(value).replace(/\n/g, '<br>')}</td></tr>` : '';

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      <h2 style="color:#1e3a8a;border-bottom:2px solid #1e3a8a;padding-bottom:10px;">New Hiring Request</h2>

      <h3 style="color:#374151;margin:20px 0 10px;">Company Information</h3>
      <table style="width:100%;border-collapse:collapse;">
        ${row('Company', companyName)}
        ${row('Contact Person', contactName)}
        ${row('Email', email)}
        ${row('Phone', phone || '-')}
        ${row('Website', companyWebsite)}
        ${row('Industry', industry)}
      </table>

      <h3 style="color:#374151;margin:20px 0 10px;">Hiring Requirements</h3>
      <table style="width:100%;border-collapse:collapse;">
        ${row('Position / Job Title', jobTitle)}
        ${row('No. of Positions', positions || '-')}
        ${row('Employment Type', employmentType)}
        ${row('Work Mode', workMode)}
        ${row('Experience Required', experienceRequired)}
        ${row('Required Skills', requiredSkills)}
        ${row('Salary / Budget', salaryRange)}
        ${row('Hiring Timeline', hiringTimeline)}
      </table>

      <h3 style="color:#374151;margin:20px 0 10px;">Job Description</h3>
      <table style="width:100%;border-collapse:collapse;">
        ${multiRow('Description / Requirements', jobDescription || requirements)}
        ${multiRow('Additional Information', additionalInfo)}
      </table>

      <p style="margin-top:20px;color:#9ca3af;font-size:12px;">Submitted via Aaideology Hire Talent form</p>
    </div>
  `;

  const textParts = [
    `Company: ${companyName}`, `Contact: ${contactName}`, `Email: ${email}`,
    `Phone: ${phone || '-'}`, companyWebsite ? `Website: ${companyWebsite}` : '',
    industry ? `Industry: ${industry}` : '',
    `Position: ${jobTitle || '-'}`, `Positions: ${positions || '-'}`,
    employmentType ? `Type: ${employmentType}` : '',
    workMode ? `Work Mode: ${workMode}` : '',
    experienceRequired ? `Experience: ${experienceRequired}` : '',
    requiredSkills ? `Skills: ${requiredSkills}` : '',
    salaryRange ? `Salary/Budget: ${salaryRange}` : '',
    hiringTimeline ? `Timeline: ${hiringTimeline}` : '',
    '', jobDescription || requirements || '', additionalInfo ? `\nAdditional: ${additionalInfo}` : ''
  ].filter(Boolean).join('\n');

  try {
    await sendEmail({
      to,
      subject: `New Hiring Request from ${companyName} — ${jobTitle || 'Multiple Positions'}`,
      text: textParts,
      html
    });
    sendWhatsApp(`New hiring request from ${companyName} (${contactName}, ${phone || 'no phone'}) for ${jobTitle || 'multiple positions'}`).catch(() => {});
    res.json({ success: true, message: 'Hiring request received' });
  } catch (err) {
    console.error('Hire email failed:', err.message);
    res.status(500).json({ error: 'Failed to submit your request. Please try again later.' });
  }
});

module.exports = router;

