import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { User, Sparkles, FileText, ChevronDown, ChevronUp, MessageSquare, Volume2, VolumeX } from 'lucide-react';
import Loader from './Loader';

function SourceChips({ sources }) {
  const [expandedSource, setExpandedSource] = useState(null);

  if (!sources || sources.length === 0) return null;

  const formatDocName = (name) => {
    if (!name) return '';
    return name.replace(/^[^-]+-\d+-/, '');
  };

  return (
    <div>
      <div className="message-sources">
        {sources.map((source, i) => (
          <button
            key={i}
            className="source-chip"
            onClick={() =>
              setExpandedSource(expandedSource === i ? null : i)
            }
          >
            <FileText />
            {formatDocName(source.document)}
            {source.page && ` · p.${source.page}`}
            {expandedSource === i ? (
              <ChevronUp size={10} />
            ) : (
              <ChevronDown size={10} />
            )}
          </button>
        ))}
      </div>
      {expandedSource !== null && sources[expandedSource] && (
        <div className="source-detail">
          <strong>
            {formatDocName(sources[expandedSource].document)}
            {sources[expandedSource].page &&
              ` — Page ${sources[expandedSource].page}`}
          </strong>
          <p style={{ marginTop: '6px' }}>
            {sources[expandedSource].preview}
          </p>
        </div>
      )}
    </div>
  );
}

export default function ChatWindow({ messages, isLoading, onSuggestionClick }) {
  const bottomRef = useRef(null);
  const [speakingIndex, setSpeakingIndex] = useState(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    return () => window.speechSynthesis.cancel();
  }, []);

  const handleSpeak = (text, index) => {
    if (speakingIndex === index) {
      window.speechSynthesis.cancel();
      setSpeakingIndex(null);
      return;
    }

    window.speechSynthesis.cancel();
    const textToSpeak = text.replace(/[#*`_\[\]]/g, '').trim();
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.onend = () => setSpeakingIndex(null);
    utterance.onerror = () => setSpeakingIndex(null);
    setSpeakingIndex(index);
    window.speechSynthesis.speak(utterance);
  };

  const suggestions = [
    'Summarize the key points',
    'What are the main differences?',
    'Explain the methodology',
    'List important findings',
  ];

  // Empty state when no messages
  if (messages.length === 0 && !isLoading) {
    return (
      <div className="chat-window" id="chat-window">
        <div className="chat-empty">
          <div className="chat-empty-icon">
            <MessageSquare />
          </div>
          <h3>Ask anything about your documents</h3>
          <p>
            Upload your PDF files and start asking questions. I'll find the most
            relevant information and give you accurate, context-aware answers.
          </p>
          {onSuggestionClick && (
            <div className="chat-empty-suggestions">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  className="suggestion-chip"
                  onClick={() => onSuggestionClick(s)}
                  id={`suggestion-${i}`}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  const parseContent = (content) => {
    if (typeof content !== 'string') return { cleanContent: content, confidence: null };
    let cleanContent = content;
    let confidence = null;
    const match = content.match(/<confidence>(\d+)<\/confidence>/i);
    if (match) {
      confidence = match[1];
      cleanContent = content.replace(match[0], '');
    }
    return { cleanContent, confidence };
  };

  return (
    <div className="chat-window" id="chat-window">
      {messages.map((msg, index) => {
        const { cleanContent, confidence } = parseContent(msg.content);
        return (
          <div
            key={index}
            className={`message ${msg.role}`}
            id={`message-${index}`}
          >
            <div
              className={`message-avatar ${
                msg.role === 'user' ? 'user-avatar' : 'ai-avatar'
              }`}
            >
              {msg.role === 'user' ? (
                <User size={18} />
              ) : (
                <Sparkles size={18} />
              )}
            </div>
            <div>
              <div className="message-content">
                {msg.role === 'assistant' ? (
                  <>
                    <ReactMarkdown>{cleanContent}</ReactMarkdown>
                    {confidence && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                        <div className="confidence-badge" style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: '600',
                          backgroundColor: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          color: parseInt(confidence) > 75 ? '#4ade80' : parseInt(confidence) > 50 ? '#fbbf24' : '#f87171'
                        }} title="AI confidence score based on uploaded context">
                          Confidence: {confidence}%
                        </div>
                        <button 
                          onClick={() => handleSpeak(cleanContent, index)}
                          style={{
                            background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255,255,255,0.1)',
                            color: speakingIndex === index ? '#c084fc' : '#a1a1aa', borderRadius: '4px',
                            padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center'
                          }}
                          title={speakingIndex === index ? "Stop speaking" : "Read aloud"}
                        >
                          {speakingIndex === index ? <VolumeX size={14} /> : <Volume2 size={14} />}
                        </button>
                      </div>
                    )}
                    {/* Fallback if no confidence score but still want to speak */}
                    {!confidence && cleanContent && (
                        <button 
                          onClick={() => handleSpeak(cleanContent, index)}
                          style={{
                            marginTop: '8px',
                            background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255,255,255,0.1)',
                            color: speakingIndex === index ? '#c084fc' : '#a1a1aa', borderRadius: '4px',
                            padding: '4px 8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center'
                          }}
                          title={speakingIndex === index ? "Stop speaking" : "Read aloud"}
                        >
                          {speakingIndex === index ? <VolumeX size={14} /> : <Volume2 size={14} />}
                        </button>
                    )}
                  </>
                ) : (
                  msg.content
                )}
              </div>
            {msg.role === 'assistant' && msg.sources && (
              <SourceChips sources={msg.sources} />
            )}
          </div>
        </div>
      );
      })}

      {isLoading && (
        <div className="message assistant" id="loading-message">
          <div className="message-avatar ai-avatar">
            <Sparkles size={18} />
          </div>
          <div className="message-content">
            <Loader text="Searching documents and generating answer..." />
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
