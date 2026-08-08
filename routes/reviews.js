const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { requireAdmin } = require('../middleware/auth');
const { readJson, writeJson } = require('../utils/jsonStore');

const REVIEWS_FILE = 'data/reviews.json';
const MAX_NAME_LEN = 100;
const MAX_TEXT_LEN = 2000;

const getReviews = () => {
  try {
    return readJson(REVIEWS_FILE);
  } catch (err) {
    return [];
  }
};
const saveReviews = (reviews) => writeJson(REVIEWS_FILE, reviews);

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
router.get('/', (req, res) => {
  const reviews = getReviews()
    .filter(r => r.approved !== false)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(reviews);
});

// GET all reviews (pending + approved) — admin only, for the moderation table
router.get('/all', requireAdmin, (req, res) => {
  const reviews = getReviews().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(reviews);
});

// CREATE review — public, submitted by a candidate from the main website.
// Always saved as pending (approved:false) so nothing goes live without an
// admin looking at it first, no matter what the client sends.
router.post('/', (req, res) => {
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

  const reviews = getReviews();
  const review = {
    id: crypto.randomUUID(),
    name: String(name).trim(),
    rating: clampRating(rating),
    text: String(text).trim(),
    type: normalizeType(type),
    source: 'candidate',
    approved: false,
    createdAt: new Date().toISOString()
  };
  reviews.push(review);
  saveReviews(reviews);
  res.status(201).json({ success: true, message: 'Thanks! Your review has been submitted and will appear once approved.' });
});

// CREATE review — admin only. Lets an admin add a review on a candidate's
// behalf (e.g. one collected by phone/email), or write one under their own
// name. Approved by default since an admin is the one adding it, but they
// can uncheck "approved" in the form if they want to draft it first.
router.post('/admin', requireAdmin, (req, res) => {
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

  const reviews = getReviews();
  const review = {
    id: crypto.randomUUID(),
    name: String(name).trim(),
    rating: clampRating(rating),
    text: String(text).trim(),
    type: normalizeType(type),
    source: 'admin',
    approved: approved !== false,
    createdAt: new Date().toISOString()
  };
  reviews.push(review);
  saveReviews(reviews);
  res.status(201).json(review);
});

// UPDATE review — admin only (edit name/text/rating, and/or toggle approved)
router.put('/:id', requireAdmin, (req, res) => {
  const reviews = getReviews();
  const index = reviews.findIndex(r => String(r.id) === String(req.params.id));
  if (index === -1) return res.status(404).json({ error: 'Review not found' });

  const { name, rating, text, approved, type } = req.body || {};
  if (name !== undefined) {
    if (!String(name).trim()) return res.status(400).json({ error: 'Name cannot be empty.' });
    if (String(name).length > MAX_NAME_LEN) return res.status(400).json({ error: `Name must be under ${MAX_NAME_LEN} characters.` });
    reviews[index].name = String(name).trim();
  }
  if (text !== undefined) {
    if (!String(text).trim()) return res.status(400).json({ error: 'Review text cannot be empty.' });
    if (String(text).length > MAX_TEXT_LEN) return res.status(400).json({ error: `Review must be under ${MAX_TEXT_LEN} characters.` });
    reviews[index].text = String(text).trim();
  }
  if (rating !== undefined) reviews[index].rating = clampRating(rating);
  if (type !== undefined) reviews[index].type = normalizeType(type);
  if (approved !== undefined) reviews[index].approved = !!approved;
  reviews[index].updatedAt = new Date().toISOString();

  saveReviews(reviews);
  res.json(reviews[index]);
});

// DELETE review — admin only
router.delete('/:id', requireAdmin, (req, res) => {
  const reviews = getReviews();
  const next = reviews.filter(r => String(r.id) !== String(req.params.id));
  if (next.length === reviews.length) return res.status(404).json({ error: 'Review not found' });
  saveReviews(next);
  res.json({ message: 'Deleted' });
});

module.exports = router;
