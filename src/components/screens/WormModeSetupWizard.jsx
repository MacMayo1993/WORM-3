import React, { useState, useRef } from 'react';
import { useGameStore } from '../../hooks/useGameStore.js';
import { WORM_SKINS, WORM_HATS } from '../../worm/wormCosmeticsData.js';
import { WORM_CHARACTERS } from '../../worm/wormCharacterData.js';
import { COLOR_SCHEMES, TILE_STYLES, SCHEME_LABELS } from '../../utils/colorSchemes.js';
import { CLASSIC_STYLE_KEYS, ANTIPODAL_STYLE_KEYS, LIVING_STYLE_KEYS, NON_EUCLIDEAN_STYLE_KEYS, TILE_STYLE_SECTIONS } from '../../utils/tileStyleCatalog.js';
import { BACKGROUNDS, getBackgroundUrl } from '../../utils/backgrounds.js';
import { registerTilePreview, updateTilePreview, unregisterTilePreview } from '../../3d/TilePreviewRenderer.js';
import { isMobile } from '../../utils/device.js';
import { extractColorsFromImage } from '../../utils/colorExtraction.js';
import {
  UI_FONT, DISPLAY_FONT,
  PAPER_BACKDROP, PAPER_BACKDROP_BLUR,
  PAPER_SHEET_RAISED, PAPER_BORDER, PAPER_BORDER_SOFT,
  PAPER_TEXT, PAPER_TEXT_MUTED, PAPER_TEXT_FAINT,
  PAPER_BG_MUTED, PAPER_CARD_SHADOW, PAPER_SHADOW,
  NIGHT_BORDER, NIGHT_TEXT, NIGHT_TEXT_MUTED, NIGHT_SHADOW, NIGHT_TITLE_SHADOW,
  UI_CREAM,
} from '../../utils/uiTheme.js';
import { BG_PREVIEWS } from '../../utils/bgPreviews.js';
import { wizardLayout, WizardSteps, WizardSection } from './WizardChrome.jsx';
import WormPreviewCanvas from '../../3d/WormPreviewCanvas.jsx';

const BG_OPTIONS = BACKGROUNDS.map(bg => ({
  value: bg.id,
  label: bg.label,
  thumbnail: bg.thumbnail ? getBackgroundUrl(bg.thumbnail) : null,
  gradient: BG_PREVIEWS[bg.id] || 'linear-gradient(135deg, #333 0%, #000 100%)',
}));

// Color schemes shown in the wizard (biome is a mode, not a palette)
const WIZARD_SCHEME_KEYS = Object.keys(SCHEME_LABELS).filter(k => k !== 'biome');

// Perceived brightness of a hex color (0–255); higher = lighter
const hexLum = hex => {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b;
};

const FACE_LABELS = { 1: 'Front', 2: 'Left', 3: 'Top', 4: 'Back', 5: 'Right', 6: 'Bottom' };

function TilePreviewCanvas({ styleKey, colorHex = '#4a7fa5', size = 48, canvasStyle }) {
  const canvasRef = useRef(null);
  const idRef = useRef(null);
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = size;
    canvas.height = size;
    idRef.current = registerTilePreview(canvas, styleKey, colorHex);
    return () => { if (idRef.current !== null) unregisterTilePreview(idRef.current); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    if (idRef.current !== null) updateTilePreview(idRef.current, styleKey, colorHex);
  }, [styleKey, colorHex]);
  return <canvas ref={canvasRef} width={size} height={size} style={{ display: 'block', borderRadius: '6px', ...canvasStyle }} />;
}

// ── Shared inline styles ──────────────────────────────────────────────────────

const ACCENT = '#6A2C91';
const ACCENT_SHADOW = '#3d1854';

const LAYOUT = wizardLayout(ACCENT, ACCENT_SHADOW);

const S = {
  ...LAYOUT,


  card: (selected) => ({
    display: 'flex',
    padding: '14px 16px',
    borderRadius: '10px',
    border: selected ? `2px solid ${ACCENT}` : '2px solid #d6d0c8',
    background: selected ? `${ACCENT}12` : PAPER_SHEET_RAISED,
    boxShadow: selected
      ? 'inset 0 2px 5px rgba(0,0,0,0.10), 0 1px 0 rgba(255,255,255,0.6)'
      : `0 3px 0 ${PAPER_CARD_SHADOW}, 0 4px 10px rgba(0,0,0,0.06)`,
    transform: selected ? 'translateY(1px)' : 'none',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    outline: 'none',
    WebkitTapHighlightColor: 'transparent',
    textAlign: 'left',
    width: '100%',
    fontFamily: 'inherit',
    position: 'relative',
  }),

  checkmark: {
    width: '20px',
    height: '20px',
    borderRadius: '5px',
    background: ACCENT,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    boxShadow: `0 2px 0 ${ACCENT_SHADOW}`,
  },

  bgGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '8px',
    paddingBottom: '8px',
  },

  bgCard: (selected) => ({
    borderRadius: '10px',
    overflow: 'hidden',
    border: selected ? `3px solid ${ACCENT}` : '3px solid transparent',
    boxShadow: selected ? `0 0 0 1px ${ACCENT}44` : '0 2px 6px rgba(0,0,0,0.10)',
    cursor: 'pointer',
    transition: 'all 0.18s ease',
    outline: 'none',
    position: 'relative',
    aspectRatio: '4/3',
    WebkitTapHighlightColor: 'transparent',
  }),

  bgLabel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: '18px 8px 7px',
    background: 'linear-gradient(to top, rgba(0,0,0,0.72) 0%, transparent 100%)',
    fontSize: '10px',
    fontWeight: '500',
    color: '#fff',
    textAlign: 'center',
  },
};

