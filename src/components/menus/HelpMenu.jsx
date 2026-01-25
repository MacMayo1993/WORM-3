import React from 'react';

const HelpMenu = ({ onClose }) => {
  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      height: '100dvh',
      background: 'rgba(245,241,232,0.92)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      backdropFilter: 'blur(4px)',
      padding: 'env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px) env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px)',
      boxSizing: 'border-box'
    }} onClick={onClose}>
      <div style={{
        background: '#fdfbf7',
        border: '2px solid #d4c5a9',
        borderRadius: '8px',
        padding: '32px',
        maxWidth: '600px',
        width: '90%',
        maxHeight: 'calc(100dvh - 60px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))',
        overflowY: 'auto',
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
        boxSizing: 'border-box'
      }} onClick={e => e.stopPropagation()}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px'
        }}>
          <h2 style={{
            margin: 0,
            fontSize: '28px',
            fontWeight: 600,
            color: '#6b4423',
            fontFamily: 'Georgia, serif'
          }}>How to Play</h2>
          <button onClick={onClose} style={{
            background: '#e8dcc8',
            border: '1px solid #d4c5a9',
            color: '#6b4423',
            fontSize: '24px',
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s'
          }}>×</button>
        </div>

        <div style={{ color: '#5a4a3a', lineHeight: 1.7, fontFamily: 'Georgia, serif' }}>
          <section style={{ marginBottom: '24px' }}>
            <h3 style={{ color: '#8b6f47', marginBottom: '12px', fontSize: '18px', fontWeight: 600 }}>🎮 Moving the Cube</h3>
            <div style={{ paddingLeft: '16px', fontSize: '14px' }}>
              <p style={{ margin: '8px 0' }}><strong>Drag normally:</strong> Rotates a slice (like a Rubik's Cube)</p>
              <p style={{ margin: '8px 0' }}><strong>Hold Shift + Drag:</strong> Twists the face itself</p>
              <p style={{ margin: '8px 0' }}><strong>Click a sticker:</strong> Flips it to its "opposite" color</p>
            </div>
          </section>

          <section style={{ marginBottom: '24px' }}>
            <h3 style={{ color: '#a67c52', marginBottom: '12px', fontSize: '18px', fontWeight: 600 }}>🌀 Special Features</h3>
            <div style={{ paddingLeft: '16px', fontSize: '14px' }}>
              <p style={{ margin: '8px 0' }}><strong>Tunnels:</strong> The colorful tunnels show connections between opposite points</p>
              <p style={{ margin: '8px 0' }}><strong>Flip Mode:</strong> Turn color flipping on or off</p>
              <p style={{ margin: '8px 0' }}><strong>Chaos Mode:</strong> Watch instability spread across the cube!</p>
            </div>
          </section>

          <section style={{ marginBottom: '24px' }}>
            <h3 style={{ color: '#c19a6b', marginBottom: '12px', fontSize: '18px', fontWeight: 600 }}>👁️ Different Views</h3>
            <div style={{ paddingLeft: '16px', fontSize: '14px' }}>
              <p style={{ margin: '8px 0' }}><strong>Classic:</strong> The standard colorful cube</p>
              <p style={{ margin: '8px 0' }}><strong>Grid:</strong> Shows position labels (M1-001, etc.)</p>
              <p style={{ margin: '8px 0' }}><strong>Sudokube:</strong> Numbers instead of colors</p>
              <p style={{ margin: '8px 0' }}><strong>Wireframe:</strong> See-through edges with lights</p>
              <p style={{ margin: '8px 0' }}><strong>Explode:</strong> Spreads the cube apart to see all sides</p>
              <p style={{ margin: '8px 0' }}><strong>Tunnels:</strong> Hide or show the antipodal connections</p>
            </div>
          </section>

          <section style={{ marginBottom: '24px' }}>
            <h3 style={{ color: '#8b6f47', marginBottom: '12px', fontSize: '18px', fontWeight: 600 }}>📊 What the Numbers Mean</h3>
            <div style={{ paddingLeft: '16px', fontSize: '14px' }}>
              <p style={{ margin: '8px 0' }}><strong>M:</strong> How many moves you've made</p>
              <p style={{ margin: '8px 0' }}><strong>F:</strong> How many times you've flipped colors</p>
              <p style={{ margin: '8px 0' }}><strong>W:</strong> How many flipped pairs are currently active</p>
              <p style={{ margin: '8px 0' }}><strong>Instability Bar:</strong> Shows how chaotic things are getting!</p>
            </div>
          </section>

          <section style={{ marginBottom: '24px' }}>
            <h3 style={{ color: '#a67c52', marginBottom: '12px', fontSize: '18px', fontWeight: 600 }}>🎯 Speedcube Controls</h3>
            <div style={{ paddingLeft: '16px', fontSize: '14px' }}>
              <p style={{ margin: '8px 0' }}><strong>Arrow Keys</strong> — Move cursor to select a tile</p>
              <p style={{ margin: '8px 0' }}><strong>W / S</strong> — Rotate selected row up / down</p>
              <p style={{ margin: '8px 0' }}><strong>A / D</strong> — Rotate selected column left / right</p>
              <p style={{ margin: '8px 0' }}><strong>Q / E</strong> — Rotate face counter-clockwise / clockwise</p>
              <p style={{ margin: '8px 0' }}><strong>F</strong> — Flip the selected tile (antipodal)</p>
              <p style={{ margin: '8px 0', color: '#9b8b7a', fontStyle: 'italic' }}>Cursor appears when you use keyboard controls</p>
            </div>
          </section>

          <section>
            <h3 style={{ color: '#a67c52', marginBottom: '12px', fontSize: '18px', fontWeight: 600 }}>⌨️ Other Shortcuts</h3>
            <div style={{ paddingLeft: '16px', fontSize: '14px' }}>
              <p style={{ margin: '8px 0' }}><strong>H</strong> or <strong>?</strong> — Open/close this help menu</p>
              <p style={{ margin: '8px 0' }}><strong>Space</strong> — Shuffle the cube randomly</p>
              <p style={{ margin: '8px 0' }}><strong>R</strong> — Reset everything</p>
              <p style={{ margin: '8px 0' }}><strong>G</strong> — Toggle flip mode for mouse</p>
              <p style={{ margin: '8px 0' }}><strong>T</strong> — Show/hide tunnels</p>
              <p style={{ margin: '8px 0' }}><strong>X</strong> — Toggle explosion view</p>
              <p style={{ margin: '8px 0' }}><strong>V</strong> — Change view mode</p>
              <p style={{ margin: '8px 0' }}><strong>C</strong> — Turn chaos mode on/off</p>
              <p style={{ margin: '8px 0' }}><strong>Esc</strong> — Close menus / hide cursor</p>
            </div>
          </section>
        </div>

        <div style={{
          marginTop: '24px',
          padding: '16px',
          background: '#f9f5ed',
          borderRadius: '6px',
          fontSize: '14px',
          color: '#6b4423',
          fontStyle: 'italic',
          border: '2px solid #e8dcc8',
          fontFamily: 'Georgia, serif'
        }}>
          💡 <strong>What you're learning:</strong> This puzzle demonstrates a special kind of mathematical space
          where opposite points are treated as the same location. When you flip a color, you're creating a connection
          through this space – that's what the tunnels represent!
        </div>
      </div>
    </div>
  );
};

export default HelpMenu;
