@echo off
echo Starting RAG Backend Server...
start cmd /k "cd backend && npm run dev"

echo Starting RAG Frontend Server...
start cmd /k "cd frontend && npm run dev"

echo Applications are starting in separate windows.
