import React, { useState, useEffect } from 'react';
import {
  UI_FONT, DISPLAY_FONT, PAPER_SHEET_RAISED, PAPER_BORDER, PAPER_BORDER_SOFT,
  PAPER_TEXT, PAPER_TEXT_MUTED, PAPER_TEXT_FAINT, PAPER_BG_MUTED,
  PAPER_CARD_SHADOW, UI_MOSS,
 Z } from '../../utils/uiTheme.js';
import { wizardPaperBackground } from '../../components/screens/WizardChrome.jsx';

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
          ? `linear-gradient(135deg, ${theme.color}20, ${theme.accent}14)`
          : PAPER_SHEET_RAISED,
        border: `1.5px solid ${active ? theme.color : PAPER_BORDER_SOFT}`,
        borderRadius: '16px',
        cursor: 'pointer',
        transition: 'all 0.22s cubic-bezier(0.4,0,0.2,1)',
        boxShadow: active
          ? `0 4px 0 ${PAPER_CARD_SHADOW}, 0 8px 20px ${theme.color}28`
          : `0 3px 0 ${PAPER_CARD_SHADOW}, 0 4px 10px rgba(60,48,34,0.10)`,
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
          boxShadow: `inset 0 0 12px ${theme.color}18`,
          pointerEvents: 'none',
        }} />
      )}
      <span style={{ fontSize: '32px', lineHeight: 1 }}>{theme.emoji}</span>
      <span style={{
        fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em',
        // Brand colours are picked for contrast on dark; several of them (Pokémon
        // yellow, Disney gold) vanish on cream. Only the active card wears its
        // brand colour, where the tinted fill and border carry it — the rest take
        // the readable paper ink.
        textTransform: 'uppercase', color: active ? PAPER_TEXT : PAPER_TEXT_MUTED,
        transition: 'color 0.2s',
        fontFamily: UI_FONT,
      }}>{theme.label}</span>
      <span style={{
        fontSize: '10px', color: PAPER_TEXT_FAINT,
        fontFamily: UI_FONT,
        textAlign: 'center',
      }}>{theme.desc}</span>
    </button>
  );
};

const TierLegend = () => (
  <div style={{
    display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap',
    padding: '14px 20px',
    background: PAPER_BG_MUTED,
    border: `1px solid ${PAPER_BORDER_SOFT}`,
    borderRadius: '12px',
  }}>
    {[
      { tier: 1, label: 'Base form', desc: '1–2 tiles', color: '#8a8175' },
      { tier: 2, label: 'Mid form', desc: '3+ tiles · pulses', color: '#6a5b95' },
      { tier: 3, label: 'Final form', desc: 'Full face · pops out', color: '#b88f4a' },
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
          <div style={{ fontSize: '11px', fontWeight: 600, color: PAPER_TEXT, fontFamily: UI_FONT }}>{label}</div>
          <div style={{ fontSize: '10px', color: PAPER_TEXT_MUTED, fontFamily: UI_FONT }}>{desc}</div>
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
      position: 'fixed', inset: 0, zIndex: Z.FULLSCREEN,
      ...wizardPaperBackground,
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
          letterSpacing: '0.04em', fontFamily: DISPLAY_FONT,
          color: PAPER_TEXT,
          marginBottom: '8px',
        }}>
          MERGE MODE
        </div>
        <p style={{
          margin: 0, fontSize: '13px', color: PAPER_TEXT_MUTED,
          letterSpacing: '0.18em', textTransform: 'uppercase',
          fontFamily: UI_FONT,
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
            background: PAPER_BG_MUTED,
            border: `1.5px solid ${PAPER_BORDER_SOFT}`,
            borderRadius: '100px', cursor: 'pointer',
            fontSize: '13px', fontWeight: 600, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: PAPER_TEXT_MUTED,
            fontFamily: UI_FONT,
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#e8e2d8'; }}
          onMouseLeave={e => { e.currentTarget.style.background = PAPER_BG_MUTED; }}
        >
          ← Back
        </button>
        <button
          onClick={() => onStart(selectedTheme)}
          style={{
            flex: 2, padding: '14px 20px',
            background: UI_MOSS,
            border: 'none',
            borderRadius: '100px', cursor: 'pointer',
            fontSize: '13px', fontWeight: 700, letterSpacing: '0.14em',
            textTransform: 'uppercase', color: '#fffdf5',
            fontFamily: UI_FONT,
            boxShadow: '0 4px 18px rgba(95,127,74,0.32)',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(95,127,74,0.44)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 18px rgba(95,127,74,0.32)'; }}
        >
          Enter the Cube ✦
        </button>
      </div>
    </div>
  );
};

export default MergeThemePicker;
