import React, { useState } from 'react';
import { COLOR_SCHEMES, SCHEME_LABELS, TILE_STYLES, PALETTE_GROUPS, PALETTE_INFO } from '../../../utils/colorSchemes.js';
import { WIZ_TEXT_MUTED } from '../WizardChrome.jsx';
import CubePlate from './CubePlate.jsx';
import { WIZARD_SCHEME_KEYS, Checkmark, LockPip, sizeTier, bgOptionFor } from './shared.jsx';
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
  const styleLabel = settings.tileStyle === 'random' ? 'Random Mix' : TILE_STYLES[settings.tileStyle]?.label || 'Solid';
  return <>
    {slot !== 'body' && <CubePlate caption="Palette" index={atIndex < 0 ? undefined : atIndex + 1}
      total={atIndex < 0 ? undefined : unlocked.length}
      title={isCustom ? 'Your Photo' : SCHEME_LABELS[settings.colorScheme] || 'Standard'}
      subtitle={`${styleLabel} · ${sizeTier(cubeSize).name}`} onPrev={() => step(-1)} onNext={() => step(1)}
      cube={{ size: cubeSize, colors, tileStyle: settings.tileStyle, perFaceStyles: settings.perFaceStyles }}
      glow={colors[1]} backdrop={bgOptionFor(settings.backgroundTheme)}
      swatches={[1, 2, 3, 4, 5, 6].map(id => colors[id])} />}
    {slot !== 'hero' && <div className="palette-browser" style={{ '--palette-accent': accent }}>
      <div className="palette-intro">
        <strong>Six colors. Three opposite pairs.</strong>
        <p>Explore the colors below. Paired faces meet through a flip.</p>
      </div>
      <div className="palette-current" aria-label="Current opposite face colors">
        {PAIRS.map(pair => <div className="palette-pair" key={pair[0]}>
          {pair.map(id => <span className="palette-face" key={id}><span className="palette-face-color" aria-hidden="true" style={{ background: colors[id] }} /><span className="palette-face-label">{FACE_NAMES[id]}</span></span>)}
        </div>)}
      </div>
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
          return <button type="button" key={key} className="palette-card" aria-pressed={selected}
            disabled={!available} aria-label={`${SCHEME_LABELS[key]}${available ? '' : ', available in the store'}`}
            onClick={() => select('colorScheme', key)}>
            <span className="palette-card-colors" aria-hidden="true">
              {[1, 2, 3, 4, 5, 6].map(id => <span key={id} style={{ background: COLOR_SCHEMES[key][id] }} />)}
            </span>
            <span className="palette-card-heading"><strong>{SCHEME_LABELS[key]}</strong>
              {selected ? <Checkmark accent={accent} accentShadow={accentShadow} /> : !available ? <LockPip size={12} /> : null}
            </span>
            <span className="palette-card-description">{PALETTE_INFO[key]?.description}</span>
            <span className="palette-card-status">{selected ? 'Selected' : available ? PALETTE_INFO[key]?.group : 'In the store'}</span>
          </button>;
        })}
      </div>
      {shown.length === 0 && <p className="palette-empty">No owned palettes in this family. Turn off “Owned only” to explore it.</p>}
      <button type="button" className="palette-upload" aria-pressed={isCustom} onClick={openImagePicker}>
        {customPreview && <img src={customPreview} alt="Your palette source" />}
        <span><strong>{isCustom ? 'Your photo palette' : 'Make a palette from a photo'}</strong>
          <span style={{ color: WIZ_TEXT_MUTED }}>Choose an image and preview its six colors.</span></span>
        {isCustom && <Checkmark accent={accent} accentShadow={accentShadow} />}
      </button>
    </div>}
  </>;
}
