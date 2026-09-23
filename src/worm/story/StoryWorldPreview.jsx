import React from 'react';
import { STORY_WORLDS } from './worlds.js';
import { COLOR_SCHEMES, TILE_STYLES } from '../../utils/colorSchemes.js';
import { TilePreviewCanvas } from '../../components/screens/wizardSteps/shared.jsx';

export default function StoryWorldPreview({ levelId, compact = false }) {
  const world = STORY_WORLDS[levelId];
  const colors = COLOR_SCHEMES[world.palette];
  return <div className={`worm-world-preview${compact ? ' is-compact' : ''}`}
    aria-hidden={compact || undefined} aria-label={compact ? undefined : `${world.name} tile preview`}>
    {(compact ? [1] : [1,2,3,4,5,6]).map(face => <span key={face}
      className="worm-world-tile" title={TILE_STYLES[world.styles[face]].label}
      style={{ backgroundColor: colors[face] }}>
      <TilePreviewCanvas styleKey={world.styles[face]} colorHex={colors[face]} size={compact ? 40 : 72}
        canvasStyle={{ width: '100%', height: '100%', borderRadius: 0 }} />
    </span>)}
  </div>;
}
