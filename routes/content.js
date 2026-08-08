const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { requireAdmin } = require('../middleware/auth');

const contentFile = path.join(__dirname, '..', 'data', 'content.json');

const readJSON = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJSON = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));
const mergeItemsPreservingExtraFields = (existingItems, incomingItems) => {
  if (!Array.isArray(incomingItems)) return incomingItems;
  const existingByTitle = new Map();
  (Array.isArray(existingItems) ? existingItems : []).forEach(item => {
    if (item && typeof item.title === 'string') {
      existingByTitle.set(item.title.trim().toLowerCase(), item);
    }
  });
  return incomingItems.map(incoming => {
    if (!incoming || typeof incoming !== 'object') return incoming;
    const match = typeof incoming.title === 'string'
      ? existingByTitle.get(incoming.title.trim().toLowerCase())
      : null;
    return match ? { ...match, ...incoming } : incoming;
  });
};

const SECTIONS_WITH_PRESERVED_ITEMS = ['industries', 'values'];
// GET all site content — public, the website needs this to render every page.
router.get('/', (req, res) => {
  try {
    const data = readJSON(contentFile);
    res.json(data);
  } catch (err) {
    console.error('Failed to read content.json:', err);
    res.status(500).json({ error: 'Failed to load site content.' });
  }
});

// UPDATE site content — admin only.
// Body should contain one or more top-level sections to replace, e.g.
// { "about": { ...full about object... } } or
// { "serviceList": [ ...full array... ] }.
// Each section is replaced wholesale, so the admin UI always sends the
// complete section object/array, not a partial patch.
router.put('/', requireAdmin, (req, res) => {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return res.status(400).json({ error: 'Expected a JSON object of content sections to update.' });
  }
  try {
    const data = readJSON(contentFile);

const incoming = { ...req.body };
for (const key of SECTIONS_WITH_PRESERVED_ITEMS) {
  if (incoming[key] && Array.isArray(incoming[key].items)) {
    incoming[key] = {
      ...incoming[key],
      items: mergeItemsPreservingExtraFields(data[key]?.items, incoming[key].items)
    };
  }
}

const updated = { ...data, ...incoming };
    writeJSON(contentFile, updated);
    res.json(updated);
  } catch (err) {
    console.error('Failed to update content.json:', err);
    res.status(500).json({ error: 'Failed to save site content.' });
  }
});

module.exports = router;
