const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    const expectedUsername = process.env.ADMIN_USERNAME;
    const hash = process.env.ADMIN_PASSWORD_HASH;

    if (!hash) {
      console.error('ADMIN_PASSWORD_HASH is not set in .env');
      return res.status(500).json({ error: 'Admin login is not configured on the server' });
    }

    if (!password || typeof password !== 'string') {
      return res.status(400).json({ error: 'Password is required' });
    }

    if (expectedUsername && username !== expectedUsername) {
      // Still run a bcrypt compare against the real hash so a bad username
      // takes the same amount of time as a bad password (avoids leaking
      // which one was wrong via response timing / user enumeration).
      await bcrypt.compare(password, hash);
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const match = await bcrypt.compare(password, hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Regenerate the session on privilege change to prevent session fixation.
    req.session.regenerate((err) => {
      if (err) {
        console.error('Session regenerate failed:', err);
        return res.status(500).json({ error: 'Login failed' });
      }
      req.session.isAdmin = true;
      req.session.csrfToken = crypto.randomBytes(24).toString('hex');
      return res.json({ success: true, message: 'Logged in', csrfToken: req.session.csrfToken });
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Login failed' });
  }
});

// Used by the admin panel on page load to decide whether to show the
// dashboard or the login screen, and to fetch the CSRF token needed for
// any subsequent write requests.
router.get('/status', (req, res) => {
  const loggedIn = !!(req.session && req.session.isAdmin);
  res.json({ loggedIn, csrfToken: loggedIn ? req.session.csrfToken : undefined });
});

// Kept for backwards compatibility with anything still calling /check
router.get('/check', (req, res) => {
  res.json({ isAdmin: !!(req.session && req.session.isAdmin) });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('sid');
    res.json({ success: true });
  });
});

module.exports = router;
