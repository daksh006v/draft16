const express = require('express');
const router = express.Router();
const { signup, login, googleAuth, googleCallback } = require('../controllers/authController');

router.post('/signup', signup);
router.post('/login', login);

// Google OAuth
router.get('/google', googleAuth);
router.get('/google/callback', googleCallback);

module.exports = router;
