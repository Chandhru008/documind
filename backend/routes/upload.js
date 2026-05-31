import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { processDocuments } from "../services/pdfProcessor.js";
import { addDocuments, clear, isReady } from "../services/vectorStore.js";
import { generateDocumentBrief } from "../services/llmService.js";

const router = Router();

// Security: Validate Session ID format to prevent injection attacks
router.use((req, res, next) => {
  const sessionId = req.headers['x-session-id'];
  if (sessionId && (sessionId.length > 50 || !/^[a-zA-Z0-9_-]+$/.test(sessionId))) {
    return res.status(400).json({ error: "Invalid Session ID format" });
  }
  next();
});

// Configure multer for PDF uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.resolve("./uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Preserve original filename with timestamp and sessionId prefix to avoid collisions
    const sessionId = req.headers['x-session-id'] || 'anonymous';
    const timestamp = Date.now();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${sessionId}-${timestamp}-${safeName}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed"), false);
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB per file
  },
});

// In-memory tracking of uploaded documents per session
const uploadedDocumentsMap = new Map();

/**
 * POST /api/upload
 * Upload up to 2 PDF files, process them, and index into the vector store.
 */
router.post("/", upload.array("files", 2), async (req, res) => {
  try {
    const sessionId = req.headers['x-session-id'];
    if (!sessionId) {
      // Clean up newly uploaded files
      req.files?.forEach((f) => {
        if (fs.existsSync(f.path)) fs.unlinkSync(f.path);
      });
      return res.status(400).json({ error: "Session ID is required in headers" });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No PDF files were uploaded" });
    }

    const uploadedDocuments = uploadedDocumentsMap.get(sessionId) || [];

    // Check total document limit (including previously uploaded)
    const totalDocs = uploadedDocuments.length + req.files.length;
    if (totalDocs > 2) {
      // Clean up newly uploaded files
      req.files.forEach((f) => {
        if (fs.existsSync(f.path)) fs.unlinkSync(f.path);
      });
      return res.status(400).json({
        error: `Maximum 2 documents allowed. You already have ${uploadedDocuments.length} uploaded. Please clear existing documents first.`,
      });
    }

    const filePaths = req.files.map((f) => f.path);

    console.log(`\n📤 Uploading ${req.files.length} file(s)...`);

    // Process PDFs: extract text and split into chunks
    const chunks = await processDocuments(filePaths);

    // Index chunks into FAISS vector store for this session
    await addDocuments(chunks, sessionId);

    // Track uploaded documents
    const newDocs = [];
    for (let i = 0; i < req.files.length; i++) {
      const f = req.files[i];
      const docChunks = chunks.filter((c) => c.metadata.documentName === f.originalname);
      
      let brief = null;
      if (docChunks.length > 0) {
         console.log(`🧠 Generating brief for ${f.originalname}...`);
         brief = await generateDocumentBrief(docChunks);
      }

      newDocs.push({
        id: `doc-${Date.now()}-${i}`,
        name: f.originalname,
        size: f.size,
        path: f.path,
        uploadedAt: new Date().toISOString(),
        chunkCount: docChunks.length,
        brief: brief,
      });
    }

    uploadedDocuments.push(...newDocs);
    uploadedDocumentsMap.set(sessionId, uploadedDocuments);

    res.json({
      message: `Successfully processed ${req.files.length} document(s)`,
      documents: newDocs.map((d) => ({
        id: d.id,
        name: d.name,
        size: d.size,
        chunkCount: d.chunkCount,
        uploadedAt: d.uploadedAt,
        brief: d.brief,
      })),
      totalDocuments: uploadedDocuments.length,
      totalChunks: chunks.length,
    });
  } catch (err) {
    console.error("❌ Upload error:", err);
    res.status(500).json({ error: err.message || "Failed to process PDFs" });
  }
});

/**
 * GET /api/upload/status
 * Returns current upload status and document info.
 */
router.get("/status", (req, res) => {
  const sessionId = req.headers['x-session-id'];
  const uploadedDocuments = sessionId ? (uploadedDocumentsMap.get(sessionId) || []) : [];
  
  res.json({
    ready: sessionId ? isReady(sessionId) : false,
    documents: uploadedDocuments.map((d) => ({
      id: d.id,
      name: d.name,
      size: d.size,
      chunkCount: d.chunkCount,
      uploadedAt: d.uploadedAt,
    })),
    totalDocuments: uploadedDocuments.length,
    maxDocuments: 2,
  });
});

/**
 * DELETE /api/upload
 * Clear all uploaded documents and the vector store for the session.
 */
router.delete("/", async (req, res) => {
  try {
    const sessionId = req.headers['x-session-id'];
    if (!sessionId) {
      return res.status(400).json({ error: "Session ID is required" });
    }

    // Clear vector store for session
    await clear(sessionId);

    // Delete uploaded files from disk for this session
    const uploadDir = path.resolve("./uploads");
    if (fs.existsSync(uploadDir)) {
      const files = fs.readdirSync(uploadDir);
      files.forEach((file) => {
        if (file.startsWith(`${sessionId}-`)) {
          const filePath = path.join(uploadDir, file);
          fs.unlinkSync(filePath);
        }
      });
    }

    uploadedDocumentsMap.delete(sessionId);

    res.json({ message: "All documents cleared successfully" });
  } catch (err) {
    console.error("❌ Clear error:", err);
    res.status(500).json({ error: "Failed to clear documents" });
  }
});

export default router;
