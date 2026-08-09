const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { requireAdmin } = require('../middleware/auth');
const Review = require('../models/Review');

const MAX_NAME_LEN = 100;
const MAX_TEXT_LEN = 2000;

const clampRating = (value) => {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return 5;
  return Math.min(5, Math.max(1, n));
};

// Reviews are shown on the site in two separate groups — Candidate Reviews
// and Client Reviews — so every review is tagged with which one it belongs
// to. Anything unrecognized falls back to 'candidate'.
const normalizeType = (value) => (value === 'client' ? 'client' : 'candidate');

// GET approved reviews — public (what visitors see on the site)
router.get('/', async (req, res) => {
  try {
    const reviews = await Review.find({ approved: { $ne: false } })
      .sort({ createdAt: -1 });
    res.json(reviews);
  } catch (err) {
    console.error('Reviews route error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// GET all reviews (pending + approved) — admin only, for the moderation table
router.get('/all', requireAdmin, async (req, res) => {
  try {
    const reviews = await Review.find().sort({ createdAt: -1 });
    res.json(reviews);
  } catch (err) {
    console.error('Reviews route error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// CREATE review — public, submitted by a candidate from the main website.
// Always saved as pending (approved:false) so nothing goes live without an
// admin looking at it first, no matter what the client sends.
router.post('/', async (req, res) => {
  const { name, rating, text, type } = req.body || {};

  if (!name || !String(name).trim() || !text || !String(text).trim()) {
    return res.status(400).json({ error: 'Name and review text are required.' });
  }
  if (String(name).length > MAX_NAME_LEN) {
    return res.status(400).json({ error: `Name must be under ${MAX_NAME_LEN} characters.` });
  }
  if (String(text).length > MAX_TEXT_LEN) {
    return res.status(400).json({ error: `Review must be under ${MAX_TEXT_LEN} characters.` });
  }

  try {
    await Review.create({
      name: String(name).trim(),
      rating: clampRating(rating),
      text: String(text).trim(),
      type: normalizeType(type),
      source: 'candidate',
      approved: false
    });
    res.status(201).json({ success: true, message: 'Thanks! Your review has been submitted and will appear once approved.' });
  } catch (err) {
    console.error('Reviews route error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// CREATE review — admin only. Lets an admin add a review on a candidate's
// behalf (e.g. one collected by phone/email), or write one under their own
// name. Approved by default since an admin is the one adding it, but they
// can uncheck "approved" in the form if they want to draft it first.
router.post('/admin', requireAdmin, async (req, res) => {
  const { name, rating, text, approved, type } = req.body || {};

  if (!name || !String(name).trim() || !text || !String(text).trim()) {
    return res.status(400).json({ error: 'Name and review text are required.' });
  }
  if (String(name).length > MAX_NAME_LEN) {
    return res.status(400).json({ error: `Name must be under ${MAX_NAME_LEN} characters.` });
  }
  if (String(text).length > MAX_TEXT_LEN) {
    return res.status(400).json({ error: `Review must be under ${MAX_TEXT_LEN} characters.` });
  }

  try {
    const review = await Review.create({
      name: String(name).trim(),
      rating: clampRating(rating),
      text: String(text).trim(),
      type: normalizeType(type),
      source: 'admin',
      approved: approved !== false
    });
    res.status(201).json(review);
  } catch (err) {
    console.error('Reviews route error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// UPDATE review — admin only (edit name/text/rating, and/or toggle approved)
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ error: 'Review not found' });

    const { name, rating, text, approved, type } = req.body || {};
    if (name !== undefined) {
      if (!String(name).trim()) return res.status(400).json({ error: 'Name cannot be empty.' });
      if (String(name).length > MAX_NAME_LEN) return res.status(400).json({ error: `Name must be under ${MAX_NAME_LEN} characters.` });
      review.name = String(name).trim();
    }
    if (text !== undefined) {
      if (!String(text).trim()) return res.status(400).json({ error: 'Review text cannot be empty.' });
      if (String(text).length > MAX_TEXT_LEN) return res.status(400).json({ error: `Review must be under ${MAX_TEXT_LEN} characters.` });
      review.text = String(text).trim();
    }
    if (rating !== undefined) review.rating = clampRating(rating);
    if (type !== undefined) review.type = normalizeType(type);
    if (approved !== undefined) review.approved = !!approved;

    await review.save();
    res.json(review);
  } catch (err) {
    console.error('Reviews route error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// DELETE review — admin only
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const result = await Review.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ error: 'Review not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('Reviews route error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

module.exports = router;
