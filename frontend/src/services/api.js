const API_BASE = "/api";

// Generate or retrieve session ID
function getSessionId() {
  let sessionId = localStorage.getItem('documind_user_id');
  if (!sessionId) {
    sessionId = 'user_' + Date.now() + '_' + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('documind_user_id', sessionId);
  }
  return sessionId;
}

/**
 * Upload PDF files to the backend.
 * @param {File[]} files - Array of File objects to upload
 * @returns {Promise<object>} Upload response with document metadata
 */
export async function uploadFiles(files) {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append("files", file);
  });

  const response = await fetch(`${API_BASE}/upload`, {
    method: "POST",
    headers: {
      "x-session-id": getSessionId(),
    },
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Failed to upload files");
  }

  return data;
}

/**
 * Ask a question about the uploaded documents and stream the response.
 * @param {string} question - The user's question
 * @param {Array} history - Previous messages for context
 * @param {function} onStream - Callback for stream updates (content, type)
 * @returns {Promise<object>} Final Answer with sources
 */
export async function askQuestionStream(question, history, onStream) {
  const response = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "x-session-id": getSessionId()
    },
    body: JSON.stringify({ question, history }),
  });

  if (!response.ok) {
    let errorMsg = "Failed to get answer";
    try {
      const errData = await response.json();
      errorMsg = errData.error || errorMsg;
    } catch (e) {}
    throw new Error(errorMsg);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let sources = [];
  let fullAnswer = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    
    // Process complete SSE messages
    let newlineIndex;
    while ((newlineIndex = buffer.indexOf('\n\n')) >= 0) {
      const message = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 2);
      
      const lines = message.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const dataStr = line.slice(6).trim();
          if (!dataStr) continue;

          try {
            const data = JSON.parse(dataStr);
            if (data.type === 'metadata') {
              sources = data.sources;
              onStream({ type: 'metadata', sources: data.sources });
            } else if (data.type === 'chunk') {
              fullAnswer += data.content;
              onStream({ type: 'chunk', content: data.content });
            } else if (data.type === 'error') {
              throw new Error(data.error);
            }
          } catch (e) {
            console.error("Error parsing SSE chunk:", e, dataStr);
          }
        }
      }
    }
  }

  return { answer: fullAnswer, sources };
}

/**
 * Clear all uploaded documents and reset the vector store.
 * @returns {Promise<object>} Confirmation message
 */
export async function clearDocuments() {
  const response = await fetch(`${API_BASE}/upload`, {
    method: "DELETE",
    headers: {
      "x-session-id": getSessionId()
    }
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Failed to clear documents");
  }

  return data;
}

/**
 * Get current upload status and document info.
 * @returns {Promise<object>} Status object
 */
export async function getStatus() {
  const response = await fetch(`${API_BASE}/upload/status`, {
    headers: {
      "x-session-id": getSessionId()
    }
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Failed to get status");
  }

  return data;
}

/**
 * Transcribe an audio blob using the backend Whisper endpoint.
 * @param {Blob} audioBlob - The audio recording
 * @returns {Promise<string>} Transcribed text
 */
export async function transcribeAudio(audioBlob) {
  const formData = new FormData();
  formData.append("audio", audioBlob, "recording.webm");

  const response = await fetch(`${API_BASE}/transcribe`, {
    method: "POST",
    headers: {
      "x-session-id": getSessionId()
    },
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Failed to transcribe audio");
  }

  return data.text;
}
