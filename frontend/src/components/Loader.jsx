export default function Loader({ text = 'Thinking...' }) {
  return (
    <div className="loader-container" id="ai-thinking-loader">
      <div className="thinking-dots">
        <div className="thinking-dot"></div>
        <div className="thinking-dot"></div>
        <div className="thinking-dot"></div>
      </div>
      <span className="loader-text">{text}</span>
    </div>
  );
}
