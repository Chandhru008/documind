import { FileText } from 'lucide-react';

export default function Header({ documentCount, isReady }) {
  return (
    <header className="header" id="app-header">
      <div className="header-brand">
        <div className="header-logo" style={{ background: 'none', boxShadow: 'none', padding: 0 }}>
          <img src="/logo.png" alt="DocuMind Logo" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '8px' }} />
        </div>
        <div>
          <h1 className="header-title">DocuMind</h1>
          <p className="header-subtitle">AI-Powered PDF Intelligence</p>
        </div>
      </div>

      <div className={`header-status ${isReady ? 'ready' : ''}`}>
        <span className={`status-dot ${isReady ? 'active' : ''}`}></span>
        {isReady
          ? `${documentCount} document${documentCount !== 1 ? 's' : ''} loaded · Ready to chat`
          : 'Upload PDFs to get started'}
      </div>
    </header>
  );
}
