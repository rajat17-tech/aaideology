const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { requireAdmin } = require('../middleware/auth');

const dataDir = path.join(__dirname, '..', 'data');
const sectionsFile = path.join(dataDir, 'sections.json');
const navbarFile = path.join(dataDir, 'navbar.json');

// Helper: read/write JSON
const readJSON = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJSON = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));

// Section IDs are used verbatim inside the admin panel's inline HTML event
// handlers (onclick="editSection('...')" etc.) and as URL/anchor fragments,
// so they must be restricted to a safe slug format — otherwise a quote or
// angle bracket in a client-supplied id could break out of an HTML
// attribute. Falls back to an auto-generated id if the input is invalid.
const SAFE_ID = /^[a-zA-Z0-9_-]{1,80}$/;
const sanitizeId = (id) => (typeof id === 'string' && SAFE_ID.test(id)) ? id : null;

// GET all sections
router.get('/', (req, res) => {
  try {
    const data = readJSON(sectionsFile);
    res.json(data.sections);
  } catch (err) {
    console.error('Sections route error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// GET single section
router.get('/:id', (req, res) => {
  try {
    const data = readJSON(sectionsFile);
    const section = data.sections.find(s => s.id === req.params.id);
    if (!section) return res.status(404).json({ error: 'Section not found' });
    res.json(section);
  } catch (err) {
    console.error('Sections route error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// CREATE new section + auto-add to navbar
// New sections default to the TOP of the page (order 0), pushing existing
// sections down, unless the caller explicitly passes an `order`.
router.post('/', requireAdmin, (req, res) => {
  try {
    const data = readJSON(sectionsFile);
    const navbarData = readJSON(navbarFile);

    const placeAtTop = req.body.order === undefined;

    if (placeAtTop) {
      // Shift every existing section down by 1 to make room at the top
      data.sections.forEach(s => { s.order = (s.order || 0) + 1; });
    }

    const newSection = {
      id: sanitizeId(req.body.id) || 'section-' + Date.now(),
      title: req.body.title || 'New Section',
      subtitle: req.body.subtitle || '',
      content: req.body.content || '',
      type: req.body.type || 'text', // text, image, cards, stats, team, testimonials, custom
      bgColor: req.body.bgColor || '#ffffff',
      textColor: req.body.textColor || '#333333',
      padding: req.body.padding || '60px',
      order: placeAtTop ? 0 : req.body.order,
      visible: req.body.visible !== undefined ? req.body.visible : true,
      navLabel: req.body.navLabel || req.body.title || 'New Section',
      showInNav: req.body.showInNav !== undefined ? req.body.showInNav : true,
      imageUrl: req.body.imageUrl || '',
      cards: req.body.cards || [],
      createdAt: new Date().toISOString()
    };

    data.sections.push(newSection);
    data.sections.sort((a, b) => a.order - b.order);
    writeJSON(sectionsFile, data);

    // Auto-add to navbar if showInNav is true (nav order stays append-at-end
    // so the top nav bar itself doesn't reshuffle every time a section is added)
    if (newSection.showInNav) {
      const existingNav = navbarData.items.find(n => n.id === newSection.id);
      if (!existingNav) {
        const maxNavOrder = navbarData.items.reduce((max, n) => Math.max(max, n.order || 0), -1);
        navbarData.items.push({
          id: newSection.id,
          label: newSection.navLabel,
          href: '#' + newSection.id,
          order: maxNavOrder + 1
        });
        navbarData.items.sort((a, b) => a.order - b.order);
        writeJSON(navbarFile, navbarData);
      }
    }

    res.status(201).json(newSection);
  } catch (err) {
    console.error('Sections route error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// UPDATE section + sync navbar
router.put('/:id', requireAdmin, (req, res) => {
  try {
    const data = readJSON(sectionsFile);
    const navbarData = readJSON(navbarFile);
    const index = data.sections.findIndex(s => s.id === req.params.id);

    if (index === -1) return res.status(404).json({ error: 'Section not found' });

    // id is immutable on update — otherwise a PUT could rename a section to
    // an unsafe id (see sanitizeId above) or silently orphan it from the
    // navbar entry that references the original id.
    const updatedSection = { ...data.sections[index], ...req.body, id: data.sections[index].id, updatedAt: new Date().toISOString() };
    data.sections[index] = updatedSection;
    data.sections.sort((a, b) => a.order - b.order);
    writeJSON(sectionsFile, data);

    // Sync navbar
    const navIndex = navbarData.items.findIndex(n => n.id === req.params.id);

    if (updatedSection.showInNav) {
      const navItem = {
        id: updatedSection.id,
        label: updatedSection.navLabel || updatedSection.title,
        href: '#' + updatedSection.id,
        order: updatedSection.order
      };
      if (navIndex !== -1) {
        navbarData.items[navIndex] = navItem;
      } else {
        navbarData.items.push(navItem);
      }
    } else {
      if (navIndex !== -1) {
        navbarData.items.splice(navIndex, 1);
      }
    }

    navbarData.items.sort((a, b) => a.order - b.order);
    writeJSON(navbarFile, navbarData);

    res.json(updatedSection);
  } catch (err) {
    console.error('Sections route error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// DELETE section + remove from navbar
router.delete('/:id', requireAdmin, (req, res) => {
  try {
    const data = readJSON(sectionsFile);
    const navbarData = readJSON(navbarFile);

    const index = data.sections.findIndex(s => s.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Section not found' });

    data.sections.splice(index, 1);
    writeJSON(sectionsFile, data);

    // Remove from navbar
    const navIndex = navbarData.items.findIndex(n => n.id === req.params.id);
    if (navIndex !== -1) {
      navbarData.items.splice(navIndex, 1);
      writeJSON(navbarFile, navbarData);
    }

    res.json({ message: 'Section deleted successfully' });
  } catch (err) {
    console.error('Sections route error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// REORDER sections
router.post('/reorder', requireAdmin, (req, res) => {
  try {
    const { orders } = req.body; // { sectionId: newOrder, ... }
    const data = readJSON(sectionsFile);
    const navbarData = readJSON(navbarFile);

    data.sections.forEach(section => {
      if (orders[section.id] !== undefined) {
        section.order = orders[section.id];
      }
    });

    data.sections.sort((a, b) => a.order - b.order);
    writeJSON(sectionsFile, data);

    // Sync navbar orders
    navbarData.items.forEach(item => {
      if (orders[item.id] !== undefined) {
        item.order = orders[item.id];
      }
    });
    navbarData.items.sort((a, b) => a.order - b.order);
    writeJSON(navbarFile, navbarData);

    res.json(data.sections);
  } catch (err) {
    console.error('Sections route error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

module.exports = router;