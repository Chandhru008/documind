import { useState } from 'react';
import { FileText, X, ChevronDown, ChevronUp } from 'lucide-react';

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export default function DocumentCard({ document, onRemove }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="document-card" id={`doc-card-${document.id}`}>
      <div className="doc-main-row" style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
        <div className="doc-icon">
          <FileText />
        </div>
        <div className="doc-info" style={{ flex: 1, minWidth: 0 }}>
          <div className="doc-name" title={document.name} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {document.name}
          </div>
          <div className="doc-meta">
            <span>{formatFileSize(document.size)}</span>
            {document.chunkCount && (
              <span>{document.chunkCount} chunks</span>
            )}
          </div>
        </div>
        {document.brief && (
          <button 
            onClick={() => setExpanded(!expanded)} 
            style={{ background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer', padding: '4px', marginLeft: '4px' }}
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        )}
        {onRemove && (
          <button
            className="doc-remove"
            onClick={() => onRemove(document.id)}
            title="Remove document"
            id={`remove-doc-${document.id}`}
            style={{ marginLeft: '4px' }}
          >
            <X size={16} />
          </button>
        )}
      </div>

      {expanded && document.brief && (
        <div className="doc-brief" style={{ marginTop: '12px', padding: '10px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '6px', fontSize: '12px', color: '#e4e4e7' }}>
          <strong>Summary:</strong>
          <p style={{ marginTop: '4px', marginBottom: '8px', lineHeight: '1.4' }}>{document.brief.summary}</p>
          
          <strong>Topics:</strong>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px', marginBottom: '8px' }}>
            {document.brief.topics?.map((topic, i) => (
              <span key={i} style={{ backgroundColor: 'rgba(139, 92, 246, 0.2)', color: '#c4b5fd', padding: '2px 6px', borderRadius: '4px', fontSize: '10px' }}>
                {topic}
              </span>
            ))}
          </div>

          <strong>Suggested Questions:</strong>
          <ul style={{ marginTop: '4px', paddingLeft: '16px', margin: '0' }}>
            {document.brief.questions?.map((q, i) => (
              <li key={i} style={{ color: '#a1a1aa' }}>{q}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
