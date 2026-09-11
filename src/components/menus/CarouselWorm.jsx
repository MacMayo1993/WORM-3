import React, { useEffect, useState } from 'react';
import WormPreviewCanvas from '../../3d/WormPreviewCanvas.jsx';
import { createMenuWormMotion, aimMenuWorm } from '../../3d/menuWormMotion.js';
import './carouselWorm.css';

export default function CarouselWorm({ disabled = false }) {
  const [companion] = useState(createMenuWormMotion);
  const [touched, setTouched] = useState(false);
  const [reduced, setReduced] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  const [hidden, setHidden] = useState(() => document.hidden);
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const motion = () => setReduced(media?.matches ?? false);
    const visibility = () => setHidden(document.hidden);
    media?.addEventListener('change', motion);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      media?.removeEventListener('change', motion);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);
  const paused = disabled || hidden || reduced;
  return <button type="button" className="carousel-worm" disabled={disabled}
    aria-label="Tap a spot for Glow Worm to follow" data-paused={paused}
    onClick={event => {
      setTouched(true);
      if (paused) return;
      const rect = event.currentTarget.querySelector('canvas')?.getBoundingClientRect();
      // Keyboard activation calls the worm to the middle of its ground plane.
      const u = event.detail && rect?.width ? (event.clientX - rect.left) / rect.width : 0.5;
      const v = event.detail && rect?.height ? (event.clientY - rect.top) / rect.height : 0.5;
      aimMenuWorm(companion, u, v);
    }}>
    <span className="carousel-worm-scene" aria-hidden="true">
      <WormPreviewCanvas characterId="glow" skinId="slime" hatId="none" size={400}
        framing="runway" companion={companion} animated={!paused} style={{ width: '100%', height: 'auto' }} />
    </span>
    <span className="carousel-worm-hint" aria-live="polite">{!touched ? 'Tap a spot — I’ll follow' : reduced ? 'Hello!' : '\u00a0'}</span>
  </button>;
}
