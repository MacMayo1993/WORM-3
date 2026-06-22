import React from 'react';

const panelStyle = {
  position: 'fixed',
  inset: 0,
  zIndex: 9998,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '24px',
  background: 'rgba(160,152,140,0.60)',
  backdropFilter: 'blur(18px)',
  WebkitBackdropFilter: 'blur(18px)',
  fontFamily: 'var(--ui-font, -apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif)',
  animation: 'modalBackdropIn 0.22s ease',
};

const cardStyle = {
  width: 'min(760px, 100%)',
  borderRadius: '20px',
  padding: '32px',
  border: '1px solid #cec8be',
  background: '#f5f0e8',
  boxShadow: '0 20px 56px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.10)',
  color: '#1e1612',
  animation: 'modalSheetIn 0.30s cubic-bezier(0.22, 1, 0.36, 1)',
};

const optionGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '16px',
  marginTop: '24px',
};

const optionButtonBase = {
  textAlign: 'left',
  minHeight: '190px',
  borderRadius: '16px',
  padding: '24px',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  outline: 'none',
  fontFamily: 'inherit',
};

const CubeModeSelectScreen = ({ onRubiks, onDisparity, onBack }) => (
  <div style={panelStyle} role="dialog" aria-modal="true" aria-labelledby="cube-mode-title">
    <section style={cardStyle}>
      <p style={{
        margin: '0 0 8px',
        color: '#9a8e82',
        fontSize: '12px',
        fontWeight: 800,
        letterSpacing: '0.24em',
        textTransform: 'uppercase',
      }}>
        Cube path
      </p>
      <h2 id="cube-mode-title" style={{ margin: 0, fontSize: 'clamp(2rem, 6vw, 3.4rem)', lineHeight: 0.95, letterSpacing: '-0.06em', color: '#1e1612' }}>
        Choose your cube mode
      </h2>
      <p style={{ margin: '14px 0 0', color: '#7a6e62', fontSize: '16px', lineHeight: 1.55 }}>
        Pick classic freeplay setup or the antipodal Disparity ruleset. The main CUBE tile now starts the progressive campaign.
      </p>

      <div style={optionGridStyle}>
        <button
          type="button"
          onClick={onRubiks}
          style={{
            ...optionButtonBase,
            border: '2px solid #d6d0c8',
            background: '#ffffff',
            boxShadow: '0 4px 0 #c4beb6, 0 6px 16px rgba(0,0,0,0.08)',
            color: '#1e1612',
          }}
          onMouseEnter={(event) => {
            event.currentTarget.style.border = '2px solid #1565C0';
            event.currentTarget.style.background = '#1565C012';
            event.currentTarget.style.boxShadow = 'inset 0 2px 6px rgba(0,0,0,0.08), 0 1px 0 rgba(255,255,255,0.6)';
            event.currentTarget.style.transform = 'translateY(2px)';
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.border = '2px solid #d6d0c8';
            event.currentTarget.style.background = '#ffffff';
            event.currentTarget.style.boxShadow = '0 4px 0 #c4beb6, 0 6px 16px rgba(0,0,0,0.08)';
            event.currentTarget.style.transform = 'none';
          }}
        >
          <span style={{ display: 'block', fontSize: '22px', fontWeight: 900, letterSpacing: '-0.03em', color: '#1565C0' }}>Rubik's Mode</span>
          <span style={{ display: 'block', marginTop: '10px', color: '#7a6e62', lineHeight: 1.45 }}>
            Classic cube play with the freeplay setup wizard before shuffling into the board.
          </span>
        </button>

        <button
          type="button"
          onClick={onDisparity}
          style={{
            ...optionButtonBase,
            border: '2px solid #d6d0c8',
            background: '#ffffff',
            boxShadow: '0 4px 0 #c4beb6, 0 6px 16px rgba(0,0,0,0.08)',
            color: '#1e1612',
          }}
          onMouseEnter={(event) => {
            event.currentTarget.style.border = '2px solid #C44B00';
            event.currentTarget.style.background = '#C44B0012';
            event.currentTarget.style.boxShadow = 'inset 0 2px 6px rgba(0,0,0,0.08), 0 1px 0 rgba(255,255,255,0.6)';
            event.currentTarget.style.transform = 'translateY(2px)';
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.border = '2px solid #d6d0c8';
            event.currentTarget.style.background = '#ffffff';
            event.currentTarget.style.boxShadow = '0 4px 0 #c4beb6, 0 6px 16px rgba(0,0,0,0.08)';
            event.currentTarget.style.transform = 'none';
          }}
        >
          <span style={{ display: 'block', fontSize: '22px', fontWeight: 900, letterSpacing: '-0.03em', color: '#C44B00' }}>Disparity Mode</span>
          <span style={{ display: 'block', marginTop: '10px', color: '#7a6e62', lineHeight: 1.45 }}>
            Antipodal flip survival, betting, and chaos tuning through the disparity wizard.
          </span>
        </button>
      </div>

      <button
        type="button"
        onClick={onBack}
        style={{
          marginTop: '22px',
          border: '1.5px solid #d6d0c8',
          background: '#f0ebe2',
          color: '#7a6e62',
          borderRadius: '999px',
          padding: '10px 18px',
          cursor: 'pointer',
          fontWeight: 600,
          fontSize: '14px',
          transition: 'all 0.15s ease',
          boxShadow: '0 2px 0 #c4beb6',
          fontFamily: 'inherit',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = '#e8e2d8'; e.currentTarget.style.color = '#1e1612'; }}
        onMouseLeave={e => { e.currentTarget.style.background = '#f0ebe2'; e.currentTarget.style.color = '#7a6e62'; }}
      >
        ← Back to opening screen
      </button>
    </section>
  </div>
);

export default CubeModeSelectScreen;
