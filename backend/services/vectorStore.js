import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import path from "path";
import fs from "fs";

const vectorStores = new Map();
let embeddings = null;
const rawChunksMap = new Map(); // Store raw chunks per session for hybrid search

/**
 * Get or create the embeddings instance.
 */
function getEmbeddings() {
  if (!embeddings) {
    embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: process.env.GOOGLE_API_KEY,
      modelName: "gemini-embedding-001",
    });
  }
  return embeddings;
}

/**
 * Add document chunks to the vector store.
 * Creates a new store if none exists, or adds to existing.
 */
export async function addDocuments(chunks, sessionId) {
  if (!sessionId) throw new Error("Session ID is required for vector store");
  const emb = getEmbeddings();

  try {
    let vectorStore = vectorStores.get(sessionId);
    if (!vectorStore) {
      console.log(`🔨 Creating new vector store for session ${sessionId}...`);
      vectorStore = await MemoryVectorStore.fromDocuments(chunks, emb);
      vectorStores.set(sessionId, vectorStore);
    } else {
      console.log(`➕ Adding documents to existing vector store for session ${sessionId}...`);
      await vectorStore.addDocuments(chunks);
    }
    
    if (!rawChunksMap.has(sessionId)) {
      rawChunksMap.set(sessionId, []);
    }
    rawChunksMap.get(sessionId).push(...chunks);
    
    console.log(`✅ Vector store ready for session ${sessionId} with documents indexed`);
  } catch (err) {
    console.error("❌ Vector store error:", err.message);
    console.error("   Full error:", err);
    throw new Error(`Failed to create embeddings: ${err.message}. Check your GOOGLE_API_KEY.`);
  }
}

function keywordSearch(query, chunks, k = 4) {
  const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  if (queryTerms.length === 0) return [];

  const scoredChunks = chunks.map(chunk => {
    const content = chunk.pageContent.toLowerCase();
    let score = 0;
    
    // Boost for exact full phrase match
    if (content.includes(query.toLowerCase())) {
        score += 100;
    }
    
    queryTerms.forEach(term => {
      // Basic term frequency
      const regex = new RegExp(`\\b${term}\\b`, 'g');
      const matches = content.match(regex);
      if (matches) {
        score += matches.length * 10;
      } else if (content.includes(term)) {
        score += 5; // Partial match
      }
    });
    return { chunk, score };
  });

  scoredChunks.sort((a, b) => b.score - a.score);
  return scoredChunks.filter(c => c.score > 0).slice(0, k).map(c => c.chunk);
}

/**
 * Perform hybrid search against the vector store and raw chunks.
 * Returns the top-K most relevant document chunks.
 */
export async function search(query, k = 4, sessionId) {
  if (!sessionId) throw new Error("Session ID is required for search");
  
  const vectorStore = vectorStores.get(sessionId);
  if (!vectorStore) {
    throw new Error("No documents have been indexed yet. Please upload PDFs first.");
  }

  // Semantic search
  const semanticResults = await vectorStore.similaritySearch(query, k);
  
  // Keyword search
  const rawChunks = rawChunksMap.get(sessionId) || [];
  const keywordResults = keywordSearch(query, rawChunks, k);

  // Combine and deduplicate
  const combined = [...keywordResults, ...semanticResults];
  const uniqueChunks = [];
  const seenContent = new Set();
  
  for (const chunk of combined) {
    if (!seenContent.has(chunk.pageContent)) {
      seenContent.add(chunk.pageContent);
      uniqueChunks.push(chunk);
    }
    if (uniqueChunks.length >= k) break;
  }

  return uniqueChunks;
}

/**
 * Clear the vector store.
 */
export async function clear(sessionId) {
  if (!sessionId) return;
  vectorStores.delete(sessionId);
  rawChunksMap.delete(sessionId);
  console.log(`🗑️  Vector store cleared for session ${sessionId}`);
}

/**
 * Try to load from disk (no-op for MemoryVectorStore).
 */
export async function loadFromDisk() {
  return false;
}

/**
 * Check if the vector store has been initialized with documents.
 */
export function isReady(sessionId) {
  if (!sessionId) return false;
  return vectorStores.has(sessionId);
}
