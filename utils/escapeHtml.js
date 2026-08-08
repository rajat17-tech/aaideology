// Used when building HTML email bodies from public form submissions
// (contact/apply/hire). Without this, a visitor could submit a name or
// message containing HTML/script that gets embedded in the notification
// email sent to the site owner (HTML injection in outbound mail).
function escapeHtml(value) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

module.exports = { escapeHtml };
