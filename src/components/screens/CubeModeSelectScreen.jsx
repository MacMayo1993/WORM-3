import React from 'react';
import {
  UI_FONT, PAPER_BACKDROP, PAPER_BACKDROP_BLUR, PAPER_SHEET, PAPER_SHEET_RAISED,
  PAPER_BORDER, PAPER_BORDER_SOFT, PAPER_TEXT, PAPER_TEXT_MUTED, PAPER_TEXT_FAINT,
  PAPER_BG_MUTED, PAPER_CARD_SHADOW, PAPER_SHADOW,
 Z } from '../../utils/uiTheme.js';

const panelStyle = {
  position: 'fixed',
  inset: 0,
  zIndex: Z.FULLSCREEN,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '24px',
  background: PAPER_BACKDROP,
  backdropFilter: PAPER_BACKDROP_BLUR,
  WebkitBackdropFilter: PAPER_BACKDROP_BLUR,
  fontFamily: UI_FONT,
  animation: 'modalBackdropIn 0.22s ease',
};

const cardStyle = {
  width: 'min(760px, 100%)',
  borderRadius: '20px',
  padding: '32px',
  border: `1px solid ${PAPER_BORDER}`,
  background: PAPER_SHEET,
  boxShadow: PAPER_SHADOW,
  color: PAPER_TEXT,
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
        color: PAPER_TEXT_FAINT,
        fontSize: '12px',
        fontWeight: 800,
        letterSpacing: '0.24em',
        textTransform: 'uppercase',
      }}>
        Cube path
      </p>
      <h2 id="cube-mode-title" style={{ margin: 0, fontSize: 'clamp(2rem, 6vw, 3.4rem)', lineHeight: 0.95, letterSpacing: '-0.06em', color: PAPER_TEXT }}>
        Choose your cube mode
      </h2>
      <p style={{ margin: '14px 0 0', color: PAPER_TEXT_MUTED, fontSize: '16px', lineHeight: 1.55 }}>
        Pick classic freeplay setup or the antipodal Disparity ruleset. The main CUBE tile now starts the progressive campaign.
      </p>

      <div style={optionGridStyle}>
        <button
          type="button"
          onClick={onRubiks}
          style={{
            ...optionButtonBase,
            border: `2px solid ${PAPER_BORDER_SOFT}`,
            background: PAPER_SHEET_RAISED,
            boxShadow: `0 4px 0 ${PAPER_CARD_SHADOW}, 0 6px 16px rgba(0,0,0,0.08)`,
            color: PAPER_TEXT,
          }}
          onMouseEnter={(event) => {
            event.currentTarget.style.border = '2px solid #1565C0';
            event.currentTarget.style.background = '#1565C012';
            event.currentTarget.style.boxShadow = 'inset 0 2px 6px rgba(0,0,0,0.08), 0 1px 0 rgba(255,255,255,0.6)';
            event.currentTarget.style.transform = 'translateY(2px)';
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.border = `2px solid ${PAPER_BORDER_SOFT}`;
            event.currentTarget.style.background = PAPER_SHEET_RAISED;
            event.currentTarget.style.boxShadow = `0 4px 0 ${PAPER_CARD_SHADOW}, 0 6px 16px rgba(0,0,0,0.08)`;
            event.currentTarget.style.transform = 'none';
          }}
        >
          <span style={{ display: 'block', fontSize: '22px', fontWeight: 900, letterSpacing: '-0.03em', color: '#1565C0' }}>Rubik's Mode</span>
          <span style={{ display: 'block', marginTop: '10px', color: PAPER_TEXT_MUTED, lineHeight: 1.45 }}>
            Classic cube play with the freeplay setup wizard before shuffling into the board.
          </span>
        </button>

        <button
          type="button"
          onClick={onDisparity}
          style={{
            ...optionButtonBase,
            border: `2px solid ${PAPER_BORDER_SOFT}`,
            background: PAPER_SHEET_RAISED,
            boxShadow: `0 4px 0 ${PAPER_CARD_SHADOW}, 0 6px 16px rgba(0,0,0,0.08)`,
            color: PAPER_TEXT,
          }}
          onMouseEnter={(event) => {
            event.currentTarget.style.border = '2px solid #C44B00';
            event.currentTarget.style.background = '#C44B0012';
            event.currentTarget.style.boxShadow = 'inset 0 2px 6px rgba(0,0,0,0.08), 0 1px 0 rgba(255,255,255,0.6)';
            event.currentTarget.style.transform = 'translateY(2px)';
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.border = `2px solid ${PAPER_BORDER_SOFT}`;
            event.currentTarget.style.background = PAPER_SHEET_RAISED;
            event.currentTarget.style.boxShadow = `0 4px 0 ${PAPER_CARD_SHADOW}, 0 6px 16px rgba(0,0,0,0.08)`;
            event.currentTarget.style.transform = 'none';
          }}
        >
          <span style={{ display: 'block', fontSize: '22px', fontWeight: 900, letterSpacing: '-0.03em', color: '#C44B00' }}>Disparity Mode</span>
          <span style={{ display: 'block', marginTop: '10px', color: PAPER_TEXT_MUTED, lineHeight: 1.45 }}>
            Antipodal flip survival, betting, and chaos tuning through the disparity wizard.
          </span>
        </button>
      </div>

      <button
        type="button"
        onClick={onBack}
        style={{
          marginTop: '22px',
          border: `1.5px solid ${PAPER_BORDER_SOFT}`,
          background: PAPER_BG_MUTED,
          color: PAPER_TEXT_MUTED,
          borderRadius: '999px',
          padding: '10px 18px',
          cursor: 'pointer',
          fontWeight: 600,
          fontSize: '14px',
          transition: 'all 0.15s ease',
          boxShadow: `0 2px 0 ${PAPER_CARD_SHADOW}`,
          fontFamily: 'inherit',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = '#e8e2d8'; e.currentTarget.style.color = PAPER_TEXT; }}
        onMouseLeave={e => { e.currentTarget.style.background = PAPER_BG_MUTED; e.currentTarget.style.color = PAPER_TEXT_MUTED; }}
      >
        ← Back to opening screen
      </button>
    </section>
  </div>
);

export default CubeModeSelectScreen;
