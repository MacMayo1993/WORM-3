// SceneStep.jsx — pick the environment, with the cube standing in it.
//
// Rendered twice by the wizard: once as `slot="hero"` for the full-width plate
// across the top of the sheet, once as `slot="body"` for the scrolling picker
// under it. Passing no slot renders both, which is what a caller outside the
// wizard chrome wants.

import React, { Suspense, useState } from 'react';
import { WIZ_SURFACE_RAISED } from '../WizardChrome.jsx';
import CubePlate from './CubePlate.jsx';
import { BG_OPTIONS, Checkmark, sizeTier, styleLabel } from './shared.jsx';
const ProjectiscopeCreator = React.lazy(() => import('../../../projectiscope/ProjectiscopeCreator.jsx'));

export default function SceneStep({ cos, slot }) {
  const { settings, select, cubeSize, colors, accent, accentShadow } = cos;
  const [creating, setCreating] = useState(false);
  const choose = value => value === 'projectiscope' ? setCreating(true) : select('backgroundTheme', value);

  const index = Math.max(0, BG_OPTIONS.findIndex(o => o.value === settings.backgroundTheme));
  const current = settings.backgroundTheme === 'projectiscope' && settings.projectiscopeDesign?.thumbnail
    ? { ...BG_OPTIONS[index], thumbnail: settings.projectiscopeDesign.thumbnail } : BG_OPTIONS[index];
  const step = delta => choose(BG_OPTIONS[(index + delta + BG_OPTIONS.length) % BG_OPTIONS.length].value);

  return (
    <>
      {slot !== 'body' && (
      <CubePlate
        caption="Scene"
        index={index + 1}
        total={BG_OPTIONS.length}
        title={current?.label || 'Scene'}
        subtitle={`${styleLabel(settings)} · ${sizeTier(cubeSize).name}`}
        onPrev={() => step(-1)}
        onNext={() => step(1)}
        cube={{ size: cubeSize, colors, tileStyle: settings.tileStyle, perFaceStyles: settings.perFaceStyles }}
        glow={colors[1]}
        backdrop={current}
      />
      )}

      {slot !== 'hero' && (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', paddingBottom: '8px' }}>
        {BG_OPTIONS.map(opt => {
          const selected = settings.backgroundTheme === opt.value;
          const thumbnail = opt.value === 'projectiscope' ? settings.projectiscopeDesign?.thumbnail : opt.thumbnail;
          return (
            <button
              key={opt.value}
              aria-pressed={selected}
              onClick={() => choose(opt.value)}
              style={{
                borderRadius: '10px', overflow: 'hidden', background: WIZ_SURFACE_RAISED,
                border: selected ? `3px solid ${accent}` : '3px solid transparent',
                boxShadow: selected ? `0 0 0 1px ${accent}44` : '0 2px 6px rgba(0,0,0,0.10)',
                cursor: 'pointer', transition: 'all 0.18s ease',
                position: 'relative', aspectRatio: '4/3', padding: 0,
                WebkitTapHighlightColor: 'transparent'
              }}
            >
              {thumbnail ? (
                <img src={thumbnail} alt={opt.label} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
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
      )}
      {creating && <Suspense fallback={<p role="status">Opening background creator…</p>}>
        <ProjectiscopeCreator design={settings.projectiscopeDesign} onCancel={() => setCreating(false)}
          onApply={projectiscopeDesign => {
            cos.setSettings(s => ({ ...s, backgroundTheme: 'projectiscope', projectiscopeDesign }));
            setCreating(false);
          }} />
      </Suspense>}
    </>
  );
}
