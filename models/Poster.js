const mongoose = require('mongoose');

const posterSchema = new mongoose.Schema({
  url: { type: String, required: true },
  originalName: { type: String, default: '' },
  caption: { type: String, default: '' }
}, {
  timestamps: true
});

posterSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Poster', posterSchema);
