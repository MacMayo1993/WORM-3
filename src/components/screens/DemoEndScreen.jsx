import React from 'react';
import {
  UI_FONT, DISPLAY_FONT,
  GLASS_PANEL, GLASS_PANEL_BORDER, GLASS_TEXT, GLASS_TEXT_MUTED, GLASS_SHADOW,
} from '../../utils/uiTheme.js';

const DemoEndScreen = ({ onReplay, onFreeplay, onExit }) => {
  const btnBase = {
    display: 'block',
    width: '100%',
    maxWidth: 320,
    margin: '0 auto 12px',
    padding: '14px 0',
    border: 'none',
    borderRadius: 12,
    fontFamily: UI_FONT,
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    letterSpacing: '0.04em',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 12000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(2,3,10,0.88)',
      backdropFilter: 'blur(18px)',
      fontFamily: UI_FONT,
    }}>
      <div style={{
        background: GLASS_PANEL,
        border: `1px solid ${GLASS_PANEL_BORDER}`,
        borderRadius: 20,
        boxShadow: GLASS_SHADOW,
        padding: '48px 36px 36px',
        maxWidth: 420,
        width: '90vw',
        textAlign: 'center',
      }}>
        <h1 style={{
          fontFamily: DISPLAY_FONT,
          fontSize: 28,
          color: '#fff',
          margin: '0 0 8px',
          letterSpacing: '0.06em',
        }}>
          DEMO COMPLETE
        </h1>

        <p style={{
          color: GLASS_TEXT,
          fontSize: 14,
          lineHeight: 1.6,
          margin: '0 0 32px',
          maxWidth: 340,
          marginLeft: 'auto',
          marginRight: 'auto',
        }}>
          You found the first layer. The full game expands into campaign levels,
          advanced puzzle rules, WORM modes, chaos challenges, and more cosmetics.
        </p>

        <button
          type="button"
          onClick={onReplay}
          style={{
            ...btnBase,
            background: '#3b82f6',
            color: '#fff',
          }}
        >
          Replay Demo
        </button>

        <button
          type="button"
          onClick={onFreeplay}
          style={{
            ...btnBase,
            background: 'rgba(255,255,255,0.10)',
            color: GLASS_TEXT,
            border: `1px solid ${GLASS_PANEL_BORDER}`,
          }}
        >
          Freeplay Preview
        </button>

        <button
          type="button"
          onClick={onExit}
          style={{
            ...btnBase,
            background: 'transparent',
            color: GLASS_TEXT_MUTED,
            fontSize: 13,
            marginBottom: 0,
          }}
        >
          Back to Menu
        </button>
      </div>
    </div>
  );
};

export default DemoEndScreen;
