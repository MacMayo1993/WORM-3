// StyleStep.jsx — pick the tile surface, applied to the live cube as you pick it.
//
// The catalogue is ~95 styles in six families. Flat it was three thousand pixels
// of scrolling; as accordions the family you opened pushed the cube preview off
// screen; as a pill row across the top it fit four families on a phone and hid
// the other three behind a horizontal swipe. The families live in the wizard
// rail now (see styleCategory.jsx) — all of them visible, none of them costing
// this panel any vertical space. What is left here is the preview and the grid
// for whichever family the rail has selected.
//
// Rendered twice by the wizard: `slot="hero"` for the full-width plate across
// the top of the sheet, `slot="body"` for the grid under it. No slot renders
// both.

import React from 'react';
import { COLOR_SCHEMES, TILE_STYLES } from '../../../utils/colorSchemes.js';
import { TILE_STYLE_SECTIONS } from '../../../utils/tileStyleCatalog.js';
import { PAPER_TEXT, PAPER_TEXT_MUTED, PAPER_BG_MUTED, PAPER_CARD_SHADOW, PAPER_BORDER_SOFT } from '../../../utils/uiTheme.js';
import CubePlate from './CubePlate.jsx';
import { useIsMobile } from '../../../hooks/index.js';
import { Checkmark, TilePreviewCanvas, cardStyle, sizeTier, bgOptionFor, FACE_LABELS, paletteLabel, styleLabel, uniformStyle } from './shared.jsx';
import { resolveStyleFamily, PER_FACE_FAMILY } from './styleCategory.jsx';

export default function StyleStep({ cos, family, slot }) {
  const isMobile = useIsMobile();
  const { settings, setSettings, cubeSize, colors, accent, accentShadow, ownedItems } = cos;

  const owned = key => ownedItems.includes(`tile_${key}`);

  const perFace = settings.perFaceStyles;
  const globalStyle = uniformStyle(settings);
  const isRandom = settings.tileStyle === 'random' && !perFace;

  const applyGlobal = key => setSettings(s => ({ ...s, tileStyle: key, perFaceStyles: null }));
  const applyPerFace = (faceId, key) =>
    setSettings(s => ({ ...s, perFaceStyles: { ...(s.perFaceStyles || {}), [faceId]: key } }));

  // The rail resolves this and passes it down; the fallback keeps the panel
  // standing on its own if it is ever rendered without one.
  const activeFamily = family ?? resolveStyleFamily(settings, cos.styleFamily);
  const showingPerFace = activeFamily === PER_FACE_FAMILY;
  const section = TILE_STYLE_SECTIONS.find(sec => sec.key === activeFamily) || TILE_STYLE_SECTIONS[0];

  // Arrows walk the owned styles of the family on screen.
  const walkable = section.keys.filter(owned);
  const atIndex = walkable.indexOf(globalStyle);
  const stepStyle = delta => {
    if (!walkable.length) return;
    const from = atIndex === -1 ? 0 : atIndex;
    applyGlobal(walkable[(from + delta + walkable.length) % walkable.length]);
  };

  const swatchColor = colors[1] || '#4a7fa5';

  return (
    <>
      {slot !== 'body' && (
      <CubePlate
        caption={showingPerFace ? 'Per Face' : section.label}
        index={showingPerFace || atIndex === -1 ? undefined : atIndex + 1}
        total={showingPerFace || atIndex === -1 ? undefined : walkable.length}
        title={styleLabel(settings)}
        subtitle={`${paletteLabel(settings)} · ${sizeTier(cubeSize).name}`}
        onPrev={showingPerFace ? undefined : () => stepStyle(-1)}
        onNext={showingPerFace ? undefined : () => stepStyle(1)}
        cube={{ size: cubeSize, colors, tileStyle: settings.tileStyle, perFaceStyles: settings.perFaceStyles }}
        glow={swatchColor}
        backdrop={bgOptionFor(settings.backgroundTheme)}
      />
      )}

      {slot !== 'hero' && (showingPerFace ? (
        <>
          <p style={{ fontSize: '11px', color: PAPER_TEXT_MUTED, lineHeight: 1.5, margin: '2px 2px 12px' }}>
            Give each face its own surface. Every face starts on the style you picked, so change
            only the ones you want to differ.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${isMobile ? 2 : 3}, minmax(0, 1fr))`, gap: '8px' }}>
            {[1, 2, 3, 4, 5, 6].map(faceId => {
              const fallback = settings.tileStyle === 'random' ? 'solid' : settings.tileStyle || 'solid';
              const raw = perFace?.[faceId] || fallback;
              const faceStyle = owned(raw) ? raw : 'solid';
              const faceColor = colors[faceId] || COLOR_SCHEMES.standard[faceId];
              return (
                <div key={faceId} style={{
                  display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0,
                  padding: '10px', borderRadius: '10px', background: PAPER_BG_MUTED,
                  border: `2px solid ${faceColor}55`
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: faceColor, flexShrink: 0, boxShadow: '0 1px 0 rgba(0,0,0,0.20)' }} />
                    <span style={{ fontSize: '11px', fontWeight: 600, color: PAPER_TEXT_MUTED }}>{FACE_LABELS[faceId]}</span>
                  </div>
                  <TilePreviewCanvas
                    styleKey={faceStyle === 'random' ? 'solid' : faceStyle}
                    colorHex={faceColor}
                    size={96}
                    canvasStyle={{ width: '100%', height: 'auto' }}
                  />
                  <select
                    value={faceStyle}
                    onChange={e => applyPerFace(faceId, e.target.value)}
                    style={{
                      fontSize: '10px', padding: '4px 6px', borderRadius: '6px',
                      border: `1px solid ${PAPER_BORDER_SOFT}`, background: '#f7f3ec',
                      color: PAPER_TEXT, fontFamily: 'inherit', cursor: 'pointer',
                      appearance: 'none', WebkitAppearance: 'none',
                      // Without these the select's intrinsic width sets the grid
                      // column and the whole panel scrolls sideways.
                      width: '100%', minWidth: 0, boxSizing: 'border-box'
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
        </>
      ) : (
        <>
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

          {/* Styles in the family the rail has selected. Three across on a phone —
              the rail takes its width off the pane, and four thumbnails there
              stop being readable. */}
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${isMobile ? 3 : 4}, minmax(0, 1fr))`, gap: '7px' }}>
            {section.keys.map(key => {
              const sel = globalStyle === key;
              const unlocked = owned(key);
              return (
                <button
                  key={key}
                  onClick={() => unlocked && applyGlobal(key)}
                  style={{
                    display: 'block', position: 'relative', padding: 0, borderRadius: '10px',
                    border: sel ? `2px solid ${accent}` : `2px solid ${PAPER_BORDER_SOFT}`,
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
        </>
      ))}
    </>
  );
}
