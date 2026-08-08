const twilio = require('twilio');

function getClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || sid.includes('your-') || sid.includes('xxx')) return null;
  return twilio(sid, token);
}

async function sendWhatsApp(body) {
  const client = getClient();
  if (!client) {
    console.log('[WhatsApp skipped - not configured]:', body.substring(0, 100) + '...');
    return;
  }

  return client.messages.create({
    body: body.substring(0, 1600),
    from: process.env.TWILIO_WHATSAPP_FROM,
    to: process.env.OWNER_WHATSAPP_TO
  });
}

module.exports = { sendWhatsApp };
