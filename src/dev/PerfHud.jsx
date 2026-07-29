// PerfHud — the DOM half of the Mega Worm measurement harness.
//
// Developer chrome, shown only when the Mega Worm flag is on. It reads
// perfBridge on its own requestAnimationFrame and writes the numbers straight
// into DOM nodes via refs, never through React state: a HUD whose job is to
// report frame cost must not cost a React render per frame to do it. Same
// technique MobiusHUD already uses for the tunnel progress readout.

import { useRef, useEffect, useState } from 'react';
import { perfBridge, perfSnapshot } from './perfBridge.js';
import { UI_FONT, MONO_FONT, NIGHT_SHEET, NIGHT_BORDER, NIGHT_TEXT, NIGHT_TEXT_MUTED, RADIUS_MD } from '../utils/uiTheme.js';

// Budgets from the Mega Worm spec, used only to colour the readout.
const DESKTOP_P95_BUDGET = 18;
const MOBILE_P95_BUDGET = 34;
const DRAW_CALL_BUDGET = 250;

const OK = '#9fdb7a';
const WARN = '#ffd166';
const BAD = '#ff7b6b';

const rowStyle = { display: 'flex', justifyContent: 'space-between', gap: 12, lineHeight: 1.5 };
const labelStyle = { color: NIGHT_TEXT_MUTED, fontFamily: UI_FONT, fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase' };
const valueStyle = { color: NIGHT_TEXT, fontFamily: MONO_FONT, fontSize: 12, fontVariantNumeric: 'tabular-nums' };

function Row({ label, valueRef }) {
  return (
    <div style={rowStyle}>
      <span style={labelStyle}>{label}</span>
      <span ref={valueRef} style={valueStyle}>–</span>
    </div>
  );
}

export default function PerfHud() {
  const [collapsed, setCollapsed] = useState(false);
  const fpsRef = useRef(null);
  const p50Ref = useRef(null);
  const p95Ref = useRef(null);
  const callsRef = useRef(null);
  const trisRef = useRef(null);
  const heapRef = useRef(null);
  const sceneRef = useRef(null);

  useEffect(() => {
    if (collapsed) return undefined;
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const p95 = perfBridge.p95Ms;
      // The tighter mobile budget is the one worth flagging on a phone, but the
      // HUD has no device context — colour against the desktop budget and treat
      // the mobile budget as the hard fail line so both reads are visible.
      const p95Colour = p95 <= DESKTOP_P95_BUDGET ? OK : p95 <= MOBILE_P95_BUDGET ? WARN : BAD;

      if (fpsRef.current) fpsRef.current.textContent = String(Math.round(perfBridge.fps));
      if (p50Ref.current) p50Ref.current.textContent = `${perfBridge.p50Ms.toFixed(1)} ms`;
      if (p95Ref.current) {
        p95Ref.current.textContent = `${p95.toFixed(1)} ms`;
        p95Ref.current.style.color = p95Colour;
      }
      if (callsRef.current) {
        callsRef.current.textContent = String(perfBridge.drawCalls);
        callsRef.current.style.color = perfBridge.drawCalls <= DRAW_CALL_BUDGET ? OK : BAD;
      }
      if (trisRef.current) trisRef.current.textContent = perfBridge.triangles.toLocaleString();
      if (heapRef.current) heapRef.current.textContent = perfBridge.heapMB ? `${perfBridge.heapMB} MB` : 'n/a';
      if (sceneRef.current) {
        sceneRef.current.textContent = perfBridge.cubeSize
          ? `${perfBridge.cubeSize}³${perfBridge.label ? ` · ${perfBridge.label}` : ''}`
          : (perfBridge.label || '–');
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [collapsed]);

  return (
    <div
      style={{
        position: 'fixed', top: 8, left: 8, zIndex: 9000,
        background: NIGHT_SHEET, border: `1px solid ${NIGHT_BORDER}`, borderRadius: RADIUS_MD,
        padding: collapsed ? '4px 10px' : '8px 12px', minWidth: collapsed ? 0 : 176,
        pointerEvents: 'auto', userSelect: 'none', backdropFilter: 'blur(6px)',
      }}
    >
      <button
        type="button"
        onClick={() => setCollapsed(c => !c)}
        // Snapshot to the console on right-click: the fastest way to capture a
        // reading off a phone, where there is no dev-tools panel to read.
        onContextMenu={(e) => { e.preventDefault(); console.log('[perf]', perfSnapshot()); }}
        style={{
          background: 'none', border: 'none', padding: 0, cursor: 'pointer',
          color: NIGHT_TEXT, fontFamily: UI_FONT, fontSize: 10, fontWeight: 800,
          letterSpacing: '0.10em', textTransform: 'uppercase',
        }}
      >
        {collapsed ? 'perf ▸' : 'perf ▾'}
      </button>
      {!collapsed && (
        <div style={{ marginTop: 6 }}>
          <Row label="scene" valueRef={sceneRef} />
          <Row label="fps" valueRef={fpsRef} />
          <Row label="p50" valueRef={p50Ref} />
          <Row label="p95" valueRef={p95Ref} />
          <Row label="draws" valueRef={callsRef} />
          <Row label="tris" valueRef={trisRef} />
          <Row label="heap" valueRef={heapRef} />
        </div>
      )}
    </div>
  );
}
