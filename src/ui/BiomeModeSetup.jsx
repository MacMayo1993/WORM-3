import React, { useState } from 'react';
import { FACE_CITIES, CITY_CONFIG, getSeamInteraction } from '../modes/CityBiomeMode.js';

// Standard face colors for the 6 faces (matches FACE_COLORS in constants.js)
const FACE_BASE_COLORS = {
  1: '#e02020', // Red   (PZ)
  2: '#3a9c3a', // Green (NX)
  3: '#f0f0f0', // White (PY)
  4: '#e06010', // Orange (NZ)
  5: '#3060c0', // Blue  (PX)
  6: '#e0c020', // Yellow (NY)
};

const FACE_LABELS = { 1: 'Front', 2: 'Left', 3: 'Top', 4: 'Back', 5: 'Right', 6: 'Bottom' };

const INTERACTION_LABELS = {
  'antipodal-thermal-max':    'Thermal Max ⚡',
  'antipodal-cool-harmony':   'Cool Harmony 🌊',
  'antipodal-warm-ambiguous': 'Warm Ambiguous 🔥',
  'cross-cool':               'Cross-Cool',
  'luminance-bridge':         'Luminance Bridge',
  'cold-compute':             'Cold + Compute',
  'thermal-clash':            'Thermal Clash',
  'luminance-compute':        'Luminance + Compute',
  'cross-temperature':        'Cross-Temperature',
  'warm-organic':             'Warm + Organic',
  'cool-compute':             'Cool + Compute',
  'third-color':              'Third-Color Seam',
  'thermal-organic':          'Thermal vs Organic',
  'organic-compute':          'Organic + Compute',
  'neutral':                  'Neutral',
};

// Fisher-Yates shuffle (returns new array)
function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const S = {
  container: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif',
  },
  sectionLabel: {
    fontSize: '11px',
    fontWeight: '600',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'rgba(0,0,0,0.35)',
    marginBottom: '10px',
    marginTop: '0',
  },
  faceRow: {
    display: 'flex',
    gap: '8px',
    marginBottom: '20px',
    flexWrap: 'wrap',
  },
  faceSlot: () => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
    flex: '1',
    minWidth: '80px',
  }),
  faceSwatch: (bgColor) => ({
    width: '100%',
    height: '36px',
    borderRadius: '8px',
    background: bgColor,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '11px',
    fontWeight: '600',
    color: bgColor === '#f0f0f0' ? '#555' : '#fff',
    boxShadow: '0 1px 3px rgba(0,0,0,0.18)',
    letterSpacing: '0.01em',
  }),
  select: {
    width: '100%',
    fontSize: '11px',
    padding: '4px 6px',
    borderRadius: '6px',
    border: '1px solid rgba(0,0,0,0.18)',
    background: '#fff',
    color: '#222',
    cursor: 'pointer',
    outline: 'none',
  },
  antipodalSection: {
    marginBottom: '16px',
  },
  antipodalRow: () => ({
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    borderRadius: '10px',
    background: 'rgba(0,0,0,0.03)',
    marginBottom: '6px',
  }),
  antipodalSwatch: (bg) => ({
    width: '18px',
    height: '18px',
    borderRadius: '4px',
    background: bg,
    flexShrink: 0,
    boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
  }),
  antipodalLabel: {
    fontSize: '12px',
    fontWeight: '500',
    color: '#333',
    flex: 1,
  },
  interactionLabel: {
    fontSize: '11px',
    color: 'rgba(0,0,0,0.45)',
    marginLeft: 'auto',
    letterSpacing: '0.01em',
  },
  actionRow: {
    display: 'flex',
    gap: '8px',
    marginBottom: '20px',
  },
  actionBtn: {
    flex: 1,
    padding: '8px 12px',
    borderRadius: '8px',
    border: '1px solid rgba(0,0,0,0.15)',
    background: 'rgba(0,0,0,0.03)',
    fontSize: '12px',
    fontWeight: '500',
    color: '#333',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};

