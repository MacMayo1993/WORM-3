import React, { useState, useRef } from 'react';
import { COLOR_SCHEMES, TILE_STYLES, SCHEME_LABELS } from '../../utils/colorSchemes.js';
import { CLASSIC_STYLE_KEYS, ANTIPODAL_STYLE_KEYS, LIVING_STYLE_KEYS } from '../../utils/tileStyleCatalog.js';
import { BACKGROUNDS, getBackgroundUrl } from '../../utils/backgrounds.js';
import { registerTilePreview, updateTilePreview, unregisterTilePreview } from '../../3d/TilePreviewRenderer.js';
import { isMobile } from '../../utils/device.js';
import { useGameStore } from '../../hooks/useGameStore.js';

const BG_PREVIEWS = {
  blackhole: 'radial-gradient(circle, #1a0033 0%, #000000 100%)',
  cave: 'linear-gradient(135deg, #3d2817 0%, #1a120a 100%)',
  beach: 'linear-gradient(180deg, #87ceeb 0%, #f4e4c1 70%, #c2b280 100%)',
  forest: 'linear-gradient(180deg, #6b8e23 0%, #2d5016 50%, #1a2f0f 100%)',
  park: 'linear-gradient(180deg, #a8d5ba 0%, #7cb89d 50%, #4a7c59 100%)',
  night: 'linear-gradient(180deg, #0f0f23 0%, #1a1a3e 50%, #050510 100%)',
  city: 'linear-gradient(180deg, #4a5568 0%, #2d3748 50%, #1a202c 100%)',
  apartment: 'linear-gradient(135deg, #f5f5dc 0%, #deb887 50%, #cd853f 100%)',
  lobby: 'linear-gradient(135deg, #e8e8e8 0%, #b8b8b8 50%, #707070 100%)',
  warehouse: 'linear-gradient(180deg, #6e6e6e 0%, #4a4a4a 50%, #2c2c2c 100%)',
  studio: 'linear-gradient(180deg, #ffffff 0%, #f0f0f0 50%, #d0d0d0 100%)',
  dark: 'linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%)',
  midnight: 'linear-gradient(135deg, #191970 0%, #0c0c38 100%)',
  cobblestone: 'linear-gradient(135deg, #8b8b8b 0%, #555555 100%)',
  desert: 'linear-gradient(180deg, #edc9af 0%, #d2b48c 100%)',
  fireplace: 'linear-gradient(135deg, #5c2c2c 0%, #2a1a1a 100%)',
  lounge: 'linear-gradient(135deg, #4a3b2a 0%, #2a221a 100%)',
  paris: 'linear-gradient(180deg, #aaddff 0%, #dceeff 100%)',
  shanghai: 'linear-gradient(180deg, #1a2a6c 0%, #b21f1f 100%)',
  snow: 'linear-gradient(180deg, #eef7ff 0%, #cceeff 100%)',
  stadium: 'linear-gradient(180deg, #3a7bd5 0%, #3a6073 100%)',
  sunset: 'linear-gradient(180deg, #ff7e5f 0%, #feb47b 100%)',
  umbrella: 'linear-gradient(135deg, #ff9966 0%, #ff5e62 100%)',
};

const BG_OPTIONS = BACKGROUNDS.map(bg => ({
  value: bg.id,
  label: bg.label,
  thumbnail: bg.thumbnail ? getBackgroundUrl(bg.thumbnail) : null,
  gradient: BG_PREVIEWS[bg.id] || 'linear-gradient(135deg, #333 0%, #000 100%)',
}));

const WIZARD_SCHEME_KEYS = Object.keys(SCHEME_LABELS).filter(k => k !== 'biome');
const FACE_LABELS = { 1: 'Front', 2: 'Left', 3: 'Top', 4: 'Back', 5: 'Right', 6: 'Bottom' };
const LEVEL_LABELS = { 1: 'Low', 2: 'Medium', 3: 'High', 4: 'Extreme', 5: 'Maximum' };
const LEVEL_ACCENT = { 1: '#34c759', 2: '#ffcc00', 3: '#ff9500', 4: '#ff3b30', 5: '#af52de' };

