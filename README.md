# DocuMind 🧠
### AI-Powered PDF Intelligence

Upload any two PDF documents and ask questions in natural language. DocuMind finds the most relevant content using semantic search and delivers accurate, cited answers powered by AI.

## 🔗 Live Demo
[documind-plum.vercel.app](https://documind-plum.vercel.app)

## ✨ Features
- 📄 Upload & analyze up to 2 PDF documents
- 💬 Natural language Q&A across both documents
- 📍 Inline citations with page numbers
- 📊 Confidence score per answer
- 🎤 Voice input support
- 💾 Multi-turn conversation memory
- 🔄 Real-time streaming responses

## 🛠 Tech Stack
**Frontend:** React, Vite, TailwindCSS  
**Backend:** Node.js, Express.js  
**AI:** Google Gemini, Groq  
**Search:** FAISS vector store, semantic similarity  
**Deployment:** Vercel (frontend) + Render (backend)

## 🚀 Run Locally
```bash
# Backend
cd backend
npm install
node server.js

# Frontend
cd frontend
npm install
npm run dev
```

## 🔑 Environment Variables
```
GOOGLE_API_KEY=your_key
GROQ_API_KEY=your_key
PORT=3001
```
