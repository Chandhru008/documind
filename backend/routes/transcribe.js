import { Router } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import Groq from "groq-sdk";

const router = Router();

// Initialize Groq only when needed to ensure process.env is loaded
let groq = null;
function getGroq() {
  if (!groq) {
    groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return groq;
}

// Configure multer to save audio blobs temporarily
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.resolve("./uploads/audio");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `audio-${Date.now()}.webm`);
  },
});

const upload = multer({ storage });

router.post("/", upload.single("audio"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No audio file provided" });
  }

  try {
    console.log(`🎙️ Transcribing audio file: ${req.file.path}`);
    const groqClient = getGroq();
    const transcription = await groqClient.audio.transcriptions.create({
      file: fs.createReadStream(req.file.path),
      model: "whisper-large-v3",
      response_format: "json",
    });

    // Clean up temporary file
    fs.unlinkSync(req.file.path);

    console.log(`✅ Transcription complete: "${transcription.text}"`);
    res.json({ text: transcription.text });
  } catch (err) {
    console.error("❌ Transcription error:", err);
    // Cleanup on error
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: err.message || "Failed to transcribe audio" });
  }
});

export default router;