const FLIP_CAP_PRESETS = [
  { label: 'Fragile', value: 6, sub: 'Fast massacre' },
  { label: 'Standard', value: 15, sub: 'Balanced carnage' },
  { label: 'Endurance', value: 25, sub: 'Slow attrition' },
  { label: 'Titan', value: 40, sub: 'War of attrition' },
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

function extractColorsFromImage(img, count = 6) {
  const canvas = document.createElement('canvas');
  const size = 64;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, size, size);
  const data = ctx.getImageData(0, 0, size, size).data;
  const pixels = [];
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const brightness = r * 0.299 + g * 0.587 + b * 0.114;
    if (brightness > 20 && brightness < 240) pixels.push([r, g, b]);
  }
  if (pixels.length < count) {
    const fallback = [];
    for (let i = 0; i < count; i++) {
      const idx = Math.floor((i / count) * data.length / 4) * 4;
      fallback.push([data[idx], data[idx + 1], data[idx + 2]]);
    }
    return fallback.map(([r, g, b]) => `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`);
  }
  const centroids = [];
  for (let i = 0; i < count; i++) centroids.push([...pixels[Math.floor((i / count) * pixels.length)]]);
  for (let iter = 0; iter < 10; iter++) {
    const clusters = Array.from({ length: count }, () => []);
    for (const px of pixels) {
      let minDist = Infinity;
      let best = 0;
      for (let c = 0; c < count; c++) {
        const dr = px[0] - centroids[c][0], dg = px[1] - centroids[c][1], db = px[2] - centroids[c][2];
        const dist = dr * dr + dg * dg + db * db;
        if (dist < minDist) {
          minDist = dist;
          best = c;
        }
      }
      clusters[best].push(px);
    }
    for (let c = 0; c < count; c++) {
      if (!clusters[c].length) continue;
      const sum = [0, 0, 0];
      for (const px of clusters[c]) {
        sum[0] += px[0];
        sum[1] += px[1];
        sum[2] += px[2];
      }
      centroids[c] = [Math.round(sum[0] / clusters[c].length), Math.round(sum[1] / clusters[c].length), Math.round(sum[2] / clusters[c].length)];
    }
  }
  centroids.sort((a, b) => {
    const hA = Math.atan2(Math.sqrt(3) * (a[1] - a[2]), 2 * a[0] - a[1] - a[2]);
    const hB = Math.atan2(Math.sqrt(3) * (b[1] - b[2]), 2 * b[0] - b[1] - b[2]);
    return hA - hB;
  });
  return centroids.map(([r, g, b]) => `#${[r, g, b].map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('')}`);
}

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

