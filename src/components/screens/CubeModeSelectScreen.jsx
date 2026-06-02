import React from 'react';

const panelStyle = {
  position: 'fixed',
  inset: 0,
  zIndex: 9998,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '24px',
  background: 'radial-gradient(circle at 50% 35%, rgba(59,130,246,0.22), rgba(2,6,23,0.86) 48%, rgba(0,0,8,0.96) 100%)',
  backdropFilter: 'blur(18px)',
  WebkitBackdropFilter: 'blur(18px)',
  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif',
};

const cardStyle = {
  width: 'min(760px, 100%)',
  borderRadius: '28px',
  padding: '28px',
  border: '1px solid rgba(148, 163, 184, 0.28)',
  background: 'linear-gradient(180deg, rgba(15,23,42,0.88), rgba(2,6,23,0.94))',
  boxShadow: '0 32px 90px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.08)',
  color: '#f8fafc',
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
  border: `1px solid ${accent}88`,
  background: `linear-gradient(180deg, ${accent}28, rgba(15,23,42,0.72))`,
  color: '#f8fafc',
  cursor: 'pointer',
  boxShadow: `0 0 28px ${accent}20`,
  transition: 'transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease',
});

const CubeModeSelectScreen = ({ onRubiks, onDisparity, onBack }) => (
  <div style={panelStyle} role="dialog" aria-modal="true" aria-labelledby="cube-mode-title">
    <section style={cardStyle}>
      <p style={{
        margin: '0 0 8px',
        color: 'rgba(147,197,253,0.9)',
        fontSize: '12px',
        fontWeight: 800,
        letterSpacing: '0.24em',
        textTransform: 'uppercase',
      }}>
        Cube path
      </p>
      <h2 id="cube-mode-title" style={{ margin: 0, fontSize: 'clamp(2rem, 6vw, 3.4rem)', lineHeight: 0.95, letterSpacing: '-0.06em' }}>
        Choose your cube mode
      </h2>
      <p style={{ margin: '14px 0 0', color: 'rgba(226,232,240,0.72)', fontSize: '16px', lineHeight: 1.55 }}>
        Pick the ruleset first, then we’ll send you into the matching setup wizard for cube size, palette, tiles, and start options.
      </p>

      <div style={optionGridStyle}>
        <button
          type="button"
          onClick={onRubiks}
          style={optionButtonStyle('#3b82f6')}
          onMouseEnter={(event) => { event.currentTarget.style.transform = 'translateY(-3px)'; event.currentTarget.style.boxShadow = '0 0 38px rgba(59,130,246,0.32)'; }}
          onMouseLeave={(event) => { event.currentTarget.style.transform = 'none'; event.currentTarget.style.boxShadow = '0 0 28px rgba(59,130,246,0.13)'; }}
        >
          <span style={{ display: 'block', fontSize: '34px', marginBottom: '14px' }}>🧩</span>
          <span style={{ display: 'block', fontSize: '22px', fontWeight: 900, letterSpacing: '-0.03em' }}>Rubik’s Mode</span>
          <span style={{ display: 'block', marginTop: '10px', color: 'rgba(219,234,254,0.76)', lineHeight: 1.45 }}>
            Classic cube play with the freeplay setup wizard before shuffling into the board.
          </span>
        </button>

        <button
          type="button"
          onClick={onDisparity}
          style={optionButtonStyle('#f97316')}
          onMouseEnter={(event) => { event.currentTarget.style.transform = 'translateY(-3px)'; event.currentTarget.style.boxShadow = '0 0 38px rgba(249,115,22,0.32)'; }}
          onMouseLeave={(event) => { event.currentTarget.style.transform = 'none'; event.currentTarget.style.boxShadow = '0 0 28px rgba(249,115,22,0.13)'; }}
        >
          <span style={{ display: 'block', fontSize: '34px', marginBottom: '14px' }}>⚡</span>
          <span style={{ display: 'block', fontSize: '22px', fontWeight: 900, letterSpacing: '-0.03em' }}>Disparity Mode</span>
          <span style={{ display: 'block', marginTop: '10px', color: 'rgba(255,237,213,0.78)', lineHeight: 1.45 }}>
            Antipodal flip survival, betting, and chaos tuning through the disparity wizard.
          </span>
        </button>
      </div>

      <button
        type="button"
        onClick={onBack}
        style={{
          marginTop: '22px',
          border: '1px solid rgba(148,163,184,0.35)',
          background: 'rgba(15,23,42,0.62)',
          color: 'rgba(226,232,240,0.82)',
          borderRadius: '999px',
          padding: '10px 18px',
          cursor: 'pointer',
          fontWeight: 700,
        }}
      >
        ← Back to opening screen
      </button>
    </section>
  </div>
);

export default CubeModeSelectScreen;
