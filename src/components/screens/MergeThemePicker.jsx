import React, { useState, useEffect } from 'react';

const THEMES = [
  { id: 'pokemon', label: 'Pokémon', color: '#FFCB05', accent: '#3B4CCA', emoji: '⚡', desc: 'Catch & evolve' },
  { id: 'dnd', label: 'D&D', color: '#C5A028', accent: '#8B0000', emoji: '🐉', desc: 'Dungeons & Dragons' },
  { id: 'digimon', label: 'Digimon', color: '#FF6B35', accent: '#1B4FBE', emoji: '🌐', desc: 'Digital monsters' },
  { id: 'marvel', label: 'Marvel', color: '#ED1D24', accent: '#F0C100', emoji: '🦸', desc: 'Heroes & villains' },
  { id: 'harry-potter', label: 'Harry Potter', color: '#D3A625', accent: '#740001', emoji: '🪄', desc: 'Magic & spells' },
  { id: 'disney', label: 'Disney', color: '#FCD000', accent: '#003087', emoji: '✨', desc: 'Wish upon a star' },
];

const ThemeCard = ({ theme, selected, onSelect }) => {
  const [hovered, setHovered] = useState(false);
  const active = selected || hovered;

  return (
    <button
      onClick={() => onSelect(theme.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex: '1 1 calc(33% - 8px)',
        minWidth: '130px',
        maxWidth: '180px',
        padding: '18px 12px 14px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
        background: active
          ? `linear-gradient(135deg, ${theme.color}22, ${theme.accent}18)`
          : 'rgba(255,255,255,0.06)',
        border: `1.5px solid ${active ? theme.color : 'rgba(255,255,255,0.12)'}`,
        borderRadius: '16px',
        cursor: 'pointer',
        transition: 'all 0.22s cubic-bezier(0.4,0,0.2,1)',
        backdropFilter: 'blur(12px)',
        boxShadow: active
          ? `0 0 20px ${theme.color}30, 0 4px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.12)`
          : '0 2px 8px rgba(0,0,0,0.2)',
        transform: active ? 'translateY(-3px) scale(1.02)' : 'none',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* selection ring */}
      {selected && (
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '15px',
          border: `2px solid ${theme.color}`,
          boxShadow: `inset 0 0 12px ${theme.color}20`,
          pointerEvents: 'none',
        }} />
      )}
      <span style={{ fontSize: '32px', lineHeight: 1 }}>{theme.emoji}</span>
      <span style={{
        fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em',
        textTransform: 'uppercase', color: active ? theme.color : 'rgba(200,220,255,0.8)',
        transition: 'color 0.2s',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
      }}>{theme.label}</span>
      <span style={{
        fontSize: '10px', color: 'rgba(160,190,230,0.55)',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
        textAlign: 'center',
      }}>{theme.desc}</span>
    </button>
  );
};

const TierLegend = () => (
  <div style={{
    display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap',
    padding: '14px 20px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '12px',
  }}>
    {[
      { tier: 1, label: 'Base form', desc: '1–2 tiles', color: 'rgba(160,200,255,0.7)' },
      { tier: 2, label: 'Mid form', desc: '3+ tiles · pulses', color: '#a78bfa' },
      { tier: 3, label: 'Final form', desc: 'Full face · pops out', color: '#fbbf24' },
    ].map(({ tier, label, desc, color }) => (
      <div key={tier} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{
          width: '28px', height: '28px', borderRadius: '6px',
          background: `${color}22`,
          border: `1.5px solid ${color}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '11px', fontWeight: 700, color,
        }}>{tier}</div>
        <div>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(220,235,255,0.9)', fontFamily: 'system-ui' }}>{label}</div>
          <div style={{ fontSize: '10px', color: 'rgba(150,175,210,0.6)', fontFamily: 'system-ui' }}>{desc}</div>
        </div>
      </div>
    ))}
  </div>
);

/**
 * MergeThemePicker — shown after selecting Merge Mode from the main menu.
 *
 * Props:
 *   onStart(themeId)  — called when user confirms theme and starts the game
 *   onBack()          — called to return to main menu
 */
const MergeThemePicker = ({ onStart, onBack }) => {
  const [selectedTheme, setSelectedTheme] = useState('pokemon');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 60);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'radial-gradient(circle at 50% 35%, #0e1324 0%, #070b16 52%, #05050f 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '24px',
      opacity: visible ? 1 : 0,
      transition: 'opacity 0.35s ease',
      overflowY: 'auto',
    }}>

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '28px' }}>
        <div style={{
          fontSize: 'clamp(26px,6vw,42px)', fontWeight: 900,
          letterSpacing: '0.12em', fontFamily: "'Courier New', monospace",
          background: 'linear-gradient(100deg,#a78bfa,#60a5fa,#34d399)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          marginBottom: '8px',
        }}>
          MERGE MODE
        </div>
        <p style={{
          margin: 0, fontSize: '13px', color: 'rgba(150,180,220,0.65)',
          letterSpacing: '0.18em', textTransform: 'uppercase',
          fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
        }}>
          Connect tiles to evolve your characters
        </p>
      </div>

      {/* Theme grid */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: '10px',
        justifyContent: 'center',
        maxWidth: '620px', width: '100%',
        marginBottom: '24px',
      }}>
        {THEMES.map(theme => (
          <ThemeCard
            key={theme.id}
            theme={theme}
            selected={selectedTheme === theme.id}
            onSelect={setSelectedTheme}
          />
        ))}
      </div>

      {/* Tier legend */}
      <div style={{ maxWidth: '560px', width: '100%', marginBottom: '28px' }}>
        <TierLegend />
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '12px', maxWidth: '420px', width: '100%' }}>
        <button
          onClick={onBack}
          style={{
            flex: 1, padding: '14px 20px',
            background: 'rgba(255,255,255,0.07)',
            border: '1.5px solid rgba(255,255,255,0.12)',
            borderRadius: '100px', cursor: 'pointer',
            fontSize: '13px', fontWeight: 600, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: 'rgba(180,200,230,0.7)',
            fontFamily: 'system-ui',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
        >
          ← Back
        </button>
        <button
          onClick={() => onStart(selectedTheme)}
          style={{
            flex: 2, padding: '14px 20px',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            border: 'none',
            borderRadius: '100px', cursor: 'pointer',
            fontSize: '13px', fontWeight: 700, letterSpacing: '0.14em',
            textTransform: 'uppercase', color: '#ffffff',
            fontFamily: 'system-ui',
            boxShadow: '0 4px 20px rgba(99,102,241,0.4)',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 28px rgba(99,102,241,0.55)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(99,102,241,0.4)'; }}
        >
          Enter the Cube ✦
        </button>
      </div>
    </div>
  );
};

export default MergeThemePicker;
