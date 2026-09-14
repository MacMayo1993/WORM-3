// DOM overlay for Holonomy Mode — a compact field note, not a separate sci-fi HUD.
import React, { useEffect, useRef, useState } from 'react';
import { MONO_FONT, UI_CREAM, UI_MOSS, UI_MOSS_LIGHT, Z } from '../utils/uiTheme.js';
import { FieldGuideButton, FieldGuideEyebrow, FieldGuideSheet, fieldGuide } from '../components/ui/FieldGuide.jsx';

const fmt = (n) => `${n >= 0 ? '+' : ''}${n.toFixed(3)}`;
const fmtDeg = (r) => `${((r * 180) / Math.PI).toFixed(1)}°`;

export default function HolonomyHUD({ holonomyAngle = 0, orientationParity = 1, holonomyMatrix, seamCount = 0, mobiusCount = 0, loopClosed = false, onReset, onTurnLeft, onTurnRight }) {
  const [showMatrix, setShowMatrix] = useState(false);
  const [loopFlash, setLoopFlash] = useState(false);
  const prevLoop = useRef(false);
  useEffect(() => {
    if (loopClosed && !prevLoop.current) {
      setLoopFlash(true);
      const timer = setTimeout(() => setLoopFlash(false), 2500);
      prevLoop.current = true;
      return () => clearTimeout(timer);
    }
    if (!loopClosed) prevLoop.current = false;
  }, [loopClosed]);

  const isFlipped = orientationParity < 0;
  const H = holonomyMatrix || [[1, 0], [0, 1]];
  const metrics = [['Angle φ', fmtDeg(holonomyAngle)], ['Parity', isFlipped ? 'Flipped' : 'Oriented'], ['Seams', seamCount], ['Möbius', mobiusCount]];

  return <div style={{ position: 'fixed', inset: 0, zIndex: Z.CONTROLS, pointerEvents: 'none', fontFamily: MONO_FONT }}>
    <div style={{ display: 'flex', justifyContent: 'center', padding: 'max(10px, env(safe-area-inset-top, 0px)) 12px 0' }}>
      <FieldGuideSheet style={{ width: 'min(620px, calc(100vw - 24px))', padding: '10px 14px', pointerEvents: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <FieldGuideEyebrow style={{ color: '#7b6f45' }}>Holonomy field notes</FieldGuideEyebrow>
          <div style={{ display: 'flex', gap: 6 }}>
            <FieldGuideButton secondary onClick={() => setShowMatrix(v => !v)} style={{ padding: '6px 10px', fontSize: 10 }}>{showMatrix ? 'Hide matrix' : 'Matrix'}</FieldGuideButton>
            <FieldGuideButton secondary onClick={onReset} style={{ padding: '6px 10px', fontSize: 10 }}>Reset</FieldGuideButton>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(62px, 1fr))', gap: 6, marginTop: 8 }}>
          {metrics.map(([label, value]) => <div key={label} style={{ padding: '6px 4px', textAlign: 'center', borderLeft: '1px solid rgba(111,126,86,0.16)' }}>
            <div style={{ color: fieldGuide.muted, fontSize: 9, letterSpacing: 1, textTransform: 'uppercase' }}>{label}</div>
            <div style={{ color: label === 'Parity' && isFlipped ? '#9b4d3d' : fieldGuide.ink, fontSize: 13, fontWeight: 800 }}>{value}</div>
          </div>)}
        </div>
      </FieldGuideSheet>
    </div>
    {showMatrix && <div style={{ display: 'flex', justifyContent: 'center', marginTop: 6, pointerEvents: 'auto' }}>
      <FieldGuideSheet style={{ padding: '10px 18px', borderRadius: 12, textAlign: 'center' }}>
        <FieldGuideEyebrow style={{ color: '#7b6f45', fontSize: 9 }}>Holonomy matrix H</FieldGuideEyebrow>
        <table style={{ margin: '5px auto 0', borderCollapse: 'collapse', color: fieldGuide.ink, fontSize: 13 }}><tbody>{H.map((row, ri) => <tr key={ri}>{row.map((value, ci) => <td key={ci} style={{ padding: '2px 10px', textAlign: 'right', color: Math.abs(value) > 0.01 ? UI_MOSS : fieldGuide.muted }}>{fmt(value)}</td>)}</tr>)}</tbody></table>
        <div style={{ color: fieldGuide.muted, fontSize: 9 }}>det(H) = {fmt(H[0][0] * H[1][1] - H[0][1] * H[1][0])}</div>
      </FieldGuideSheet>
    </div>}
    {loopFlash && <div style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none', background: 'radial-gradient(ellipse at center, rgba(24,31,18,0.34), rgba(24,31,18,0.62))' }}>
      <div style={{ textAlign: 'center', color: UI_CREAM }}><FieldGuideEyebrow>{isFlipped ? 'Möbius loop detected' : 'Loop complete'}</FieldGuideEyebrow><div style={{ fontFamily: "'Bungee', 'Arial Black', sans-serif", fontSize: 'clamp(30px, 8vw, 52px)', textShadow: '0 3px 0 rgba(43,53,35,0.55), 0 10px 34px rgba(24,31,18,0.6)' }}>{isFlipped ? 'LOOP FLIPPED' : 'LOOP CLOSED'}</div><p style={{ margin: '8px 0 0', fontFamily: MONO_FONT, fontSize: 13 }}>{fmtDeg(holonomyAngle)} · det(H) = {orientationParity > 0 ? '+1' : '−1'}</p></div>
    </div>}
    <div style={{ position: 'fixed', bottom: 'calc(env(safe-area-inset-bottom, 0px) + 96px)', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 10, pointerEvents: 'auto' }}>
      <FieldGuideButton aria-label="Turn left" onPointerDown={() => onTurnLeft?.()} style={{ width: 54, height: 54, padding: 0, fontSize: 22 }}>↺</FieldGuideButton>
      <FieldGuideButton aria-label="Turn right" onPointerDown={() => onTurnRight?.()} style={{ width: 54, height: 54, padding: 0, fontSize: 22, background: UI_MOSS_LIGHT, color: '#26331f' }}>↻</FieldGuideButton>
    </div>
  </div>;
}
