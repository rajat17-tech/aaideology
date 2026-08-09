const mongoose = require('mongoose');

const siteContentSchema = new mongoose.Schema({
  // Fixed _id ensures only one document ever exists (singleton pattern)
  _id: { type: String, default: 'site-content' },
  hero: { type: mongoose.Schema.Types.Mixed, default: {} },
  about: { type: mongoose.Schema.Types.Mixed, default: {} },
  stats: { type: mongoose.Schema.Types.Mixed, default: {} },
  values: { type: mongoose.Schema.Types.Mixed, default: {} },
  industries: { type: mongoose.Schema.Types.Mixed, default: {} },
  services: { type: mongoose.Schema.Types.Mixed, default: {} },
  serviceList: { type: [mongoose.Schema.Types.Mixed], default: [] },
  contact: { type: mongoose.Schema.Types.Mixed, default: {} },
  footer: { type: mongoose.Schema.Types.Mixed, default: {} }
}, {
  timestamps: false,
  // Prevent Mongoose from filtering out unknown top-level keys the admin
  // panel might add in the future.
  strict: false
});

module.exports = mongoose.model('SiteContent', siteContentSchema);
