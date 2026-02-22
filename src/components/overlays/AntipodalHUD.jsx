// src/components/overlays/AntipodalHUD.jsx
// HUD overlay displaying real-time antipodal integrity I(T).
// Shows the numeric metric, a bar gauge, regime indicator,
// and the k* threshold marker.

import React from 'react';

const REGIME_LABELS = {
  structure: 'STRUCTURE-DOMINATED',
  entropy: 'ENTROPY-DOMINATED',
  critical: 'CRITICAL THRESHOLD'
};

const REGIME_COLORS = {
  structure: '#22c55e',
  entropy: '#ef4444',
  critical: '#fbbf24'
};

export default function AntipodalHUD({ integrity, preserved, total, regime, kStar, onClose }) {
  const pct = Math.round(integrity * 100);
  const kStarPct = Math.round(kStar * 100);
  const barColor = REGIME_COLORS[regime] || '#60a5fa';
  const regimeLabel = REGIME_LABELS[regime] || '';

  return (
    <div style={{
      position: 'fixed',
      top: '60px',
      right: '16px',
      background: 'rgba(0, 0, 0, 0.85)',
      border: `1px solid ${barColor}`,
      borderRadius: '8px',
      padding: '12px 16px',
      color: '#e5e7eb',
      fontFamily: "'Courier New', monospace",
      fontSize: '12px',
      zIndex: 200,
      backdropFilter: 'blur(8px)',
      minWidth: '200px',
      userSelect: 'none',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontWeight: 'bold', color: barColor, letterSpacing: '0.1em' }}>
          ANTIPODAL INTEGRITY
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none', color: '#9ca3af',
            cursor: 'pointer', fontSize: '14px', padding: '0 4px',
            fontFamily: "'Courier New', monospace"
          }}
        >
          x
        </button>
      </div>

      {/* Main metric */}
      <div style={{ fontSize: '28px', fontWeight: 'bold', color: barColor, textAlign: 'center', lineHeight: 1 }}>
        I(T) = {integrity.toFixed(3)}
      </div>
      <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: '10px', marginTop: '2px' }}>
        {preserved}/{total} pairs preserved
      </div>

      {/* Bar gauge */}
      <div style={{ position: 'relative', height: '16px', background: '#1f2937', borderRadius: '4px', marginTop: '10px', overflow: 'hidden' }}>
        {/* Fill */}
        <div style={{
          position: 'absolute', top: 0, left: 0, height: '100%',
          width: `${pct}%`, background: barColor, borderRadius: '4px',
          transition: 'width 0.3s ease, background 0.3s ease'
        }} />
        {/* k* threshold marker */}
        <div style={{
          position: 'absolute', top: 0, left: `${kStarPct}%`,
          width: '2px', height: '100%', background: '#fbbf24',
          zIndex: 1
        }} />
        {/* k* label */}
        <div style={{
          position: 'absolute', top: '-14px', left: `${kStarPct}%`,
          transform: 'translateX(-50%)', fontSize: '9px', color: '#fbbf24',
          whiteSpace: 'nowrap'
        }}>
          k*
        </div>
      </div>

      {/* Percentage labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#6b7280', marginTop: '2px' }}>
        <span>0%</span>
        <span>{pct}%</span>
        <span>100%</span>
      </div>

      {/* Regime indicator */}
      <div style={{
        textAlign: 'center', marginTop: '8px', fontSize: '10px',
        color: barColor, letterSpacing: '0.15em', fontWeight: 'bold'
      }}>
        {regimeLabel}
      </div>

      {/* Commutator norm */}
      <div style={{ textAlign: 'center', fontSize: '9px', color: '#6b7280', marginTop: '4px' }}>
        C(T) = {Math.round(total * 2 * (1 - integrity))} | k* = {kStar.toFixed(4)}
      </div>
    </div>
  );
}
