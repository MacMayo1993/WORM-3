// StyleStep.jsx — pick the tile surface, applied to the live cube as you pick it.
//
// The catalogue is ~95 styles in four families. Laid out flat it was about three
// thousand pixels of scrolling, so it used to be four collapsing accordions —
// which kept the list short but pushed the thing you were previewing off screen
// the moment you opened one. Families are tabs now: the cube stays put at the
// top, and every style in a family is one tap away underneath it.

import React from 'react';
import { COLOR_SCHEMES, TILE_STYLES, SCHEME_LABELS } from '../../../utils/colorSchemes.js';
import { TILE_STYLE_SECTIONS } from '../../../utils/tileStyleCatalog.js';
import { PAPER_TEXT, PAPER_TEXT_MUTED, PAPER_TEXT_FAINT, PAPER_BG_MUTED, PAPER_CARD_SHADOW } from '../../../utils/uiTheme.js';
import { WizardSection } from '../WizardChrome.jsx';
import CubePlate from './CubePlate.jsx';
import { Checkmark, LockPip, TilePreviewCanvas, cardStyle, sizeTier, bgOptionFor, FACE_LABELS } from './shared.jsx';

export default function StyleStep({ cos }) {
  const {
    settings, setSettings, cubeSize, colors,
    accent, accentShadow, ownedItems, styleFamily, setStyleFamily,
    showPerFace = true
  } = cos;

  const owned = key => ownedItems.includes(`tile_${key}`);

  const perFace = settings.perFaceStyles;
  const faceValues = [1, 2, 3, 4, 5, 6].map(id => perFace?.[id] || settings.tileStyle || 'solid');
  const globalStyle = faceValues.every(v => v === faceValues[0]) ? faceValues[0] : null;
  const isRandom = settings.tileStyle === 'random' && !perFace;

  const applyGlobal = key => setSettings(s => ({ ...s, tileStyle: key, perFaceStyles: null }));
  const applyPerFace = (faceId, key) =>
    setSettings(s => ({ ...s, perFaceStyles: { ...(s.perFaceStyles || {}), [faceId]: key } }));

  // The family holding your current style is the one that opens, until you pick
  // a different tab.
  const homeFamily = TILE_STYLE_SECTIONS.find(sec => sec.keys.includes(globalStyle))?.key ?? 'classic';
  const activeFamily = styleFamily ?? homeFamily;
  const section = TILE_STYLE_SECTIONS.find(sec => sec.key === activeFamily) || TILE_STYLE_SECTIONS[0];

  // Arrows walk the owned styles of the family on screen.
  const walkable = section.keys.filter(owned);
  const atIndex = walkable.indexOf(globalStyle);
  const stepStyle = delta => {
    if (!walkable.length) return;
    const from = atIndex === -1 ? 0 : atIndex;
    applyGlobal(walkable[(from + delta + walkable.length) % walkable.length]);
  };

  const title = isRandom ? 'Random Mix' : TILE_STYLES[globalStyle]?.label || (perFace ? 'Per Face' : 'Solid');
  const paletteLabel = settings.colorScheme === 'custom' ? 'Your Photo' : SCHEME_LABELS[settings.colorScheme] || 'Standard';
  const swatchColor = colors[1] || '#4a7fa5';

  return (
    <>
      <CubePlate
        caption={section.label}
        index={atIndex === -1 ? undefined : atIndex + 1}
        total={atIndex === -1 ? undefined : walkable.length}
        title={title}
        subtitle={`${paletteLabel} · ${sizeTier(cubeSize).name}`}
        onPrev={() => stepStyle(-1)}
        onNext={() => stepStyle(1)}
        cube={{ size: cubeSize, colors, tileStyle: settings.tileStyle, perFaceStyles: settings.perFaceStyles }}
        glow={swatchColor}
        backdrop={bgOptionFor(settings.backgroundTheme)}
      />

      {/* Family tabs */}
      <div style={{
        display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '10px',
        scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch'
      }}>
        {TILE_STYLE_SECTIONS.map(sec => {
          const active = sec.key === activeFamily;
          const lockedHere = sec.keys.filter(k => !owned(k)).length;
          return (
            <button
              key={sec.key}
              onClick={() => setStyleFamily(sec.key)}
              style={{
                flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '8px 13px', borderRadius: '999px',
                border: active ? `2px solid ${accent}` : '2px solid #ded7cb',
                background: active ? `${accent}14` : 'rgba(255,255,255,0.62)',
                boxShadow: active ? 'inset 0 2px 4px rgba(83,72,56,0.10)' : `0 2px 0 ${PAPER_CARD_SHADOW}`,
                transform: active ? 'translateY(1px)' : 'none',
                cursor: 'pointer', fontFamily: 'inherit', WebkitTapHighlightColor: 'transparent',
                transition: 'all 0.15s ease',
                fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em',
                color: active ? accent : PAPER_TEXT_MUTED, whiteSpace: 'nowrap'
              }}
            >
              {sec.label}
              {lockedHere > 0 && <LockPip size={9} color={active ? accent : PAPER_TEXT_FAINT} />}
            </button>
          );
        })}
      </div>

      {/* Random Mix */}
      <button
        style={{ ...cardStyle(isRandom, accent), flexDirection: 'row', alignItems: 'center', gap: '14px', marginBottom: '12px', padding: '11px 14px' }}
        onClick={() => applyGlobal('random')}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: PAPER_TEXT }}>Random Mix</div>
          <div style={{ fontSize: '11px', color: PAPER_TEXT_MUTED, marginTop: '2px' }}>A different style on every face</div>
        </div>
        {isRandom && <Checkmark accent={accent} accentShadow={accentShadow} />}
      </button>

      {/* Styles in the active family */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '7px' }}>
        {section.keys.map(key => {
          const sel = globalStyle === key;
          const unlocked = owned(key);
          return (
            <button
              key={key}
              onClick={() => unlocked && applyGlobal(key)}
              style={{
                display: 'block', position: 'relative', padding: 0, borderRadius: '10px',
                border: sel ? `2px solid ${accent}` : '2px solid #d6d0c8',
                background: PAPER_BG_MUTED,
                boxShadow: sel ? 'inset 0 2px 4px rgba(0,0,0,0.10)' : `0 2px 0 ${PAPER_CARD_SHADOW}, 0 3px 6px rgba(0,0,0,0.06)`,
                transform: sel ? 'translateY(1px)' : 'none',
                cursor: unlocked ? 'pointer' : 'not-allowed',
                opacity: unlocked ? 1 : 0.42,
                WebkitTapHighlightColor: 'transparent',
                transition: 'all 0.15s ease', fontFamily: 'inherit', overflow: 'hidden'
              }}
            >
              <TilePreviewCanvas styleKey={key} colorHex={swatchColor} size={56} canvasStyle={{ width: '100%', height: 'auto', borderRadius: 0 }} />
              <span style={{
                position: 'absolute', bottom: 0, left: 0, right: 0, textAlign: 'center',
                padding: '14px 3px 4px', fontSize: '10px', fontWeight: sel ? 700 : 500,
                color: '#fff', textShadow: '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
                lineHeight: 1.2, background: 'linear-gradient(to top, rgba(0,0,0,0.62) 0%, transparent 100%)'
              }}>
                {TILE_STYLES[key]?.label || key}{!unlocked ? ' 🔒' : ''}
              </span>
            </button>
          );
        })}
      </div>

      {/* Per-face overrides — folded away; most players never want a different
          style on each face, and the ones who do go looking for it. */}
      {showPerFace && (
        <div style={{ marginTop: '12px' }}>
          <WizardSection
            label="Per Face"
            accent={accent}
            note={perFace ? 'Custom' : 'Advanced'}
            open={styleFamily === 'perFace'}
            onToggle={() => setStyleFamily(styleFamily === 'perFace' ? homeFamily : 'perFace')}
            sticky={false}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              {[1, 2, 3, 4, 5, 6].map(faceId => {
                const fallback = settings.tileStyle === 'random' ? 'solid' : settings.tileStyle || 'solid';
                const raw = perFace?.[faceId] || fallback;
                const faceStyle = owned(raw) ? raw : 'solid';
                const faceColor = colors[faceId] || COLOR_SCHEMES.standard[faceId];
                return (
                  <div key={faceId} style={{
                    display: 'flex', flexDirection: 'column', gap: '6px',
                    padding: '10px', borderRadius: '10px', background: PAPER_BG_MUTED,
                    border: `2px solid ${faceColor}55`
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: faceColor, flexShrink: 0, boxShadow: '0 1px 0 rgba(0,0,0,0.20)' }} />
                      <span style={{ fontSize: '11px', fontWeight: 600, color: PAPER_TEXT_MUTED }}>{FACE_LABELS[faceId]}</span>
                    </div>
                    <TilePreviewCanvas styleKey={faceStyle === 'random' ? 'solid' : faceStyle} colorHex={faceColor} size={36} />
                    <select
                      value={faceStyle}
                      onChange={e => applyPerFace(faceId, e.target.value)}
                      style={{
                        fontSize: '10px', padding: '4px 6px', borderRadius: '6px',
                        border: '1px solid #d6d0c8', background: '#f7f3ec',
                        color: PAPER_TEXT, fontFamily: 'inherit', cursor: 'pointer',
                        appearance: 'none', WebkitAppearance: 'none'
                      }}
                    >
                      {TILE_STYLE_SECTIONS.map(sec => (
                        <optgroup key={sec.key} label={sec.label}>
                          {sec.keys.filter(owned).map(k => <option key={k} value={k}>{TILE_STYLES[k]?.label || k}</option>)}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          </WizardSection>
        </div>
      )}
    </>
  );
}