// ── Character plate (NIGHT family) ────────────────────────────────────────────
// The character step is the one place in this wizard where the panel is showing
// something alive rather than a setting, so it takes the warm dark STEP COMPLETE
// surface: the same faint field-guide grid as the paper, drawn in lamplight, lit
// by the selected skin's glow. It used to be a cold near-black left over from
// the retired navy glass family, which read as a different app dropped into the
// middle of Mobi's notebook.
const plateSurface = (glow) => ({
  // NIGHT_SHEET's rgb, opaque: the plate sits on cream paper rather than over the
  // 3D scene, so it takes the colour without the transparency.
  backgroundColor: '#1c2316',
  backgroundImage: [
    `radial-gradient(ellipse at 50% 44%, ${glow}2b 0%, transparent 62%)`,
    'linear-gradient(rgba(255,245,220,0.05) 1px, transparent 1px)',
    'linear-gradient(90deg, rgba(255,245,220,0.05) 1px, transparent 1px)',
    'linear-gradient(165deg, rgba(255,245,220,0.07), rgba(12,16,9,0.55))'
  ].join(','),
  backgroundSize: '100% 100%, 22px 22px, 22px 22px, 100% 100%',
  transition: 'background-image 0.4s ease',
});

const plateArrow = {
  background: 'rgba(255,245,220,0.10)',
  border: `1.5px solid ${NIGHT_BORDER}`,
  color: UI_CREAM,
  width: '38px',
  height: '38px',
  borderRadius: '50%',
  cursor: 'pointer',
  fontSize: '22px',
  lineHeight: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  fontFamily: 'inherit',
  transition: 'all 0.15s ease',
  paddingBottom: '2px',
  WebkitTapHighlightColor: 'transparent',
};

// ── Sub-components ────────────────────────────────────────────────────────────

// Small padlock for cosmetics that have to be bought in the Parity Store first.
function LockPip({ size = 10, color = PAPER_TEXT_FAINT }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" style={{ display: 'block', flexShrink: 0 }} aria-hidden="true">
      <path d="M5 7V5a3 3 0 0 1 6 0v2" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      <rect x="3.2" y="7" width="9.6" height="7" rx="2" fill={color} />
    </svg>
  );
}

// Heading for the cosmetic pickers. Carries a live count of what is still locked
// so the Parity Store has a visible reason to exist from inside the wizard.
function PickerHeading({ label, hint, locked = 0 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '9px', marginBottom: '8px' }}>
      <span style={{ fontSize: '11px', fontWeight: 700, color: PAPER_TEXT_FAINT, letterSpacing: '0.14em', textTransform: 'uppercase' }}>{label}</span>
      {hint && <span style={{ fontSize: '10px', color: PAPER_TEXT_FAINT }}>{hint}</span>}
      {locked > 0 && (
        <span style={{
          marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '5px',
          fontSize: '9px', fontWeight: 700, letterSpacing: '0.06em', color: PAPER_TEXT_FAINT,
        }}>
          <LockPip size={9} /> {locked} in the store
        </span>
      )}
    </div>
  );
}

