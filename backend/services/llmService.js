import { ChatGroq } from "@langchain/groq";
import { HumanMessage, SystemMessage, AIMessage } from "@langchain/core/messages";

let llm = null;

/**
 * Get or create the Groq LLM instance.
 */
function getLLM() {
  if (!llm) {
    llm = new ChatGroq({
      apiKey: process.env.GROQ_API_KEY,
      model: "llama-3.1-8b-instant",
      temperature: 0.3,
      maxTokens: 2048,
    });
  }
  return llm;
}

/**
 * Generate a streaming answer using the RAG pipeline.
 * Takes the user's question, relevant document chunks, and chat history.
 */
export async function generateAnswerStream(question, relevantChunks, history = []) {
  const model = getLLM();

  // Helper to format document names (strip sessionId and timestamp prefix)
  const formatDocName = (name) => name ? name.replace(/^[^-]+-\d+-/, '') : "Unknown";

  // Build context string from retrieved chunks
  const context = relevantChunks
    .map((chunk) => {
      const source = formatDocName(chunk.metadata.documentName);
      const page = chunk.metadata.loc?.pageNumber || "N/A";
      return `--- START SOURCE: ${source} (Page ${page}) ---\n${chunk.pageContent}\n--- END SOURCE ---`;
    })
    .join("\n\n");

  // Build source references for the response metadata
  const sources = relevantChunks.map((chunk, i) => ({
    index: i + 1,
    document: formatDocName(chunk.metadata.documentName),
    page: chunk.metadata.loc?.pageNumber || null,
    preview: chunk.pageContent.substring(0, 150) + "...",
  }));

  const systemPrompt = `You are a highly knowledgeable AI assistant specialized in answering questions based on provided document context.

INSTRUCTIONS:
1. Provide highly detailed, user-friendly, and engaging answers.
2. Structure your response using clear markdown: use bold text to highlight key concepts, bullet points for lists, and short paragraphs for readability.
3. Answer the user's question using ONLY the context provided below. If the answer is not in the context, honestly say: "I couldn't find information about that in the uploaded documents."
4. INLINE CITATIONS: Immediately after stating a fact derived from the text, you MUST cite it inline using the format [Filename, p. PageNumber].
5. CROSS-DOCUMENT COMPARISON: If the user asks to compare documents, explicitly organize your answer into clear Markdown tables or bulleted side-by-side sections.
6. CONFIDENCE SCORE: At the very end of your response, evaluate your confidence in the answer based solely on how well the context supports it. Append an XML tag like <confidence>XX</confidence> where XX is an integer from 0 to 100.

CONTEXT FROM UPLOADED DOCUMENTS:
${context}`;

  const messages = [
    new SystemMessage(systemPrompt),
  ];

  // Append history (limit to last 5 turns to save context window)
  const recentHistory = history.slice(-5);
  for (const turn of recentHistory) {
    if (turn.role === 'user') messages.push(new HumanMessage(turn.content));
    else if (turn.role === 'assistant') messages.push(new AIMessage(turn.content));
  }

  messages.push(new HumanMessage(question));

  const stream = await model.stream(messages);
  
  return { stream, sources };
}

/**
 * Analyzes a document and generates a brief summary, topics, and suggested questions.
 */
export async function generateDocumentBrief(chunks) {
  const model = getLLM();
  // Take first 3 chunks to get a sense of the document
  const sampleText = chunks.slice(0, 3).map(c => c.pageContent).join("\n\n");
  
  const prompt = `Analyze the following document text and provide a JSON response with exactly three fields:
- "summary": A concise 2-sentence summary of the document.
- "topics": An array of 4 key topics or keywords.
- "questions": An array of 4 suggested questions that a user could ask about this document.

DOCUMENT TEXT:
${sampleText}

Respond ONLY with the raw JSON object. Do not include markdown formatting or backticks.`;

  try {
    const response = await model.invoke([new HumanMessage(prompt)]);
    let content = response.content.trim();
    if (content.startsWith("\`\`\`json")) {
      content = content.replace(/\`\`\`json/g, "").replace(/\`\`\`/g, "").trim();
    } else if (content.startsWith("\`\`\`")) {
      content = content.replace(/\`\`\`/g, "").trim();
    }
    return JSON.parse(content);
  } catch (err) {
    console.error("Failed to generate brief:", err);
    return null;
  }
}
