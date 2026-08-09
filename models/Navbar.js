const mongoose = require('mongoose');

const navItemSchema = new mongoose.Schema({
  id: { type: String, required: true },
  label: { type: String, required: true },
  href: { type: String, required: true },
  order: { type: Number, default: 0 }
}, { _id: false });

const navbarSchema = new mongoose.Schema({
  _id: { type: String, default: 'navbar' },
  items: { type: [navItemSchema], default: [] }
}, {
  timestamps: false
});

module.exports = mongoose.model('Navbar', navbarSchema);