function Checkmark() {
  return (
    <div style={S.checkmark}>
      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
        <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
const WormModeSetupWizard = ({ onComplete, onCancel, initialSettings }) => {
  const [step, setStep] = useState(0);
  // Which tile-style family is expanded. null means "whichever holds the style
  // you are already using"; '' means you deliberately closed that one.
  const [openSection, setOpenSection] = useState(null);
  const [cubeSize, setCubeSize] = useState(initialSettings?.size || 3);
  const [settings, setSettings] = useState({
    colorScheme: initialSettings?.colorScheme || 'standard',
    customColors: initialSettings?.customColors || null,
    tileStyle: 'solid',
    backgroundTheme: initialSettings?.backgroundTheme || 'blackhole',
    // Per-face tile styles; null means "use global tileStyle"
    perFaceStyles: null,
    wormSpeed: 2.0,
    wormOrbCount: 15,
    wormholeInterval: 10,
    wormColor: '#33ff66',
  });
  const [customPreview, setCustomPreview] = useState(null);
  const fileInputRef = useRef(null);

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      setCustomPreview(url);
      const colors = extractColorsFromImage(img, 6);
      const customColors = {};
      colors.forEach((c, i) => { customColors[i + 1] = c; });
      setSettings(s => ({ ...s, colorScheme: 'custom', customColors }));
    };
    img.src = url;
  };

  const STEPS = ['Character', 'Scene', 'Style', 'Colors', 'Gameplay', 'Size'];
  const totalSteps = 6;

  const handleNext = () => {
    if (step < totalSteps - 1) {
      setStep(step + 1);
    } else {
      onComplete({ ...settings, cubeSize });
    }
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
    else onCancel();
  };

  const select = (key, value) => setSettings(s => ({ ...s, [key]: value }));

  const resolvedColors = settings.colorScheme === 'custom' && settings.customColors
    ? { ...COLOR_SCHEMES.standard, ...settings.customColors }
    : COLOR_SCHEMES[settings.colorScheme] || COLOR_SCHEMES.standard;

  // ── Step 0: Size ────────────────────────────────────────────────────────────

  const renderSize = () => {
    const sizes = [
      { n: 2, name: '2×2×2', tag: 'Mini', desc: 'Fast & approachable' },
      { n: 3, name: '3×3×3', tag: 'Classic', desc: 'The original challenge' },
      { n: 4, name: '4×4×4', tag: 'Master', desc: 'Expert territory' },
      { n: 5, name: '5×5×5', tag: 'Ultra', desc: '150 stickers of chaos' },
      { n: 6, name: '6×6×6', tag: 'Mega', desc: '216 stickers of madness' },
      { n: 7, name: '7×7×7', tag: 'Titan', desc: '294 stickers of insanity' },
    ];

    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', paddingBottom: '8px' }}>
        {sizes.map(({ n, name, tag, desc }) => {
          const selected = cubeSize === n;
          return (
            <button key={n} style={{ ...S.card(selected), flexDirection: 'column', gap: '12px', padding: '18px 16px' }}
              onClick={() => setCubeSize(n)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  border: `1px solid ${selected ? 'rgba(0,0,0,0.15)' : PAPER_BORDER_SOFT}`,
                  background: PAPER_BG_MUTED,
                }}>
                  <TilePreviewCanvas
                    styleKey={settings.tileStyle === 'random' ? 'solid' : (settings.tileStyle || 'solid')}
                    colorHex={resolvedColors[1] || '#4a7fa5'}
                    size={44}
                  />
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${n}, 1fr)`,
                  gap: '3px',
                  width: '44px',
                }}>
                  {Array.from({ length: n * n }).map((_, i) => (
                    <div key={i} style={{
                      aspectRatio: '1',
                      borderRadius: '3px',
                      background: selected ? ACCENT : '#d4cfc5',
                      transition: 'background 0.18s ease',
                    }} />
                  ))}
                </div>
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '3px' }}>
                  <span style={{ fontSize: '16px', fontWeight: '700', color: PAPER_TEXT, letterSpacing: '-0.4px' }}>{name}</span>
                  <span style={{
                    fontSize: '10px', fontWeight: '600', letterSpacing: '0.04em',
                    textTransform: 'uppercase', color: selected ? ACCENT : PAPER_TEXT_FAINT,
                  }}>{tag}</span>
                </div>
                <div style={{ fontSize: '12px', color: PAPER_TEXT_FAINT }}>{desc}</div>
              </div>

              {selected && (
                <div style={{ position: 'absolute', top: '12px', right: '12px' }}>
                  <Checkmark />
                </div>
              )}
            </button>
          );
        })}
      </div>
    );
  };

  // ── Step 1: Background ──────────────────────────────────────────────────────

  const renderBackgrounds = () => (
    <div style={S.bgGrid}>
      {BG_OPTIONS.map(opt => {
        const selected = settings.backgroundTheme === opt.value;
        return (
          <button key={opt.value} style={S.bgCard(selected)} onClick={() => select('backgroundTheme', opt.value)}>
            {opt.thumbnail ? (
              <img src={opt.thumbnail} alt={opt.label} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            ) : (
              <div style={{ width: '100%', height: '100%', background: opt.gradient }} />
            )}
            <div style={S.bgLabel}>{opt.label}</div>
            {selected && (
              <div style={{ position: 'absolute', top: '7px', right: '7px', width: '20px', height: '20px', borderRadius: '5px', background: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 2px 0 ${ACCENT_SHADOW}` }}>
                <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                  <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );

  // ── Step 2: Colors ──────────────────────────────────────────────────────────

  const renderColors = () => {
    const resolvedCustom = settings.colorScheme === 'custom' && settings.customColors
      ? settings.customColors
      : null;
    const previewStyle = settings.tileStyle === 'random' ? 'solid' : (settings.tileStyle || 'solid');

    return (
      <>
        {/* Image upload */}
        <div style={{ marginBottom: '16px' }}>
          <button
            style={{
              ...S.card(settings.colorScheme === 'custom'),
              flexDirection: 'row',
              alignItems: 'center',
              gap: '14px',
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            {customPreview ? (
              <img src={customPreview} alt="Uploaded"
                style={{ width: '56px', height: '36px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0 }} />
            ) : (
              <div style={{
                width: '56px', height: '36px', borderRadius: '8px',
                background: PAPER_BG_MUTED, border: '1px solid #d6d0c8', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: '10px', fontWeight: 600, letterSpacing: '0.06em',
                color: PAPER_TEXT_FAINT, flexShrink: 0,
              }}>IMG</div>
            )}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '14px', fontWeight: settings.colorScheme === 'custom' ? '600' : '500', color: PAPER_TEXT }}>
                Extract from Image
              </div>
              <div style={{ fontSize: '12px', color: PAPER_TEXT_MUTED, marginTop: '2px' }}>
                {customPreview ? 'Tap to change image' : 'Upload a photo to auto-generate a palette'}
              </div>
            </div>
            {resolvedCustom && (
              <div style={{ display: 'flex', gap: '3px', flexShrink: 0 }}>
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} style={{ width: '12px', height: '12px', borderRadius: '3px', background: resolvedCustom[i], boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                ))}
              </div>
            )}
            {settings.colorScheme === 'custom' && (
              <div style={{ marginLeft: 'auto' }}><Checkmark /></div>
            )}
          </button>
        </div>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
          <div style={{ flex: 1, height: '1px', background: PAPER_BORDER_SOFT }} />
          <span style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.06em', textTransform: 'uppercase', color: PAPER_TEXT_FAINT }}>Presets</span>
          <div style={{ flex: 1, height: '1px', background: PAPER_BORDER_SOFT }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '7px', paddingBottom: '8px' }}>
          {WIZARD_SCHEME_KEYS.filter(k => k !== 'custom').map(key => {
            const owned = ownedItems.includes(`scheme_${key}`);
            const selected = settings.colorScheme === key;
            const colors = Object.values(COLOR_SCHEMES[key] || {}).slice(0, 6).sort((a, b) => hexLum(b) - hexLum(a));
            return (
              <button key={key}
                style={{
                  ...S.card(selected),
                  flexDirection: 'column', gap: '6px', padding: '10px 12px',
                  ...(owned ? {} : { opacity: 0.42, cursor: 'not-allowed', pointerEvents: 'none' }),
                }}
                onClick={() => owned && select('colorScheme', key)}>
                <span style={{ fontSize: '12px', fontWeight: selected ? '600' : '400', color: selected ? PAPER_TEXT : PAPER_TEXT_MUTED, lineHeight: 1.2 }}>
                  {SCHEME_LABELS[key]}{!owned ? ' 🔒' : ''}
                </span>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '5px', overflow: 'hidden', flexShrink: 0 }}>
                    <TilePreviewCanvas styleKey={previewStyle} colorHex={colors[0] || '#4a7fa5'} size={32} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '3px', flex: 1 }}>
                    {colors.slice(1).map((c, i) => (
                      <div key={i} style={{ width: '100%', aspectRatio: '1', borderRadius: '3px', background: owned ? c : '#bbb', boxShadow: '0 1px 2px rgba(0,0,0,0.18)' }} />
                    ))}
                  </div>
                </div>
                {selected && (
                  <div style={{ position: 'absolute', top: '8px', right: '8px' }}><Checkmark /></div>
                )}
              </button>
            );
          })}
        </div>
      </>
    );
  };

  // ── Step 3: Tile Style ──────────────────────────────────────────────────────

  const renderStyles = () => {
    const resolvedColors = settings.colorScheme === 'custom' && settings.customColors
      ? settings.customColors
      : COLOR_SCHEMES[settings.colorScheme] || COLOR_SCHEMES.standard;

    const perFace = settings.perFaceStyles;
    const faceValues = [1, 2, 3, 4, 5, 6].map(id => (perFace?.[id]) || settings.tileStyle || 'solid');
    const globalStyle = faceValues.every(v => v === faceValues[0]) ? faceValues[0] : null;

    const applyGlobal = (key) => {
      select('tileStyle', key);
      setSettings(s => ({ ...s, tileStyle: key, perFaceStyles: null }));
    };

    const applyPerFace = (faceId, key) => {
      const current = settings.perFaceStyles || {};
      setSettings(s => ({ ...s, perFaceStyles: { ...current, [faceId]: key } }));
    };

    const StyleGrid = ({ keys }) => (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '7px' }}>
          {keys.map(key => {
            const owned = ownedItems.includes(`tile_${key}`);
            const sel = globalStyle === key;
            return (
              <button key={key} style={{
                display: 'block', position: 'relative', padding: 0, borderRadius: '10px',
                border: sel ? `2px solid ${ACCENT}` : '2px solid #d6d0c8',
                background: PAPER_BG_MUTED,
                boxShadow: sel
                  ? 'inset 0 2px 4px rgba(0,0,0,0.10)'
                  : `0 2px 0 ${PAPER_CARD_SHADOW}, 0 3px 6px rgba(0,0,0,0.06)`,
                transform: sel ? 'translateY(1px)' : 'none',
                cursor: owned ? 'pointer' : 'not-allowed',
                opacity: owned ? 1 : 0.38,
                outline: 'none', WebkitTapHighlightColor: 'transparent',
                transition: 'all 0.15s ease', fontFamily: 'inherit', overflow: 'hidden',
              }} onClick={() => owned && applyGlobal(key)}>
                <TilePreviewCanvas styleKey={key} colorHex={Object.values(resolvedColors)[0] || '#4a7fa5'} size={56} canvasStyle={{ width: '100%', height: 'auto', borderRadius: 0 }} />
                <span style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0, textAlign: 'center',
                  padding: '14px 3px 4px', fontSize: '10px', fontWeight: sel ? '700' : '500',
                  color: '#fff', textShadow: '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
                  lineHeight: 1.2, background: 'linear-gradient(to top, rgba(0,0,0,0.62) 0%, transparent 100%)',
                }}>
                  {TILE_STYLES[key]?.label || key}{!owned ? ' 🔒' : ''}
                </span>
              </button>
            );
          })}
      </div>
    );

    // The family holding your current style opens by default; picking a style
    // keeps its family open. `openSection` of '' means you closed that one.
    const currentFamily = TILE_STYLE_SECTIONS.find(sec => sec.keys.includes(globalStyle))?.key ?? 'classic';
    const openKey = openSection ?? currentFamily;
    const toggle = (key) => setOpenSection(openKey === key ? '' : key);

    return (
      <>
        {/* Random Mix shortcut */}
        <div style={{ marginBottom: '18px' }}>
          <button
            style={{ ...S.card(settings.tileStyle === 'random' && !perFace), flexDirection: 'row', alignItems: 'center', gap: '14px' }}
            onClick={() => applyGlobal('random')}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '14px', fontWeight: '600', color: PAPER_TEXT }}>Random Mix</div>
              <div style={{ fontSize: '12px', color: PAPER_TEXT_MUTED, marginTop: '2px' }}>Different style on every face</div>
            </div>
            {settings.tileStyle === 'random' && !perFace && <Checkmark />}
          </button>
        </div>

        {TILE_STYLE_SECTIONS.map(section => {
          const ownedCount = section.keys.filter(k => ownedItems.includes(`tile_${k}`)).length;
          const holdsPick = section.keys.includes(globalStyle);
          return (
            <WizardSection
              key={section.key}
              label={section.label}
              accent={ACCENT}
              note={holdsPick ? TILE_STYLES[globalStyle]?.label : `${ownedCount}/${section.keys.length}`}
              open={openKey === section.key}
              onToggle={() => toggle(section.key)}
            >
              <StyleGrid keys={section.keys} />
            </WizardSection>
          );
        })}

        {/* Per-face overrides — folded away by default; most players never
            need a different style on each face. */}
        <WizardSection
          label="Per Face"
          accent={ACCENT}
          note={perFace ? 'Custom' : 'Advanced'}
          open={openKey === 'perFace'}
          onToggle={() => toggle('perFace')}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
            {[1, 2, 3, 4, 5, 6].map(faceId => {
              const globalFallback = settings.tileStyle === 'random' ? 'solid' : (settings.tileStyle || 'solid');
              const faceStyle = perFace?.[faceId] || globalFallback;
              const faceColor = resolvedColors[faceId] || '#4a7fa5';
              return (
                <div key={faceId} style={{
                  display: 'flex', flexDirection: 'column', gap: '6px',
                  padding: '10px', borderRadius: '10px', background: PAPER_BG_MUTED,
                  border: `2px solid ${faceColor}55`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: faceColor, flexShrink: 0, boxShadow: '0 1px 0 rgba(0,0,0,0.20)' }} />
                    <span style={{ fontSize: '11px', fontWeight: '600', color: PAPER_TEXT_MUTED }}>{FACE_LABELS[faceId]}</span>
                  </div>
                  <TilePreviewCanvas styleKey={faceStyle === 'random' ? 'solid' : faceStyle} colorHex={faceColor} size={36} />
                  <select
                    value={faceStyle}
                    onChange={e => applyPerFace(faceId, e.target.value)}
                    style={{
                      fontSize: '10px', padding: '4px 6px', borderRadius: '6px',
                      border: '1px solid #d6d0c8', background: '#f7f3ec',
                      color: PAPER_TEXT, fontFamily: 'inherit', cursor: 'pointer',
                      appearance: 'none', WebkitAppearance: 'none',
                    }}
                  >
                    <optgroup label="Classic">
                      {CLASSIC_STYLE_KEYS.filter(k => ownedItems.includes(`tile_${k}`)).map(k => <option key={k} value={k}>{TILE_STYLES[k]?.label}</option>)}
                    </optgroup>
                    <optgroup label="Antipodal Op Art">
                      {ANTIPODAL_STYLE_KEYS.filter(k => ownedItems.includes(`tile_${k}`)).map(k => <option key={k} value={k}>{TILE_STYLES[k]?.label}</option>)}
                    </optgroup>
                    <optgroup label="Living">
                      {LIVING_STYLE_KEYS.filter(k => ownedItems.includes(`tile_${k}`)).map(k => <option key={k} value={k}>{TILE_STYLES[k]?.label}</option>)}
                    </optgroup>
                    <optgroup label="Non-Euclidean">
                      {NON_EUCLIDEAN_STYLE_KEYS.filter(k => ownedItems.includes(`tile_${k}`)).map(k => <option key={k} value={k}>{TILE_STYLES[k]?.label}</option>)}
                    </optgroup>
                  </select>
                </div>
              );
            })}
          </div>
        </WizardSection>
      </>
    );
  };


  const renderGameplay = () => {
    const OptionGroup = ({ label, options, value, onChange, accent }) => (
      <div style={{ display: 'grid', gap: '8px' }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: PAPER_TEXT_MUTED, letterSpacing: '0.04em' }}>{label}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
          {options.map(opt => {
            const selected = value === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => onChange(opt.value)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                  padding: '14px 8px 12px',
                  borderRadius: '10px',
                  border: selected ? `2px solid ${accent}` : '2px solid #d6d0c8',
                  background: selected ? `${accent}14` : PAPER_SHEET_RAISED,
                  boxShadow: selected ? 'inset 0 2px 4px rgba(0,0,0,0.08)' : `0 2px 0 ${PAPER_CARD_SHADOW}, 0 3px 6px rgba(0,0,0,0.06)`,
                  transform: selected ? 'translateY(1px)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  outline: 'none',
                  WebkitTapHighlightColor: 'transparent',
                  fontFamily: 'inherit',
                }}
              >
                <span style={{ fontSize: '13px', fontWeight: 700, color: selected ? accent : PAPER_TEXT_MUTED, letterSpacing: '-0.2px' }}>{opt.label}</span>
                <span style={{ fontSize: '10px', color: selected ? accent : PAPER_TEXT_FAINT, fontWeight: 500 }}>{opt.hint}</span>
              </button>
            );
          })}
        </div>
      </div>
    );

    return (
      <div style={{ display: 'grid', gap: '20px' }}>
        <OptionGroup
          label="Worm Speed"
          accent="#1565C0"
          value={settings.wormSpeed}
          onChange={v => select('wormSpeed', v)}
          options={[
            { value: 1.0,  label: 'Slow',    hint: '1.0×' },
            { value: 2.0,  label: 'Average', hint: '2.0×' },
            { value: 2.75, label: 'Fast',    hint: '2.75×' },
          ]}
        />
        <OptionGroup
          label="Orb Count"
          accent={ACCENT}
          value={settings.wormOrbCount}
          onChange={v => select('wormOrbCount', v)}
          options={[
            { value: 5,  label: 'Less',    hint: '5 orbs' },
            { value: 15, label: 'Average', hint: '15 orbs' },
            { value: 25, label: 'More',    hint: '25 orbs' },
          ]}
        />
        <OptionGroup
          label="Wormhole Duration"
          accent="#b58a00"
          value={settings.wormholeInterval}
          onChange={v => select('wormholeInterval', v)}
          options={[
            { value: 20, label: 'Slow',    hint: '20s' },
            { value: 10, label: 'Average', hint: '10s' },
            { value: 5,  label: 'Fast',    hint: '5s' },
          ]}
        />
      </div>
    );
  };

  // ── Step 0: Character ───────────────────────────────────────────────────────

  const wormSkinId = useGameStore(s => s.wormSkin ?? 'slime');
  const wormHatId = useGameStore(s => s.wormHat ?? 'none');
  const wormCharacterId = useGameStore(s => s.wormCharacter ?? 'classic');
  const wormShowTrail = useGameStore(s => s.wormShowTrail ?? true);
  const setWormSkin = useGameStore(s => s.setWormSkin);
  const setWormHat = useGameStore(s => s.setWormHat);
  const setWormCharacter = useGameStore(s => s.setWormCharacter);
  const setWormShowTrail = useGameStore(s => s.setWormShowTrail);
  const ownedItems = useGameStore(s => s.ownedItems);
  const activeSkin = WORM_SKINS.find(s => s.id === wormSkinId) ?? WORM_SKINS[0];
  const activeCharacter = WORM_CHARACTERS.find(c => c.id === wormCharacterId) ?? WORM_CHARACTERS[0];

  const renderCharacter = () => {
    const chipBase = {
      border: 'none', cursor: 'pointer', borderRadius: '10px',
      transition: 'all 0.18s ease', fontFamily: 'inherit',
    };

    const lockedSkins = WORM_SKINS.filter(s => !ownedItems.includes(`skin_${s.id}`)).length;
    const lockedHats = WORM_HATS.filter(h => !ownedItems.includes(`hat_${h.id}`)).length;

    const charIndex = WORM_CHARACTERS.findIndex(c => c.id === wormCharacterId);
    const prevChar = () => setWormCharacter(WORM_CHARACTERS[(charIndex - 1 + WORM_CHARACTERS.length) % WORM_CHARACTERS.length].id);
    const nextChar = () => setWormCharacter(WORM_CHARACTERS[(charIndex + 1) % WORM_CHARACTERS.length].id);

    // "Steady Crawler — reliable healing on every cube size" → named trait plus
    // its explanation, so the trait itself can be set apart from the prose.
    const [rawTrait, ...traitRest] = activeCharacter.special.split('—');
    const traitName = rawTrait.trim();
    const traitDetail = traitRest.join('—').trim();


    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

        {/* ── Character plate ── */}
        <div style={{
          borderRadius: '18px',
          overflow: 'hidden',
          border: `1.5px solid ${NIGHT_BORDER}`,
          boxShadow: NIGHT_SHADOW,
        }}>
          <div style={{
            ...plateSurface(activeSkin.glow),
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: isMobile ? '14px 14px 16px' : '16px 20px 18px',
            position: 'relative',
            gap: '12px',
          }}>
            {/* Plate caption + position in the set */}
            <div style={{ alignSelf: 'stretch', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: NIGHT_TEXT_MUTED }}>
                Specimen
              </span>
              <div style={{ flex: 1, height: '1px', background: NIGHT_BORDER }} />
              <span style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '0.1em', color: NIGHT_TEXT_MUTED }}>
                {charIndex + 1} / {WORM_CHARACTERS.length}
              </span>
            </div>

            {/* Arrows + SVG worm */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: isMobile ? '4px' : '10px',
              justifyContent: 'center', position: 'relative', alignSelf: 'stretch',
            }}>
              {/* Floor glow, under the worm */}
              <div style={{
                position: 'absolute', bottom: '4px', left: '50%', transform: 'translateX(-50%)',
                width: '170px', height: '18px',
                background: `radial-gradient(ellipse, ${activeSkin.glow}4d 0%, transparent 70%)`,
                borderRadius: '50%', pointerEvents: 'none', transition: 'background 0.4s ease',
              }} />

              <button onClick={prevChar} aria-label="Previous character" style={plateArrow}>‹</button>
              <div style={{ zIndex: 1, display: 'flex', justifyContent: 'center', flex: 1 }}>
                <WormPreviewCanvas
                  characterId={wormCharacterId}
                  skinId={wormSkinId}
                  hatId={wormHatId}
                  size={isMobile ? 168 : 200}
                  animated
                />
              </div>
              <button onClick={nextChar} aria-label="Next character" style={plateArrow}>›</button>
            </div>

            {/* Name plate */}
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontFamily: DISPLAY_FONT,
                fontSize: isMobile ? '15px' : '18px',
                color: UI_CREAM, letterSpacing: '0.02em', lineHeight: 1.15,
                textShadow: NIGHT_TITLE_SHADOW, marginBottom: '7px',
              }}>
                {activeCharacter.label.toUpperCase()}
              </div>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                background: `${activeSkin.glow}28`, border: `1px solid ${activeSkin.glow}55`,
                color: activeSkin.glow, fontSize: '9px', fontWeight: '800',
                letterSpacing: '0.16em', textTransform: 'uppercase', padding: '3px 11px', borderRadius: '999px',
                transition: 'all 0.4s ease',
              }}>
                {activeCharacter.type}
                <span style={{ opacity: 0.5 }}>·</span>
                <span style={{ letterSpacing: '0.06em', textTransform: 'none', fontWeight: 600, opacity: 0.85 }}>
                  {activeCharacter.subtitle}
                </span>
              </div>
            </div>

            {/* Signature trait */}
            <div style={{
              alignSelf: 'stretch', display: 'flex', gap: '9px', alignItems: 'flex-start',
              paddingLeft: '2px',
            }}>
              <span style={{ color: activeSkin.glow, fontSize: '10px', lineHeight: 1.6, flexShrink: 0 }}>◆</span>
              <span style={{ fontSize: '11px', color: NIGHT_TEXT_MUTED, lineHeight: 1.5 }}>
                <span style={{ color: NIGHT_TEXT, fontWeight: 700 }}>{traitName}</span>
                {traitDetail ? ` — ${traitDetail}` : ''}
              </span>
            </div>

            {/* Page dots */}
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              {WORM_CHARACTERS.map(c => (
                <button key={c.id} onClick={() => setWormCharacter(c.id)} aria-label={c.label} style={{
                  width: c.id === wormCharacterId ? '22px' : '7px',
                  height: '7px', borderRadius: '4px',
                  background: c.id === wormCharacterId ? UI_CREAM : 'rgba(255,245,220,0.28)',
                  border: 'none', cursor: 'pointer', padding: 0,
                  transition: 'all 0.28s cubic-bezier(0.4,0,0.2,1)',
                  WebkitTapHighlightColor: 'transparent',
                }} />
              ))}
            </div>
          </div>
        </div>

        {/* ── Skin picker ── */}
        <div>
          <PickerHeading label="Skin" locked={lockedSkins} />
          <div style={{ display: 'flex', gap: '7px', overflowX: 'auto', paddingBottom: '4px' }}>
            {WORM_SKINS.map(skin => {
              const owned = ownedItems.includes(`skin_${skin.id}`);
              const selected = skin.id === wormSkinId;
              return (
                <button key={skin.id} onClick={() => owned && setWormSkin(skin.id)} style={{
                  ...chipBase, flexShrink: 0,
                  padding: '7px 9px 6px',
                  background: selected ? PAPER_SHEET_RAISED : 'rgba(255,255,255,0.62)',
                  border: selected ? `2px solid ${skin.body}` : `2px solid ${PAPER_BORDER_SOFT}`,
                  boxShadow: selected ? `0 3px 0 ${skin.body}66, 0 5px 14px ${skin.glow}3d` : `0 2px 0 ${PAPER_CARD_SHADOW}`,
                  transform: selected ? 'translateY(-1px)' : 'none',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
                  opacity: owned ? 1 : 0.5,
                  cursor: owned ? 'pointer' : 'not-allowed',
                  position: 'relative',
                  minWidth: '60px',
                }}>
                  {/* Locked skins keep their colour, the same as in the store —
                      a grey worm tells you nothing about what you'd be buying. */}
                  <div style={{ filter: owned ? 'none' : 'saturate(0.5)' }}>
                    <WormPreviewCanvas characterId={wormCharacterId} skinId={skin.id} size={34} />
                  </div>
                  <span style={{ fontSize: '9px', fontWeight: 700, color: selected ? skin.body : PAPER_TEXT_FAINT, letterSpacing: '0.05em' }}>{skin.label}</span>
                  {!owned && (
                    <span style={{ position: 'absolute', top: '4px', right: '4px' }}><LockPip size={9} /></span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Hat picker ── */}
        <div>
          <PickerHeading label="Hat" locked={lockedHats} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(66px, 1fr))', gap: '7px' }}>
            {WORM_HATS.map(hat => {
              const owned = ownedItems.includes(`hat_${hat.id}`);
              const selected = hat.id === wormHatId;
              return (
                <button key={hat.id} onClick={() => owned && setWormHat(hat.id)} style={{
                  ...chipBase,
                  padding: '8px 6px 6px',
                  background: selected ? `${ACCENT}12` : 'rgba(255,255,255,0.62)',
                  border: selected ? `2px solid ${ACCENT}` : `2px solid ${PAPER_BORDER_SOFT}`,
                  boxShadow: selected ? 'inset 0 2px 4px rgba(83,72,56,0.12)' : `0 2px 0 ${PAPER_CARD_SHADOW}`,
                  transform: selected ? 'translateY(1px)' : 'none',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
                  opacity: owned ? 1 : 0.5,
                  cursor: owned ? 'pointer' : 'not-allowed',
                  position: 'relative',
                }}>
                  <WormPreviewCanvas
                    characterId={wormCharacterId} skinId={wormSkinId} hatId={hat.id}
                    size={34} framing="head"
                    style={{ filter: owned ? 'none' : 'saturate(0.5)' }}
                  />
                  <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.05em', color: selected ? ACCENT : PAPER_TEXT_MUTED, lineHeight: 1.2, textAlign: 'center' }}>
                    {hat.label}
                  </span>
                  {!owned && (
                    <span style={{ position: 'absolute', top: '4px', right: '4px' }}><LockPip size={9} /></span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Trail toggle ── */}
        <div>
          <PickerHeading label="Trail" hint="Mark tiles you've visited" />
          <div style={{ display: 'flex', gap: '7px' }}>
            {[{ val: true, label: 'On' }, { val: false, label: 'Off' }].map(({ val, label }) => {
              const selected = wormShowTrail === val;
              const accent = activeSkin.glow;
              return (
                <button key={String(val)} onClick={() => setWormShowTrail(val)} style={{
                  ...chipBase,
                  padding: '9px 24px',
                  background: selected ? `${accent}18` : 'rgba(255,255,255,0.62)',
                  border: selected ? `2px solid ${accent}` : `2px solid ${PAPER_BORDER_SOFT}`,
                  boxShadow: selected ? 'inset 0 2px 4px rgba(83,72,56,0.12)' : `0 2px 0 ${PAPER_CARD_SHADOW}`,
                  transform: selected ? 'translateY(1px)' : 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: selected ? accent : PAPER_TEXT_MUTED }}>
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // ── Step titles ─────────────────────────────────────────────────────────────

  const stepContent = [renderCharacter, renderBackgrounds, renderStyles, renderColors, renderGameplay, renderSize];
  const stepTitles = ['Pick Worm Type', 'Background', 'Tile Style', 'Color Palette', 'Gameplay', 'Cube Size'];
  const stepSubtitles = [
    'Select your character, then customize skin & hat',
    'Choose your play environment',
    'Choose how your tiles look and feel',
    'Pick a palette — see it applied to your chosen tile style',
    'Tune how fast and chaotic your worm run feels',
    'Pick your puzzle dimensions',
  ];

  return (
    <div style={S.overlay}>
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />

      <div style={S.sheet}>
        {/* Header */}
        <div style={S.header}>
          {/* Mode identity badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            background: ACCENT, borderRadius: '6px', padding: '4px 12px', marginBottom: '16px',
            fontSize: '11px', fontWeight: '800', letterSpacing: '0.12em',
            textTransform: 'uppercase', color: '#fff',
            boxShadow: `0 2px 0 ${ACCENT_SHADOW}`,
          }}>
            WORM MODE
          </div>
          <WizardSteps styles={S} steps={STEPS} step={step} />
          <h2 style={S.title}>{stepTitles[step]}</h2>
          <p style={S.subtitle}>{stepSubtitles[step]}</p>
        </div>

        {/* Scrollable body */}
        <div style={S.body}>
          <div style={{ paddingBottom: '24px' }}>
            {stepContent[step]()}
          </div>
        </div>

        {/* Footer */}
        <div style={S.footer}>
          <button
            style={S.btnSecondary}
            onClick={handleBack}
            onMouseEnter={e => { e.currentTarget.style.color = PAPER_TEXT; e.currentTarget.style.borderColor = '#b8b2aa'; }}
            onMouseLeave={e => { e.currentTarget.style.color = PAPER_TEXT_MUTED; e.currentTarget.style.borderColor = PAPER_BORDER_SOFT; }}
          >
            {step === 0 ? 'Cancel' : 'Back'}
          </button>

          <button
            style={S.btnPrimary}
            onClick={handleNext}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'none'; }}
            onMouseDown={e => { e.currentTarget.style.transform = 'translateY(3px)'; e.currentTarget.style.boxShadow = `0 1px 0 ${ACCENT_SHADOW}`; }}
            onMouseUp={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = `0 4px 0 ${ACCENT_SHADOW}, 0 6px 16px ${ACCENT}44`; }}
          >
            {step === totalSteps - 1 ? 'Start Playing' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default WormModeSetupWizard;
