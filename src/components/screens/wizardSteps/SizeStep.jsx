// SizeStep.jsx — the size slider, with the cube growing under it.

import React from 'react';
import { TILE_STYLES, SCHEME_LABELS } from '../../../utils/colorSchemes.js';
import { PAPER_TEXT_MUTED } from '../../../utils/uiTheme.js';
import CubePlate from './CubePlate.jsx';
import CubeSizeSlider from './CubeSizeSlider.jsx';
import { MIN_CUBE_SIZE, MAX_CUBE_SIZE, MEGA_WORM_TIER, sizeTier, bgOptionFor } from './shared.jsx';
import { MEGA_SIZE } from '../../../game/sliceIndex.js';
import { MEGA_WORM_ENABLED } from '../../../utils/megaFlag.js';
import { PAPER_SHEET_RAISED, PAPER_BORDER_SOFT, PAPER_TEXT, PAPER_TEXT_FAINT, RADIUS_MD } from '../../../utils/uiTheme.js';

/**
 * @param {boolean} allowMega - offer the experimental 15×15 tier. Worm mode only,
 *   and only when the ?megaworm flag is on: it is a separate performance class,
 *   not one more notch on the slider, so it gets its own opt-in rather than a
 *   slider stop that would misrepresent the jump.
 */
export default function SizeStep({ cos, allowMega = false }) {
  const { settings, cubeSize, setCubeSize, colors, accent, accentShadow } = cos;

  const megaOffered = allowMega && MEGA_WORM_ENABLED;
  const megaSelected = megaOffered && cubeSize === MEGA_SIZE;

  const tier = sizeTier(cubeSize);
  const styleLabel = settings.tileStyle === 'random' ? 'Random Mix' : TILE_STYLES[settings.tileStyle]?.label || 'Solid';
  const paletteLabel = settings.colorScheme === 'custom' ? 'Your Photo' : SCHEME_LABELS[settings.colorScheme] || 'Standard';

  const clamp = n => Math.max(MIN_CUBE_SIZE, Math.min(MAX_CUBE_SIZE, n));
  // Stepping off the Mega tier lands on the top standard size rather than
  // clamping 15 down one at a time.
  const step = d => setCubeSize(megaSelected ? MAX_CUBE_SIZE : clamp(cubeSize + d));

  return (
    <>
      <CubePlate
        caption="Cube Size"
        index={megaSelected ? MAX_CUBE_SIZE - MIN_CUBE_SIZE + 2 : cubeSize - MIN_CUBE_SIZE + 1}
        total={MAX_CUBE_SIZE - MIN_CUBE_SIZE + (megaOffered ? 2 : 1)}
        title={tier.name}
        subtitle={`${paletteLabel} · ${styleLabel}`}
        onPrev={() => step(-1)}
        onNext={() => (cubeSize === MAX_CUBE_SIZE && megaOffered ? setCubeSize(MEGA_SIZE) : step(1))}
        cube={{ size: megaSelected ? MAX_CUBE_SIZE : cubeSize, colors, tileStyle: settings.tileStyle, perFaceStyles: settings.perFaceStyles }}
        glow={colors[1]}
        backdrop={bgOptionFor(settings.backgroundTheme)}
      />

      <CubeSizeSlider
        value={megaSelected ? MAX_CUBE_SIZE : cubeSize}
        onChange={setCubeSize}
        accent={accent}
        accentShadow={accentShadow}
      />

      <p style={{ fontSize: '11px', color: PAPER_TEXT_MUTED, lineHeight: 1.5, margin: '14px 2px 8px' }}>
        Bigger cubes keep the same rules — antipodal identification, the same flips — with more
        pieces to carry through them.
      </p>

      {megaOffered && (
        <button
          type="button"
          onClick={() => setCubeSize(megaSelected ? MAX_CUBE_SIZE : MEGA_SIZE)}
          style={{
            display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer',
            background: PAPER_SHEET_RAISED,
            border: `2px solid ${megaSelected ? accent : PAPER_BORDER_SOFT}`,
            borderRadius: RADIUS_MD, padding: '12px 14px', margin: '4px 2px 8px',
            fontFamily: 'inherit',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: PAPER_TEXT }}>{MEGA_WORM_TIER.name}</span>
            <span style={{
              fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase',
              color: accent,
            }}>{MEGA_WORM_TIER.tag} · Experimental</span>
          </span>
          <span style={{ display: 'block', fontSize: 11, color: PAPER_TEXT_FAINT, marginTop: 3, lineHeight: 1.45 }}>
            {MEGA_WORM_TIER.desc}. Expect low frame rates — the renderer for this size
            is still being built.
          </span>
        </button>
      )}
    </>
  );
}
