import React, { useState, useEffect } from 'react';
import {
  UI_FONT,
  PAPER_BACKDROP,
  PAPER_BACKDROP_BLUR,
  PAPER_SHEET,
  PAPER_SHEET_RAISED,
  PAPER_BORDER,
  PAPER_BORDER_SOFT,
  PAPER_TEXT,
  PAPER_TEXT_MUTED,
  PAPER_TEXT_FAINT,
} from '../../utils/uiTheme.js';

const ACCENT = '#1565C0';

const MODES = [
  {
    id: 'story',
    label: 'Story Mode',
    accent: '#b71c1c',
    description:
      'Ten levels. A cube that remembers every move. A narrative written in rotations — where solving the puzzle unlocks the next chapter of a world built on real projective plane topology.',
    tags: ['Campaign', '10 Levels', 'Narrative'],
  },
  {
    id: 'holonomy',
    label: 'Holonomy',
    accent: '#1565C0',
    description:
      'Move a vector around a closed loop on the cube surface and watch it come back rotated. A mode built on the mathematics of parallel transport and curvature in RP2.',
    tags: ['Math Mode', 'Topology', 'Experimental'],
  },
  {
    id: 'biome',
    label: 'Biome Mode',
    accent: '#2e7d32',
    description:
      'A living world grows on the surface of the cube. Each face a different ecosystem — forests, deserts, oceans. Navigate a topology that breathes and changes as you solve.',
    tags: ['Exploration', 'Procedural', 'Sandbox'],
  },
  {
    id: 'merge',
    label: 'Merge Mode',
    accent: '#6a1b9a',
    description:
      'Two cubes. One truth. Combine solved states across the manifold boundary to create something that has never existed — a cooperative puzzle of antipodal geometry.',
    tags: ['Co-op', 'Puzzle', 'Manifold'],
  },
];

const Tag = ({ label, accent }) => (
  <span
    style={{
      display: 'inline-block',
      padding: '3px 9px',
      borderRadius: '20px',
      fontSize: '10px',
      fontWeight: 700,
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      color: accent,
      background: `${accent}14`,
      border: `1px solid ${accent}28`,
      fontFamily: UI_FONT,
    }}
  >
    {label}
  </span>
);

const ModeCard = ({ item, isSelected, onClick }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%',
        background: isSelected ? `${item.accent}0c` : PAPER_SHEET_RAISED,
        border: isSelected ? `2px solid ${item.accent}` : `2px solid ${PAPER_BORDER_SOFT}`,
        borderRadius: '14px',
        padding: 'clamp(14px, 4vw, 20px)',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all 0.18s ease',
        boxShadow: isSelected
          ? `inset 0 2px 5px rgba(0,0,0,0.08), 0 1px 0 rgba(255,255,255,0.6)`
          : hovered
            ? `0 3px 0 #c4beb6, 0 4px 10px rgba(0,0,0,0.06)`
            : `0 3px 0 #c4beb6, 0 4px 10px rgba(0,0,0,0.06)`,
        transform: isSelected ? 'translateY(1px)' : hovered ? 'translateY(-1px)' : 'none',
        fontFamily: UI_FONT,
        outline: 'none',
        WebkitTapHighlightColor: 'transparent',
        position: 'relative',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
        <div
          style={{
            width: '6px',
            alignSelf: 'stretch',
            borderRadius: '3px',
            background: isSelected ? item.accent : `${item.accent}40`,
            flexShrink: 0,
            transition: 'background 0.2s ease',
          }}
        />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <span
              style={{
                fontSize: '16px',
                fontWeight: 800,
                color: isSelected ? item.accent : PAPER_TEXT,
                letterSpacing: '-0.02em',
                transition: 'color 0.2s ease',
              }}
            >
              {item.label}
            </span>
            <span
              style={{
                fontSize: '9px',
                fontWeight: 700,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: PAPER_TEXT_FAINT,
                background: `${PAPER_BORDER}60`,
                border: `1px solid ${PAPER_BORDER}`,
                borderRadius: '4px',
                padding: '2px 7px',
              }}
            >
              Coming Soon
            </span>
          </div>

          <div
            style={{
              maxHeight: isSelected ? '240px' : '0px',
              overflow: 'hidden',
              transition: 'max-height 0.4s cubic-bezier(0.22,1,0.36,1)',
            }}
          >
            <p
              style={{
                margin: '6px 0 10px',
                fontSize: '13px',
                lineHeight: 1.6,
                color: PAPER_TEXT_MUTED,
              }}
            >
              {item.description}
            </p>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {item.tags.map((tag) => (
                <Tag key={tag} label={tag} accent={item.accent} />
              ))}
            </div>
          </div>

          {!isSelected && (
            <p
              style={{
                margin: '2px 0 0',
                fontSize: '12px',
                color: PAPER_TEXT_FAINT,
                fontStyle: 'italic',
              }}
            >
              Tap to learn more
            </p>
          )}
        </div>
      </div>
    </button>
  );
};

