const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  title: { type: String, default: '' },
  type: { type: String, default: '' },
  salary: { type: String, default: '' },
  location: { type: String, default: '' },
  experience: { type: String, default: '' },
  description: { type: String, default: '' },
  tags: { type: [String], default: [] }
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
