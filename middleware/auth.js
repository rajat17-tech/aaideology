const crypto = require('crypto');

// Constant-time string comparison to avoid leaking token contents via
// response-timing side channels.
function safeEqual(a, b) {
  const bufA = Buffer.from(String(a || ''));
  const bufB = Buffer.from(String(b || ''));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// Requires a logged-in admin session for every request, and — for any
// state-changing method — also requires a matching CSRF token in the
// X-CSRF-Token header (double-submit cookie/session pattern). The token is
// generated per-session in server.js and handed to the client via
// GET /api/auth/status, so a third-party site cannot forge it even though
// the browser will still send the session cookie along with a forged request.
function requireAdmin(req, res, next) {
  if (!(req.session && req.session.isAdmin)) {
    return res.status(401).json({ error: 'Not authenticated. Please log in to the admin panel.' });
  }

  const isStateChanging = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
  if (isStateChanging) {
    const headerToken = req.get('X-CSRF-Token');
    if (!headerToken || !req.session.csrfToken || !safeEqual(headerToken, req.session.csrfToken)) {
      return res.status(403).json({ error: 'Invalid or missing CSRF token. Please refresh the admin panel and try again.' });
    }
  }

  return next();
}

module.exports = { requireAdmin };
