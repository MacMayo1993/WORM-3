import React, { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../../hooks/useGameStore.js';
import { inspectionLens, inspectionSuspended, lensRect } from '../../3d/inspectionBridge.js';
import './inspectionLens.css';

export function InspectionToggle({ className = 'top-bar-icon-btn' }) {
  const active = useGameStore(s => s.showCutawayLens);
  const toggle = useGameStore(s => s.toggleCutawayLens);
  return <button type="button" className={className} aria-label="Cutaway lens" title="Inspect inside the cube"
    aria-pressed={active} onClick={toggle}>
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <circle cx="10" cy="10" r="7"/><path d="m15 15 6 6M6 10h8M10 6v8"/>
    </svg>
  </button>;
}

export default function InspectionLens() {
  const visible = useGameStore(s => s.showCutawayLens && !s.captureMode && !inspectionSuspended(s));
  const close = useGameStore(s => s.setShowCutawayLens);
  const [screen, setScreen] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }));
  const [, refresh] = useState(0);
  const drag = useRef(null), handle = useRef(null);
  useEffect(() => {
    const resize = () => setScreen({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  useEffect(() => {
    if (!visible) return;
    const previous = document.activeElement;
    handle.current?.focus({ preventScroll: true });
    return () => { drag.current = null; if (previous?.isConnected) previous.focus?.({ preventScroll: true }); };
  }, [visible]);
  if (!visible) return null;
  const rect = lensRect(screen.width, screen.height);
  const move = (x, y) => {
    inspectionLens.x = x / screen.width; inspectionLens.y = y / screen.height;
    const clamped = lensRect(screen.width, screen.height);
    inspectionLens.x = clamped.x / screen.width; inspectionLens.y = clamped.y / screen.height;
    refresh(value => value + 1);
  };
  const stop = e => {
    e.stopPropagation();
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    drag.current = null;
  };
  return <div className="inspection-lens" role="group" aria-label="Cube inspection"
    style={{ left: rect.x, top: rect.y, width: rect.radius * 2, height: rect.radius * 2 }}
    onKeyDown={e => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(false); }
    }}>
    <button type="button" ref={handle} className="inspection-lens-drag" aria-label="Move cutaway lens"
      aria-describedby="inspection-lens-hint" onPointerDown={e => {
        if (e.button !== 0) return;
        e.preventDefault(); e.stopPropagation(); e.currentTarget.focus();
        drag.current = { id: e.pointerId, x: e.clientX - rect.x, y: e.clientY - rect.y };
        e.currentTarget.setPointerCapture?.(e.pointerId);
      }} onPointerMove={e => {
        if (drag.current?.id !== e.pointerId) return;
        e.preventDefault(); e.stopPropagation(); move(e.clientX - drag.current.x, e.clientY - drag.current.y);
      }} onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={() => { drag.current = null; }}
      onKeyDown={e => {
        const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
        if (!direction) return;
        e.preventDefault(); e.stopPropagation();
        const step = e.shiftKey ? 40 : 12;
        move(rect.x + direction[0] * step, rect.y + direction[1] * step);
      }} />
    <div className="inspection-lens-caption">
      <span>Cutaway</span>
      <button type="button" aria-label="Close cutaway lens" onClick={() => close(false)}>×</button>
    </div>
    <div className="inspection-lens-tools" onPointerDown={e => e.stopPropagation()} onKeyDown={e => {
      if (e.key.startsWith('Arrow')) e.stopPropagation();
    }}>
      <label>Size <input aria-label="Cutaway lens size" type="range" min="70" max="180" step="5" value={inspectionLens.radius}
        onChange={e => { inspectionLens.radius = Number(e.target.value); refresh(value => value + 1); }} /></label>
      <span id="inspection-lens-hint">Drag the lens · arrow keys to move</span>
    </div>
  </div>;
}
