import React, { useEffect, useState } from 'react';
import WormPreviewCanvas from '../../3d/WormPreviewCanvas.jsx';
import { useGameStore } from '../../hooks/useGameStore.js';
import './carouselWorm.css';

export default function CarouselWorm({ disabled = false }) {
  const characterId = useGameStore(s => s.wormCharacter);
  const skinId = useGameStore(s => s.wormSkin);
  const hatId = useGameStore(s => s.wormHat);
  const [jumping, setJumping] = useState(false);
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
    aria-label="Make your selected worm jump" data-paused={paused}
    onClick={() => { setTouched(true); setJumping(!reduced); }}>
    <span className="carousel-worm-runner">
      <span className="carousel-worm-facing">
        <span className="carousel-worm-jump" data-jumping={jumping}
          onAnimationEnd={() => setJumping(false)}>
          <WormPreviewCanvas characterId={characterId} skinId={skinId} hatId={hatId} size={96} animated={!paused} />
        </span>
      </span>
    </span>
    <span className="carousel-worm-hint">{!touched ? 'Tap to hop' : reduced ? 'Hello!' : '\u00a0'}</span>
  </button>;
}
