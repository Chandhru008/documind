import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import uploadRoutes from "./routes/upload.js";
import chatRoutes from "./routes/chat.js";
import transcribeRoutes from "./routes/transcribe.js";
import { loadFromDisk } from "./services/vectorStore.js";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Trust reverse proxy (needed for accurate IP rate limiting in prod)
app.set('trust proxy', 1);

// Security Headers
app.use(helmet());

// Global Rate Limiter: 100 requests per 15 minutes
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: "Too many requests from this IP, please try again after 15 minutes" }
});
app.use('/api', globalLimiter);

// Strict Rate Limiter for expensive operations
const strictLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 20,
  message: { error: "Too many requests, please slow down." }
});

// Middleware
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',') 
  : ["http://localhost:5173", "http://localhost:5174", "http://127.0.0.1:5173"];

app.use(cors({
  origin: allowedOrigins,
  methods: ["GET", "POST", "DELETE"],
  credentials: true,
}));

// Limit JSON payload size to prevent memory exhaustion
app.use(express.json({ limit: '1mb' }));

// Ensure uploads directory exists
const uploadsDir = path.resolve("./uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Routes
app.use("/api/upload", strictLimiter, uploadRoutes);
app.use("/api/chat", strictLimiter, chatRoutes);
app.use("/api/transcribe", strictLimiter, transcribeRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "RAG Chat with PDFs",
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("💥 Unhandled error:", err);

  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: "File too large. Maximum size is 50MB." });
  }

  if (err.message === "Only PDF files are allowed") {
    return res.status(400).json({ error: err.message });
  }

  res.status(500).json({
    error: "An unexpected error occurred. Please try again.",
  });
});

// Start server
async function start() {
  // Try to load previously saved FAISS index
  await loadFromDisk();

  app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════╗
║    🚀 RAG Chat with PDFs — Backend      ║
║    Running on http://localhost:${PORT}      ║
╚══════════════════════════════════════════╝
    `);
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});



