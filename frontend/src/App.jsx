import { useState, useEffect, useCallback } from 'react';
import { Trash2, AlertCircle, CheckCircle, Plus, MessageSquare } from 'lucide-react';
import Header from './components/Header';
import FileUpload from './components/FileUpload';
import DocumentCard from './components/DocumentCard';
import ChatWindow from './components/ChatWindow';
import ChatInput from './components/ChatInput';
import { uploadFiles, askQuestionStream, clearDocuments, getStatus } from './services/api';

export default function App() {
  const [documents, setDocuments] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Initialize state only once
  const [initialState] = useState(() => {
    const newSessionId = `session_${Date.now()}`;
    const newSession = { id: newSessionId, title: 'New Chat', messages: [] };
    
    let parsedSessions = [];
    try {
      const saved = localStorage.getItem('documind_sessions');
      if (saved) {
        parsedSessions = JSON.parse(saved);
      }
    } catch (e) {
      // Ignore
    }
    
    // Filter out empty sessions to keep history clean
    parsedSessions = parsedSessions.filter(s => s.messages && s.messages.length > 0);
    
    return {
      sessions: [newSession, ...parsedSessions],
      activeSessionId: newSessionId
    };
  });

  const [sessions, setSessions] = useState(initialState.sessions);
  const [activeSessionId, setActiveSessionId] = useState(initialState.activeSessionId);

  const isReady = documents.length > 0;

  // Derive active session and its messages
  const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0] || { id: 'session_default', title: 'New Chat', messages: [] };
  const messages = activeSession.messages || [];

  // Sync sessions to localStorage
  useEffect(() => {
    localStorage.setItem('documind_sessions', JSON.stringify(sessions));
  }, [sessions]);

  // Sync activeSessionId to localStorage
  useEffect(() => {
    localStorage.setItem('documind_active_session', activeSessionId);
  }, [activeSessionId]);

  // Check initial documents status on mount
  useEffect(() => {
    async function checkStatus() {
      try {
        const status = await getStatus();
        if (status.documents && status.documents.length > 0) {
          setDocuments(status.documents);
        }
      } catch {
        // Server might not be running yet, that's ok
      }
    }
    checkStatus();
  }, []);

  // Auto-dismiss toast after 4 seconds
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const showToast = (message, type = 'error') => {
    setToast({ message, type });
  };

  // Create a new empty chat session
  const handleNewChat = useCallback(() => {
    const newSession = {
      id: `session_${Date.now()}`,
      title: 'New Chat',
      messages: [],
    };
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
  }, []);

  // Delete a chat session from history
  const handleDeleteSession = useCallback((sessionId, e) => {
    e.stopPropagation();
    
    setSessions((prev) => {
      const filtered = prev.filter((s) => s.id !== sessionId);
      
      // If we deleted all sessions, create a new blank one
      if (filtered.length === 0) {
        const defaultSession = { id: `session_${Date.now()}`, title: 'New Chat', messages: [] };
        setActiveSessionId(defaultSession.id);
        return [defaultSession];
      }
      
      // If we deleted the currently active session, select the next available one
      if (activeSessionId === sessionId) {
        const index = prev.findIndex((s) => s.id === sessionId);
        const nextActive = filtered[index] || filtered[index - 1] || filtered[0];
        setActiveSessionId(nextActive.id);
      }
      
      return filtered;
    });
  }, [activeSessionId]);

  // Handle file upload
  const handleUpload = useCallback(async (files) => {
    setIsUploading(true);
    try {
      const result = await uploadFiles(files);
      setDocuments((prev) => [...prev, ...result.documents]);
      showToast(result.message, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsUploading(false);
    }
  }, []);

  // Handle sending a message
  const handleSendMessage = useCallback(
    async (question) => {
      if (!isReady) return;

      const userMessage = { role: 'user', content: question };
      const aiMessageId = `ai_${Date.now()}`;
      
      // Get the current history before adding the new user message
      const historyToPass = sessions.find(s => s.id === activeSessionId)?.messages?.map(m => ({
        role: m.role,
        content: m.content
      })) || [];
      
      // Add user message to the active session and a placeholder AI message
      setSessions((prev) =>
        prev.map((session) => {
          if (session.id === activeSessionId) {
            const updatedMessages = [
              ...(session.messages || []), 
              userMessage, 
              { id: aiMessageId, role: 'assistant', content: '', sources: [] }
            ];
            const title = session.title === 'New Chat'
              ? question.substring(0, 24) + (question.length > 24 ? '...' : '')
              : session.title;
            return { ...session, title, messages: updatedMessages };
          }
          return session;
        })
      );
      
      setIsLoading(true);

      try {
        await askQuestionStream(question, historyToPass, (update) => {
          setSessions((prev) =>
            prev.map((session) => {
              if (session.id === activeSessionId) {
                const messages = [...(session.messages || [])];
                const aiIndex = messages.findIndex(m => m.id === aiMessageId);
                if (aiIndex >= 0) {
                  if (update.type === 'metadata') {
                    messages[aiIndex] = { ...messages[aiIndex], sources: update.sources };
                  } else if (update.type === 'chunk') {
                    messages[aiIndex] = { ...messages[aiIndex], content: messages[aiIndex].content + update.content };
                  }
                }
                return { ...session, messages };
              }
              return session;
            })
          );
        });
      } catch (err) {
        setSessions((prev) =>
          prev.map((session) => {
            if (session.id === activeSessionId) {
              const messages = [...(session.messages || [])];
              const aiIndex = messages.findIndex(m => m.id === aiMessageId);
              if (aiIndex >= 0) {
                 messages[aiIndex] = { 
                   ...messages[aiIndex], 
                   content: messages[aiIndex].content + `\n\n⚠️ Sorry, I encountered an error: ${err.message}` 
                 };
              }
              return { ...session, messages };
            }
            return session;
          })
        );
      } finally {
        setIsLoading(false);
      }
    },
    [isReady, activeSessionId, sessions]
  );

  // Handle suggestion click
  const handleSuggestionClick = useCallback(
    (suggestion) => {
      if (isReady) {
        handleSendMessage(suggestion);
      }
    },
    [isReady, handleSendMessage]
  );

  // Handle clearing all documents
  const handleClear = useCallback(async () => {
    try {
      await clearDocuments();
      setDocuments([]);
      
      // Clear all sessions and start with a single clean session
      const cleanSession = { id: `session_${Date.now()}`, title: 'New Chat', messages: [] };
      setSessions([cleanSession]);
      setActiveSessionId(cleanSession.id);
      
      showToast('All documents and chat history cleared', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }, []);

  return (
    <>
      <div className="app-background" />

      <div className="app-container" id="app-container">
        <Header 
          documentCount={documents.length} 
          isReady={isReady} 
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        />

        <main className="app-main">
          {/* Mobile Overlay */}
          {isSidebarOpen && (
            <div 
              className="mobile-overlay" 
              onClick={() => setIsSidebarOpen(false)}
            />
          )}

          {/* Sidebar */}
          <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`} id="sidebar">
            {/* Chat Sessions list */}
            <div className="sidebar-section chats-section">
              <button 
                className="new-chat-btn" 
                onClick={handleNewChat} 
                id="new-chat-btn"
                title="Start a new chat session"
              >
                <Plus size={14} />
                New Chat
              </button>
              
              <p className="sidebar-title" style={{ marginTop: '18px' }}>Recent Chats</p>
              
              <div className="sessions-list" id="sessions-list">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className={`session-item ${session.id === activeSessionId ? 'active' : ''}`}
                    onClick={() => setActiveSessionId(session.id)}
                    id={`session-item-${session.id}`}
                  >
                    <MessageSquare size={13} className="session-icon" />
                    <span className="session-title-text" title={session.title}>
                      {session.title}
                    </span>
                    <button
                      className="session-delete-btn"
                      onClick={(e) => handleDeleteSession(session.id, e)}
                      title="Delete chat session"
                      id={`delete-session-${session.id}`}
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="sidebar-divider" />

            {/* Document Upload section */}
            <div className="sidebar-section docs-section">
              <p className="sidebar-title">Upload Documents</p>
              <FileUpload
                onUpload={handleUpload}
                isUploading={isUploading}
                disabled={isUploading}
                documentCount={documents.length}
              />

              {documents.length > 0 && (
                <div style={{ marginTop: '16px' }}>
                  <p className="sidebar-title">
                    Loaded Documents ({documents.length}/2)
                  </p>
                  <div className="documents-list">
                    {documents.map((doc) => (
                      <DocumentCard key={doc.id} document={doc} />
                    ))}
                  </div>
                  <button
                    className="clear-btn"
                    onClick={handleClear}
                    id="clear-all-btn"
                    style={{ marginTop: '12px' }}
                  >
                    <Trash2
                      size={14}
                      style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }}
                    />
                    Clear All Documents
                  </button>
                </div>
              )}
            </div>
          </aside>

          {/* Chat Area */}
          <section className="chat-area" id="chat-area">
            <ChatWindow
              messages={messages}
              isLoading={isLoading}
              onSuggestionClick={isReady ? handleSuggestionClick : null}
            />
            <ChatInput
              onSend={handleSendMessage}
              isLoading={isLoading}
              disabled={!isReady}
            />
          </section>
        </main>
      </div>

      {/* Toast Notifications */}
      {toast && (
        <div className={`toast ${toast.type}`} id="toast-notification">
          {toast.type === 'error' ? (
            <AlertCircle size={18} />
          ) : (
            <CheckCircle size={18} />
          )}
          {toast.message}
        </div>
      )}
    </>
  );
}
