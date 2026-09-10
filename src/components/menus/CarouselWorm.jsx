import React, { useEffect, useState } from 'react';
import WormPreviewCanvas from '../../3d/WormPreviewCanvas.jsx';
import { useGameStore } from '../../hooks/useGameStore.js';
import { WORM_CHARACTERS } from '../../worm/wormCharacterData.js';
import './carouselWorm.css';

const SKINS = { mobi: 'ice', classic: 'slime', inch: 'gold', glow: 'toxic', book: 'lava', wiggle: 'bubble', prism: 'royal' };

function RoamingWorm({ character, index, selected, skinId, hatId, paused, reduced, disabled, onTouch }) {
  const [jumping, setJumping] = useState(false);
  const duration = 4 + (index % 4) * 0.7;
  return <div className="carousel-worm-lane" style={{ '--duration': `${duration}s`, '--cycle': `${duration * 2}s`, '--delay': `${-index * 1.3}s` }}>
    <button type="button" className="carousel-worm-runner" disabled={disabled}
      aria-label={`Make ${character.label} hop`}
      onClick={() => { onTouch(); setJumping(!reduced); }}>
      <span className="carousel-worm-shadow" aria-hidden="true" data-jumping={jumping} />
      <span className="carousel-worm-facing" aria-hidden="true">
        <span className="carousel-worm-jump" data-jumping={jumping}
          onAnimationEnd={() => setJumping(false)}>
          <WormPreviewCanvas characterId={character.id} skinId={selected ? skinId : SKINS[character.id] ?? 'slime'}
            hatId={selected ? hatId : 'none'} size={180} maxPixelRatio={1} framing="runway" animated={!paused}
            style={{ width: '100%', height: 'auto' }} />
        </span>
      </span>
    </button>
  </div>;
}

export default function CarouselWorm({ disabled = false }) {
  const characterId = useGameStore(s => s.wormCharacter);
  const skinId = useGameStore(s => s.wormSkin);
  const hatId = useGameStore(s => s.wormHat);
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
  return <div className="carousel-worm" role="group" aria-label="Meet the worms" data-paused={paused}>
    <div className="carousel-worm-gathering">
      {WORM_CHARACTERS.map((character, index) => <RoamingWorm key={character.id}
        character={character} index={index} selected={character.id === characterId}
        skinId={skinId} hatId={hatId} paused={paused} reduced={reduced} disabled={disabled}
        onTouch={() => setTouched(true)} />)}
    </div>
    <span className="carousel-worm-hint" aria-live="polite">{!touched ? 'Tap a worm to hop' : reduced ? 'Hello!' : '\u00a0'}</span>
  </div>;
}
