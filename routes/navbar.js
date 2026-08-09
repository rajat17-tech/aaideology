const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/auth');
const Navbar = require('../models/Navbar');

// GET navbar items — public
router.get('/', async (req, res) => {
  try {
    const doc = await Navbar.findById('navbar').lean();
    res.json(doc ? doc.items : []);
  } catch (err) {
    console.error('Failed to read navbar:', err);
    res.status(500).json({ error: 'Failed to load navigation.' });
  }
});

// UPDATE navbar items — admin only
router.put('/', requireAdmin, async (req, res) => {
  if (!Array.isArray(req.body)) {
    return res.status(400).json({ error: 'Expected an array of navbar items.' });
  }
  try {
    await Navbar.findOneAndUpdate(
      { _id: 'navbar' },
      { items: req.body },
      { upsert: true }
    );
    res.json({ message: 'Navbar updated' });
  } catch (err) {
    console.error('Failed to write navbar:', err);
    res.status(500).json({ error: 'Failed to save navigation.' });
  }
});

module.exports = router;
