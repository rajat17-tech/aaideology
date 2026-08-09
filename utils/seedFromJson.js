const fs = require('fs');
const path = require('path');

const SiteContent = require('../models/SiteContent');
const Job = require('../models/Job');
const Poster = require('../models/Poster');
const HeroImage = require('../models/HeroImage');
const Review = require('../models/Review');
const Section = require('../models/Section');
const Navbar = require('../models/Navbar');

const dataDir = path.join(__dirname, '..', 'data');

/**
 * Read a JSON file from the data/ directory; return null if missing or invalid.
 */
function readLocalJson(filename) {
  try {
    const filepath = path.join(dataDir, filename);
    if (!fs.existsSync(filepath)) return null;
    return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * One-time migration: for every collection that is currently empty in MongoDB,
 * read the matching data/*.json file and insert its contents. This preserves
 * whatever the admin has already configured while the app was running on the
 * JSON-file backend.
 *
 * Safe to run on every startup — if a collection already has documents the
 * seed for that collection is skipped.
 */
async function seedFromJson() {
  let seeded = false;

  // ── SiteContent (singleton) ──────────────────────────────────────
  const contentCount = await SiteContent.countDocuments();
  if (contentCount === 0) {
    const data = readLocalJson('content.json');
    if (data && typeof data === 'object') {
      await SiteContent.create({ _id: 'site-content', ...data });
      console.log('  📄 Seeded SiteContent from content.json');
      seeded = true;
    }
  }

  // ── Jobs ─────────────────────────────────────────────────────────
  const jobCount = await Job.countDocuments();
  if (jobCount === 0) {
    const data = readLocalJson('jobs.json');
    if (Array.isArray(data) && data.length > 0) {
      await Job.insertMany(data.map(j => ({
        title: j.title || '',
        type: j.type || '',
        salary: j.salary || '',
        location: j.location || '',
        experience: j.experience || '',
        description: j.description || '',
        tags: j.tags || [],
        createdAt: j.createdAt || new Date()
      })));
      console.log(`  💼 Seeded ${data.length} jobs from jobs.json`);
      seeded = true;
    }
  }

  // ── Posters ──────────────────────────────────────────────────────
  const posterCount = await Poster.countDocuments();
  if (posterCount === 0) {
    const data = readLocalJson('posters.json');
    if (Array.isArray(data) && data.length > 0) {
      await Poster.insertMany(data.map(p => ({
        url: p.url,
        originalName: p.originalName || '',
        caption: p.caption || '',
        createdAt: p.createdAt || new Date()
      })));
      console.log(`  🖼️  Seeded ${data.length} posters from posters.json`);
      seeded = true;
    }
  }

  // ── HeroImage (singleton) ────────────────────────────────────────
  const heroCount = await HeroImage.countDocuments();
  if (heroCount === 0) {
    const data = readLocalJson('heroImage.json');
    if (data && typeof data === 'object') {
      await HeroImage.create({ _id: 'hero-image', url: data.url || null });
      console.log('  🏞️  Seeded HeroImage from heroImage.json');
      seeded = true;
    }
  }

  // ── Reviews ──────────────────────────────────────────────────────
  const reviewCount = await Review.countDocuments();
  if (reviewCount === 0) {
    const data = readLocalJson('reviews.json');
    if (Array.isArray(data) && data.length > 0) {
      await Review.insertMany(data.map(r => ({
        name: r.name,
        rating: r.rating,
        text: r.text,
        type: r.type || 'candidate',
        source: r.source || 'candidate',
        approved: r.approved !== undefined ? r.approved : false,
        createdAt: r.createdAt || new Date()
      })));
      console.log(`  ⭐ Seeded ${data.length} reviews from reviews.json`);
      seeded = true;
    }
  }

  // ── Sections ─────────────────────────────────────────────────────
  const sectionCount = await Section.countDocuments();
  if (sectionCount === 0) {
    const data = readLocalJson('sections.json');
    const sections = data && data.sections ? data.sections : [];
    if (sections.length > 0) {
      await Section.insertMany(sections.map(s => ({
        sectionId: s.id,
        title: s.title,
        subtitle: s.subtitle || '',
        content: s.content || '',
        type: s.type || 'text',
        bgColor: s.bgColor || '#ffffff',
        textColor: s.textColor || '#333333',
        padding: s.padding || '60px',
        order: s.order || 0,
        visible: s.visible !== undefined ? s.visible : true,
        navLabel: s.navLabel || s.title || 'New Section',
        showInNav: s.showInNav !== undefined ? s.showInNav : true,
        imageUrl: s.imageUrl || '',
        cards: s.cards || [],
        createdAt: s.createdAt || new Date()
      })));
      console.log(`  📐 Seeded ${sections.length} sections from sections.json`);
      seeded = true;
    }
  }

  // ── Navbar (singleton) ───────────────────────────────────────────
  const navbarCount = await Navbar.countDocuments();
  if (navbarCount === 0) {
    const data = readLocalJson('navbar.json');
    if (data && Array.isArray(data.items)) {
      await Navbar.create({ _id: 'navbar', items: data.items });
      console.log(`  🧭 Seeded navbar (${data.items.length} items) from navbar.json`);
      seeded = true;
    }
  }

  if (seeded) {
    console.log('✅ Database seeding complete');
  } else {
    console.log('ℹ️  Database already has data — skipping seed');
  }
}

module.exports = { seedFromJson };
