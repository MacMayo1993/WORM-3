import React, { useState } from 'react';

const LEVEL_LABELS = { 1: 'Low', 2: 'Medium', 3: 'High', 4: 'Extreme', 5: 'Maximum' };
const LEVEL_ACCENT = { 1: '#34c759', 2: '#ffcc00', 3: '#ff9500', 4: '#ff3b30', 5: '#af52de' };

// Tile endurance presets — how many flips a tile can absorb before dying
const FLIP_CAP_PRESETS = [
  { label: 'Fragile', value: 6, sub: 'Fast massacre' },
  { label: 'Standard', value: 15, sub: 'Balanced carnage' },
  { label: 'Endurance', value: 25, sub: 'Slow attrition' },
  { label: 'Titan', value: 40, sub: 'War of attrition' },
];

/**
 * DisparitySetupWizard
 *
 * Clean, light-mode setup screen (Apple/Google aesthetic).
 * Lets the player pick cube size, disparity level, and a few gameplay toggles
 * before the game starts on a solved cube.
 */
const DisparitySetupWizard = ({ onStart, onCancel }) => {
  const [cubeSize, setCubeSize] = useState(3);
  const [disparityLevel, setDisparityLevel] = useState(3);
  const [flipCap, setFlipCap] = useState(15); // default: Standard
  const [visualMode, setVisualMode] = useState('classic');
  const [flipMode, setFlipMode] = useState(true);
  const [showTunnels, setShowTunnels] = useState(true);

  const accent = LEVEL_ACCENT[disparityLevel];

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(242,242,247,0.96)',
      backdropFilter: 'blur(20px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 800,
      pointerEvents: 'auto',
      fontFamily: "-apple-system, 'Helvetica Neue', Roboto, sans-serif",
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: '20px',
        padding: '32px 28px',
        maxWidth: '400px',
        width: '92vw',
        boxShadow: '0 8px 40px rgba(0,0,0,0.12)',
        display: 'flex', flexDirection: 'column', gap: '24px',
      }}>

        {/* Header */}
        <div>
          <div style={{ fontSize: '22px', fontWeight: '700', color: '#1c1c1e', letterSpacing: '-0.3px' }}>
            Disparity Mode
          </div>
          <div style={{ fontSize: '14px', color: '#8e8e93', marginTop: '4px' }}>
            Last tile surviving wins by least observation
          </div>
        </div>

        {/* Cube Size */}
        <Section label="Cube Size">
          <div style={{ display: 'flex', background: '#f2f2f7', borderRadius: '10px', padding: '3px', gap: '2px' }}>
            {[2, 3, 4, 5].map(n => (
              <button
                key={n}
                onClick={() => setCubeSize(n)}
                style={{
                  flex: 1, padding: '7px 0', border: 'none', borderRadius: '8px', fontSize: '14px',
                  fontWeight: cubeSize === n ? '600' : '400',
                  background: cubeSize === n ? '#ffffff' : 'transparent',
                  color: cubeSize === n ? '#1c1c1e' : '#8e8e93',
                  cursor: 'pointer',
                  boxShadow: cubeSize === n ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
                  transition: 'all 0.15s',
                  fontFamily: 'inherit',
                }}
              >
                {n}×{n}
              </button>
            ))}
          </div>
        </Section>

        {/* Disparity Level */}
        <Section label={<span>Disparity Level <span style={{ color: accent, fontWeight: '600' }}>{LEVEL_LABELS[disparityLevel]}</span></span>}>
          <div style={{ display: 'flex', gap: '6px' }}>
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n}
                onClick={() => setDisparityLevel(n)}
                style={{
                  flex: 1, padding: '9px 0', border: `1.5px solid ${disparityLevel === n ? LEVEL_ACCENT[n] : '#e5e5ea'}`,
                  borderRadius: '10px', fontSize: '14px', fontWeight: disparityLevel === n ? '700' : '400',
                  background: disparityLevel === n ? `${LEVEL_ACCENT[n]}18` : '#f9f9fb',
                  color: disparityLevel === n ? LEVEL_ACCENT[n] : '#8e8e93',
                  cursor: 'pointer', transition: 'all 0.15s',
                  fontFamily: 'inherit',
                }}
              >
                {n}
              </button>
            ))}
          </div>
        </Section>

        {/* Tile Endurance */}
        <Section label="Tile Endurance">
          <div style={{ display: 'flex', gap: '6px' }}>
            {FLIP_CAP_PRESETS.map(p => (
              <button
                key={p.value}
                onClick={() => setFlipCap(p.value)}
                style={{
                  flex: 1, padding: '8px 4px', border: `1.5px solid ${flipCap === p.value ? accent : '#e5e5ea'}`,
                  borderRadius: '10px', fontSize: '11px', fontWeight: flipCap === p.value ? '700' : '400',
                  background: flipCap === p.value ? `${accent}18` : '#f9f9fb',
                  color: flipCap === p.value ? accent : '#8e8e93',
                  cursor: 'pointer', transition: 'all 0.15s',
                  fontFamily: 'inherit', textAlign: 'center', lineHeight: 1.3,
                }}
              >
                <div>{p.label}</div>
                <div style={{ fontSize: '9px', marginTop: '2px', opacity: 0.75 }}>{p.sub}</div>
              </button>
            ))}
          </div>
        </Section>

        {/* Visual Mode */}
        <Section label="View">
          <div style={{ display: 'flex', background: '#f2f2f7', borderRadius: '10px', padding: '3px', gap: '2px' }}>
            {['classic', 'grid', 'sudokube'].map(vm => (
              <button
                key={vm}
                onClick={() => setVisualMode(vm)}
                style={{
                  flex: 1, padding: '7px 0', border: 'none', borderRadius: '8px', fontSize: '13px',
                  fontWeight: visualMode === vm ? '600' : '400',
                  background: visualMode === vm ? '#ffffff' : 'transparent',
                  color: visualMode === vm ? '#1c1c1e' : '#8e8e93',
                  cursor: 'pointer', textTransform: 'capitalize',
                  boxShadow: visualMode === vm ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
                  transition: 'all 0.15s',
                  fontFamily: 'inherit',
                }}
              >
                {vm}
              </button>
            ))}
          </div>
        </Section>

        {/* Toggles */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
          <ToggleRow label="Flip Mode" sub="Allow manual tile flips" value={flipMode} onChange={setFlipMode} />
          <div style={{ height: '1px', background: '#f2f2f7', margin: '0 0 0 0' }} />
          <ToggleRow label="Wormhole Tunnels" sub="Show antipodal connections" value={showTunnels} onChange={setShowTunnels} />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1, padding: '14px', border: '1.5px solid #e5e5ea', borderRadius: '12px',
              fontSize: '16px', fontWeight: '500', background: '#f9f9fb', color: '#8e8e93',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Back
          </button>
          <button
            onClick={() => onStart({ cubeSize, disparityLevel, flipCap, visualMode, flipMode, showTunnels })}
            style={{
              flex: 2, padding: '14px', border: 'none', borderRadius: '12px',
              fontSize: '16px', fontWeight: '600', background: accent, color: '#fff',
              cursor: 'pointer', fontFamily: 'inherit',
              boxShadow: `0 4px 16px ${accent}55`,
            }}
          >
            Begin
          </button>
        </div>
      </div>
    </div>
  );
};

const Section = ({ label, children }) => (
  <div>
    <div style={{ fontSize: '13px', fontWeight: '600', color: '#8e8e93', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
      {label}
    </div>
    {children}
  </div>
);

const ToggleRow = ({ label, sub, value, onChange }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0' }}>
    <div>
      <div style={{ fontSize: '15px', fontWeight: '400', color: '#1c1c1e' }}>{label}</div>
      {sub && <div style={{ fontSize: '12px', color: '#8e8e93', marginTop: '1px' }}>{sub}</div>}
    </div>
    <div
      onClick={() => onChange(!value)}
      style={{
        width: '51px', height: '31px', borderRadius: '16px', flexShrink: 0,
        background: value ? '#34c759' : '#e5e5ea',
        position: 'relative', cursor: 'pointer', transition: 'background 0.2s',
      }}
    >
      <div style={{
        position: 'absolute', top: '3px',
        left: value ? '23px' : '3px',
        width: '25px', height: '25px', borderRadius: '50%',
        background: '#fff',
        boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
        transition: 'left 0.2s',
      }} />
    </div>
  </div>
);

export default DisparitySetupWizard;
