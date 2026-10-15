import React, { useLayoutEffect, useRef } from 'react';
import { victoryViewport, victoryView, resetVictoryView, rotateVictoryView, zoomVictoryView } from './victoryFrame.js';
import './victoryCubeStage.css';

const stopTouch = event => event.stopPropagation();
const gesture = pointers => {
  const [a, b] = [...pointers.values()];
  return b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, gap: Math.hypot(a.x - b.x, a.y - b.y) }
    : a && { ...a, gap: 0 };
};

export default function VictoryCubeStage() {
  const stage = useRef(null), pointers = useRef(new Map());
  useLayoutEffect(() => {
    resetVictoryView();
    const node = stage.current, activePointers = pointers.current;
    const measure = () => {
      const rect = node.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      victoryViewport.current = { left: rect.left / window.innerWidth, top: rect.top / window.innerHeight,
        width: rect.width / window.innerWidth, height: rect.height / window.innerHeight };
    };
    const wheel = event => {
      if (event.target.closest('button')) return;
      event.preventDefault(); event.stopPropagation();
      zoomVictoryView(Math.exp(Math.max(-1, Math.min(1, event.deltaY * 0.002))));
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(node);
    window.addEventListener('resize', measure);
    node.addEventListener('wheel', wheel, { passive: false });
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
      node.removeEventListener('wheel', wheel);
      activePointers.clear();
      victoryViewport.current = null;
      resetVictoryView();
    };
  }, []);
  const down = event => {
    if (event.target.closest('button') || event.button !== 0 || pointers.current.size >= 2) return;
    event.preventDefault(); event.stopPropagation();
    stage.current.focus({ preventScroll: true });
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    stage.current.setPointerCapture(event.pointerId);
    victoryView.manual = true;
  };
  const move = event => {
    if (!pointers.current.has(event.pointerId)) return;
    event.preventDefault(); event.stopPropagation();
    const before = gesture(pointers.current);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const after = gesture(pointers.current);
    rotateVictoryView(after.x - before.x, after.y - before.y);
    if (before.gap > 0 && after.gap > 0) zoomVictoryView(before.gap / after.gap);
  };
  const end = event => {
    pointers.current.delete(event.pointerId);
    if (stage.current.hasPointerCapture?.(event.pointerId)) stage.current.releasePointerCapture(event.pointerId);
  };
  const key = event => {
    if (event.target !== event.currentTarget) return;
    const turns = { ArrowLeft: [-12, 0], ArrowRight: [12, 0], ArrowUp: [0, -12], ArrowDown: [0, 12] };
    if (turns[event.key]) rotateVictoryView(...turns[event.key]);
    else if (event.key === '+' || event.key === '=') zoomVictoryView(0.9);
    else if (event.key === '-') zoomVictoryView(1.1);
    else if (event.key === 'Home') resetVictoryView();
    else return;
    event.preventDefault(); event.stopPropagation();
  };
  return <div ref={stage} className="story-completion-cube" role="group" tabIndex={0} data-game-input="ui"
    aria-label="Completed cube and your worm. Drag to rotate, pinch or use plus and minus to zoom. Arrow keys rotate; Home resets the view."
    onPointerDown={down} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end}
    onTouchStart={stopTouch} onTouchMove={stopTouch} onTouchEnd={stopTouch} onTouchCancel={stopTouch} onKeyDown={key}>
    <div className="victory-cube-tools">
      <span>Drag to rotate · Pinch to zoom</span>
      <button type="button" onClick={resetVictoryView}>Reset view</button>
    </div>
  </div>;
}
