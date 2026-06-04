import React from 'react';

const Section = ({ title, children }) => (
  <section style={{ marginBottom: '24px' }}>
    <h3 style={{
      margin: '0 0 10px',
      fontSize: '11px',
      fontWeight: 700,
      color: 'rgba(180, 210, 255, 0.40)',
      textTransform: 'uppercase',
      letterSpacing: '0.10em',
    }}>{title}</h3>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {children}
    </div>
  </section>
);

const Row = ({ label, desc }) => (
  <div style={{
    display: 'flex',
    alignItems: 'baseline',
    gap: '10px',
    padding: '6px 10px',
    borderRadius: '8px',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    fontSize: '13px',
    lineHeight: 1.5,
  }}>
    <span style={{ fontWeight: 600, color: '#e8edf8', whiteSpace: 'nowrap', flexShrink: 0 }}>{label}</span>
    <span style={{ color: 'rgba(200, 220, 255, 0.60)' }}>{desc}</span>
  </div>
);

const KeyRow = ({ keys, desc }) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '6px 10px',
    borderRadius: '8px',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
  }}>
    <span style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
      {keys.split('/').map((k, i) => (
        <kbd key={i} style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2px 7px',
          background: 'rgba(255, 255, 255, 0.08)',
          border: '1px solid rgba(255, 255, 255, 0.16)',
          borderRadius: '5px',
          fontSize: '11px',
          fontWeight: 600,
          fontFamily: 'var(--ui-font)',
          color: '#e8edf8',
          minWidth: '22px',
        }}>{k.trim()}</kbd>
      ))}
    </span>
    <span style={{ fontSize: '13px', color: 'rgba(200, 220, 255, 0.60)', lineHeight: 1.4 }}>{desc}</span>
  </div>
);

const HelpMenu = ({ onClose }) => (
  <div
    onClick={onClose}
    style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      height: '100dvh',
      background: 'rgba(8, 10, 22, 0.72)',
      backdropFilter: 'blur(24px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: 'env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px) env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px)',
      boxSizing: 'border-box',
    }}
  >
    <div
      onClick={e => e.stopPropagation()}
      style={{
        background: 'rgba(14, 17, 38, 0.94)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        borderRadius: '20px',
        padding: '0',
        maxWidth: '560px',
        width: '92%',
        maxHeight: 'calc(100dvh - 48px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))',
        overflowY: 'auto',
        boxShadow: '0 32px 80px rgba(0,0,0,0.60), 0 0 0 1px rgba(255,255,255,0.06)',
        backdropFilter: 'blur(24px)',
        boxSizing: 'border-box',
        fontFamily: 'var(--ui-font)',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '20px 24px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        position: 'sticky',
        top: 0,
        background: 'rgba(14, 17, 38, 0.96)',
        backdropFilter: 'blur(24px)',
        borderRadius: '20px 20px 0 0',
        zIndex: 1,
      }}>
        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600, color: '#e8edf8', letterSpacing: '0.01em' }}>
          How to Play
        </h2>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'rgba(200, 220, 255, 0.45)',
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            cursor: 'pointer',
            fontSize: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.15s ease, color 0.15s ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#e8edf8'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(200,220,255,0.45)'; }}
        >
          &times;
        </button>
      </div>

      {/* Content */}
      <div style={{ padding: '20px 24px 24px' }}>

        <Section title="Moving the Cube">
          <Row label="Drag" desc="Rotates a slice — just like a real Rubik's Cube" />
          <Row label="Shift + Drag" desc="Twists the entire face" />
          <Row label="Click a sticker" desc="Flips it to its antipodal (opposite) color" />
        </Section>

        <Section title="Special Features">
          <Row label="Tunnels" desc="Colorful tunnels show connections between antipodal points" />
          <Row label="Flip Mode" desc="Toggle color flipping on or off" />
          <Row label="Disparity Mode" desc="Watch instability cascade across the cube!" />
        </Section>

        <Section title="Views">
          <Row label="Classic" desc="Standard colorful cube" />
          <Row label="Grid" desc="Position labels (M1-001, etc.)" />
          <Row label="Sudoku" desc="Numbers instead of colors" />
          <Row label="Wireframe" desc="See-through edges with lights" />
          <Row label="Explode" desc="Spreads cube apart to see all sides" />
        </Section>

        <Section title="HUD Numbers">
          <Row label="M" desc="Moves made" />
          <Row label="F" desc="Color flips" />
          <Row label="W" desc="Active flipped pairs" />
          <Row label="Pressure bar" desc="Shows chaos intensity" />
        </Section>

        <Section title="Keyboard Controls">
          <KeyRow keys="Arrow keys" desc="Move cursor to select a tile" />
          <KeyRow keys="W / S" desc="Rotate selected row up / down" />
          <KeyRow keys="A / D" desc="Rotate selected column left / right" />
          <KeyRow keys="Q / E" desc="Rotate face counter-clockwise / clockwise" />
          <KeyRow keys="F" desc="Flip the selected tile (antipodal)" />
        </Section>

        <Section title="Hands Mode (P) — Speedcuber">
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '6px',
          }}>
            <KeyRow keys="I / K" desc="U / U'" />
            <KeyRow keys="O" desc="U2" />
            <KeyRow keys="J / L" desc="R / R'" />
            <KeyRow keys="F / D" desc="L / L'" />
            <KeyRow keys="H / G" desc="F / F'" />
            <KeyRow keys="W / E" desc="B / B'" />
            <KeyRow keys="S / ;" desc="D / D'" />
            <KeyRow keys=", / M" desc="M' / M" />
          </div>
        </Section>

        <Section title="Quick Shortcuts">
          <KeyRow keys="H / ?" desc="Open / close this help menu" />
          <KeyRow keys="Space" desc="Shuffle the cube" />
          <KeyRow keys="R" desc="Reset everything" />
          <KeyRow keys="G" desc="Toggle flip mode" />
          <KeyRow keys="T" desc="Show / hide tunnels" />
          <KeyRow keys="X" desc="Toggle explosion view" />
          <KeyRow keys="V" desc="Cycle view mode" />
          <KeyRow keys="C" desc="Toggle Disparity Mode" />
          <KeyRow keys="P" desc="Toggle Hands Mode" />
          <KeyRow keys="Esc" desc="Close menus / exit Hands Mode" />
        </Section>

        {/* Footnote */}
        <div style={{
          marginTop: '8px',
          padding: '14px 16px',
          background: 'rgba(30, 136, 229, 0.10)',
          borderRadius: '12px',
          fontSize: '13px',
          color: 'rgba(200, 220, 255, 0.65)',
          lineHeight: 1.6,
          border: '1px solid rgba(30, 136, 229, 0.22)',
        }}>
          <strong style={{ color: '#60a5fa' }}>What you're learning:</strong> This puzzle demonstrates a special mathematical space —
          the real projective plane — where opposite points are the same location.
          When you flip a color you're creating a connection through this space. That's what the tunnels represent.
        </div>
      </div>
    </div>
  </div>
);

export default HelpMenu;