/**
 * BiomeModeSetup — wizard step for assigning cities to faces.
 * Props:
 *   value    {{ [faceId]: cityKey }} — current assignment (or null for defaults)
 *   onChange {function}             — called with new assignment on each change
 */
export function BiomeModeSetup({ value, onChange }) {
  // assignment: { [faceId]: cityKey }
  const [assignment, setAssignment] = useState(() => value ?? { ...FACE_CITIES });

  const cityKeys = Object.keys(CITY_CONFIG);

  const handleChange = (faceId, cityKey) => {
    // Ensure each city is assigned to exactly one face — swap if already assigned elsewhere
    const newAssignment = { ...assignment };
    const prevFaceForCity = Object.entries(newAssignment).find(([_f, c]) => c === cityKey)?.[0];
    if (prevFaceForCity && prevFaceForCity !== String(faceId)) {
      // Swap: put the current face's city into the old slot
      newAssignment[prevFaceForCity] = newAssignment[faceId];
    }
    newAssignment[faceId] = cityKey;
    setAssignment(newAssignment);
    onChange(newAssignment);
  };

  const handleDefault = () => {
    const reset = { ...FACE_CITIES };
    setAssignment(reset);
    onChange(reset);
  };

  const handleRandomize = () => {
    const shuffled = shuffleArray(cityKeys);
    const random = {};
    [1, 2, 3, 4, 5, 6].forEach((faceId, i) => { random[faceId] = shuffled[i]; });
    setAssignment(random);
    onChange(random);
  };

  // Derive antipodal pair interaction labels
  const antipodalPairs = [[1, 4], [2, 5], [3, 6]];

  return (
    <div style={S.container}>
      {/* Action buttons */}
      <div style={S.actionRow}>
        <button style={S.actionBtn} onClick={handleDefault}>Default</button>
        <button style={S.actionBtn} onClick={handleRandomize}>Randomize</button>
      </div>

      {/* Face assignment */}
      <p style={S.sectionLabel}>Assign Cities to Faces</p>
      <div style={S.faceRow}>
        {[1, 2, 3, 4, 5, 6].map(faceId => {
          const bgColor = FACE_BASE_COLORS[faceId];
          const cityKey = assignment[faceId] ?? FACE_CITIES[faceId];
          return (
            <div key={faceId} style={S.faceSlot()}>
              <div style={S.faceSwatch(bgColor)}>{FACE_LABELS[faceId]}</div>
              <select
                style={S.select}
                value={cityKey}
                onChange={e => handleChange(faceId, e.target.value)}
              >
                {cityKeys.map(ck => (
                  <option key={ck} value={ck}>{CITY_CONFIG[ck].label}</option>
                ))}
              </select>
            </div>
          );
        })}
      </div>

      {/* Antipodal pair preview */}
      <p style={S.sectionLabel}>Antipodal Entanglement</p>
      <div style={S.antipodalSection}>
        {antipodalPairs.map(([faceA, faceB]) => {
          const cityA = assignment[faceA] ?? FACE_CITIES[faceA];
          const cityB = assignment[faceB] ?? FACE_CITIES[faceB];
          const configA = CITY_CONFIG[cityA];
          const configB = CITY_CONFIG[cityB];
          const interaction = getSeamInteraction(faceA, faceB);
          const interactionLabel = INTERACTION_LABELS[interaction.type] ?? interaction.type;
          return (
            <div key={`${faceA}-${faceB}`} style={S.antipodalRow()}>
              <div style={S.antipodalSwatch(configA?.pulseColor ?? '#fff')} />
              <span style={S.antipodalLabel}>
                {configA?.label ?? cityA} ↔ {configB?.label ?? cityB}
              </span>
              <div style={S.antipodalSwatch(configB?.pulseColor ?? '#fff')} />
              <span style={S.interactionLabel}>{interactionLabel}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default BiomeModeSetup;
