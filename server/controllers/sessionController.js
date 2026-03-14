const Session = require('../models/Session');

// Create Session
exports.createSession = async (req, res) => {
  try {
    const { title, lyrics, beatSource, beatUrl } = req.body;
    const userId = req.user.userId;

    const session = await Session.create({
      userId,
      title,
      lyrics,
      beatSource,
      beatUrl
    });

    res.status(201).json(session);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get All Sessions
exports.getSessions = async (req, res) => {
  try {
    const userId = req.user.userId;
    // Find sessions belonging to this user, sorted by newest first
    const sessions = await Session.find({ userId }).sort({ createdAt: -1 });
    res.json(sessions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get Single Session
exports.getSessionById = async (req, res) => {
  try {
    const session = await Session.findById(req.params.id);

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Verify ownership
    if (session.userId.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    res.json(session);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update Session
exports.updateSession = async (req, res) => {
  try {
    const { title, lyrics, beatSource, beatUrl } = req.body;
    const session = await Session.findById(req.params.id);

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Verify ownership
    if (session.userId.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    // Update fields
    if (title !== undefined) session.title = title;
    if (lyrics !== undefined) session.lyrics = lyrics;
    if (beatSource !== undefined) session.beatSource = beatSource;
    if (beatUrl !== undefined) session.beatUrl = beatUrl;

    const updatedSession = await session.save();
    res.json(updatedSession);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete Session
exports.deleteSession = async (req, res) => {
  try {
    const session = await Session.findById(req.params.id);

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Verify ownership
    if (session.userId.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    await session.deleteOne();
    res.json({ message: 'Session deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
