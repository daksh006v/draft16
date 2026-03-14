const express = require('express');
const router = express.Router();
const upload = require('../middleware/uploadMiddleware');

// POST /api/upload/beat
// We expect the field name "beat" from the frontend form data
router.post('/beat', upload.single('beat'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  // Cloudinary returns the URL in req.file.path
  res.json({
    url: req.file.path
  });
});

module.exports = router;
