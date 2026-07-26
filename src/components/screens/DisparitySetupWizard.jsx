import React, { useState, useRef } from 'react';
import { COLOR_SCHEMES, TILE_STYLES, SCHEME_LABELS } from '../../utils/colorSchemes.js';
import { CLASSIC_STYLE_KEYS, ANTIPODAL_STYLE_KEYS, LIVING_STYLE_KEYS, NON_EUCLIDEAN_STYLE_KEYS } from '../../utils/tileStyleCatalog.js';
import { BACKGROUNDS, getBackgroundUrl } from '../../utils/backgrounds.js';
import { registerTilePreview, updateTilePreview, unregisterTilePreview } from '../../3d/TilePreviewRenderer.js';
import { useGameStore } from '../../hooks/useGameStore.js';
import { extractColorsFromImage } from '../../utils/colorExtraction.js';
import {
  UI_FONT,
  PAPER_BACKDROP, PAPER_BACKDROP_BLUR,
  PAPER_SHEET_RAISED, PAPER_BORDER, PAPER_BORDER_SOFT,
  PAPER_TEXT, PAPER_TEXT_MUTED, PAPER_TEXT_FAINT,
  PAPER_BG_MUTED, PAPER_CARD_SHADOW, PAPER_SHADOW,
} from '../../utils/uiTheme.js';
import { BG_PREVIEWS } from '../../utils/bgPreviews.js';
import { wizardLayout, WizardSteps } from './WizardChrome.jsx';

const BG_OPTIONS = BACKGROUNDS.map(bg => ({
  value: bg.id,
  label: bg.label,
  thumbnail: bg.thumbnail ? getBackgroundUrl(bg.thumbnail) : null,
  gradient: BG_PREVIEWS[bg.id] || 'linear-gradient(135deg, #333 0%, #000 100%)',
}));

const WIZARD_SCHEME_KEYS = Object.keys(SCHEME_LABELS).filter(k => k !== 'biome');
const FACE_LABELS = { 1: 'Front', 2: 'Left', 3: 'Top', 4: 'Back', 5: 'Right', 6: 'Bottom' };
const LEVEL_LABELS = { 1: 'Low', 2: 'Medium', 3: 'High', 4: 'Extreme', 5: 'Maximum' };
const LEVEL_ACCENT = { 1: '#2d7a3a', 2: '#b58a00', 3: '#c45000', 4: '#c0392b', 5: '#7b2d8b' };

const FLIP_CAP_PRESETS = [
  { label: 'Fragile', value: 3, sub: 'Fast massacre' },
  { label: 'Standard', value: 8, sub: 'Balanced carnage' },
  { label: 'Endurance', value: 13, sub: 'Slow attrition' },
  { label: 'Titan', value: 20, sub: 'War of attrition' },
];

const GAME_LENGTH_OPTIONS = [
  { value: 'short',  label: 'Short',  sub: '10 shuffles' },
  { value: 'medium', label: 'Medium', sub: '20 shuffles' },
  { value: 'long',   label: 'Long',   sub: '30 shuffles' },
];

const hexLum = hex => {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b;
};

// COLOR_SCHEMES is static, so the per-scheme sorted preview swatches only need
// computing once at module load rather than re-sorting on every render.
const SORTED_SCHEME_COLORS = Object.fromEntries(
  WIZARD_SCHEME_KEYS.map(key => [key, Object.values(COLOR_SCHEMES[key] || {}).slice(0, 6).sort((a, b) => hexLum(b) - hexLum(a))])
);

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

const ACCENT = '#C44B00';
const ACCENT_SHADOW = '#7a2e00';

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
  checkmark: { width: '20px', height: '20px', borderRadius: '5px', background: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: `0 2px 0 ${ACCENT_SHADOW}` },
  bgGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', paddingBottom: '8px' },
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
    position: 'absolute', bottom: 0, left: 0, right: 0, padding: '18px 8px 7px',
    background: 'linear-gradient(to top, rgba(0,0,0,0.72) 0%, transparent 100%)',
    fontSize: '10px', fontWeight: '500', color: '#fff', textAlign: 'center',
  },
};

