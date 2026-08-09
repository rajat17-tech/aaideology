const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/auth');
const Section = require('../models/Section');
const Navbar = require('../models/Navbar');

// Section IDs are used verbatim inside the admin panel's inline HTML event
// handlers (onclick="editSection('...')" etc.) and as URL/anchor fragments,
// so they must be restricted to a safe slug format — otherwise a quote or
// angle bracket in a client-supplied id could break out of an HTML
// attribute. Falls back to an auto-generated id if the input is invalid.
const SAFE_ID = /^[a-zA-Z0-9_-]{1,80}$/;
const sanitizeId = (id) => (typeof id === 'string' && SAFE_ID.test(id)) ? id : null;

// Helper: get or create the singleton navbar document
async function getNavbar() {
  let nav = await Navbar.findById('navbar');
  if (!nav) nav = await Navbar.create({ _id: 'navbar', items: [] });
  return nav;
}

// GET all sections
router.get('/', async (req, res) => {
  try {
    const sections = await Section.find().sort({ order: 1 });
    res.json(sections);
  } catch (err) {
    console.error('Sections route error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// GET single section
router.get('/:id', async (req, res) => {
  try {
    const section = await Section.findOne({ sectionId: req.params.id });
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
router.post('/', requireAdmin, async (req, res) => {
  try {
    const placeAtTop = req.body.order === undefined;

    if (placeAtTop) {
      // Shift every existing section down by 1 to make room at the top
      await Section.updateMany({}, { $inc: { order: 1 } });
    }

    const sectionId = sanitizeId(req.body.id) || 'section-' + Date.now();
    const section = await Section.create({
      sectionId,
      title: req.body.title || 'New Section',
      subtitle: req.body.subtitle || '',
      content: req.body.content || '',
      type: req.body.type || 'text',
      bgColor: req.body.bgColor || '#ffffff',
      textColor: req.body.textColor || '#333333',
      padding: req.body.padding || '60px',
      order: placeAtTop ? 0 : req.body.order,
      visible: req.body.visible !== undefined ? req.body.visible : true,
      navLabel: req.body.navLabel || req.body.title || 'New Section',
      showInNav: req.body.showInNav !== undefined ? req.body.showInNav : true,
      imageUrl: req.body.imageUrl || '',
      cards: req.body.cards || []
    });

    // Auto-add to navbar if showInNav is true
    if (section.showInNav) {
      const nav = await getNavbar();
      const exists = nav.items.find(n => n.id === sectionId);
      if (!exists) {
        const maxOrder = nav.items.reduce((max, n) => Math.max(max, n.order || 0), -1);
        nav.items.push({
          id: sectionId,
          label: section.navLabel,
          href: '#' + sectionId,
          order: maxOrder + 1
        });
        nav.items.sort((a, b) => a.order - b.order);
        await nav.save();
      }
    }

    res.status(201).json(section);
  } catch (err) {
    console.error('Sections route error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// UPDATE section + sync navbar
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const section = await Section.findOne({ sectionId: req.params.id });
    if (!section) return res.status(404).json({ error: 'Section not found' });

    // id is immutable on update — otherwise a PUT could rename a section to
    // an unsafe id or silently orphan it from the navbar entry.
    const fieldsToUpdate = ['title', 'subtitle', 'content', 'type', 'bgColor',
      'textColor', 'padding', 'order', 'visible', 'navLabel', 'showInNav',
      'imageUrl', 'cards'];
    fieldsToUpdate.forEach(f => {
      if (req.body[f] !== undefined) section[f] = req.body[f];
    });

    await section.save();

    // Sync navbar
    const nav = await getNavbar();
    const navIndex = nav.items.findIndex(n => n.id === req.params.id);

    if (section.showInNav) {
      const navItem = {
        id: section.sectionId,
        label: section.navLabel || section.title,
        href: '#' + section.sectionId,
        order: section.order
      };
      if (navIndex !== -1) {
        nav.items[navIndex] = navItem;
      } else {
        nav.items.push(navItem);
      }
    } else {
      if (navIndex !== -1) {
        nav.items.splice(navIndex, 1);
      }
    }

    nav.items.sort((a, b) => a.order - b.order);
    nav.markModified('items');
    await nav.save();

    res.json(section);
  } catch (err) {
    console.error('Sections route error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// DELETE section + remove from navbar
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const result = await Section.findOneAndDelete({ sectionId: req.params.id });
    if (!result) return res.status(404).json({ error: 'Section not found' });

    // Remove from navbar
    const nav = await getNavbar();
    const navIndex = nav.items.findIndex(n => n.id === req.params.id);
    if (navIndex !== -1) {
      nav.items.splice(navIndex, 1);
      nav.markModified('items');
      await nav.save();
    }

    res.json({ message: 'Section deleted successfully' });
  } catch (err) {
    console.error('Sections route error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// REORDER sections
router.post('/reorder', requireAdmin, async (req, res) => {
  try {
    const { orders } = req.body; // { sectionId: newOrder, ... }

    // Update sections in bulk
    const bulkOps = Object.entries(orders).map(([id, order]) => ({
      updateOne: {
        filter: { sectionId: id },
        update: { $set: { order } }
      }
    }));
    if (bulkOps.length > 0) await Section.bulkWrite(bulkOps);

    // Sync navbar orders
    const nav = await getNavbar();
    nav.items.forEach(item => {
      if (orders[item.id] !== undefined) {
        item.order = orders[item.id];
      }
    });
    nav.items.sort((a, b) => a.order - b.order);
    nav.markModified('items');
    await nav.save();

    const sections = await Section.find().sort({ order: 1 });
    res.json(sections);
  } catch (err) {
    console.error('Sections route error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

module.exports = router;