// src/components/screens/ComingSoonScreen.jsx
import React, { useState, useEffect } from 'react';

const MODES = [
  {
    id: 'story',
    label: 'Story Mode',
    color: '#ef4444',
    icon: '📖',
    gradient: 'linear-gradient(135deg,#ef444422 0%,#f9731622 100%)',
    description:
      'Ten levels. A cube that remembers every move. A narrative written in rotations — where solving the puzzle unlocks the next chapter of a world built on real projective plane topology.',
    tags: ['Campaign', '10 Levels', 'Narrative'],
  },
  {
    id: 'holonomy',
    label: '∮ Holonomy',
    color: '#00f5ff',
    icon: '∮',
    gradient: 'linear-gradient(135deg,#00f5ff18 0%,#0080ff18 100%)',
    description:
      'Move a vector around a closed loop on the cube surface and watch it come back rotated. A mode built on the mathematics of parallel transport and curvature in RP².',
    tags: ['Math Mode', 'Topology', 'Experimental'],
  },
  {
    id: 'biome',
    label: 'Biome Mode',
    color: '#60a5fa',
    icon: '⬡',
    gradient: 'linear-gradient(135deg,#60a5fa18 0%,#22c55e18 100%)',
    description:
      'A living world grows on the surface of the cube. Each face a different ecosystem — forests, deserts, oceans. Navigate a topology that breathes and changes as you solve.',
    tags: ['Exploration', 'Procedural', 'Sandbox'],
  },
  {
    id: 'merge',
    label: 'Merge Mode',
    color: '#a78bfa',
    icon: '✦',
    gradient: 'linear-gradient(135deg,#a78bfa18 0%,#ec489918 100%)',
    description:
      'Two cubes. One truth. Combine solved states across the manifold boundary to create something that has never existed — a cooperative puzzle of antipodal geometry.',
    tags: ['Co-op', 'Puzzle', 'Manifold'],
  },
];

const Tag = ({ label, color }) => (
  <span
    style={{
      display: 'inline-block',
      padding: '3px 9px',
      borderRadius: '20px',
      fontSize: '10px',
      fontWeight: 700,
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      color: `${color}cc`,
      background: `${color}18`,
      border: `1px solid ${color}30`,
      fontFamily: "-apple-system, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif",
    }}
  >
    {label}
  </span>
);

