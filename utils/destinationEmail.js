const SiteContent = require('../models/SiteContent');

// The email that contact/apply/hire form notifications get sent to.
// Priority: the "Email" field on the admin panel's Content > Contact tab
// (stored in MongoDB SiteContent -> contact.email), falling back to EMAIL_TO
// in .env if that field is empty.
async function getDestinationEmail() {
  try {
    const doc = await SiteContent.findById('site-content').lean();
    const adminSetEmail = doc && doc.contact && doc.contact.email && doc.contact.email.trim();
    return adminSetEmail || process.env.EMAIL_TO || null;
  } catch (err) {
    return process.env.EMAIL_TO || null;
  }
}

module.exports = { getDestinationEmail };

