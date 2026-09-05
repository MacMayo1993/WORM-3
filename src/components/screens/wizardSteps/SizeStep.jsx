// SizeStep.jsx — the size slider, with the cube growing under it.
//
// Rendered twice by the wizard: `slot="hero"` for the full-width plate across
// the top of the sheet, `slot="body"` for the slider under it. No slot renders
// both.

import React from 'react';
import { WIZ_TEXT_MUTED } from '../WizardChrome.jsx';
import CubePlate from './CubePlate.jsx';
import CubeSizeSlider from './CubeSizeSlider.jsx';
import { SIZE_TIERS, sizeTier, bgOptionFor, paletteLabel, styleLabel } from './shared.jsx';

export default function SizeStep({ cos, tiers = SIZE_TIERS, slot }) {
  const { settings, cubeSize, setCubeSize, colors, accent, accentShadow } = cos;

  const tier = sizeTier(cubeSize, tiers);

  const sizeIndex = Math.max(0, tiers.findIndex(option => option.n === cubeSize));
  const adjacentSize = offset => tiers[Math.max(0, Math.min(tiers.length - 1, sizeIndex + offset))].n;

  return (
    <>
      {slot !== 'body' && (
      <CubePlate
        caption="Cube Size"
        index={sizeIndex + 1}
        total={tiers.length}
        title={tier.name}
        subtitle={`${paletteLabel(settings)} · ${styleLabel(settings)}`}
        onPrev={() => setCubeSize(adjacentSize(-1))}
        onNext={() => setCubeSize(adjacentSize(1))}
        cube={{ size: cubeSize, colors, tileStyle: settings.tileStyle, perFaceStyles: settings.perFaceStyles }}
        glow={colors[1]}
        backdrop={bgOptionFor(settings.backgroundTheme)}
      />
      )}

      {slot !== 'hero' && (
      <>
      <CubeSizeSlider value={cubeSize} onChange={setCubeSize} accent={accent} accentShadow={accentShadow} tiers={tiers} />

      <p style={{ fontSize: '11px', color: WIZ_TEXT_MUTED, lineHeight: 1.5, margin: '14px 2px 8px' }}>
        Bigger cubes keep the same rules — antipodal identification, the same flips — with more
        pieces to carry through them.
      </p>
      </>
      )}
    </>
  );
}
