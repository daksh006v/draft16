const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  drafts: [{
    name: { type: String, required: true },
    content: { type: String, default: '' }
  }],
  beatSource: { type: String, enum: ['upload', 'youtube', 'external'] },
  beatUrl: { type: String }
}, {
  timestamps: true
});

module.exports = mongoose.model('Session', sessionSchema);