export default function ComingSoonScreen({ onBack }) {
  const [visible, setVisible] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 30);
    return () => clearTimeout(t);
  }, []);

  const handleBack = () => {
    setVisible(false);
    setTimeout(onBack, 320);
  };

  const handleSelect = (id) => {
    setSelectedId((prev) => (prev === id ? null : id));
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: PAPER_BACKDROP,
        backdropFilter: PAPER_BACKDROP_BLUR,
        WebkitBackdropFilter: PAPER_BACKDROP_BLUR,
        display: 'flex',
        justifyContent: 'center',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.32s ease',
        fontFamily: UI_FONT,
      }}
    >
      <div
        style={{
          width: 'min(520px, 96vw)',
          background: PAPER_SHEET,
          borderRadius: '20px',
          border: `1px solid ${PAPER_BORDER}`,
          boxShadow: '0 20px 56px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.10)',
          margin: 'max(32px, env(safe-area-inset-top, 32px)) auto max(32px, env(safe-area-inset-bottom, 32px))',
          padding: 'clamp(24px, 5vw, 36px)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0',
          alignSelf: 'flex-start',
          opacity: visible ? 1 : 0,
          transform: visible ? 'none' : 'translateY(16px)',
          transition: 'opacity 0.32s ease, transform 0.32s cubic-bezier(0.22,1,0.36,1)',
          animation: visible ? 'modalSheetIn 0.30s cubic-bezier(0.22, 1, 0.36, 1)' : 'none',
        }}
      >
        {/* Back button */}
        <button
          onClick={handleBack}
          style={{
            alignSelf: 'flex-start',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 14px 8px 8px',
            background: '#f0ebe2',
            border: `1.5px solid ${PAPER_BORDER_SOFT}`,
            borderRadius: '999px',
            cursor: 'pointer',
            color: PAPER_TEXT_MUTED,
            fontSize: '13px',
            fontWeight: 600,
            fontFamily: UI_FONT,
            marginBottom: '24px',
            transition: 'all 0.15s ease',
            boxShadow: '0 2px 0 #c4beb6',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#e8e2d8';
            e.currentTarget.style.color = PAPER_TEXT;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#f0ebe2';
            e.currentTarget.style.color = PAPER_TEXT_MUTED;
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back
        </button>

        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <p
            style={{
              margin: '0 0 8px',
              color: PAPER_TEXT_FAINT,
              fontSize: '12px',
              fontWeight: 800,
              letterSpacing: '0.24em',
              textTransform: 'uppercase',
            }}
          >
            In development
          </p>
          <h1
            style={{
              margin: '0 0 8px',
              fontSize: 'clamp(24px, 6vw, 34px)',
              fontWeight: 900,
              letterSpacing: '-0.03em',
              color: PAPER_TEXT,
              lineHeight: 1.1,
            }}
          >
            Coming Soon
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: '14px',
              color: PAPER_TEXT_MUTED,
              lineHeight: 1.5,
            }}
          >
            New game modes currently in development. Tap a card to see what's planned.
          </p>
        </div>

        {/* Mode cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {MODES.map((mode) => (
            <ModeCard key={mode.id} item={mode} isSelected={selectedId === mode.id} onClick={() => handleSelect(mode.id)} />
          ))}
        </div>

        {/* Footer */}
        <p
          style={{
            marginTop: '28px',
            textAlign: 'center',
            fontSize: '11px',
            color: PAPER_TEXT_FAINT,
            letterSpacing: '0.08em',
          }}
        >
          WORM3 — More modes unlocking soon
        </p>
      </div>
    </div>
  );
}
