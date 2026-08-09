const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { requireAdmin } = require('../middleware/auth');
const HeroImage = require('../models/HeroImage');

// NOTE: this route was previously a stub (`GET / -> { url: '' }` with no
// POST/DELETE at all), so uploading a hero background image from the admin
// panel silently did nothing. It's now implemented the same way
// routes/posters.js handles image uploads.

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'hero');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_IMAGE_TYPES = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp']
};

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
router.get('/', async (req, res) => {
  try {
    const doc = await HeroImage.findById('hero-image').lean();
    const url = doc ? doc.url : null;
    res.json({ exists: !!url, url: url || '' });
  } catch (err) {
    console.error('HeroImage route error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// UPLOAD/replace the hero background image — admin only
router.post('/', requireAdmin, (req, res) => {
  upload.single('heroImage')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No image file provided' });

    try {
      // Remove the previous hero image file (if any) before saving the new one
      const previous = await HeroImage.findById('hero-image').lean();
      if (previous && previous.url) {
        const prevPath = path.resolve(UPLOAD_DIR, path.basename(previous.url));
        if (prevPath.startsWith(UPLOAD_DIR + path.sep)) fs.unlink(prevPath, () => {});
      }

      const url = `/uploads/hero/${req.file.filename}`;
      await HeroImage.findOneAndUpdate(
        { _id: 'hero-image' },
        { url },
        { upsert: true }
      );
      res.status(201).json({ url });
    } catch (dbErr) {
      console.error('HeroImage route error:', dbErr);
      res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
  });
});

// REMOVE the hero background image — admin only
router.delete('/', requireAdmin, async (req, res) => {
  try {
    const doc = await HeroImage.findById('hero-image').lean();
    if (doc && doc.url) {
      const filePath = path.resolve(UPLOAD_DIR, path.basename(doc.url));
      if (filePath.startsWith(UPLOAD_DIR + path.sep)) fs.unlink(filePath, () => {});
    }
    await HeroImage.findOneAndUpdate(
      { _id: 'hero-image' },
      { url: null },
      { upsert: true }
    );
    res.json({ message: 'Hero image removed' });
  } catch (err) {
    console.error('HeroImage route error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

module.exports = router;
