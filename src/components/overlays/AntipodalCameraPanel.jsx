import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useGameStore } from '../../hooks/useGameStore.js';
import { GAME_HUD_VARS } from '../../utils/uiTheme.js';
import { antipodalViewport, placeAntipodalPanel } from '../../3d/antipodalViewport.js';
import './antipodalCameraPanel.css';

const AVOID = '.top-app-bar, .bottom-nav-bar, .instrument-menu-panel, .worm-hud-top, .worm-hud-bottom, .teach-course, .worm-story-live, .demo-intro-card, .demo-step-hint, .demo-spotlight-hint, .demo-progress-pill, .demo-coach-pill, .demo-launch-stamp, .demo-complete-stamp, [role="status"], [role="alert"], [role="dialog"], [data-camera-avoid]';
const rectOf = element => {
  const r = element.getBoundingClientRect();
  return { x: r.left, y: r.top, width: r.width, height: r.height };
};
const stop = e => e.stopPropagation();

export default function AntipodalCameraPanel({ active }) {
  const capture = useGameStore(s => s.captureMode);
  const enabled = active && !capture;
  const [preference, setPreference] = useState({ compact: false, expanded: false, corner: 0 });
  const [placement, setPlacement] = useState(null);
  const previous = useRef(null), view = useRef(null), safeArea = useRef(null);

  useEffect(() => {
    antipodalViewport.rect = null;
    if (!enabled) { previous.current = null; setPlacement(null); return; }
    const measure = () => {
      const canvas = document.querySelector('.canvas-container canvas');
      if (!canvas) return;
      const canvasRect = rectOf(canvas);
      antipodalViewport.canvas = canvasRect;
      const obstacles = [];
      for (const element of document.querySelectorAll(AVOID)) {
        if (element.closest('[hidden], [inert]')) continue;
        const style = getComputedStyle(element), r = rectOf(element);
        if (style.visibility === 'hidden' || style.display === 'none' || +style.opacity === 0 || !r.width || !r.height) continue;
        obstacles.push(r);
      }
      const bounds = antipodalViewport.cube;
      const cube = bounds && { x: canvasRect.x + bounds.x * canvasRect.width, y: canvasRect.y + bounds.y * canvasRect.height,
        width: bounds.width * canvasRect.width, height: bounds.height * canvasRect.height };
      const style = safeArea.current && getComputedStyle(safeArea.current);
      const insets = style ? { left: parseFloat(style.paddingLeft), top: parseFloat(style.paddingTop), right: parseFloat(style.paddingRight), bottom: parseFloat(style.paddingBottom) } : {};
      const next = placeAntipodalPanel({ width: window.innerWidth, height: window.innerHeight, obstacles, cube, insets, ...preference, previous: previous.current });
      if (JSON.stringify(next) !== JSON.stringify(previous.current)) {
        antipodalViewport.rect = null; // Never render into the frame's old position.
        previous.current = next;
        setPlacement(next);
      }
    };
    measure();
    const timer = setInterval(measure, 250);
    window.addEventListener('resize', measure);
    return () => { clearInterval(timer); window.removeEventListener('resize', measure); antipodalViewport.rect = null; };
  }, [enabled, preference]);

  useLayoutEffect(() => {
    if (!enabled || !placement || placement.compact) { antipodalViewport.rect = null; return; }
    const canvas = document.querySelector('.canvas-container canvas');
    const measure = () => {
      antipodalViewport.rect = view.current && rectOf(view.current);
      antipodalViewport.canvas = canvas && rectOf(canvas);
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    if (view.current) observer?.observe(view.current);
    if (canvas) observer?.observe(canvas);
    window.addEventListener('resize', measure);
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); antipodalViewport.rect = null; };
  }, [enabled, placement]);

  if (!enabled) return null;
  const folded = placement?.compact ?? true;
  return <>
    <span ref={safeArea} className="antipodal-safe-area" aria-hidden="true" />
    {placement && <section className="antipodal-panel" style={{ ...GAME_HUD_VARS, left: placement.x, top: placement.y, width: placement.width }}
      aria-label="Far-side camera" data-game-input="ui" onPointerDown={stop} onTouchStart={stop} onTouchEnd={stop} onWheel={stop} onKeyDown={stop}>
      <div className="antipodal-panel-header">
        <button type="button" className="antipodal-panel-toggle" aria-expanded={!folded} aria-controls="antipodal-camera-view"
          aria-label={folded ? 'Expand far-side camera' : 'Collapse far-side camera'} onClick={() => {
            previous.current = null;
            setPreference(p => ({ ...p, compact: !folded, expanded: folded }));
          }}><span aria-hidden="true">{folded ? '＋' : '−'}</span> Far side</button>
        <button type="button" className="antipodal-panel-move" aria-label="Move far-side camera" title="Move to another corner"
          onClick={() => { previous.current = null; setPreference(p => ({ ...p, corner: (p.corner + 1) % 4 })); }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M3 3l6 6m12-6-6 6M3 21l6-6m12 6-6-6" /></svg>
        </button>
      </div>
      <div className="antipodal-panel-mat" hidden={folded}><div ref={view} id="antipodal-camera-view" className="antipodal-panel-view" /></div>
    </section>}
  </>;
}
