const express = require('express');
const session = require('express-session');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

dotenv.config();

// Fail fast if critical secrets are missing/insecure so the app never
// silently runs with a guessable session secret in production.
if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.includes('change-this')) {
  if (process.env.NODE_ENV === 'production') {
    console.error('FATAL: SESSION_SECRET is not set (or still the placeholder) in .env. Refusing to start in production.');
    process.exit(1);
  } else {
    console.warn('⚠️  SESSION_SECRET is missing/placeholder. Using a random in-memory secret for this run only — sessions will not survive a restart. Set SESSION_SECRET in .env.');
  }
}
const SESSION_SECRET = (process.env.SESSION_SECRET && !process.env.SESSION_SECRET.includes('change-this'))
  ? process.env.SESSION_SECRET
  : crypto.randomBytes(32).toString('hex');

const app = express();
const isProduction = process.env.NODE_ENV === 'production';

// Trust the first proxy hop (needed for secure cookies + correct client IPs
// when deployed behind a reverse proxy / load balancer, e.g. Render, Heroku, Nginx).
app.set('trust proxy', 1);

// ==================== SECURITY HEADERS ====================
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      // Inline styles/scripts are used throughout the existing admin panel
      // and site; tightening further would require a larger rewrite of the
      // front end. CDN font-awesome + Google Fonts are explicitly allow-listed.
      scriptSrc: ["'self'", "'unsafe-inline'"],
      // Helmet defaults script-src-attr to 'none' unless this is set explicitly,
      // which silently blocks every onclick="..." handler in the site and the
      // admin panel (buttons render fine, but clicking them does nothing).
      // The whole front end relies on inline onclick handlers, so this must
      // stay in sync with scriptSrc above.
      scriptSrcAttr: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://cdnjs.cloudflare.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https://cdnjs.cloudflare.com'],
      // 'https:' allows the About-section fallback image (and any external
      // image URL an admin pastes in) to load; local/uploaded images still
      // load fine under 'self'.
      imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'self'"],
      upgradeInsecureRequests: isProduction ? [] : null
    }
  },
  crossOriginEmbedderPolicy: false
}));

// ==================== RATE LIMITING ====================
// Slows down brute-force login attempts against the admin panel.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' }
});

// Generic limiter for public form endpoints, to slow down spam/abuse of the
// outgoing email + WhatsApp notifications.
const formLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many submissions from this device. Please try again later.' }
});

// ==================== SESSION ====================
app.use(session({
  name: 'sid',
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: isProduction, // requires HTTPS in production (set NODE_ENV=production behind a TLS-terminating proxy)
    sameSite: 'lax',      // blocks cross-site form/fetch requests from carrying this cookie (primary CSRF defense)
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// Issue a per-session CSRF token (double-submit style). The admin panel
// reads this from /api/auth/status and sends it back as the X-CSRF-Token
// header on every state-changing request; requireAdmin verifies it.
app.use((req, res, next) => {
  if (req.session && !req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(24).toString('hex');
  }
  next();
});

// Body parsing (50mb was excessive for a JSON/text API and makes it easier
// to DoS the server with huge payloads; file uploads go through multer with
// their own explicit limits instead).
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Static files
app.use(express.static(path.join(__dirname, 'public')));
// Uploaded files are user/admin-supplied. Serve them without executing
// scripts in-browser: force download-only content-type sniffing off and
// disable directory listing (express.static already disables listing).
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  setHeaders: (res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
  }
}));

// Ensure data files exist
const ensureDataFile = (filename, defaultData) => {
  const filepath = path.join(__dirname, 'data', filename);
  if (!fs.existsSync(filepath)) {
    fs.writeFileSync(filepath, JSON.stringify(defaultData, null, 2));
  }
};

ensureDataFile('sections.json', { sections: [] });
ensureDataFile('navbar.json', { items: [
  { id: 'home', label: 'Home', href: '#home', order: 0 },
  { id: 'about', label: 'About', href: '#about', order: 1 },
  { id: 'services', label: 'Services', href: '#services', order: 2 },
  { id: 'jobs', label: 'Jobs', href: '#jobs', order: 3 },
  { id: 'contact', label: 'Contact', href: '#contact', order: 4 }
]});
ensureDataFile('jobs.json', []);
ensureDataFile('posters.json', []);
ensureDataFile('heroImage.json', { url: null });
ensureDataFile('reviews.json', []);

// Apply rate limiting to sensitive endpoints before mounting routers
app.use('/api/auth/login', loginLimiter);
app.use('/api/apply', formLimiter);
app.use('/api/hire', formLimiter);
app.use('/api/contact', formLimiter);
// Only the public "candidate submits a review" POST needs throttling;
// GET (public listing) and the /admin, PUT, DELETE routes are already
// gated by requireAdmin below and shouldn't be rate-limited alongside it.
app.use('/api/reviews', (req, res, next) => {
  if (req.method === 'POST' && req.path === '/') return formLimiter(req, res, next);
  next();
});

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/content', require('./routes/content'));
app.use('/api/jobs', require('./routes/jobs'));
app.use('/api/posters', require('./routes/posters'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/hero-image', require('./routes/heroImage'));
app.use('/api/apply', require('./routes/apply'));
app.use('/api/hire', require('./routes/hire'));
app.use('/api/contact', require('./routes/contact'));
app.use('/api/sections', require('./routes/sections'));
app.use('/api/navbar', require('./routes/navbar'));

// Admin panel route
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html'));
});

// 404 handler for unknown API routes
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Generic error handler — never leak stack traces, file paths, or other
// internals to the client. Full details still go to the server console/log.
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({ error: 'Something went wrong. Please try again later.' });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('========================================');
  console.log(`🌐 Main Site:  http://localhost:${PORT}`);
  console.log(`🔐 Admin Panel: http://localhost:${PORT}/admin`);
  console.log(isProduction ? '🔒 Running in production mode' : '⚠️  Running in development mode (set NODE_ENV=production when deploying)');
  console.log('========================================');
});
