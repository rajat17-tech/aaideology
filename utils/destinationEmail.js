const fs = require('fs');
const path = require('path');

const contentFile = path.join(__dirname, '..', 'data', 'content.json');

// The email that contact/apply/hire form notifications get sent to.
// Priority: the "Email" field on the admin panel's Content > Contact tab
// (data/content.json -> contact.email), falling back to EMAIL_TO in .env
// if that field is empty. This is the "email I've selected" from the
// admin panel that client/candidate messages should land in.
function getDestinationEmail() {
  try {
    const data = JSON.parse(fs.readFileSync(contentFile, 'utf8'));
    const adminSetEmail = data.contact && data.contact.email && data.contact.email.trim();
    return adminSetEmail || process.env.EMAIL_TO || null;
  } catch (err) {
    return process.env.EMAIL_TO || null;
  }
}

module.exports = { getDestinationEmail };
