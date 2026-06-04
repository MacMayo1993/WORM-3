import React from 'react';

const panelStyle = {
  position: 'fixed',
  inset: 0,
  zIndex: 9998,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '24px',
  background: 'rgba(8, 10, 22, 0.72)',
  backdropFilter: 'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)',
  fontFamily: 'var(--ui-font, -apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif)',
};

const cardStyle = {
  width: 'min(760px, 100%)',
  borderRadius: '28px',
  padding: '28px',
  border: '1px solid rgba(255, 255, 255, 0.06)',
  background: 'rgba(14, 17, 38, 0.94)',
  boxShadow: '0 32px 80px rgba(0,0,0,0.60), 0 0 0 1px rgba(255,255,255,0.06)',
  backdropFilter: 'blur(24px)',
  color: '#e8edf8',
};

const optionGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
  gap: '16px',
  marginTop: '24px',
};

const optionButtonStyle = (accent, accentHex) => ({
  textAlign: 'left',
  minHeight: '190px',
  borderRadius: '22px',
  padding: '22px',
  border: `1px solid ${accentHex}40`,
  background: 'rgba(255, 255, 255, 0.05)',
  color: '#e8edf8',
  cursor: 'pointer',
  boxShadow: `0 2px 12px ${accentHex}10`,
  transition: 'transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease, background 160ms ease',
});

const CubeModeSelectScreen = ({ onRubiks, onDisparity, onBack }) => (
  <div style={panelStyle} role="dialog" aria-modal="true" aria-labelledby="cube-mode-title">
    <section style={cardStyle}>
      <p style={{
        margin: '0 0 8px',
        color: 'rgba(180, 210, 255, 0.40)',
        fontSize: '12px',
        fontWeight: 800,
        letterSpacing: '0.24em',
        textTransform: 'uppercase',
      }}>
        Cube path
      </p>
      <h2 id="cube-mode-title" style={{ margin: 0, fontSize: 'clamp(2rem, 6vw, 3.4rem)', lineHeight: 0.95, letterSpacing: '-0.06em', color: '#e8edf8' }}>
        Choose your cube mode
      </h2>
      <p style={{ margin: '14px 0 0', color: 'rgba(200, 220, 255, 0.65)', fontSize: '16px', lineHeight: 1.55 }}>
        Pick the ruleset first, then we'll send you into the matching setup wizard for cube size, palette, tiles, and start options.
      </p>

      <div style={optionGridStyle}>
        <button
          type="button"
          onClick={onRubiks}
          style={optionButtonStyle('#3b82f6', '#1e88e5')}
          onMouseEnter={(event) => {
            event.currentTarget.style.transform = 'translateY(-3px)';
            event.currentTarget.style.background = 'rgba(30,136,229,0.18)';
            event.currentTarget.style.borderColor = 'rgba(30,136,229,0.55)';
            event.currentTarget.style.boxShadow = '0 8px 28px rgba(30,136,229,0.22)';
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.transform = 'none';
            event.currentTarget.style.background = 'rgba(255,255,255,0.05)';
            event.currentTarget.style.borderColor = 'rgba(30,136,229,0.25)';
            event.currentTarget.style.boxShadow = '0 2px 12px rgba(30,136,229,0.10)';
          }}
        >
          <span style={{ display: 'block', fontSize: '34px', marginBottom: '14px' }}>🧩</span>
          <span style={{ display: 'block', fontSize: '22px', fontWeight: 900, letterSpacing: '-0.03em', color: '#60a5fa' }}>Rubik's Mode</span>
          <span style={{ display: 'block', marginTop: '10px', color: 'rgba(200, 220, 255, 0.65)', lineHeight: 1.45 }}>
            Classic cube play with the freeplay setup wizard before shuffling into the board.
          </span>
        </button>

        <button
          type="button"
          onClick={onDisparity}
          style={optionButtonStyle('#f97316', '#f97316')}
          onMouseEnter={(event) => {
            event.currentTarget.style.transform = 'translateY(-3px)';
            event.currentTarget.style.background = 'rgba(249,115,22,0.18)';
            event.currentTarget.style.borderColor = 'rgba(249,115,22,0.55)';
            event.currentTarget.style.boxShadow = '0 8px 28px rgba(249,115,22,0.22)';
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.transform = 'none';
            event.currentTarget.style.background = 'rgba(255,255,255,0.05)';
            event.currentTarget.style.borderColor = 'rgba(249,115,22,0.25)';
            event.currentTarget.style.boxShadow = '0 2px 12px rgba(249,115,22,0.10)';
          }}
        >
          <span style={{ display: 'block', fontSize: '34px', marginBottom: '14px' }}>⚡</span>
          <span style={{ display: 'block', fontSize: '22px', fontWeight: 900, letterSpacing: '-0.03em', color: '#fb923c' }}>Disparity Mode</span>
          <span style={{ display: 'block', marginTop: '10px', color: 'rgba(200, 220, 255, 0.65)', lineHeight: 1.45 }}>
            Antipodal flip survival, betting, and chaos tuning through the disparity wizard.
          </span>
        </button>
      </div>

      <button
        type="button"
        onClick={onBack}
        style={{
          marginTop: '22px',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          background: 'rgba(255, 255, 255, 0.06)',
          color: 'rgba(200, 220, 255, 0.65)',
          borderRadius: '999px',
          padding: '10px 18px',
          cursor: 'pointer',
          fontWeight: 600,
          fontSize: '14px',
          transition: 'background 0.15s ease, border-color 0.15s ease',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.10)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.20)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; }}
      >
        ← Back to opening screen
      </button>
    </section>
  </div>
);

export default CubeModeSelectScreen;
