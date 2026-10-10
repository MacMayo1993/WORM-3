import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../../hooks/useGameStore.js';
import WormPreviewCanvas from '../../3d/WormPreviewCanvas.jsx';
import CubePreviewCanvas from '../../3d/CubePreviewCanvas.jsx';
import PaletteSwatches from '../../components/PaletteSwatches.jsx';
import { COLOR_SCHEMES } from '../../utils/colorSchemes.js';
import { accessoryFraming, accessoryPreviewEquipment, EMPTY_ACCESSORIES } from '../handmadeAccessoriesData.js';

// Shared renderers draw the real store asset once, without extra WebGL contexts
// or idle animation competing with the live victory scene.
export default function StoryRewardPreview({ item }) {
  const { character, skin } = useGameStore(useShallow(s => ({ character: s.wormCharacter, skin: s.wormSkin })));
  if (item.type === 'scheme' || item.type === 'tile') {
    const colors = COLOR_SCHEMES[item.schemeKey] ?? COLOR_SCHEMES.standard;
    return <>
      <CubePreviewCanvas px={112} size={3} colors={colors} tileStyle={item.tileKey ?? 'solid'} animated={false} interactive={false} />
      {item.type === 'scheme' && <PaletteSwatches colors={colors} />}
    </>;
  }
  return <WormPreviewCanvas size={128} maxRenderPixels={256} animated={false}
    characterId={item.characterId ?? character} skinId={item.skinId ?? skin} hatId={item.hatId ?? 'none'}
    accessories={accessoryPreviewEquipment(item, EMPTY_ACCESSORIES)}
    framing={item.type === 'hat' ? 'portrait' : item.type === 'accessory' ? accessoryFraming(item.slot) : 'body'} />;
}
