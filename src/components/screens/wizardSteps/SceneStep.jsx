// SceneStep.jsx — pick the environment, with the cube standing in it.

import React from 'react';
import { TILE_STYLES } from '../../../utils/colorSchemes.js';
import CubePlate from './CubePlate.jsx';
import { BG_OPTIONS, Checkmark, sizeTier } from './shared.jsx';

export default function SceneStep({ cos }) {
  const { settings, select, cubeSize, colors, accent, accentShadow } = cos;

  const index = Math.max(0, BG_OPTIONS.findIndex(o => o.value === settings.backgroundTheme));
  const current = BG_OPTIONS[index];
  const step = delta => select('backgroundTheme', BG_OPTIONS[(index + delta + BG_OPTIONS.length) % BG_OPTIONS.length].value);

  const styleLabel = settings.tileStyle === 'random' ? 'Random Mix' : TILE_STYLES[settings.tileStyle]?.label || 'Solid';

  return (
    <>
      <CubePlate
        caption="Scene"
        index={index + 1}
        total={BG_OPTIONS.length}
        title={current?.label || 'Scene'}
        subtitle={`${styleLabel} · ${sizeTier(cubeSize).name}`}
        onPrev={() => step(-1)}
        onNext={() => step(1)}
        cube={{ size: cubeSize, colors, tileStyle: settings.tileStyle, perFaceStyles: settings.perFaceStyles }}
        glow={colors[1]}
        backdrop={current}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', paddingBottom: '8px' }}>
        {BG_OPTIONS.map(opt => {
          const selected = settings.backgroundTheme === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => select('backgroundTheme', opt.value)}
              style={{
                borderRadius: '10px', overflow: 'hidden',
                border: selected ? `3px solid ${accent}` : '3px solid transparent',
                boxShadow: selected ? `0 0 0 1px ${accent}44` : '0 2px 6px rgba(0,0,0,0.10)',
                cursor: 'pointer', transition: 'all 0.18s ease',
                position: 'relative', aspectRatio: '4/3', padding: 0,
                WebkitTapHighlightColor: 'transparent'
              }}
            >
              {opt.thumbnail ? (
                <img src={opt.thumbnail} alt={opt.label} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', background: opt.gradient }} />
              )}
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                padding: '18px 8px 7px',
                background: 'linear-gradient(to top, rgba(0,0,0,0.72) 0%, transparent 100%)',
                fontSize: '10px', fontWeight: 500, color: '#fff', textAlign: 'center'
              }}>
                {opt.label}
              </div>
              {selected && (
                <div style={{ position: 'absolute', top: '7px', right: '7px' }}>
                  <Checkmark accent={accent} accentShadow={accentShadow} />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}
