const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const crypto = require('crypto');
const { requireAdmin } = require('../middleware/auth');
const { readJson, writeJson } = require('../utils/jsonStore');

const POSTERS_FILE = 'data/posters.json';
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'posters');

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const getPosters = () => {
  try {
    return readJson(POSTERS_FILE);
  } catch (err) {
    return [];
  }
};
const savePosters = (posters) => writeJson(POSTERS_FILE, posters);

// Only allow a fixed whitelist of raster image types. SVG is deliberately
// excluded even though it's technically an "image" — SVG files can contain
// <script> and are rendered by the browser when opened directly, which
// turns "upload an image" into a stored-XSS vector via /uploads/posters/*.
const ALLOWED_IMAGE_TYPES = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp']
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    // Ignore the client-supplied extension for the filename we actually
    // write to disk — derive it from the validated mimetype instead, so a
    // renamed malicious file (e.g. "photo.jpg" that is really a .html/.svg)
    // can't smuggle an executable extension onto disk.
    const ext = ALLOWED_IMAGE_TYPES[file.mimetype][0];
    const randomSuffix = crypto.randomBytes(6).toString('hex');
    cb(null, `poster-${Date.now()}-${randomSuffix}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_IMAGE_TYPES[file.mimetype]) {
      return cb(new Error('Only JPG, PNG, GIF, or WEBP images are allowed'));
    }
    cb(null, true);
  }
});

// GET all posters — public
router.get('/', (req, res) => {
  res.json(getPosters());
});

// UPLOAD a new poster/update — admin only
router.post('/', requireAdmin, (req, res) => {
  upload.single('poster')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No image file provided' });

    const posters = getPosters();
    const poster = {
      id: Date.now(),
      url: `/uploads/posters/${req.file.filename}`,
      originalName: req.file.originalname,
      caption: req.body.caption || '',
      createdAt: new Date().toISOString()
    };
    posters.unshift(poster); // newest first
    savePosters(posters);
    res.status(201).json(poster);
  });
});

// DELETE a poster — admin only
router.delete('/:id', requireAdmin, (req, res) => {
  const posters = getPosters();
  const poster = posters.find(p => String(p.id) === String(req.params.id));
  if (!poster) return res.status(404).json({ error: 'Poster not found' });

  const next = posters.filter(p => String(p.id) !== String(req.params.id));
  savePosters(next);

  // Best-effort remove the file from disk too. Resolve + verify the path
  // stays inside UPLOAD_DIR before deleting anything (defense in depth
  // against a tampered posters.json ever containing a path like
  // "/uploads/posters/../../server.js").
  const resolved = path.resolve(__dirname, '..', poster.url.replace(/^\//, ''));
  if (resolved.startsWith(UPLOAD_DIR + path.sep)) {
    fs.unlink(resolved, () => {});
  }

  res.json({ message: 'Deleted' });
});

module.exports = router;
