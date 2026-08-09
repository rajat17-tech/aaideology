const mongoose = require('mongoose');

const heroImageSchema = new mongoose.Schema({
  _id: { type: String, default: 'hero-image' },
  url: { type: String, default: null }
}, {
  timestamps: false
});

module.exports = mongoose.model('HeroImage', heroImageSchema);
