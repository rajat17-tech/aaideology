const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { requireAdmin } = require('../middleware/auth');
const { readJson, writeJson } = require('../utils/jsonStore');

// NOTE: this route was previously a stub (`GET / -> { url: '' }` with no
// POST/DELETE at all), so uploading a hero background image from the admin
// panel silently did nothing. It's now implemented the same way
// routes/posters.js handles image uploads.

const HERO_FILE = 'data/heroImage.json';
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'hero');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_IMAGE_TYPES = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp']
};

const getHero = () => {
  try {
    return readJson(HERO_FILE);
  } catch (err) {
    return { url: null };
  }
};
const saveHero = (hero) => writeJson(HERO_FILE, hero);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = ALLOWED_IMAGE_TYPES[file.mimetype][0];
    const randomSuffix = crypto.randomBytes(6).toString('hex');
    cb(null, `hero-${Date.now()}-${randomSuffix}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_IMAGE_TYPES[file.mimetype]) {
      return cb(new Error('Only JPG, PNG, GIF, or WEBP images are allowed'));
    }
    cb(null, true);
  }
});

// GET current hero background image — public (the homepage needs this)
router.get('/', (req, res) => {
  const hero = getHero();
  res.json({ exists: !!hero.url, url: hero.url || '' });
});

// UPLOAD/replace the hero background image — admin only
router.post('/', requireAdmin, (req, res) => {
  upload.single('heroImage')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No image file provided' });

    // Remove the previous hero image file (if any) before saving the new one
    const previous = getHero();
    if (previous.url) {
      const prevPath = path.resolve(UPLOAD_DIR, path.basename(previous.url));
      if (prevPath.startsWith(UPLOAD_DIR + path.sep)) fs.unlink(prevPath, () => {});
    }

    const url = `/uploads/hero/${req.file.filename}`;
    saveHero({ url });
    res.status(201).json({ url });
  });
});

// REMOVE the hero background image — admin only
router.delete('/', requireAdmin, (req, res) => {
  const hero = getHero();
  if (hero.url) {
    const filePath = path.resolve(UPLOAD_DIR, path.basename(hero.url));
    if (filePath.startsWith(UPLOAD_DIR + path.sep)) fs.unlink(filePath, () => {});
  }
  saveHero({ url: null });
  res.json({ message: 'Hero image removed' });
});

module.exports = router;
