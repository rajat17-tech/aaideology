const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/auth');
const Job = require('../models/Job');

// GET all jobs — public
router.get('/', async (req, res) => {
  try {
    const jobs = await Job.find().sort({ createdAt: -1 });
    res.json(jobs);
  } catch (err) {
    console.error('Jobs route error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// GET single job — public (used by admin edit form, but harmless to expose)
router.get('/:id', async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json(job);
  } catch (err) {
    console.error('Jobs route error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// CREATE job — admin only
router.post('/', requireAdmin, async (req, res) => {
  try {
    const job = await Job.create({
      title: req.body.title || '',
      type: req.body.type || '',
      salary: req.body.salary || '',
      location: req.body.location || '',
      experience: req.body.experience || '',
      description: req.body.description || '',
      tags: Array.isArray(req.body.tags)
        ? req.body.tags
        : (req.body.tags || '').split(',').map(t => t.trim()).filter(Boolean),
      department: req.body.department || '',
      summary: req.body.summary || '',
      responsibilities: req.body.responsibilities || '',
      requirements: req.body.requirements || '',
      qualifications: req.body.qualifications || '',
      benefits: req.body.benefits || ''
    });
    res.status(201).json(job);
  } catch (err) {
    console.error('Jobs route error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// UPDATE job — admin only
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const tags = Array.isArray(req.body.tags)
      ? req.body.tags
      : (req.body.tags !== undefined
          ? req.body.tags.split(',').map(t => t.trim()).filter(Boolean)
          : job.tags);

    // Apply updates (id is immutable — Mongoose _id can't be changed anyway)
    const fields = ['title', 'type', 'salary', 'location', 'experience', 'description', 'department', 'summary', 'responsibilities', 'requirements', 'qualifications', 'benefits'];
    fields.forEach(f => { if (req.body[f] !== undefined) job[f] = req.body[f]; });
    job.tags = tags;
    await job.save();

    res.json(job);
  } catch (err) {
    console.error('Jobs route error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// DELETE job — admin only
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const result = await Job.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ error: 'Job not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('Jobs route error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

module.exports = router;
