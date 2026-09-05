// PaletteStep.jsx — pick the six face colours, wearing them as you go.
//
// A palette used to be six swatches in a row, which tells you the colours but
// not the cube: standard and neon look nearly identical as swatch strips and
// nothing alike on a tumbling 5×5. The cube above the grid is the point.

import React from 'react';
import { COLOR_SCHEMES, SCHEME_LABELS, TILE_STYLES } from '../../../utils/colorSchemes.js';
import { TEXT_MICRO } from '../../../utils/uiTheme.js';
import { WIZ_BORDER_SOFT, WIZ_SURFACE, WIZ_TEXT, WIZ_TEXT_FAINT, WIZ_TEXT_MUTED } from '../WizardChrome.jsx';
import CubePlate from './CubePlate.jsx';
import {
  WIZARD_SCHEME_KEYS, SORTED_SCHEME_COLORS,
  Checkmark, LockPip, TilePreviewCanvas, cardStyle, sizeTier, bgOptionFor
} from './shared.jsx';

export default function PaletteStep({ cos, slot }) {
  const { settings, select, cubeSize, colors, accent, accentShadow, ownedItems, customPreview, openImagePicker } = cos;

  const owned = key => key === 'custom' || ownedItems.includes(`scheme_${key}`);
  const isCustom = settings.colorScheme === 'custom';

  // The arrows walk the palettes you actually own — stepping onto a locked one
  // and being unable to choose it is a dead end.
  const unlocked = WIZARD_SCHEME_KEYS.filter(owned);
  const atIndex = unlocked.indexOf(settings.colorScheme);
  const step = delta => {
    if (!unlocked.length) return;
    const from = atIndex === -1 ? 0 : atIndex;
    select('colorScheme', unlocked[(from + delta + unlocked.length) % unlocked.length]);
  };

  const previewStyle = settings.tileStyle === 'random' ? 'solid' : settings.tileStyle || 'solid';
  const styleLabel = settings.tileStyle === 'random' ? 'Random Mix' : TILE_STYLES[settings.tileStyle]?.label || 'Solid';
  const lockedCount = WIZARD_SCHEME_KEYS.length - unlocked.length;

  return (
    <>
      {slot !== 'body' && (
      <CubePlate
        caption="Palette"
        index={atIndex === -1 ? undefined : atIndex + 1}
        total={atIndex === -1 ? undefined : unlocked.length}
        title={isCustom ? 'Your Photo' : SCHEME_LABELS[settings.colorScheme] || 'Standard'}
        subtitle={`${styleLabel} · ${sizeTier(cubeSize).name}`}
        onPrev={() => step(-1)}
        onNext={() => step(1)}
        cube={{ size: cubeSize, colors, tileStyle: settings.tileStyle, perFaceStyles: settings.perFaceStyles }}
        glow={colors[1]}
        backdrop={bgOptionFor(settings.backgroundTheme)}
        swatches={[1, 2, 3, 4, 5, 6].map(id => colors[id])}
      />
      )}

      {slot !== 'hero' && (
      <>
      {/* Extract from image */}
      <button
        style={{ ...cardStyle(isCustom, accent), flexDirection: 'row', alignItems: 'center', gap: '14px', marginBottom: '14px' }}
        onClick={openImagePicker}
      >
        {customPreview ? (
          <img src={customPreview} alt="Uploaded" style={{ width: '56px', height: '36px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0 }} />
        ) : (
          <div style={{
            width: '56px', height: '36px', borderRadius: '8px', background: WIZ_SURFACE,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '10px', fontWeight: 600, letterSpacing: '0.06em',
            color: WIZ_TEXT_FAINT, flexShrink: 0, border: `1px solid ${WIZ_BORDER_SOFT}`
          }}>IMG</div>
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '14px', fontWeight: isCustom ? 600 : 500, color: WIZ_TEXT }}>Extract from Image</div>
          <div style={{ fontSize: '12px', color: WIZ_TEXT_MUTED, marginTop: '2px' }}>
            {customPreview ? 'Tap to change image' : 'Upload a photo to auto-generate a palette'}
          </div>
        </div>
        {isCustom && <Checkmark accent={accent} accentShadow={accentShadow} />}
      </button>

      {/* Divider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
        <div style={{ flex: 1, height: '1px', background: WIZ_BORDER_SOFT }} />
        <span style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: WIZ_TEXT_FAINT }}>
          Presets
        </span>
        {lockedCount > 0 && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: TEXT_MICRO, fontWeight: 700, color: WIZ_TEXT_FAINT }}>
            <LockPip size={9} /> {lockedCount} in the store
          </span>
        )}
        <div style={{ flex: 1, height: '1px', background: WIZ_BORDER_SOFT }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '7px', paddingBottom: '8px' }}>
        {WIZARD_SCHEME_KEYS.map(key => {
          const selected = settings.colorScheme === key;
          const unlockedHere = owned(key);
          const swatches = SORTED_SCHEME_COLORS[key] || Object.values(COLOR_SCHEMES[key] || {});
          return (
            <button
              key={key}
              onClick={() => unlockedHere && select('colorScheme', key)}
              style={{
                ...cardStyle(selected, accent),
                flexDirection: 'column', gap: '6px', padding: '10px 12px',
                ...(unlockedHere ? {} : { opacity: 0.42, cursor: 'not-allowed', pointerEvents: 'none' })
              }}
            >
              <span style={{ fontSize: '12px', fontWeight: selected ? 600 : 400, color: selected ? WIZ_TEXT : WIZ_TEXT_MUTED, lineHeight: 1.2 }}>
                {SCHEME_LABELS[key]}{!unlockedHere ? ' 🔒' : ''}
              </span>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '5px', overflow: 'hidden', flexShrink: 0 }}>
                  <TilePreviewCanvas styleKey={previewStyle} colorHex={swatches[0] || '#4a7fa5'} size={32} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '3px', flex: 1 }}>
                  {swatches.slice(1).map((c, i) => (
                    <div key={i} style={{
                      width: '100%', aspectRatio: '1', borderRadius: '3px',
                      background: unlockedHere ? c : '#bbb', boxShadow: '0 1px 2px rgba(0,0,0,0.18)'
                    }} />
                  ))}
                </div>
              </div>
              {selected && (
                <div style={{ position: 'absolute', top: '8px', right: '8px' }}>
                  <Checkmark accent={accent} accentShadow={accentShadow} />
                </div>
              )}
            </button>
          );
        })}
      </div>
      </>
      )}
    </>
  );
}
