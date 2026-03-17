console.log("🔥 uploadRoutes.js LOADED");
const express = require("express");
const router = express.Router();
const upload = require("../middleware/uploadMiddleware");
const cloudinary = require("../config/cloudinary");
const fs = require("fs");

router.post(/^\/audio/, upload.single("audio"), async (req, res) => {
  console.log("🔥 HIT /audio route");
  console.log("Uploading file path:", req.file ? req.file.path : 'undefined');
  console.log("UPLOAD ROUTES LOADED");
  
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded or file rejected by Multer filters.' });
  }

  try {
    const result = await cloudinary.uploader.upload(req.file.path, {
      resource_type: "auto",
      folder: "draft16_beats"
    });

    res.json({ url: result.secure_url });
  } catch (err) {
    console.error("UPLOAD ERROR:", err);
    res.status(500).json({ message: err.message });
  } finally {
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {
        console.error("Failed to delete local temp file:", e);
      }
    }
  }
});

module.exports = router;
