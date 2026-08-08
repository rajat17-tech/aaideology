const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { requireAdmin } = require('../middleware/auth');

const navbarFile = path.join(__dirname, '..', 'data', 'navbar.json');

const readJSON = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJSON = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));

// GET navbar items — public
router.get('/', (req, res) => {
  try {
    const data = readJSON(navbarFile);
    res.json(data.items);
  } catch (err) {
    console.error('Failed to read navbar.json:', err);
    res.status(500).json({ error: 'Failed to load navigation.' });
  }
});

// UPDATE navbar items — admin only
router.put('/', requireAdmin, (req, res) => {
  if (!Array.isArray(req.body)) {
    return res.status(400).json({ error: 'Expected an array of navbar items.' });
  }
  try {
    writeJSON(navbarFile, { items: req.body });
    res.json({ message: 'Navbar updated' });
  } catch (err) {
    console.error('Failed to write navbar.json:', err);
    res.status(500).json({ error: 'Failed to save navigation.' });
  }
});

module.exports = router;
