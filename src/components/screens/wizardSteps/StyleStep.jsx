// StyleStep.jsx — pick the tile surface, applied to the live cube as you pick it.
//
// The catalogue is ~150 styles in eight families. Flat it was thousands of
// pixels of scrolling; as accordions the family you opened pushed the cube
// preview off screen; as a pill row it fit four families on a phone and hid the
// rest behind a horizontal swipe. It is laid out like the store now: every
// family down a sidebar, each with a cover tile and how many of its styles you
// own, and the open family's grid beside it. The sidebar sticks under the
// category bar, so switching family never means scrolling back up.
//
// Rendered twice by the wizard: `slot="hero"` for the full-width plate across
// the top of the sheet, `slot="body"` for the browser under it. No slot renders
// both.

import React, { useRef } from 'react';
import { COLOR_SCHEMES, TILE_STYLES } from '../../../utils/colorSchemes.js';
import { TILE_STYLE_SECTIONS } from '../../../utils/tileStyleCatalog.js';
import { WIZ_BORDER_SOFT, WIZ_CARD_SHADOW, WIZ_SURFACE, WIZ_SURFACE_RAISED, WIZ_TEXT, WIZ_TEXT_MUTED } from '../WizardChrome.jsx';
import { wormMenuFeedback } from '../wormMenuFeedback.js';
import CubePlate from './CubePlate.jsx';
import { useIsMobile } from '../../../hooks/index.js';
import { Checkmark, LockPip, TilePreviewCanvas, cardStyle, sizeTier, bgOptionFor, FACE_LABELS, paletteLabel, styleLabel, uniformStyle } from './shared.jsx';
import { resolveStyleFamily, PER_FACE_FAMILY } from './styleCategory.jsx';
import './StyleStep.css';

const PANEL_ID = 'style-browser-panel';

/** The sidebar: one row per family, then Per Face set apart under them. */
function FamilyRail({ active, onSelect, owned, coverColor, colors, showPerFace }) {
  const row = (key, label, cover, detail, locked) => (
    <button
      key={key}
      type="button"
      className="style-browser-family"
      aria-pressed={active === key}
      aria-controls={PANEL_ID}
      onClick={() => { wormMenuFeedback(); onSelect(key); }}
    >
      {cover}
      <span>
        <strong>{label}</strong>
        <small>{locked > 0 && <LockPip size={8} />}{detail}</small>
      </span>
      <b aria-hidden="true">›</b>
    </button>
  );
  return (
    <nav className="style-browser-rail" aria-label="Tile families">
      {TILE_STYLE_SECTIONS.map(sec => {
        const have = sec.keys.filter(owned).length;
        // The family's first style is its cover, in the cube's front colour.
        const cover = (
          <span className="style-browser-cover" aria-hidden="true">
            <TilePreviewCanvas styleKey={sec.keys[0]} colorHex={coverColor} size={28} />
          </span>
        );
        return row(sec.key, sec.label, cover, `${have} / ${sec.keys.length} owned`, sec.keys.length - have);
      })}
      {showPerFace && (
        <div className="style-browser-perface">
          {row(PER_FACE_FAMILY, 'Per Face', (
            <span className="style-browser-cover style-browser-cover--faces" aria-hidden="true">
              {[1, 2, 3, 4, 5, 6, 3, 1, 5].map((id, i) => <i key={i} style={{ background: colors[id] }} />)}
            </span>
          ), 'A style per face', 0)}
        </div>
      )}
    </nav>
  );
}

