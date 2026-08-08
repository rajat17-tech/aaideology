const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/auth');
const { readJson, writeJson } = require('../utils/jsonStore');

const JOBS_FILE = 'data/jobs.json';

const getJobs = () => {
  try {
    return readJson(JOBS_FILE);
  } catch (err) {
    return [];
  }
};
const saveJobs = (jobs) => writeJson(JOBS_FILE, jobs);

// GET all jobs — public
router.get('/', (req, res) => {
  res.json(getJobs());
});

// GET single job — public (used by admin edit form, but harmless to expose)
router.get('/:id', (req, res) => {
  const job = getJobs().find(j => String(j.id) === String(req.params.id));
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(job);
});

// CREATE job — admin only
router.post('/', requireAdmin, (req, res) => {
  const jobs = getJobs();
  const job = {
    id: Date.now(),
    title: req.body.title || '',
    type: req.body.type || '',
    salary: req.body.salary || '',
    location: req.body.location || '',
    experience: req.body.experience || '',
    description: req.body.description || '',
    tags: Array.isArray(req.body.tags)
      ? req.body.tags
      : (req.body.tags || '').split(',').map(t => t.trim()).filter(Boolean),
    createdAt: new Date().toISOString()
  };
  jobs.push(job);
  saveJobs(jobs);
  res.status(201).json(job);
});

// UPDATE job — admin only (this route did not exist before; jobs could
// previously only be deleted and re-created from scratch)
router.put('/:id', requireAdmin, (req, res) => {
  const jobs = getJobs();
  const index = jobs.findIndex(j => String(j.id) === String(req.params.id));
  if (index === -1) return res.status(404).json({ error: 'Job not found' });

  const tags = Array.isArray(req.body.tags)
    ? req.body.tags
    : (req.body.tags !== undefined
        ? req.body.tags.split(',').map(t => t.trim()).filter(Boolean)
        : jobs[index].tags);

  jobs[index] = {
    ...jobs[index],
    ...req.body,
    tags,
    id: jobs[index].id, // id is immutable
    updatedAt: new Date().toISOString()
  };
  saveJobs(jobs);
  res.json(jobs[index]);
});

// DELETE job — admin only
router.delete('/:id', requireAdmin, (req, res) => {
  const jobs = getJobs();
  const next = jobs.filter(j => String(j.id) !== String(req.params.id));
  if (next.length === jobs.length) return res.status(404).json({ error: 'Job not found' });
  saveJobs(next);
  res.json({ message: 'Deleted' });
});

module.exports = router;