function Checkmark() {
  return (
    <div style={S.checkmark}>
      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
        <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

const DisparitySetupWizard = ({ onStart, onCancel }) => {
  const ownedItems = useGameStore(s => s.ownedItems);
  const schemeOwned = (key) => key === 'custom' || ownedItems.includes(`scheme_${key}`);
  const tileOwned = (key) => ownedItems.includes(`tile_${key}`);

  const [step, setStep] = useState(0);
  const [cubeSize, setCubeSize] = useState(3);
  const [settings, setSettings] = useState({
    colorScheme: 'standard',
    customColors: null,
    tileStyle: 'solid',
    backgroundTheme: 'blackhole',
    perFaceStyles: null,
    disparityLevel: 3,
    flipCap: 8,
    visualMode: 'classic',
    flipMode: true,
    showTunnels: false,
    gameLength: 'medium',
  });
  const [customPreview, setCustomPreview] = useState(null);
  const fileInputRef = useRef(null);

  const select = (key, value) => setSettings(s => ({ ...s, [key]: value }));

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

  const STEPS = ['Scene', 'Style', 'Colors', 'Gameplay', 'Size'];
  const totalSteps = STEPS.length;

  const handleNext = () => {
    if (step < totalSteps - 1) {
      setStep(step + 1);
      return;
    }
    onStart({ ...settings, cubeSize });
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
    else onCancel();
  };

  const resolvedColors = settings.colorScheme === 'custom' && settings.customColors
    ? { ...COLOR_SCHEMES.standard, ...settings.customColors }
    : COLOR_SCHEMES[settings.colorScheme] || COLOR_SCHEMES.standard;

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

  const renderColors = () => {
    const resolvedCustom = settings.colorScheme === 'custom' && settings.customColors ? settings.customColors : null;
    const previewStyle = settings.tileStyle === 'random' ? 'solid' : (settings.tileStyle || 'solid');
    return (
      <>
        <div style={{ marginBottom: '16px' }}>
          <button style={{ ...S.card(settings.colorScheme === 'custom'), flexDirection: 'row', alignItems: 'center', gap: '14px' }} onClick={() => fileInputRef.current?.click()}>
            {customPreview ? (
              <img src={customPreview} alt="Uploaded" style={{ width: '56px', height: '36px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0 }} />
            ) : (
              <div style={{ width: '56px', height: '36px', borderRadius: '8px', background: PAPER_BG_MUTED, border: '1px solid #d6d0c8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 600, letterSpacing: '0.06em', color: PAPER_TEXT_FAINT, flexShrink: 0 }}>IMG</div>
            )}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '14px', fontWeight: settings.colorScheme === 'custom' ? '600' : '500', color: PAPER_TEXT }}>Extract from Image</div>
              <div style={{ fontSize: '12px', color: PAPER_TEXT_MUTED, marginTop: '2px' }}>{customPreview ? 'Tap to change image' : 'Upload a photo to auto-generate a palette'}</div>
            </div>
            {resolvedCustom && (
              <div style={{ display: 'flex', gap: '3px', flexShrink: 0 }}>
                {[1, 2, 3, 4, 5, 6].map(i => <div key={i} style={{ width: '12px', height: '12px', borderRadius: '3px', background: resolvedCustom[i], boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />)}
              </div>
            )}
            {settings.colorScheme === 'custom' && <div style={{ marginLeft: 'auto' }}><Checkmark /></div>}
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
          <div style={{ flex: 1, height: '1px', background: PAPER_BORDER_SOFT }} />
          <span style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.06em', textTransform: 'uppercase', color: PAPER_TEXT_FAINT }}>Presets</span>
          <div style={{ flex: 1, height: '1px', background: PAPER_BORDER_SOFT }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '7px', paddingBottom: '8px' }}>
          {WIZARD_SCHEME_KEYS.filter(k => k !== 'custom').map(key => {
            const selected = settings.colorScheme === key;
            const owned = schemeOwned(key);
            const colors = SORTED_SCHEME_COLORS[key] || [];
            return (
              <button key={key} style={{
                ...S.card(selected), flexDirection: 'column', gap: '6px', padding: '10px 12px',
                ...(owned ? {} : { opacity: 0.42, cursor: 'not-allowed', pointerEvents: 'none' }),
              }} onClick={() => owned && select('colorScheme', key)}>
                <span style={{ fontSize: '12px', fontWeight: selected ? '600' : '400', color: selected ? PAPER_TEXT : PAPER_TEXT_MUTED, lineHeight: 1.2 }}>
                  {SCHEME_LABELS[key]}{!owned ? ' 🔒' : ''}
                </span>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '5px', overflow: 'hidden', flexShrink: 0 }}>
                    <TilePreviewCanvas styleKey={previewStyle} colorHex={colors[0] || '#4a7fa5'} size={32} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '3px', flex: 1 }}>
                    {colors.slice(1).map((c, i) => <div key={`${c}-${i}`} style={{ width: '100%', aspectRatio: '1', borderRadius: '3px', background: owned ? c : '#bbb', boxShadow: '0 1px 2px rgba(0,0,0,0.18)' }} />)}
                  </div>
                </div>
                {selected && <div style={{ position: 'absolute', top: '8px', right: '8px' }}><Checkmark /></div>}
              </button>
            );
          })}
        </div>
      </>
    );
  };

  const renderStyles = () => {
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

    const StyleGrid = ({ keys, label }) => (
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: PAPER_TEXT_FAINT, marginBottom: '8px' }}>{label}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '7px' }}>
          {keys.map(key => {
            const sel = globalStyle === key;
            const owned = tileOwned(key);
            return (
              <button key={key} style={{
                display: 'block', position: 'relative', padding: 0, borderRadius: '10px',
                border: sel ? `2px solid ${ACCENT}` : '2px solid #d6d0c8',
                background: PAPER_BG_MUTED,
                boxShadow: sel
                  ? 'inset 0 2px 4px rgba(0,0,0,0.10)'
                  : `0 2px 0 ${PAPER_CARD_SHADOW}, 0 3px 6px rgba(0,0,0,0.06)`,
                transform: sel ? 'translateY(1px)' : 'none',
                cursor: owned ? 'pointer' : 'not-allowed', outline: 'none',
                WebkitTapHighlightColor: 'transparent', transition: 'all 0.15s ease',
                fontFamily: 'inherit', opacity: owned ? 1 : 0.42, overflow: 'hidden',
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
      </div>
    );

    return (
      <>
        <div style={{ marginBottom: '18px' }}>
          <button style={{ ...S.card(settings.tileStyle === 'random' && !perFace), flexDirection: 'row', alignItems: 'center', gap: '14px' }} onClick={() => applyGlobal('random')}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '14px', fontWeight: '600', color: PAPER_TEXT }}>Random Mix</div>
              <div style={{ fontSize: '12px', color: PAPER_TEXT_MUTED, marginTop: '2px' }}>Different style on every face</div>
            </div>
            {settings.tileStyle === 'random' && !perFace && <Checkmark />}
          </button>
        </div>

        <StyleGrid keys={CLASSIC_STYLE_KEYS} label="Classic" />
        <StyleGrid keys={ANTIPODAL_STYLE_KEYS} label="Antipodal Op Art" />
        <StyleGrid keys={LIVING_STYLE_KEYS} label="Living" />
        <StyleGrid keys={NON_EUCLIDEAN_STYLE_KEYS} label="Non-Euclidean" />

        <div style={{ marginBottom: '8px' }}>
          <div style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: PAPER_TEXT_FAINT, marginBottom: '10px' }}>Per Face</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
            {(() => {
              // Computed once for all 6 faces below instead of re-filtering per face.
              const ownedClassic = CLASSIC_STYLE_KEYS.filter(tileOwned);
              const ownedAntipodal = ANTIPODAL_STYLE_KEYS.filter(tileOwned);
              const ownedLiving = LIVING_STYLE_KEYS.filter(tileOwned);
              const ownedNonEuclidean = NON_EUCLIDEAN_STYLE_KEYS.filter(tileOwned);
              return [1, 2, 3, 4, 5, 6].map(faceId => {
              const globalFallback = settings.tileStyle === 'random' ? 'solid' : (settings.tileStyle || 'solid');
              const rawStyle = perFace?.[faceId] || globalFallback;
              const faceStyle = tileOwned(rawStyle) ? rawStyle : 'solid';
              const faceColor = resolvedColors[faceId] || '#4a7fa5';
              return (
                <div key={faceId} style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '10px', borderRadius: '10px', background: PAPER_BG_MUTED, border: `2px solid ${faceColor}55` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: faceColor, flexShrink: 0, boxShadow: '0 1px 0 rgba(0,0,0,0.20)' }} />
                    <span style={{ fontSize: '11px', fontWeight: '600', color: PAPER_TEXT_MUTED }}>{FACE_LABELS[faceId]}</span>
                  </div>
                  <TilePreviewCanvas styleKey={faceStyle === 'random' ? 'solid' : faceStyle} colorHex={faceColor} size={36} />
                  <select value={faceStyle} onChange={e => applyPerFace(faceId, e.target.value)} style={{ fontSize: '10px', padding: '4px 6px', borderRadius: '6px', border: '1px solid #d6d0c8', background: '#f7f3ec', color: PAPER_TEXT, fontFamily: 'inherit', cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none' }}>
                    <optgroup label="Classic">{ownedClassic.map(k => <option key={k} value={k}>{TILE_STYLES[k]?.label}</option>)}</optgroup>
                    <optgroup label="Antipodal Op Art">{ownedAntipodal.map(k => <option key={k} value={k}>{TILE_STYLES[k]?.label}</option>)}</optgroup>
                    <optgroup label="Living">{ownedLiving.map(k => <option key={k} value={k}>{TILE_STYLES[k]?.label}</option>)}</optgroup>
                    <optgroup label="Non-Euclidean">{ownedNonEuclidean.map(k => <option key={k} value={k}>{TILE_STYLES[k]?.label}</option>)}</optgroup>
                  </select>
                </div>
              );
              });
            })()}
          </div>
        </div>
      </>
    );
  };

  const accent = LEVEL_ACCENT[settings.disparityLevel];
  const renderGameplay = () => (
    <div style={{ display: 'grid', gap: '18px' }}>
      <div>
        <div style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: PAPER_TEXT_FAINT, marginBottom: '10px' }}>
          Disparity Level <span style={{ color: accent }}>{LEVEL_LABELS[settings.disparityLevel]}</span>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          {[1, 2, 3, 4, 5].map(n => (
            <button key={n} onClick={() => select('disparityLevel', n)} style={{
              flex: 1, padding: '9px 0', border: `2px solid ${settings.disparityLevel === n ? LEVEL_ACCENT[n] : PAPER_BORDER_SOFT}`,
              borderRadius: '10px', fontSize: '14px', fontWeight: settings.disparityLevel === n ? '700' : '500',
              background: settings.disparityLevel === n ? `${LEVEL_ACCENT[n]}18` : PAPER_SHEET_RAISED,
              color: settings.disparityLevel === n ? LEVEL_ACCENT[n] : PAPER_TEXT_FAINT,
              boxShadow: settings.disparityLevel === n ? 'inset 0 2px 4px rgba(0,0,0,0.08)' : `0 2px 0 ${PAPER_CARD_SHADOW}`,
              transform: settings.disparityLevel === n ? 'translateY(1px)' : 'none',
              cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
            }}>{n}</button>
          ))}
        </div>
      </div>

      <div>
        <div style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: PAPER_TEXT_FAINT, marginBottom: '10px' }}>Tile Endurance</div>
        <div style={{ display: 'flex', gap: '6px' }}>
          {FLIP_CAP_PRESETS.map(p => (
            <button key={p.value} onClick={() => select('flipCap', p.value)} style={{
              flex: 1, padding: '8px 4px', border: `2px solid ${settings.flipCap === p.value ? accent : PAPER_BORDER_SOFT}`,
              borderRadius: '10px', fontSize: '11px', fontWeight: settings.flipCap === p.value ? '700' : '500',
              background: settings.flipCap === p.value ? `${accent}18` : PAPER_SHEET_RAISED,
              color: settings.flipCap === p.value ? accent : PAPER_TEXT_FAINT,
              boxShadow: settings.flipCap === p.value ? 'inset 0 2px 4px rgba(0,0,0,0.08)' : `0 2px 0 ${PAPER_CARD_SHADOW}`,
              transform: settings.flipCap === p.value ? 'translateY(1px)' : 'none',
              cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit', textAlign: 'center', lineHeight: 1.3,
            }}>
              <div>{p.label}</div>
              <div style={{ fontSize: '9px', marginTop: '2px', opacity: 0.75 }}>{p.sub}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <div style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: PAPER_TEXT_FAINT, marginBottom: '10px' }}>Game Length</div>
        <div style={{ display: 'flex', gap: '6px' }}>
          {GAME_LENGTH_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => select('gameLength', opt.value)} style={{
              flex: 1, padding: '8px 4px', border: `2px solid ${settings.gameLength === opt.value ? accent : PAPER_BORDER_SOFT}`,
              borderRadius: '10px', fontSize: '11px', fontWeight: settings.gameLength === opt.value ? '700' : '500',
              background: settings.gameLength === opt.value ? `${accent}18` : PAPER_SHEET_RAISED,
              color: settings.gameLength === opt.value ? accent : PAPER_TEXT_FAINT,
              boxShadow: settings.gameLength === opt.value ? 'inset 0 2px 4px rgba(0,0,0,0.08)' : `0 2px 0 ${PAPER_CARD_SHADOW}`,
              transform: settings.gameLength === opt.value ? 'translateY(1px)' : 'none',
              cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit', textAlign: 'center', lineHeight: 1.3,
            }}>
              <div>{opt.label}</div>
              <div style={{ fontSize: '9px', marginTop: '2px', opacity: 0.75 }}>{opt.sub}</div>
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gap: '10px' }}>
        <ToggleRow label="Flip Mode" sub="Allow manual tile flips" value={settings.flipMode} onChange={v => select('flipMode', v)} />
        <ToggleRow label="Wormhole Tunnels" sub="Show antipodal connections" value={settings.showTunnels} onChange={v => select('showTunnels', v)} />
      </div>
    </div>
  );

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
            <button key={n} style={{ ...S.card(selected), flexDirection: 'column', gap: '12px', padding: '18px 16px' }} onClick={() => setCubeSize(n)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '8px', overflow: 'hidden', border: `1px solid ${selected ? 'rgba(0,0,0,0.15)' : PAPER_BORDER_SOFT}`, background: PAPER_BG_MUTED }}>
                  <TilePreviewCanvas styleKey={settings.tileStyle === 'random' ? 'solid' : (settings.tileStyle || 'solid')} colorHex={resolvedColors[1] || '#4a7fa5'} size={44} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${n}, 1fr)`, gap: '3px', width: '44px' }}>
                  {Array.from({ length: n * n }).map((_, i) => <div key={i} style={{ aspectRatio: '1', borderRadius: '3px', background: selected ? ACCENT : '#d4cfc5', transition: 'background 0.18s ease' }} />)}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '3px' }}>
                  <span style={{ fontSize: '16px', fontWeight: '700', color: PAPER_TEXT, letterSpacing: '-0.4px' }}>{name}</span>
                  <span style={{ fontSize: '10px', fontWeight: '600', letterSpacing: '0.04em', textTransform: 'uppercase', color: selected ? ACCENT : PAPER_TEXT_FAINT }}>{tag}</span>
                </div>
                <div style={{ fontSize: '12px', color: PAPER_TEXT_FAINT }}>{desc}</div>
              </div>
              {selected && <div style={{ position: 'absolute', top: '12px', right: '12px' }}><Checkmark /></div>}
            </button>
          );
        })}
      </div>
    );
  };

  const stepContent = [renderBackgrounds, renderStyles, renderColors, renderGameplay, renderSize];
  const stepTitles = ['Background', 'Tile Style', 'Color Palette', 'Gameplay', 'Cube Size'];
  const stepSubtitles = [
    'Choose your play environment',
    'Choose how your tiles look and feel',
    'Pick a palette — see it applied to your chosen tile style',
    'Tune disparity intensity and survival rules',
    'Pick your puzzle dimensions',
  ];

  return (
    <div style={S.overlay}>
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
      <div style={S.sheet}>
        <div style={S.header}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            background: ACCENT, borderRadius: '6px', padding: '4px 12px', marginBottom: '16px',
            fontSize: '11px', fontWeight: '800', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#fff',
            boxShadow: `0 2px 0 ${ACCENT_SHADOW}`,
          }}>
            DISPARITY MODE
          </div>
          <WizardSteps styles={S} steps={STEPS} step={step} />
          <h2 style={S.title}>{stepTitles[step]}</h2>
          <p style={S.subtitle}>{stepSubtitles[step]}</p>
        </div>

        <div style={S.body}><div style={{ paddingBottom: '24px' }}>{stepContent[step]()}</div></div>

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

const ToggleRow = ({ label, sub, value, onChange }) => (
  <button
    type="button"
    onClick={() => onChange(!value)}
    style={{
      ...S.card(value),
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '12px',
      padding: '12px 14px',
      textAlign: 'left',
    }}
  >
    <div>
      <div style={{ fontSize: '14px', fontWeight: '600', color: PAPER_TEXT }}>{label}</div>
      {sub && <div style={{ fontSize: '12px', color: PAPER_TEXT_MUTED, marginTop: '1px' }}>{sub}</div>}
    </div>
    <div style={{ width: '44px', height: '26px', borderRadius: '14px', background: value ? ACCENT : PAPER_BORDER_SOFT, position: 'relative', transition: 'background 0.2s ease', flexShrink: 0, boxShadow: value ? `0 2px 0 ${ACCENT_SHADOW}` : '0 2px 0 #b8b2aa' }}>
      <div style={{ position: 'absolute', top: '3px', left: value ? '21px' : '3px', width: '20px', height: '20px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.20)' }} />
    </div>
  </button>
);

export default DisparitySetupWizard;
