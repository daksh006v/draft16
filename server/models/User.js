const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String }, // Made optional
  name: { type: String },
  email: { type: String, required: true, unique: true },
  password: { type: String }, // Made optional for OAuth users
  avatar: { type: String },
  themePreference: { type: String, default: 'dark' }
}, {
  timestamps: true
});

module.exports = mongoose.model('User', userSchema);
