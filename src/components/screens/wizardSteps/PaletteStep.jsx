import React, { useState } from 'react';
import { COLOR_SCHEMES, PALETTE_GROUPS, PALETTE_INFO } from '../../../utils/colorSchemes.js';
import { WIZ_TEXT, WIZ_TEXT_MUTED, WIZ_SURFACE, WIZ_SURFACE_RAISED, WIZ_BORDER } from '../WizardChrome.jsx';
import { DISPLAY_FONT } from '../../../utils/uiTheme.js';
import CubePlate from './CubePlate.jsx';
import { WIZARD_SCHEME_KEYS, Checkmark, LockPip, sizeTier, bgOptionFor, paletteLabel, styleLabel } from './shared.jsx';
import './PaletteStep.css';

const PAIRS = [[1, 4], [2, 5], [3, 6]];
const FACE_NAMES = { 1: 'Front', 4: 'Back', 2: 'Left', 5: 'Right', 3: 'Top', 6: 'Bottom' };

export default function PaletteStep({ cos, slot }) {
  const { settings, select, cubeSize, colors, accent, accentShadow, ownedItems, customPreview, openImagePicker } = cos;
  const [group, setGroup] = useState('All');
  const [availableOnly, setAvailableOnly] = useState(false);
  const owned = key => key === 'standard' || ownedItems.includes(`scheme_${key}`);
  const unlocked = WIZARD_SCHEME_KEYS.filter(owned);
  const atIndex = unlocked.indexOf(settings.colorScheme);
  const isCustom = settings.colorScheme === 'custom';
  const step = delta => {
    if (!unlocked.length) return;
    const from = atIndex < 0 ? (delta > 0 ? -1 : 0) : atIndex;
    select('colorScheme', unlocked[(from + delta + unlocked.length) % unlocked.length]);
  };
  const shown = WIZARD_SCHEME_KEYS.filter(key => (group === 'All' || PALETTE_INFO[key]?.group === group)
    && (!availableOnly || owned(key)));
  return <>
    {slot !== 'body' && <CubePlate caption="Palette" index={atIndex < 0 ? undefined : atIndex + 1}
      total={atIndex < 0 ? undefined : unlocked.length}
      title={paletteLabel(settings)}
      subtitle={`${styleLabel(settings)} · ${sizeTier(cubeSize).name}`} onPrev={() => step(-1)} onNext={() => step(1)}
      cube={{ size: cubeSize, colors, tileStyle: settings.tileStyle, perFaceStyles: settings.perFaceStyles }}
      glow={colors[1]} backdrop={bgOptionFor(settings.backgroundTheme)}
      swatches={[1, 2, 3, 4, 5, 6].map(id => colors[id])} />}
    {slot !== 'hero' && <div className="palette-browser" style={{
      '--palette-accent': accent, '--palette-ink': WIZ_TEXT, '--palette-muted': WIZ_TEXT_MUTED,
      '--palette-surface': WIZ_SURFACE, '--palette-card': WIZ_SURFACE_RAISED,
      '--palette-border': WIZ_BORDER, '--palette-font': DISPLAY_FONT,
    }}>
      <div className="palette-filters" role="group" aria-label="Palette families">
        {PALETTE_GROUPS.map(name => <button key={name} type="button" aria-pressed={group === name}
          onClick={() => setGroup(name)}>{name}</button>)}
      </div>
      <div className="palette-toolbar">
        <span aria-live="polite">{shown.length} palettes</span>
        <label><input type="checkbox" checked={availableOnly} onChange={e => setAvailableOnly(e.target.checked)} /> Owned only</label>
      </div>
      <div className="palette-grid" role="group" aria-label="Choose a palette">
        {shown.map(key => {
          const selected = settings.colorScheme === key;
          const available = owned(key);
          const label = paletteLabel({ colorScheme: key });
          return <button type="button" key={key} className="palette-card" aria-pressed={selected}
            disabled={!available} aria-label={`${label}${available ? '' : ', available in the store'}`}
            title={`${label} · ${PALETTE_INFO[key]?.description || ''}${selected ? ' · Selected' : ''}`}
            onClick={() => select('colorScheme', key)}>
            <span className="palette-card-colors" aria-hidden="true">
              {[1, 2, 3, 4, 5, 6].map(id => <span key={id} style={{ background: COLOR_SCHEMES[key][id] }} />)}
            </span>
            <span className="palette-card-heading">{label}</span>
            {(selected || !available) && <span className="palette-card-badge" aria-hidden="true">
              {selected ? <Checkmark accent={accent} accentShadow={accentShadow} size={16} /> : <LockPip size={12} color={WIZ_TEXT} />}
            </span>}
          </button>;
        })}
      </div>
      {shown.length === 0 && <p className="palette-empty">No owned palettes in this family. Turn off “Owned only” to explore it.</p>}
      <button type="button" className="palette-upload" aria-pressed={isCustom} onClick={openImagePicker}>
        {customPreview && <img src={customPreview} alt="Your palette source" />}
        <span><strong>{isCustom ? paletteLabel(settings) : 'Make a palette from a photo'}</strong>
          <span style={{ color: WIZ_TEXT_MUTED }}>Choose an image and preview its six colors.</span></span>
        {isCustom && <Checkmark accent={accent} accentShadow={accentShadow} />}
      </button>
      <details className="palette-details">
        <summary>Opposite face colors</summary>
        <p>Six colors, three opposite pairs. Paired faces meet through a flip.</p>
        <div className="palette-current" aria-label="Current opposite face colors">
          {PAIRS.map(pair => <div className="palette-pair" key={pair[0]}>
            {pair.map(id => <span className="palette-face" key={id}><span className="palette-face-color" aria-hidden="true" style={{ background: colors[id] }} /><span className="palette-face-label">{FACE_NAMES[id]}</span></span>)}
          </div>)}
        </div>
      </details>
    </div>}
  </>;
}
