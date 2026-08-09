const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const crypto = require('crypto');
const { requireAdmin } = require('../middleware/auth');
const Poster = require('../models/Poster');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'posters');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

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
router.get('/', async (req, res) => {
  try {
    const posters = await Poster.find().sort({ createdAt: -1 });
    res.json(posters);
  } catch (err) {
    console.error('Posters route error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// UPLOAD a new poster/update — admin only
router.post('/', requireAdmin, (req, res) => {
  upload.single('poster')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No image file provided' });

    try {
      const poster = await Poster.create({
        url: `/uploads/posters/${req.file.filename}`,
        originalName: req.file.originalname,
        caption: req.body.caption || ''
      });
      res.status(201).json(poster);
    } catch (dbErr) {
      console.error('Posters route error:', dbErr);
      res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
  });
});

// DELETE a poster — admin only
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const poster = await Poster.findById(req.params.id);
    if (!poster) return res.status(404).json({ error: 'Poster not found' });

    await Poster.deleteOne({ _id: poster._id });

    // Best-effort remove the file from disk too. Resolve + verify the path
    // stays inside UPLOAD_DIR before deleting anything (defense in depth
    // against a tampered DB entry ever containing a path like
    // "/uploads/posters/../../server.js").
    if (poster.url) {
      const resolved = path.resolve(__dirname, '..', poster.url.replace(/^\//, ''));
      if (resolved.startsWith(UPLOAD_DIR + path.sep)) {
        fs.unlink(resolved, () => {});
      }
    }

    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('Posters route error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

module.exports = router;
