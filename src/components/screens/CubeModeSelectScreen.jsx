import React from 'react';

const panelStyle = {
  position: 'fixed',
  inset: 0,
  zIndex: 9998,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '24px',
  background: 'rgba(15, 23, 42, 0.28)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  fontFamily: 'var(--ui-font, -apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif)',
};

const cardStyle = {
  width: 'min(760px, 100%)',
  borderRadius: '28px',
  padding: '28px',
  border: '1px solid rgba(15, 23, 42, 0.08)',
  background: 'rgba(255, 255, 255, 0.96)',
  boxShadow: '0 28px 64px rgba(15, 23, 42, 0.16), 0 4px 12px rgba(15, 23, 42, 0.08)',
  backdropFilter: 'blur(20px)',
  color: '#0f172a',
};

const optionGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
  gap: '16px',
  marginTop: '24px',
};

const optionButtonStyle = (accent) => ({
  textAlign: 'left',
  minHeight: '190px',
  borderRadius: '22px',
  padding: '22px',
  border: `1px solid ${accent}44`,
  background: `${accent}0D`,
  color: '#0f172a',
  cursor: 'pointer',
  boxShadow: `0 2px 12px ${accent}14`,
  transition: 'transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease, background 160ms ease',
});

const CubeModeSelectScreen = ({ onRubiks, onDisparity, onBack }) => (
  <div style={panelStyle} role="dialog" aria-modal="true" aria-labelledby="cube-mode-title">
    <section style={cardStyle}>
      <p style={{
        margin: '0 0 8px',
        color: 'rgba(15, 23, 42, 0.45)',
        fontSize: '12px',
        fontWeight: 800,
        letterSpacing: '0.24em',
        textTransform: 'uppercase',
      }}>
        Cube path
      </p>
      <h2 id="cube-mode-title" style={{ margin: 0, fontSize: 'clamp(2rem, 6vw, 3.4rem)', lineHeight: 0.95, letterSpacing: '-0.06em', color: '#0f172a' }}>
        Choose your cube mode
      </h2>
      <p style={{ margin: '14px 0 0', color: 'rgba(15, 23, 42, 0.60)', fontSize: '16px', lineHeight: 1.55 }}>
        Pick the ruleset first, then we'll send you into the matching setup wizard for cube size, palette, tiles, and start options.
      </p>

      <div style={optionGridStyle}>
        <button
          type="button"
          onClick={onRubiks}
          style={optionButtonStyle('#3b82f6')}
          onMouseEnter={(event) => {
            event.currentTarget.style.transform = 'translateY(-3px)';
            event.currentTarget.style.background = 'rgba(59,130,246,0.10)';
            event.currentTarget.style.borderColor = 'rgba(59,130,246,0.50)';
            event.currentTarget.style.boxShadow = '0 8px 28px rgba(59,130,246,0.18)';
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.transform = 'none';
            event.currentTarget.style.background = 'rgba(59,130,246,0.05)';
            event.currentTarget.style.borderColor = 'rgba(59,130,246,0.27)';
            event.currentTarget.style.boxShadow = '0 2px 12px rgba(59,130,246,0.08)';
          }}
        >
          <span style={{ display: 'block', fontSize: '34px', marginBottom: '14px' }}>🧩</span>
          <span style={{ display: 'block', fontSize: '22px', fontWeight: 900, letterSpacing: '-0.03em', color: '#1e40af' }}>Rubik's Mode</span>
          <span style={{ display: 'block', marginTop: '10px', color: 'rgba(15, 23, 42, 0.60)', lineHeight: 1.45 }}>
            Classic cube play with the freeplay setup wizard before shuffling into the board.
          </span>
        </button>

        <button
          type="button"
          onClick={onDisparity}
          style={optionButtonStyle('#f97316')}
          onMouseEnter={(event) => {
            event.currentTarget.style.transform = 'translateY(-3px)';
            event.currentTarget.style.background = 'rgba(249,115,22,0.10)';
            event.currentTarget.style.borderColor = 'rgba(249,115,22,0.50)';
            event.currentTarget.style.boxShadow = '0 8px 28px rgba(249,115,22,0.18)';
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.transform = 'none';
            event.currentTarget.style.background = 'rgba(249,115,22,0.05)';
            event.currentTarget.style.borderColor = 'rgba(249,115,22,0.27)';
            event.currentTarget.style.boxShadow = '0 2px 12px rgba(249,115,22,0.08)';
          }}
        >
          <span style={{ display: 'block', fontSize: '34px', marginBottom: '14px' }}>⚡</span>
          <span style={{ display: 'block', fontSize: '22px', fontWeight: 900, letterSpacing: '-0.03em', color: '#c2410c' }}>Disparity Mode</span>
          <span style={{ display: 'block', marginTop: '10px', color: 'rgba(15, 23, 42, 0.60)', lineHeight: 1.45 }}>
            Antipodal flip survival, betting, and chaos tuning through the disparity wizard.
          </span>
        </button>
      </div>

      <button
        type="button"
        onClick={onBack}
        style={{
          marginTop: '22px',
          border: '1px solid rgba(15, 23, 42, 0.12)',
          background: 'rgba(15, 23, 42, 0.05)',
          color: 'rgba(15, 23, 42, 0.65)',
          borderRadius: '999px',
          padding: '10px 18px',
          cursor: 'pointer',
          fontWeight: 600,
          fontSize: '14px',
          transition: 'background 0.15s ease, border-color 0.15s ease',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(15,23,42,0.09)'; e.currentTarget.style.borderColor = 'rgba(15,23,42,0.20)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(15,23,42,0.05)'; e.currentTarget.style.borderColor = 'rgba(15,23,42,0.12)'; }}
      >
        ← Back to opening screen
      </button>
    </section>
  </div>
);

export default CubeModeSelectScreen;
