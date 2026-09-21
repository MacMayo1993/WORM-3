import { prefersReducedMotion } from '../utils/device.js';
import React, { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../hooks/useGameStore.js';
import { STORE_ITEMS } from '../utils/storeCatalog.js';
import { COLOR_SCHEMES } from '../utils/colorSchemes.js';
import WormPreviewCanvas from '../3d/WormPreviewCanvas.jsx';
import { registerTilePreview, unregisterTilePreview } from '../3d/TilePreviewRenderer.js';

function Tile({ tileKey }) {
  const ref = useRef(null);
  useEffect(() => {
    const id = registerTilePreview(ref.current, tileKey, '#a855f7');
    return () => unregisterTilePreview(id);
  }, [tileKey]);
  return <canvas ref={ref} width={220} height={220} aria-label="Tile style preview" />;
}
export default function RewardPreview({ choice }) {
  const { character, skin, hat } = useGameStore(useShallow(s => ({ character: s.wormCharacter, skin: s.wormSkin, hat: s.wormHat })));
  const item = choice?.item || STORE_ITEMS.find(i => i.id === choice?.items?.[0]);
  if (!item) return <div className="xp-points-preview" aria-label={choice?.label}><span aria-hidden="true">✦</span><strong>{choice?.points ?? 25}</strong><small>Parity Points</small></div>;
  if (item.type === 'skin' || item.type === 'hat') return <WormPreviewCanvas characterId={character} skinId={item.skinId || skin} hatId={item.hatId || hat} size={220} animated={!prefersReducedMotion()} framing="character" maxRenderPixels={440} />;
  if (item.type === 'tile') return <Tile key={item.tileKey} tileKey={item.tileKey} />;
  if (item.type === 'scheme') return <div className="xp-palette-preview" aria-label={`${item.label} palette`}>{Object.values(COLOR_SCHEMES[item.schemeKey] || COLOR_SCHEMES.standard).slice(0, 6).map((color, i) => <span key={i} style={{ background: color }} />)}</div>;
  return null;
}
