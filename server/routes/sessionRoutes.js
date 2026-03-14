const express = require('express');
const router = express.Router();
const {
  getSessions,
  createSession,
  getSessionById,
  updateSession,
  deleteSession
} = require('../controllers/sessionController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, getSessions);
router.post('/', protect, createSession);
router.get('/:id', protect, getSessionById);
router.put('/:id', protect, updateSession);
router.delete('/:id', protect, deleteSession);

module.exports = router;
