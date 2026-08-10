const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  title: { type: String, default: '' },
  type: { type: String, default: '' },
  salary: { type: String, default: '' },
  location: { type: String, default: '' },
  experience: { type: String, default: '' },
  description: { type: String, default: '' },
  tags: { type: [String], default: [] },
  // Extended fields for public "View Details" functionality
  department: { type: String, default: '' },
  summary: { type: String, default: '' },
  responsibilities: { type: String, default: '' },
  requirements: { type: String, default: '' },
  qualifications: { type: String, default: '' },
  benefits: { type: String, default: '' }
}, {
  timestamps: true
});

// Ensure JSON output includes `id` (string form of _id) for frontend compatibility
jobSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Job', jobSchema);