const ModeCard = ({ item, isSelected, onClick }) => {
  const [hovered, setHovered] = useState(false);
  const active = isSelected || hovered;

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%',
        background: active ? item.gradient.replace(/18/g, '28').replace(/22/g, '35') : item.gradient,
        border: `1px solid ${isSelected ? item.color + '60' : item.color + '25'}`,
        borderRadius: '16px',
        padding: 'clamp(14px, 4vw, 20px)',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all 0.25s cubic-bezier(0.22,1,0.36,1)',
        boxShadow: isSelected
          ? `0 0 24px ${item.color}28, 0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 ${item.color}25`
          : hovered
            ? `0 4px 20px rgba(0,0,0,0.4), inset 0 1px 0 ${item.color}18`
            : '0 2px 12px rgba(0,0,0,0.3)',
        transform: isSelected ? 'translateY(-1px)' : hovered ? 'translateY(-1px)' : 'none',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* color accent line on left */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: '16px',
          bottom: '16px',
          width: '3px',
          borderRadius: '0 3px 3px 0',
          background: isSelected ? item.color : `${item.color}55`,
          transition: 'background 0.25s ease',
        }}
      />

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', paddingLeft: '10px' }}>
        {/* Icon */}
        <div
          style={{
            fontSize: '32px',
            lineHeight: 1,
            flexShrink: 0,
            filter: isSelected ? 'none' : 'grayscale(0.5) opacity(0.7)',
            transition: 'filter 0.25s ease',
          }}
        >
          {item.icon}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Name + lock badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span
              style={{
                fontSize: '15px',
                fontWeight: 700,
                color: isSelected ? item.color : `${item.color}cc`,
                fontFamily: "-apple-system, 'SF Pro Display', 'Segoe UI', system-ui, sans-serif",
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
                color: `${item.color}66`,
                background: `${item.color}14`,
                border: `1px solid ${item.color}28`,
                borderRadius: '4px',
                padding: '2px 6px',
                fontFamily: "-apple-system, 'SF Pro Text', system-ui, sans-serif",
              }}
            >
              Coming Soon
            </span>
          </div>

          {/* Description — shown when selected */}
          <div
            style={{
              maxHeight: isSelected ? '240px' : '0px',
              overflow: 'hidden',
              transition: 'max-height 0.4s cubic-bezier(0.22,1,0.36,1)',
            }}
          >
            <p
              style={{
                margin: '0 0 10px',
                fontSize: '13px',
                lineHeight: 1.6,
                color: 'rgba(200,220,255,0.78)',
                fontFamily: "-apple-system, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif",
              }}
            >
              {item.description}
            </p>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {item.tags.map(tag => (
                <Tag key={tag} label={tag} color={item.color} />
              ))}
            </div>
          </div>

          {/* Collapsed hint */}
          {!isSelected && (
            <p
              style={{
                margin: 0,
                fontSize: '12px',
                color: 'rgba(160,185,255,0.45)',
                fontFamily: "-apple-system, 'SF Pro Text', system-ui, sans-serif",
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

  const handleSelect = id => {
    setSelectedId(prev => (prev === id ? null : id));
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(4,6,18,0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        opacity: visible ? 1 : 0,
        transform: visible ? 'none' : 'translateY(16px)',
        transition: 'opacity 0.32s ease, transform 0.32s cubic-bezier(0.22,1,0.36,1)',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '480px',
          paddingTop: 'max(44px, env(safe-area-inset-top, 44px))',
          paddingBottom: 'max(32px, env(safe-area-inset-bottom, 32px))',
          paddingLeft: '20px',
          paddingRight: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '0',
          boxSizing: 'border-box',
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
            background: 'rgba(120,160,255,0.08)',
            border: '1px solid rgba(120,160,255,0.18)',
            borderRadius: '24px',
            cursor: 'pointer',
            color: 'rgba(180,210,255,0.75)',
            fontSize: '13px',
            fontWeight: 600,
            fontFamily: "-apple-system, 'SF Pro Text', system-ui, sans-serif",
            marginBottom: '28px',
            transition: 'background 0.2s ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(120,160,255,0.14)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(120,160,255,0.08)'; }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8L10 13" stroke="rgba(180,210,255,0.75)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back
        </button>

        {/* Header */}
        <div style={{ marginBottom: '28px' }}>
          <h1
            style={{
              margin: '0 0 8px',
              fontSize: 'clamp(28px,7vw,40px)',
              fontWeight: 900,
              letterSpacing: '0.04em',
              fontFamily: "'Courier New', monospace",
              background: 'linear-gradient(100deg,#ef4444 0%,#f97316 25%,#a78bfa 60%,#00f5ff 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Coming Soon
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: '13px',
              color: 'rgba(160,185,255,0.60)',
              fontFamily: "-apple-system, 'SF Pro Text', system-ui, sans-serif",
              lineHeight: 1.5,
              letterSpacing: '0.02em',
            }}
          >
            New game modes in development. Tap a card to see what&apos;s planned.
          </p>
        </div>

        {/* Mode cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {MODES.map(mode => (
            <ModeCard
              key={mode.id}
              item={mode}
              isSelected={selectedId === mode.id}
              onClick={() => handleSelect(mode.id)}
            />
          ))}
        </div>

        {/* Footer note */}
        <p
          style={{
            marginTop: '32px',
            textAlign: 'center',
            fontSize: '11px',
            color: 'rgba(120,150,220,0.35)',
            fontFamily: "-apple-system, 'SF Pro Text', system-ui, sans-serif",
            letterSpacing: '0.08em',
          }}
        >
          WORM³ · More modes unlocking soon
        </p>
      </div>
    </div>
  );
}
