// src/worm/OrbInventoryHUD.jsx
// Displays the worm's current color orb inventory — used for tunnel healing

import React from 'react';

const isMobile = typeof window !== 'undefined' && (window.innerWidth <= 768 || 'ontouchstart' in window);

const FACE_ORDER = [1, 2, 3, 4, 5, 6];

export default function OrbInventoryHUD({ orbInventory, faceColors }) {
  if (!orbInventory || !faceColors) return null;

  const activeEntries = FACE_ORDER.filter(faceId => (orbInventory[faceId] ?? 0) > 0);
  if (activeEntries.length === 0) return null;

  return (
    <div style={styles.container}>
      <div style={styles.label}>ORBS</div>
      <div style={styles.row}>
        {activeEntries.map(faceId => {
          const count = orbInventory[faceId];
          const color = faceColors[faceId] ?? '#888888';
          const r = parseInt(color.slice(1, 3), 16);
          const g = parseInt(color.slice(3, 5), 16);
          const b = parseInt(color.slice(5, 7), 16);
          const isLight = (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.85;
          return (
            <div key={faceId} style={styles.entry}>
              <div
                style={{
                  ...styles.orb,
                  background: color,
                  boxShadow: `0 0 8px ${color}, 0 0 16px ${color}44`,
                  border: isLight ? '1px solid #888' : 'none',
                }}
              />
              <span style={{ ...styles.count, color }}>{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const styles = {
  container: {
    position: 'absolute',
    bottom: isMobile ? '70px' : '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    pointerEvents: 'none',
    zIndex: 101,
  },
  label: {
    fontSize: isMobile ? '8px' : '10px',
    color: '#666',
    letterSpacing: '0.12em',
    fontFamily: "'Courier New', monospace",
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: isMobile ? '8px' : '12px',
    padding: '6px 14px',
    background: 'rgba(0, 0, 0, 0.6)',
    borderRadius: '20px',
    border: '1px solid rgba(255,255,255,0.1)',
    backdropFilter: 'blur(4px)',
  },
  entry: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
  },
  orb: {
    width: isMobile ? '10px' : '12px',
    height: isMobile ? '10px' : '12px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  count: {
    fontSize: isMobile ? '13px' : '16px',
    fontWeight: 'bold',
    fontFamily: "'Courier New', monospace",
    textShadow: '0 0 8px currentColor',
    minWidth: '14px',
    textAlign: 'left',
  },
};
