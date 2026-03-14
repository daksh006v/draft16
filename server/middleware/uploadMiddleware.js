const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'draft16_beats',
    resource_type: 'video', // audio is uploaded as video in cloudinary
    allowed_formats: ['mp3', 'wav'],
  },
});

const upload = multer({ storage: storage });

module.exports = upload;
