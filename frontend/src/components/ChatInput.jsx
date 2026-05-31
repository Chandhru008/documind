import { useState, useRef, useEffect } from 'react';
import { Send, Mic, Square } from 'lucide-react';
import { transcribeAudio } from '../services/api';

export default function ChatInput({ onSend, isLoading, disabled }) {
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const textareaRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  const isDisabled = disabled || isLoading || isTranscribing;
  const canSend = input.trim().length > 0 && !isDisabled;

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }
  }, [input]);

  const handleSend = () => {
    if (!canSend) return;
    onSend(input.trim());
    setInput('');
    // Reset height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Expose a way for parent to set input (for suggestions)
  useEffect(() => {
    if (!disabled && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [disabled]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        
        try {
           setIsTranscribing(true);
           const text = await transcribeAudio(audioBlob);
           setInput((prev) => (prev ? prev + ' ' + text : text));
        } catch (err) {
           console.error("Transcription failed:", err);
           alert("Transcription failed: " + err.message);
        } finally {
           setIsTranscribing(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Could not access microphone. Please allow permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  return (
    <div className="chat-input-container" id="chat-input-container">
      <div className={`chat-input-wrapper ${isDisabled && !isRecording ? 'disabled' : ''}`}>
        <textarea
          ref={textareaRef}
          className="chat-input"
          id="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            disabled
              ? 'Upload PDF documents to start chatting...'
              : isRecording 
                ? 'Listening...' 
                : isTranscribing
                  ? 'Transcribing...'
                  : 'Ask a question or use the mic...'
          }
          disabled={isDisabled && !isRecording}
          rows={1}
        />
        
        {isRecording ? (
          <button
            className="chat-mic-btn recording"
            onClick={stopRecording}
            title="Stop recording"
            style={{ color: '#f43f5e', background: 'rgba(244, 63, 94, 0.1)', padding: '8px', borderRadius: '8px', border: 'none', cursor: 'pointer', marginRight: '6px', animation: 'pulse 1.5s infinite' }}
          >
            <Square size={16} fill="currentColor" />
          </button>
        ) : (
          <button
            className="chat-mic-btn"
            onClick={startRecording}
            disabled={disabled}
            title="Voice typing"
            style={{ color: '#a1a1aa', background: 'transparent', padding: '8px', borderRadius: '8px', border: 'none', cursor: 'pointer', marginRight: '6px', transition: 'color 0.2s' }}
            onMouseOver={(e) => e.currentTarget.style.color = '#c084fc'}
            onMouseOut={(e) => e.currentTarget.style.color = '#a1a1aa'}
          >
            <Mic size={18} />
          </button>
        )}

        <button
          className="chat-send-btn"
          id="chat-send-btn"
          onClick={handleSend}
          disabled={!canSend}
          title="Send message"
        >
          <Send />
        </button>
      </div>
      <p className="chat-input-hint">
        {isLoading
          ? 'Generating response...'
          : 'Press Enter to send · Shift+Enter for new line'}
      </p>
    </div>
  );
}
