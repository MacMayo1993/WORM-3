import React, { useState } from 'react';

const DISPARITY_LABELS = ['—', 'Low', 'Medium', 'High', 'Extreme', 'Apocalypse'];

const DISPARITY_COLORS = {
  1: '#4ade80',
  2: '#facc15',
  3: '#fb923c',
  4: '#f87171',
  5: '#dc2626',
};

const btnBase = {
  border: '2px solid rgba(255,255,255,0.15)',
  borderRadius: '8px',
  padding: '10px 20px',
  fontSize: '14px',
  fontFamily: "'Courier New', monospace",
  cursor: 'pointer',
  fontWeight: 'bold',
  letterSpacing: '0.04em',
  transition: 'all 0.15s ease',
};

const SizeButton = ({ value, selected, onClick }) => (
  <button
    onClick={onClick}
    style={{
      ...btnBase,
      background: selected ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.05)',
      borderColor: selected ? '#ef4444' : 'rgba(255,255,255,0.15)',
      color: selected ? '#fff' : 'rgba(255,255,255,0.6)',
      minWidth: '64px',
    }}
  >
    {value}×{value}
  </button>
);

const Toggle = ({ label, checked, onChange }) => (
  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', color: 'rgba(255,255,255,0.75)', fontSize: '13px', fontFamily: "'Courier New', monospace" }}>
    <div
      onClick={() => onChange(!checked)}
      style={{
        width: '36px', height: '20px', borderRadius: '10px',
        background: checked ? '#ef4444' : 'rgba(255,255,255,0.15)',
        position: 'relative', cursor: 'pointer', flexShrink: 0, transition: 'background 0.2s',
      }}
    >
      <div style={{
        position: 'absolute', top: '3px',
        left: checked ? '19px' : '3px',
        width: '14px', height: '14px', borderRadius: '50%',
        background: '#fff', transition: 'left 0.2s',
      }} />
    </div>
    {label}
  </label>
);

/**
 * DisparitySetupWizard — shown when Disparity Mode is launched from the main menu.
 *
 * Player selects:
 *   • Cube size (2–5)
 *   • Disparity level (1–5)
 *   • Elements: visual mode, flip mode, show tunnels
 *
 * After confirming, the cube starts SOLVED and the player makes the first
 * stochastic flip to kick off the disparity cascade.
 */
const DisparitySetupWizard = ({ onStart, onCancel }) => {
  const [cubeSize, setCubeSize] = useState(3);
  const [disparityLevel, setDisparityLevel] = useState(3);
  const [visualMode, setVisualMode] = useState('classic');
  const [flipMode, setFlipMode] = useState(true);
  const [showTunnels, setShowTunnels] = useState(true);

  const accentColor = DISPARITY_COLORS[disparityLevel];

  const handleStart = () => {
    onStart({ cubeSize, disparityLevel, visualMode, flipMode, showTunnels });
  };

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.92)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 800,
      fontFamily: "'Courier New', monospace",
    }}>
      <div style={{
        background: 'rgba(10,10,10,0.97)',
        border: `2px solid ${accentColor}55`,
        borderRadius: '16px',
        padding: '36px 40px',
        maxWidth: '440px',
        width: '90vw',
        display: 'flex', flexDirection: 'column', gap: '28px',
        boxShadow: `0 0 40px ${accentColor}22`,
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: accentColor, letterSpacing: '0.1em' }}>
            ⚡ DISPARITY MODE
          </div>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginTop: '6px', letterSpacing: '0.06em' }}>
            Last tile standing wins by least observation
          </div>
        </div>

        {/* Cube Size */}
        <div>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '10px' }}>
            Cube Size
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {[2, 3, 4, 5].map(n => (
              <SizeButton key={n} value={n} selected={cubeSize === n} onClick={() => setCubeSize(n)} />
            ))}
          </div>
        </div>

        {/* Disparity Level */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px' }}>
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Disparity Level
            </span>
            <span style={{ fontSize: '14px', fontWeight: 'bold', color: accentColor }}>
              {DISPARITY_LABELS[disparityLevel]}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n}
                onClick={() => setDisparityLevel(n)}
                style={{
                  ...btnBase,
                  flex: 1, padding: '8px 0',
                  background: disparityLevel >= n ? `${DISPARITY_COLORS[n]}33` : 'rgba(255,255,255,0.04)',
                  borderColor: disparityLevel === n ? DISPARITY_COLORS[n] : 'rgba(255,255,255,0.1)',
                  color: disparityLevel >= n ? DISPARITY_COLORS[n] : 'rgba(255,255,255,0.3)',
                  fontSize: '13px',
                }}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Elements */}
        <div>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '12px' }}>
            Elements
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Visual mode row */}
            <div style={{ display: 'flex', gap: '6px' }}>
              {['classic', 'grid', 'sudokube'].map(vm => (
                <button
                  key={vm}
                  onClick={() => setVisualMode(vm)}
                  style={{
                    ...btnBase,
                    flex: 1, padding: '6px 0', fontSize: '11px',
                    background: visualMode === vm ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.04)',
                    borderColor: visualMode === vm ? '#6366f1' : 'rgba(255,255,255,0.1)',
                    color: visualMode === vm ? '#a5b4fc' : 'rgba(255,255,255,0.35)',
                    textTransform: 'capitalize',
                  }}
                >
                  {vm}
                </button>
              ))}
            </div>
            <Toggle label="Flip Mode (manual flips enabled)" checked={flipMode} onChange={setFlipMode} />
            <Toggle label="Show Wormhole Tunnels" checked={showTunnels} onChange={setShowTunnels} />
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
          <button
            onClick={onCancel}
            style={{
              ...btnBase,
              flex: 1,
              background: 'rgba(255,255,255,0.06)',
              color: 'rgba(255,255,255,0.5)',
            }}
          >
            ← Back
          </button>
          <button
            onClick={handleStart}
            style={{
              ...btnBase,
              flex: 2,
              background: `${accentColor}22`,
              borderColor: accentColor,
              color: accentColor,
              fontSize: '15px',
            }}
          >
            ⚡ Begin
          </button>
        </div>
      </div>
    </div>
  );
};

export default DisparitySetupWizard;
