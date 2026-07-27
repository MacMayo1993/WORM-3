// SizeStep.jsx — the size slider, with the cube growing under it.

import React from 'react';
import { TILE_STYLES, SCHEME_LABELS } from '../../../utils/colorSchemes.js';
import { PAPER_TEXT_MUTED } from '../../../utils/uiTheme.js';
import CubePlate from './CubePlate.jsx';
import CubeSizeSlider from './CubeSizeSlider.jsx';
import { MIN_CUBE_SIZE, MAX_CUBE_SIZE, sizeTier, bgOptionFor } from './shared.jsx';

export default function SizeStep({ cos }) {
  const { settings, cubeSize, setCubeSize, colors, accent, accentShadow } = cos;

  const tier = sizeTier(cubeSize);
  const styleLabel = settings.tileStyle === 'random' ? 'Random Mix' : TILE_STYLES[settings.tileStyle]?.label || 'Solid';
  const paletteLabel = settings.colorScheme === 'custom' ? 'Your Photo' : SCHEME_LABELS[settings.colorScheme] || 'Standard';

  const clamp = n => Math.max(MIN_CUBE_SIZE, Math.min(MAX_CUBE_SIZE, n));

  return (
    <>
      <CubePlate
        caption="Cube Size"
        index={cubeSize - MIN_CUBE_SIZE + 1}
        total={MAX_CUBE_SIZE - MIN_CUBE_SIZE + 1}
        title={tier.name}
        subtitle={`${paletteLabel} · ${styleLabel}`}
        onPrev={() => setCubeSize(clamp(cubeSize - 1))}
        onNext={() => setCubeSize(clamp(cubeSize + 1))}
        cube={{ size: cubeSize, colors, tileStyle: settings.tileStyle, perFaceStyles: settings.perFaceStyles }}
        glow={colors[1]}
        backdrop={bgOptionFor(settings.backgroundTheme)}
      />

      <CubeSizeSlider value={cubeSize} onChange={setCubeSize} accent={accent} accentShadow={accentShadow} />

      <p style={{ fontSize: '11px', color: PAPER_TEXT_MUTED, lineHeight: 1.5, margin: '14px 2px 8px' }}>
        Bigger cubes keep the same rules — antipodal identification, the same flips — with more
        pieces to carry through them.
      </p>
    </>
  );
}
