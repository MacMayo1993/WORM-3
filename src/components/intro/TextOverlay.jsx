import React, { useMemo } from 'react';

const TextOverlay = ({ time }) => {
  const messages = useMemo(() => {
    const msgs = [];

    if (time >= 3 && time < 10) {
      msgs.push({ text: 'Welcome to WORM^3!', fade: time >= 3 && time < 3.3 ? (time - 3) / 0.3 : 1 });
    }
    if (time >= 3.5 && time < 10) {
      msgs.push({ text: 'Discovering opposite pairs...', fade: time >= 3.5 && time < 3.8 ? (time - 3.5) / 0.3 : 1 });
    }
    if (time >= 6 && time < 10) {
      msgs.push({ text: 'Each color has a partner across the cube', fade: time >= 6 && time < 6.3 ? (time - 6) / 0.3 : 1 });
    }
    if (time >= 6.5 && time < 7.5) {
      msgs.push({ text: 'Red ↔ Orange', fade: time >= 6.5 && time < 6.8 ? (time - 6.5) / 0.3 : 1, color: '#ef4444' });
    }
    if (time >= 7.5 && time < 8.5) {
      msgs.push({ text: 'Blue ↔ Green', fade: time >= 7.5 && time < 7.8 ? (time - 7.5) / 0.3 : 1, color: '#3b82f6' });
    }
    if (time >= 8.5 && time < 9.5) {
      msgs.push({ text: 'Yellow ↔ White', fade: time >= 8.5 && time < 8.8 ? (time - 8.5) / 0.3 : 1, color: '#eab308' });
    }
    if (time >= 9.5) {
      msgs.push({ text: 'Ready to explore!', fade: time >= 9.5 && time < 9.8 ? (time - 9.5) / 0.3 : 1 });
    }

    return msgs;
  }, [time]);

  const showFinal = time >= 10;
  const finalFade = time >= 10 && time < 10.5 ? (time - 10) / 0.5 : time >= 10.5 ? 1 : 0;

  return (
    <div className="intro-text-overlay">
      <div className="intro-messages">
        {messages.map((msg, i) => (
          <div
            key={i}
            className="intro-message"
            style={{
              opacity: msg.fade,
              color: msg.color || 'rgba(255, 255, 255, 0.9)'
            }}
          >
            {msg.text}
          </div>
        ))}
      </div>

      {showFinal && (
        <div className="intro-final-card" style={{ opacity: finalFade }}>
          <div className="intro-title-box">
            <h1>WORM³</h1>
            <p>An Interactive Topology Puzzle</p>
          </div>
          <div className="intro-instructions">
            <p>Click any sticker to flip to its opposite color</p>
            <p>Drag to rotate and explore!</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default TextOverlay;