export default function StyleStep({ cos, family, slot }) {
  const isMobile = useIsMobile();
  const { settings, setSettings, cubeSize, colors, accent, accentShadow, ownedItems, setStyleFamily, showPerFace = true } = cos;

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

  // Like the store, a new family opens at its top: if the grid has been
  // scrolled up under the category bar, bring the browser back to just below it.
  const browserRef = useRef(null);
  const openFamily = key => {
    setStyleFamily(key);
    const el = browserRef.current, scroller = el?.closest('.mode-wizard-scroll');
    if (!scroller) return;
    const barH = parseFloat(getComputedStyle(scroller).getPropertyValue('--wizard-bar-h')) || 0;
    const overshoot = scroller.getBoundingClientRect().top + barH - el.getBoundingClientRect().top;
    if (overshoot > 0) scroller.scrollTop -= overshoot;
  };

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

      {slot !== 'hero' && (
        <div className="style-browser" ref={browserRef}>
          <FamilyRail
            active={activeFamily}
            onSelect={openFamily}
            owned={owned}
            coverColor={swatchColor}
            colors={colors}
            showPerFace={showPerFace}
          />
          <section className="style-browser-panel" id={PANEL_ID} aria-label={showingPerFace ? 'Per Face' : section.label}>
            <div className="style-browser-heading">
              <h2>{showingPerFace ? 'Per Face' : section.label}</h2>
              <small>{showingPerFace ? '6 faces' : `${section.keys.length} styles`}</small>
            </div>
            {showingPerFace ? (
              <>
                <p className="style-browser-note">
                  Give each face its own surface. Every face starts on the style you picked, so change
                  only the ones you want to differ.
                </p>
                <div className="style-browser-faces">
                  {[1, 2, 3, 4, 5, 6].map(faceId => {
                    const fallback = settings.tileStyle === 'random' ? 'solid' : settings.tileStyle || 'solid';
                    const raw = perFace?.[faceId] || fallback;
                    const faceStyle = owned(raw) ? raw : 'solid';
                    const faceColor = colors[faceId] || COLOR_SCHEMES.standard[faceId];
                    return (
                      <div key={faceId} style={{
                        display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0,
                        padding: '8px', borderRadius: '10px', background: WIZ_SURFACE,
                        border: `2px solid ${faceColor}55`
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                          <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: faceColor, flexShrink: 0, boxShadow: '0 1px 0 rgba(0,0,0,0.20)' }} />
                          <span style={{ fontSize: '11px', fontWeight: 600, color: WIZ_TEXT_MUTED }}>{FACE_LABELS[faceId]}</span>
                        </div>
                        <TilePreviewCanvas
                          styleKey={faceStyle === 'random' ? 'solid' : faceStyle}
                          colorHex={faceColor}
                          size={96}
                          canvasStyle={{ width: '100%', height: 'auto' }}
                        />
                        <select
                          value={faceStyle}
                          aria-label={`${FACE_LABELS[faceId]} face style`}
                          onChange={e => applyPerFace(faceId, e.target.value)}
                          style={{
                            fontSize: '11px', padding: '6px 8px', borderRadius: '6px',
                            border: `1px solid ${WIZ_BORDER_SOFT}`, background: WIZ_SURFACE_RAISED,
                            color: WIZ_TEXT, fontFamily: 'inherit', cursor: 'pointer',
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
                  type="button"
                  aria-pressed={isRandom}
                  style={{ ...cardStyle(isRandom, accent), flexDirection: 'row', alignItems: 'center', gap: '14px', marginBottom: '12px', padding: '11px 14px' }}
                  onClick={() => applyGlobal('random')}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: WIZ_TEXT }}>Random Mix</div>
                    <div style={{ fontSize: '11px', color: WIZ_TEXT_MUTED, marginTop: '2px' }}>A different style on every face</div>
                  </div>
                  {isRandom && <Checkmark accent={accent} accentShadow={accentShadow} />}
                </button>

                {/* Labels sit below the art on phones, over it on wider screens. */}
                <div className="style-browser-grid" role="group" aria-label={`${section.label} styles`}>
                  {section.keys.map(key => {
                    const sel = globalStyle === key;
                    const unlocked = owned(key);
                    return (
                      <button
                        key={key}
                        type="button"
                        title={TILE_STYLES[key]?.label || key}
                        aria-label={`${TILE_STYLES[key]?.label || key}${unlocked ? '' : ' (locked)'}`}
                        aria-pressed={sel}
                        aria-disabled={!unlocked}
                        onClick={() => unlocked && applyGlobal(key)}
                        style={{
                          display: 'block', position: 'relative', minWidth: 0, padding: 0, borderRadius: isMobile ? '6px' : '10px',
                          border: sel ? `2px solid ${accent}` : `2px solid ${WIZ_BORDER_SOFT}`,
                          background: WIZ_SURFACE,
                          boxShadow: sel ? 'inset 0 2px 4px rgba(0,0,0,0.10)' : `0 2px 0 ${WIZ_CARD_SHADOW}, 0 3px 6px rgba(0,0,0,0.06)`,
                          transform: sel ? 'translateY(1px)' : 'none',
                          cursor: unlocked ? 'pointer' : 'not-allowed',
                          opacity: unlocked ? 1 : 0.42,
                          WebkitTapHighlightColor: 'transparent',
                          transition: 'all 0.15s ease', fontFamily: 'inherit', overflow: 'hidden'
                        }}
                      >
                        <TilePreviewCanvas active={sel} styleKey={key} colorHex={swatchColor} size={56} canvasStyle={{ width: '100%', height: 'auto', borderRadius: 0 }} />
                        <span style={{
                          position: isMobile ? 'relative' : 'absolute', display: 'block', bottom: 0, left: 0, right: 0, textAlign: 'center',
                          overflowWrap: 'anywhere', minHeight: isMobile ? '24px' : undefined,
                          padding: isMobile ? '3px 1px' : '14px 3px 4px', fontSize: isMobile ? '9px' : '10px', fontWeight: sel ? 700 : 500,
                          color: '#fff', textShadow: '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
                          lineHeight: 1.2, background: isMobile ? '#263029' : 'linear-gradient(to top, rgba(0,0,0,0.62) 0%, transparent 100%)'
                        }}>
                          {TILE_STYLES[key]?.label || key}{!unlocked ? ' 🔒' : ''}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
}
