import { Router } from "express";
import { search, isReady } from "../services/vectorStore.js";
import { generateAnswerStream } from "../services/llmService.js";

const router = Router();

// Security: Validate Session ID format to prevent injection attacks
router.use((req, res, next) => {
  const sessionId = req.headers['x-session-id'];
  if (sessionId && (sessionId.length > 50 || !/^[a-zA-Z0-9_-]+$/.test(sessionId))) {
    return res.status(400).json({ error: "Invalid Session ID format" });
  }
  next();
});

/**
 * POST /api/chat
 * Accept a question and optional history, retrieve relevant chunks, and stream an answer.
 */
router.post("/", async (req, res) => {
  try {
    const sessionId = req.headers['x-session-id'];
    const { question, history = [] } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: "Session ID is required" });
    }

    if (!question || typeof question !== "string" || question.trim().length === 0) {
      return res.status(400).json({ error: "Please provide a valid question" });
    }

    if (!isReady(sessionId)) {
      return res.status(400).json({
        error: "No documents have been uploaded yet. Please upload PDF files first.",
      });
    }

    // Set headers for Server-Sent Events (SSE)
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    // Disable buffering for nginx if it's there
    res.setHeader("X-Accel-Buffering", "no");

    console.log(`\n💬 Question: "${question}"`);
    console.log(`🕰️ History length: ${history.length}`);

    // Fast-path for simple greetings
    const normalizedQuestion = question.trim().toLowerCase().replace(/[^\w\s]/g, '').trim();
    const greetings = ["hello", "hi", "hey", "greetings", "good morning", "good afternoon", "good evening", "sup", "yo", "hi there", "hello there"];
    
    if (greetings.includes(normalizedQuestion)) {
      console.log(`👋 Intercepted greeting`);
      res.write(`data: ${JSON.stringify({ type: 'chunk', content: "Hi! Ask me anything about your documents." })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
      return res.end();
    }

    // Step 1: Retrieve relevant chunks via hybrid search
    const relevantChunks = await search(question.trim(), 4, sessionId);
    console.log(`🔍 Retrieved ${relevantChunks.length} relevant chunks`);

    // Step 2: Generate answer using LLM with retrieved context & history
    const { stream, sources } = await generateAnswerStream(question.trim(), relevantChunks, history);
    
    // Send initial metadata (sources)
    res.write(`data: ${JSON.stringify({ type: 'metadata', sources, chunksRetrieved: relevantChunks.length })}\n\n`);

    // Step 3: Stream the chunks
    for await (const chunk of stream) {
      if (chunk.content) {
        res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk.content })}\n\n`);
      }
    }
    
    // End the stream
    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();

    console.log(`✅ Streaming finished`);
  } catch (err) {
    console.error("❌ Chat error:", err);
    if (!res.headersSent) {
      res.status(500).json({
        error: err.message || "Failed to generate answer. Please try again.",
      });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', error: err.message })}\n\n`);
      res.end();
    }
  }
});

export default router;
