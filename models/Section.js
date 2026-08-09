const mongoose = require('mongoose');

const sectionSchema = new mongoose.Schema({
  sectionId: { type: String, required: true, unique: true },
  title: { type: String, default: 'New Section' },
  subtitle: { type: String, default: '' },
  content: { type: String, default: '' },
  type: { type: String, default: 'text' },
  bgColor: { type: String, default: '#ffffff' },
  textColor: { type: String, default: '#333333' },
  padding: { type: String, default: '60px' },
  order: { type: Number, default: 0 },
  visible: { type: Boolean, default: true },
  navLabel: { type: String, default: 'New Section' },
  showInNav: { type: Boolean, default: true },
  imageUrl: { type: String, default: '' },
  cards: { type: [mongoose.Schema.Types.Mixed], default: [] }
}, {
  timestamps: true
});

// The frontend/admin panel refers to sections by their slug `id`, not by
// MongoDB's ObjectId.  Map sectionId → id in JSON output so the API
// contract stays the same as the old JSON-file version.
sectionSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret.sectionId;
    delete ret._id;
    delete ret.__v;
    delete ret.sectionId;
    return ret;
  }
});

module.exports = mongoose.model('Section', sectionSchema);