const S = {
  overlay: {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(8,10,22,0.72)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    zIndex: 1000,
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif',
    padding: isMobile ? '12px' : '0',
    boxSizing: 'border-box',
    animation: 'modalBackdropIn 0.22s ease',
  },
  sheet: {
    background: 'rgba(14,17,38,0.94)',
    borderRadius: isMobile ? '18px' : '24px',
    width: 'min(640px, 100%)',
    maxHeight: isMobile ? '92vh' : '88vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 32px 80px rgba(0,0,0,0.60), 0 0 0 1px rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.06)',
    animation: 'modalSheetIn 0.30s cubic-bezier(0.22, 1, 0.36, 1)',
  },
  header: { padding: isMobile ? '20px 20px 0' : '32px 36px 0', flexShrink: 0 },
  stepIndicator: { display: 'flex', gap: '6px', marginBottom: '24px' },
  dot: (active, current) => ({
    height: '3px',
    borderRadius: '2px',
    background: current ? '#f97316' : active ? 'rgba(249,115,22,0.50)' : 'rgba(255,255,255,0.15)',
    flex: current ? '2' : '1',
    transition: 'all 0.35s cubic-bezier(0.4,0,0.2,1)',
  }),
  title: { fontSize: '24px', fontWeight: '700', letterSpacing: '-0.5px', color: '#e8edf8', margin: '0 0 4px', lineHeight: 1.15 },
  subtitle: { fontSize: '13px', color: 'rgba(200,220,255,0.65)', margin: '0 0 20px', fontWeight: '400' },
  body: {
    padding: isMobile ? '0 20px' : '0 36px',
    overflowY: 'auto',
    flex: 1,
    scrollbarWidth: 'thin',
    scrollbarColor: 'rgba(255,255,255,0.15) transparent',
  },
  card: (selected) => ({
    display: 'flex',
    padding: '14px 16px',
    borderRadius: '14px',
    border: selected ? '2px solid rgba(249,115,22,0.55)' : '2px solid rgba(255,255,255,0.08)',
    background: selected ? 'rgba(249,115,22,0.18)' : 'rgba(255,255,255,0.05)',
    boxShadow: selected ? '0 0 14px rgba(249,115,22,0.22)' : 'none',
    cursor: 'pointer',
    transition: 'all 0.18s ease',
    outline: 'none',
    WebkitTapHighlightColor: 'transparent',
    textAlign: 'left',
    width: '100%',
    fontFamily: 'inherit',
    position: 'relative',
  }),
  checkmark: { width: '18px', height: '18px', borderRadius: '50%', background: '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  bgGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', paddingBottom: '8px' },
  bgCard: (selected) => ({
    borderRadius: '12px',
    overflow: 'hidden',
    border: selected ? '2.5px solid #f97316' : '2.5px solid transparent',
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
  footer: {
    padding: isMobile ? '14px 20px 20px' : '18px 36px 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexShrink: 0,
    borderTop: '1px solid rgba(255,255,255,0.08)',
  },
  btnSecondary: {
    background: 'none', border: 'none', fontSize: '15px', fontWeight: '500', color: 'rgba(200,220,255,0.55)',
    cursor: 'pointer', padding: '10px 16px', borderRadius: '10px', transition: 'color 0.15s ease', fontFamily: 'inherit',
  },
  btnPrimary: {
    background: 'linear-gradient(135deg, #f97316, #fb923c)', border: 'none', fontSize: '15px', fontWeight: '600', color: '#fff',
    cursor: 'pointer', padding: '12px 28px', borderRadius: '12px', transition: 'opacity 0.15s ease, transform 0.12s ease', fontFamily: 'inherit',
    boxShadow: '0 4px 20px rgba(249,115,22,0.40)',
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
    flipCap: 15,
    visualMode: 'classic',
    flipMode: true,
    showTunnels: true,
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
              <div style={{ position: 'absolute', top: '7px', right: '7px', width: '20px', height: '20px', borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 6px rgba(0,0,0,0.25)' }}>
                <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                  <path d="M1 4L3.5 6.5L9 1" stroke="#0a0a0a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
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
              <div style={{ width: '56px', height: '36px', borderRadius: '8px', background: 'rgba(0,0,0,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 600, letterSpacing: '0.06em', color: 'rgba(200,220,255,0.35)', flexShrink: 0 }}>IMG</div>
            )}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '14px', fontWeight: settings.colorScheme === 'custom' ? '600' : '500', color: '#e8edf8' }}>Extract from Image</div>
              <div style={{ fontSize: '12px', color: 'rgba(200,220,255,0.65)', marginTop: '2px' }}>{customPreview ? 'Tap to change image' : 'Upload a photo to auto-generate a palette'}</div>
            </div>
            {resolvedCustom && (
              <div style={{ display: 'flex', gap: '3px', flexShrink: 0 }}>
                {[1, 2, 3, 4, 5, 6].map(i => <div key={i} style={{ width: '12px', height: '12px', borderRadius: '50%', background: resolvedCustom[i], boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />)}
              </div>
            )}
            {settings.colorScheme === 'custom' && <div style={{ marginLeft: 'auto' }}><Checkmark /></div>}
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.10)' }} />
          <span style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(180,210,255,0.40)' }}>Presets</span>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.10)' }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '7px', paddingBottom: '8px' }}>
          {WIZARD_SCHEME_KEYS.filter(k => k !== 'custom').map(key => {
            const selected = settings.colorScheme === key;
            const owned = schemeOwned(key);
            const colors = Object.values(COLOR_SCHEMES[key] || {}).slice(0, 6).sort((a, b) => hexLum(b) - hexLum(a));
            return (
              <button key={key} style={{
                ...S.card(selected), flexDirection: 'column', gap: '6px', padding: '10px 12px',
                ...(owned ? {} : { opacity: 0.42, cursor: 'not-allowed', pointerEvents: 'none' }),
              }} onClick={() => owned && select('colorScheme', key)}>
                <span style={{ fontSize: '12px', fontWeight: selected ? '600' : '400', color: selected ? '#e8edf8' : 'rgba(200,220,255,0.65)', lineHeight: 1.2 }}>
                  {SCHEME_LABELS[key]}{!owned ? ' 🔒' : ''}
                </span>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '5px', overflow: 'hidden', flexShrink: 0 }}>
                    <TilePreviewCanvas styleKey={previewStyle} colorHex={colors[0] || '#4a7fa5'} size={32} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '3px', flex: 1 }}>
                    {colors.slice(1).map((c, i) => <div key={i} style={{ width: '100%', aspectRatio: '1', borderRadius: '50%', background: owned ? c : '#bbb', boxShadow: '0 1px 2px rgba(0,0,0,0.18)' }} />)}
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
        <div style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(180,210,255,0.40)', marginBottom: '8px' }}>{label}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '7px' }}>
          {keys.map(key => {
            const sel = globalStyle === key;
            const owned = tileOwned(key);
            return (
              <button key={key} style={{
                display: 'block', position: 'relative', padding: 0, borderRadius: '12px',
                border: sel ? '2px solid rgba(255,255,255,0.40)' : '2px solid rgba(255,255,255,0.09)',
                background: 'rgba(255,255,255,0.06)',
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
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#e8edf8' }}>Random Mix</div>
              <div style={{ fontSize: '12px', color: 'rgba(200,220,255,0.65)', marginTop: '2px' }}>Different style on every face</div>
            </div>
            {settings.tileStyle === 'random' && !perFace && <Checkmark />}
          </button>
        </div>

        <StyleGrid keys={CLASSIC_STYLE_KEYS} label="Classic" />
        <StyleGrid keys={ANTIPODAL_STYLE_KEYS} label="Antipodal Op Art" />
        <StyleGrid keys={LIVING_STYLE_KEYS} label="Living" />

        <div style={{ marginBottom: '8px' }}>
          <div style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(180,210,255,0.40)', marginBottom: '10px' }}>Per Face</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
            {[1, 2, 3, 4, 5, 6].map(faceId => {
              const globalFallback = settings.tileStyle === 'random' ? 'solid' : (settings.tileStyle || 'solid');
              const rawStyle = perFace?.[faceId] || globalFallback;
              // If the saved style is no longer owned, fall back to solid
              const faceStyle = tileOwned(rawStyle) ? rawStyle : 'solid';
              const faceColor = resolvedColors[faceId] || '#4a7fa5';
              return (
                <div key={faceId} style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '10px', borderRadius: '12px', background: 'rgba(255,255,255,0.06)', border: `2px solid ${faceColor}44` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: faceColor, flexShrink: 0 }} />
                    <span style={{ fontSize: '11px', fontWeight: '600', color: 'rgba(200,220,255,0.65)' }}>{FACE_LABELS[faceId]}</span>
                  </div>
                  <TilePreviewCanvas styleKey={faceStyle === 'random' ? 'solid' : faceStyle} colorHex={faceColor} size={36} />
                  <select value={faceStyle} onChange={e => applyPerFace(faceId, e.target.value)} style={{ fontSize: '10px', padding: '4px 6px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)', color: '#e8edf8', fontFamily: 'inherit', cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none' }}>
                    <optgroup label="Classic">{CLASSIC_STYLE_KEYS.filter(tileOwned).map(k => <option key={k} value={k}>{TILE_STYLES[k]?.label}</option>)}</optgroup>
                    <optgroup label="Antipodal Op Art">{ANTIPODAL_STYLE_KEYS.filter(tileOwned).map(k => <option key={k} value={k}>{TILE_STYLES[k]?.label}</option>)}</optgroup>
                    <optgroup label="Living">{LIVING_STYLE_KEYS.filter(tileOwned).map(k => <option key={k} value={k}>{TILE_STYLES[k]?.label}</option>)}</optgroup>
                  </select>
                </div>
              );
            })}
          </div>
        </div>
      </>
    );
  };

  const accent = LEVEL_ACCENT[settings.disparityLevel];
  const renderGameplay = () => (
    <div style={{ display: 'grid', gap: '18px' }}>
      <div>
        <div style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(180,210,255,0.40)', marginBottom: '10px' }}>
          Disparity Level <span style={{ color: accent }}>{LEVEL_LABELS[settings.disparityLevel]}</span>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          {[1, 2, 3, 4, 5].map(n => (
            <button key={n} onClick={() => select('disparityLevel', n)} style={{
              flex: 1, padding: '9px 0', border: `1.5px solid ${settings.disparityLevel === n ? LEVEL_ACCENT[n] : 'rgba(255,255,255,0.12)'}`,
              borderRadius: '10px', fontSize: '14px', fontWeight: settings.disparityLevel === n ? '700' : '400',
              background: settings.disparityLevel === n ? `${LEVEL_ACCENT[n]}22` : 'rgba(255,255,255,0.05)', color: settings.disparityLevel === n ? LEVEL_ACCENT[n] : 'rgba(200,220,255,0.45)',
              cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
            }}>{n}</button>
          ))}
        </div>
      </div>

      <div>
        <div style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(180,210,255,0.40)', marginBottom: '10px' }}>Tile Endurance</div>
        <div style={{ display: 'flex', gap: '6px' }}>
          {FLIP_CAP_PRESETS.map(p => (
            <button key={p.value} onClick={() => select('flipCap', p.value)} style={{
              flex: 1, padding: '8px 4px', border: `1.5px solid ${settings.flipCap === p.value ? accent : 'rgba(255,255,255,0.12)'}`,
              borderRadius: '10px', fontSize: '11px', fontWeight: settings.flipCap === p.value ? '700' : '400',
              background: settings.flipCap === p.value ? `${accent}22` : 'rgba(255,255,255,0.05)', color: settings.flipCap === p.value ? accent : 'rgba(200,220,255,0.45)',
              cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit', textAlign: 'center', lineHeight: 1.3,
            }}>
              <div>{p.label}</div>
              <div style={{ fontSize: '9px', marginTop: '2px', opacity: 0.75 }}>{p.sub}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <div style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(180,210,255,0.40)', marginBottom: '10px' }}>Game Length</div>
        <div style={{ display: 'flex', gap: '6px' }}>
          {GAME_LENGTH_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => select('gameLength', opt.value)} style={{
              flex: 1, padding: '8px 4px', border: `1.5px solid ${settings.gameLength === opt.value ? accent : 'rgba(255,255,255,0.12)'}`,
              borderRadius: '10px', fontSize: '11px', fontWeight: settings.gameLength === opt.value ? '700' : '400',
              background: settings.gameLength === opt.value ? `${accent}22` : 'rgba(255,255,255,0.05)',
              color: settings.gameLength === opt.value ? accent : 'rgba(200,220,255,0.45)',
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
                <div style={{ width: '44px', height: '44px', borderRadius: '8px', overflow: 'hidden', border: `1px solid ${selected ? 'rgba(255,255,255,0.40)' : 'rgba(255,255,255,0.15)'}`, background: 'rgba(255,255,255,0.06)' }}>
                  <TilePreviewCanvas styleKey={settings.tileStyle === 'random' ? 'solid' : (settings.tileStyle || 'solid')} colorHex={resolvedColors[1] || '#4a7fa5'} size={44} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${n}, 1fr)`, gap: '3px', width: '44px' }}>
                  {Array.from({ length: n * n }).map((_, i) => <div key={i} style={{ aspectRatio: '1', borderRadius: '3px', background: selected ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.20)', transition: 'background 0.18s ease' }} />)}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '3px' }}>
                  <span style={{ fontSize: '16px', fontWeight: '700', color: '#e8edf8', letterSpacing: '-0.4px' }}>{name}</span>
                  <span style={{ fontSize: '10px', fontWeight: '600', letterSpacing: '0.04em', textTransform: 'uppercase', color: selected ? '#e8edf8' : 'rgba(180,210,255,0.40)' }}>{tag}</span>
                </div>
                <div style={{ fontSize: '12px', color: 'rgba(180,210,255,0.50)' }}>{desc}</div>
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
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(249,115,22,0.14)', border: '1.5px solid rgba(249,115,22,0.40)', borderRadius: '20px', padding: '4px 12px', marginBottom: '16px', fontSize: '11px', fontWeight: '700', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#fb923c' }}>
            DISPARITY MODE
          </div>
          <div style={S.stepIndicator}>{STEPS.map((_, i) => <div key={i} style={S.dot(i <= step, i === step)} />)}</div>
          <h2 style={S.title}>{stepTitles[step]}</h2>
          <p style={S.subtitle}>{stepSubtitles[step]}</p>
        </div>

        <div style={S.body}><div style={{ paddingBottom: '24px' }}>{stepContent[step]()}</div></div>

        <div style={S.footer}>
          <button
            style={S.btnSecondary}
            onClick={handleBack}
            onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.85)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(200,220,255,0.55)'; }}
          >
            {step === 0 ? 'Cancel' : 'Back'}
          </button>
          <button
            style={S.btnPrimary}
            onClick={handleNext}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.82'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'none'; }}
            onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.97)'; }}
            onMouseUp={e => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
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
      border: value ? '2px solid rgba(249,115,22,0.55)' : '1.5px solid rgba(255,255,255,0.10)',
    }}
  >
    <div>
      <div style={{ fontSize: '14px', fontWeight: '600', color: '#e8edf8' }}>{label}</div>
      {sub && <div style={{ fontSize: '12px', color: 'rgba(200,220,255,0.55)', marginTop: '1px' }}>{sub}</div>}
    </div>
    <div style={{ width: '44px', height: '26px', borderRadius: '14px', background: value ? '#f97316' : 'rgba(255,255,255,0.18)', position: 'relative', transition: 'background 0.2s ease', flexShrink: 0 }}>
      <div style={{ position: 'absolute', top: '3px', left: value ? '21px' : '3px', width: '20px', height: '20px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s ease' }} />
    </div>
  </button>
);

export default DisparitySetupWizard;
