const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  name: { type: String, required: true },
  rating: { type: Number, min: 1, max: 5, default: 5 },
  text: { type: String, required: true },
  type: { type: String, enum: ['candidate', 'client'], default: 'candidate' },
  source: { type: String, enum: ['candidate', 'admin'], default: 'candidate' },
  approved: { type: Boolean, default: false }
}, {
  timestamps: true
});

reviewSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Review', reviewSchema);
