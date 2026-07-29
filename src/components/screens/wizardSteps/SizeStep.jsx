// SizeStep.jsx — the size slider, with the cube growing under it.

import React from 'react';
import { TILE_STYLES, SCHEME_LABELS } from '../../../utils/colorSchemes.js';
import { PAPER_TEXT_MUTED } from '../../../utils/uiTheme.js';
import CubePlate from './CubePlate.jsx';
import CubeSizeSlider from './CubeSizeSlider.jsx';
import { SIZE_TIERS, sizeTier, bgOptionFor } from './shared.jsx';

export default function SizeStep({ cos, tiers = SIZE_TIERS }) {
  const { settings, cubeSize, setCubeSize, colors, accent, accentShadow } = cos;

  const tier = sizeTier(cubeSize, tiers);
  const styleLabel = settings.tileStyle === 'random' ? 'Random Mix' : TILE_STYLES[settings.tileStyle]?.label || 'Solid';
  const paletteLabel = settings.colorScheme === 'custom' ? 'Your Photo' : SCHEME_LABELS[settings.colorScheme] || 'Standard';

  const sizeIndex = Math.max(0, tiers.findIndex(option => option.n === cubeSize));
  const adjacentSize = offset => tiers[Math.max(0, Math.min(tiers.length - 1, sizeIndex + offset))].n;

  return (
    <>
      <CubePlate
        caption="Cube Size"
        index={sizeIndex + 1}
        total={tiers.length}
        title={tier.name}
        subtitle={`${paletteLabel} · ${styleLabel}`}
        onPrev={() => setCubeSize(adjacentSize(-1))}
        onNext={() => setCubeSize(adjacentSize(1))}
        cube={{ size: cubeSize, colors, tileStyle: settings.tileStyle, perFaceStyles: settings.perFaceStyles }}
        glow={colors[1]}
        backdrop={bgOptionFor(settings.backgroundTheme)}
      />

      <CubeSizeSlider value={cubeSize} onChange={setCubeSize} accent={accent} accentShadow={accentShadow} tiers={tiers} />

      <p style={{ fontSize: '11px', color: PAPER_TEXT_MUTED, lineHeight: 1.5, margin: '14px 2px 8px' }}>
        Bigger cubes keep the same rules — antipodal identification, the same flips — with more
        pieces to carry through them.
      </p>
    </>
  );
}
