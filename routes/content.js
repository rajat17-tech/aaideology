const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/auth');
const SiteContent = require('../models/SiteContent');

// GET all site content — public, the website needs this to render every page.
router.get('/', async (req, res) => {
  try {
    const doc = await SiteContent.findById('site-content').lean();
    if (!doc) return res.json({});
    // Remove Mongoose internals before sending
    delete doc._id;
    delete doc.__v;
    res.json(doc);
  } catch (err) {
    console.error('Failed to read site content:', err);
    res.status(500).json({ error: 'Failed to load site content.' });
  }
});

// UPDATE site content — admin only.
// Body should contain one or more top-level sections to replace, e.g.
// { "about": { ...full about object... } } or
// { "serviceList": [ ...full array... ] }.
// Each section is replaced wholesale, so the admin UI always sends the
// complete section object/array, not a partial patch.
router.put('/', requireAdmin, async (req, res) => {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return res.status(400).json({ error: 'Expected a JSON object of content sections to update.' });
  }
  try {
    const updated = await SiteContent.findOneAndUpdate(
      { _id: 'site-content' },
      { $set: req.body },
      { upsert: true, new: true, lean: true }
    );
    delete updated._id;
    delete updated.__v;
    res.json(updated);
  } catch (err) {
    console.error('Failed to update site content:', err);
    res.status(500).json({ error: 'Failed to save site content.' });
  }
});

module.exports = router;
