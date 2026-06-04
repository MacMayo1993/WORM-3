import React, { useState, useRef } from 'react';
import { useGameStore } from '../../hooks/useGameStore.js';
import { WORM_SKINS, WORM_HATS } from '../../worm/wormCosmeticsData.js';
import { WORM_CHARACTERS } from '../../worm/wormCharacterData.js';
import { COLOR_SCHEMES, TILE_STYLES, SCHEME_LABELS } from '../../utils/colorSchemes.js';
import { CLASSIC_STYLE_KEYS, ANTIPODAL_STYLE_KEYS, LIVING_STYLE_KEYS } from '../../utils/tileStyleCatalog.js';
import { BACKGROUNDS, getBackgroundUrl } from '../../utils/backgrounds.js';
import { registerTilePreview, updateTilePreview, unregisterTilePreview } from '../../3d/TilePreviewRenderer.js';
import { isMobile } from '../../utils/device.js';

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

// Color schemes shown in the wizard (biome is a mode, not a palette)
const WIZARD_SCHEME_KEYS = Object.keys(SCHEME_LABELS).filter(k => k !== 'biome');

// Perceived brightness of a hex color (0–255); higher = lighter
const hexLum = hex => {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b;
};

const FACE_LABELS = { 1: 'Front', 2: 'Left', 3: 'Top', 4: 'Back', 5: 'Right', 6: 'Bottom' };

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
    return fallback.map(([r, g, b]) => '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join(''));
  }
  const centroids = [];
  for (let i = 0; i < count; i++) {
    centroids.push([...pixels[Math.floor((i / count) * pixels.length)]]);
  }
  for (let iter = 0; iter < 10; iter++) {
    const clusters = Array.from({ length: count }, () => []);
    for (const px of pixels) {
      let minDist = Infinity, best = 0;
      for (let c = 0; c < count; c++) {
        const dr = px[0] - centroids[c][0], dg = px[1] - centroids[c][1], db = px[2] - centroids[c][2];
        if (dr * dr + dg * dg + db * db < minDist) { minDist = dr * dr + dg * dg + db * db; best = c; }
      }
      clusters[best].push(px);
    }
    for (let c = 0; c < count; c++) {
      if (!clusters[c].length) continue;
      const sum = [0, 0, 0];
      for (const px of clusters[c]) { sum[0] += px[0]; sum[1] += px[1]; sum[2] += px[2]; }
      centroids[c] = [Math.round(sum[0] / clusters[c].length), Math.round(sum[1] / clusters[c].length), Math.round(sum[2] / clusters[c].length)];
    }
  }
  centroids.sort((a, b) => {
    const hA = Math.atan2(Math.sqrt(3) * (a[1] - a[2]), 2 * a[0] - a[1] - a[2]);
    const hB = Math.atan2(Math.sqrt(3) * (b[1] - b[2]), 2 * b[0] - b[1] - b[2]);
    return hA - hB;
  });
  return centroids.map(([r, g, b]) => '#' + [r, g, b].map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join(''));
}

function TilePreviewCanvas({ styleKey, colorHex = '#4a7fa5', size = 48 }) {
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
  return <canvas ref={canvasRef} width={size} height={size} style={{ display: 'block', borderRadius: '6px' }} />;
}

// ── Shared inline styles ──────────────────────────────────────────────────────

// isMobile imported from utils/device.js

const S = {
  overlay: {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(15,23,42,0.28)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    zIndex: 1000,
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif',
    padding: isMobile ? '12px' : '0',
    boxSizing: 'border-box',
  },

  sheet: {
    background: 'rgba(255,255,255,0.96)',
    borderRadius: isMobile ? '18px' : '24px',
    width: 'min(640px, 100%)',
    maxHeight: isMobile ? '92vh' : '88vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 28px 64px rgba(15,23,42,0.16), 0 0 0 1px rgba(15,23,42,0.08)',
  },

  header: {
    padding: isMobile ? '20px 20px 0' : '32px 36px 0',
    flexShrink: 0,
  },

  stepIndicator: {
    display: 'flex',
    gap: '6px',
    marginBottom: '24px',
  },

  dot: (active, current) => ({
    height: '3px',
    borderRadius: '2px',
    background: current ? '#000' : active ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.12)',
    flex: current ? '2' : '1',
    transition: 'all 0.35s cubic-bezier(0.4,0,0.2,1)',
  }),

  title: {
    fontSize: '24px',
    fontWeight: '700',
    letterSpacing: '-0.5px',
    color: '#0a0a0a',
    margin: '0 0 4px',
    lineHeight: 1.15,
  },

  subtitle: {
    fontSize: '13px',
    color: 'rgba(0,0,0,0.42)',
    margin: '0 0 20px',
    fontWeight: '400',
  },

  body: {
    padding: isMobile ? '0 20px' : '0 36px',
    overflowY: 'auto',
    flex: 1,
    scrollbarWidth: 'thin',
    scrollbarColor: 'rgba(0,0,0,0.15) transparent',
  },

  // Generic card with optional selected state
  card: (selected) => ({
    display: 'flex',
    padding: '14px 16px',
    borderRadius: '14px',
    border: selected ? '2px solid #0a0a0a' : '2px solid transparent',
    background: selected ? 'rgba(0,0,0,0.05)' : 'rgba(0,0,0,0.025)',
    cursor: 'pointer',
    transition: 'all 0.18s ease',
    outline: 'none',
    WebkitTapHighlightColor: 'transparent',
    textAlign: 'left',
    width: '100%',
    fontFamily: 'inherit',
    position: 'relative',
  }),

  checkmark: {
    width: '18px',
    height: '18px',
    borderRadius: '50%',
    background: '#0a0a0a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  // Background grid
  bgGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '8px',
    paddingBottom: '8px',
  },

  bgCard: (selected) => ({
    borderRadius: '12px',
    overflow: 'hidden',
    border: selected ? '2.5px solid #0a0a0a' : '2.5px solid transparent',
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

  footer: {
    padding: isMobile ? '14px 20px 20px' : '18px 36px 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexShrink: 0,
    borderTop: '1px solid rgba(0,0,0,0.07)',
  },

  btnSecondary: {
    background: 'none',
    border: 'none',
    fontSize: '15px',
    fontWeight: '500',
    color: 'rgba(0,0,0,0.45)',
    cursor: 'pointer',
    padding: '10px 16px',
    borderRadius: '10px',
    transition: 'color 0.15s ease',
    fontFamily: 'inherit',
  },

  btnPrimary: {
    background: '#0a0a0a',
    border: 'none',
    fontSize: '15px',
    fontWeight: '600',
    color: '#fff',
    cursor: 'pointer',
    padding: '12px 28px',
    borderRadius: '12px',
    transition: 'opacity 0.15s ease, transform 0.12s ease',
    fontFamily: 'inherit',
  },
};

// ── Sub-components ────────────────────────────────────────────────────────────

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
  const [cubeSize, setCubeSize] = useState(initialSettings?.size || 3);
  const [settings, setSettings] = useState({
    colorScheme: initialSettings?.colorScheme || 'standard',
    customColors: initialSettings?.customColors || null,
    tileStyle: 'solid',
    backgroundTheme: initialSettings?.backgroundTheme || 'blackhole',
    // Per-face tile styles; null means "use global tileStyle"
    perFaceStyles: null,
    wormSpeed: 1.0,
    wormOrbCount: 5,
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

  const STEPS = ['Character', 'Scene', 'Colors', 'Style', 'Gameplay', 'Size'];
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
              {/* Loaded tile style preview + cube face density thumbnail */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  border: `1px solid ${selected ? 'rgba(0,0,0,0.38)' : 'rgba(0,0,0,0.16)'}`,
                  background: 'rgba(0,0,0,0.04)',
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
                      background: selected ? '#0a0a0a' : 'rgba(0,0,0,0.15)',
                      transition: 'background 0.18s ease',
                    }} />
                  ))}
                </div>
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '3px' }}>
                  <span style={{ fontSize: '16px', fontWeight: '700', color: '#0a0a0a', letterSpacing: '-0.4px' }}>{name}</span>
                  <span style={{
                    fontSize: '10px', fontWeight: '600', letterSpacing: '0.04em',
                    textTransform: 'uppercase', color: selected ? '#0a0a0a' : 'rgba(0,0,0,0.38)',
                  }}>{tag}</span>
                </div>
                <div style={{ fontSize: '12px', color: 'rgba(0,0,0,0.45)' }}>{desc}</div>
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

  // ── Step 2: Colors ──────────────────────────────────────────────────────────

  const renderColors = () => {
    const resolvedCustom = settings.colorScheme === 'custom' && settings.customColors
      ? settings.customColors
      : null;

    return (
      <>
        {/* Image upload — shown at top, prominent */}
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
            {/* Preview or placeholder */}
            {customPreview ? (
              <img src={customPreview} alt="Uploaded"
                style={{ width: '56px', height: '36px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0 }} />
            ) : (
              <div style={{
                width: '56px', height: '36px', borderRadius: '8px',
                background: 'rgba(0,0,0,0.07)', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: '20px', flexShrink: 0,
              }}>📷</div>
            )}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '14px', fontWeight: settings.colorScheme === 'custom' ? '600' : '500', color: '#0a0a0a' }}>
                Extract from Image
              </div>
              <div style={{ fontSize: '12px', color: 'rgba(0,0,0,0.4)', marginTop: '2px' }}>
                {customPreview ? 'Tap to change image' : 'Upload a photo to auto-generate a palette'}
              </div>
            </div>
            {/* Extracted color dots when active */}
            {resolvedCustom && (
              <div style={{ display: 'flex', gap: '3px', flexShrink: 0 }}>
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} style={{ width: '12px', height: '12px', borderRadius: '50%', background: resolvedCustom[i], boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
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
          <div style={{ flex: 1, height: '1px', background: 'rgba(0,0,0,0.08)' }} />
          <span style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(0,0,0,0.28)' }}>Presets</span>
          <div style={{ flex: 1, height: '1px', background: 'rgba(0,0,0,0.08)' }} />
        </div>

        {/* Palette grid — name above dots, 4 columns, matching in-game settings */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '7px', paddingBottom: '8px' }}>
          {WIZARD_SCHEME_KEYS.filter(k => k !== 'custom').map(key => {
            const owned = ownedItems.includes(`scheme_${key}`);
            const selected = settings.colorScheme === key;
            const colors = Object.values(COLOR_SCHEMES[key] || {}).slice(0, 6).sort((a, b) => hexLum(b) - hexLum(a));
            return (
              <button key={key}
                style={{
                  ...S.card(selected),
                  flexDirection: 'column', gap: '5px', padding: '8px 6px',
                  opacity: owned ? 1 : 0.38,
                  cursor: owned ? 'pointer' : 'not-allowed',
                  position: 'relative',
                }}
                onClick={() => owned && select('colorScheme', key)}>
                {!owned && <span style={{ position: 'absolute', top: 3, right: 4, fontSize: '8px' }}>🔒</span>}
                <span style={{ fontSize: '10px', fontWeight: selected ? '600' : '400', color: selected ? '#0a0a0a' : 'rgba(0,0,0,0.6)', lineHeight: 1.2, textAlign: 'center' }}>
                  {SCHEME_LABELS[key]}
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '3px', width: '100%' }}>
                  {colors.map((c, i) => (
                    <div key={i} style={{ width: '100%', aspectRatio: '1', borderRadius: '50%', background: owned ? c : '#aaa', boxShadow: '0 1px 2px rgba(0,0,0,0.18)' }} />
                  ))}
                </div>
                {selected && (
                  <div style={{ position: 'absolute', top: '5px', right: '5px' }}><Checkmark /></div>
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

    // The global style (null when per-face styles diverge)
    const perFace = settings.perFaceStyles;
    const faceValues = [1, 2, 3, 4, 5, 6].map(id => (perFace?.[id]) || settings.tileStyle || 'solid');
    const globalStyle = faceValues.every(v => v === faceValues[0]) ? faceValues[0] : null;

    const applyGlobal = (key) => {
      select('tileStyle', key);
      setSettings(s => ({ ...s, tileStyle: key, perFaceStyles: null }));
    };

    const applyPerFace = (faceId, key) => {
      // Only track faces that have been explicitly overridden.
      // Starting from settings.perFaceStyles || {} avoids copying 'random' (or any
      // global tileStyle) into entries for untouched faces, which would cause those
      // faces to get the literal string 'random' written into manifoldStyles.
      const current = settings.perFaceStyles || {};
      setSettings(s => ({ ...s, perFaceStyles: { ...current, [faceId]: key } }));
    };

    const StyleGrid = ({ keys, label }) => (
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(0,0,0,0.32)', marginBottom: '8px' }}>
          {label}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '7px' }}>
          {keys.map(key => {
            const owned = ownedItems.includes(`tile_${key}`);
            const sel = globalStyle === key;
            return (
              <button key={key} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                padding: '10px 6px 8px', borderRadius: '12px',
                border: sel ? '2px solid #0a0a0a' : '2px solid transparent',
                background: sel ? 'rgba(0,0,0,0.05)' : 'rgba(0,0,0,0.025)',
                cursor: owned ? 'pointer' : 'not-allowed',
                opacity: owned ? 1 : 0.38,
                outline: 'none', WebkitTapHighlightColor: 'transparent',
                transition: 'all 0.15s ease', fontFamily: 'inherit',
                position: 'relative',
              }} onClick={() => owned && applyGlobal(key)}>
                {!owned && <span style={{ position: 'absolute', top: 3, right: 4, fontSize: '8px' }}>🔒</span>}
                <TilePreviewCanvas styleKey={key} colorHex={Object.values(resolvedColors)[0] || '#4a7fa5'} size={48} />
                <span style={{ fontSize: '10px', fontWeight: sel ? '600' : '400', color: sel ? '#0a0a0a' : 'rgba(0,0,0,0.5)', textAlign: 'center', lineHeight: 1.2 }}>
                  {TILE_STYLES[key]?.label || key}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );

    return (
      <>
        {/* Random Mix shortcut */}
        <div style={{ marginBottom: '18px' }}>
          <button
            style={{ ...S.card(settings.tileStyle === 'random' && !perFace), flexDirection: 'row', alignItems: 'center', gap: '14px' }}
            onClick={() => applyGlobal('random')}
          >
            <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: 'rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', flexShrink: 0 }}>🎲</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#0a0a0a' }}>Random Mix</div>
              <div style={{ fontSize: '12px', color: 'rgba(0,0,0,0.4)', marginTop: '2px' }}>Different style on every face</div>
            </div>
            {settings.tileStyle === 'random' && !perFace && <Checkmark />}
          </button>
        </div>

        <StyleGrid keys={CLASSIC_STYLE_KEYS} label="Classic" />
        <StyleGrid keys={ANTIPODAL_STYLE_KEYS} label="Antipodal Op Art" />
        <StyleGrid keys={LIVING_STYLE_KEYS} label="Living" />

        {/* Per-face overrides */}
        <div style={{ marginBottom: '8px' }}>
          <div style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(0,0,0,0.32)', marginBottom: '10px' }}>
            Per Face
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
            {[1, 2, 3, 4, 5, 6].map(faceId => {
              // 'random' is not a selectable per-face option; fall back to 'solid' so the
              // select box has a valid value when the global style is Random Mix.
              const globalFallback = settings.tileStyle === 'random' ? 'solid' : (settings.tileStyle || 'solid');
              const faceStyle = perFace?.[faceId] || globalFallback;
              const faceColor = resolvedColors[faceId] || '#4a7fa5';
              return (
                <div key={faceId} style={{
                  display: 'flex', flexDirection: 'column', gap: '6px',
                  padding: '10px', borderRadius: '12px', background: 'rgba(0,0,0,0.025)',
                  border: `2px solid ${faceColor}44`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: faceColor, flexShrink: 0 }} />
                    <span style={{ fontSize: '11px', fontWeight: '600', color: 'rgba(0,0,0,0.6)' }}>{FACE_LABELS[faceId]}</span>
                  </div>
                  <TilePreviewCanvas styleKey={faceStyle === 'random' ? 'solid' : faceStyle} colorHex={faceColor} size={36} />
                  <select
                    value={faceStyle}
                    onChange={e => applyPerFace(faceId, e.target.value)}
                    style={{
                      fontSize: '10px', padding: '4px 6px', borderRadius: '6px',
                      border: '1px solid rgba(0,0,0,0.15)', background: '#fff',
                      color: '#0a0a0a', fontFamily: 'inherit', cursor: 'pointer',
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
                  </select>
                </div>
              );
            })}
          </div>
        </div>
      </>
    );
  };


  const renderGameplay = () => (
    <div style={{ display: 'grid', gap: '14px' }}>
      <label style={{ display: 'grid', gap: '6px' }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: 'rgba(0,0,0,0.66)' }}>Worm speed ({settings.wormSpeed.toFixed(1)}×)</div>
        <input type="range" min="0.4" max="5.0" step="0.1" value={settings.wormSpeed}
          onChange={e => select('wormSpeed', parseFloat(e.target.value))}
          style={{ width: '100%', accentColor: '#60a5fa' }} />
      </label>

      <label style={{ display: 'grid', gap: '6px' }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: 'rgba(0,0,0,0.66)' }}>Orb count ({settings.wormOrbCount})</div>
        <input type="range" min="2" max="25" step="1" value={settings.wormOrbCount}
          onChange={e => select('wormOrbCount', parseInt(e.target.value, 10))}
          style={{ width: '100%', accentColor: '#a78bfa' }} />
      </label>

      <label style={{ display: 'grid', gap: '6px' }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: 'rgba(0,0,0,0.66)' }}>Wormhole spawn interval ({settings.wormholeInterval.toFixed(1)}s)</div>
        <input type="range" min="3" max="20" step="0.5" value={settings.wormholeInterval}
          onChange={e => select('wormholeInterval', parseFloat(e.target.value))}
          style={{ width: '100%', accentColor: '#f59e0b' }} />
      </label>

    </div>
  );

  // ── Step 0: Character ───────────────────────────────────────────────────────

  const wormSkinId = useGameStore(s => s.wormSkin ?? 'slime');
  const wormHatId = useGameStore(s => s.wormHat ?? 'none');
  const wormCharacterId = useGameStore(s => s.wormCharacter ?? 'classic');
  const setWormSkin = useGameStore(s => s.setWormSkin);
  const setWormHat = useGameStore(s => s.setWormHat);
  const setWormCharacter = useGameStore(s => s.setWormCharacter);
  const ownedItems = useGameStore(s => s.ownedItems);
  const activeSkin = WORM_SKINS.find(s => s.id === wormSkinId) ?? WORM_SKINS[0];
  const activeCharacter = WORM_CHARACTERS.find(c => c.id === wormCharacterId) ?? WORM_CHARACTERS[0];

  const renderCharacter = () => {
    const chipBase = {
      border: 'none', cursor: 'pointer', borderRadius: '10px',
      transition: 'all 0.18s ease', fontFamily: 'inherit',
    };

    const charIndex = WORM_CHARACTERS.findIndex(c => c.id === wormCharacterId);
    const prevChar = () => setWormCharacter(WORM_CHARACTERS[(charIndex - 1 + WORM_CHARACTERS.length) % WORM_CHARACTERS.length].id);
    const nextChar = () => setWormCharacter(WORM_CHARACTERS[(charIndex + 1) % WORM_CHARACTERS.length].id);

    const isInch = wormCharacterId === 'inch';
    const isGlow = wormCharacterId === 'glow';
    const isBook = wormCharacterId === 'book';
    const HEAD_SZ = isInch ? 50 : 60;
    const bodySegs = isInch
      ? [{w: 42, h: 24, dx: -5}, {w: 34, h: 20, dx: 5}]
      : isBook
        ? [{w: 50, h: 50, dx: 0}, {w: 42, h: 42, dx: 0}, {w: 34, h: 34, dx: 0}]
        : [{w: 50, h: 50, dx: 0}, {w: 42, h: 42, dx: 0}, {w: 34, h: 34, dx: 0}, {w: 26, h: 26, dx: 0}];

    const HatPreview = ({ hatId }) => {
      if (hatId === 'tophat') return (
        <div style={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: '1px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ width: '22px', height: '20px', background: '#111', borderRadius: '3px 3px 0 0' }} />
          <div style={{ width: '22px', height: '4px', background: '#ef4444' }} />
          <div style={{ width: '36px', height: '5px', background: '#111', borderRadius: '2px' }} />
        </div>
      );
      if (hatId === 'party') return (
        <div style={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: '1px' }}>
          <svg width="34" height="32" viewBox="0 0 34 32" fill="none">
            <polygon points="17,1 32,31 2,31" fill="#f97316" />
            <line x1="8" y1="22" x2="26" y2="22" stroke="#ef4444" strokeWidth="2" />
            <line x1="12" y1="13" x2="22" y2="13" stroke="#eab308" strokeWidth="2" />
            <circle cx="17" cy="2" r="2.5" fill="white" />
          </svg>
        </div>
      );
      if (hatId === 'crown') return (
        <div style={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: '1px' }}>
          <svg width="40" height="24" viewBox="0 0 40 24" fill="none">
            <polygon points="2,22 8,8 14,18 20,2 26,18 32,8 38,22" fill="#f59e0b" stroke="#fbbf24" strokeWidth="1" strokeLinejoin="round" />
            <rect x="2" y="18" width="36" height="5" rx="2" fill="#f59e0b" />
            <circle cx="20" cy="4" r="2" fill="#fde68a" />
            <circle cx="8" cy="10" r="1.5" fill="#fde68a" />
            <circle cx="32" cy="10" r="1.5" fill="#fde68a" />
          </svg>
        </div>
      );
      if (hatId === 'halo') return (
        <div style={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: '4px' }}>
          <svg width="40" height="14" viewBox="0 0 40 14" fill="none">
            <ellipse cx="20" cy="7" rx="17" ry="5" stroke="#fde68a" strokeWidth="3" fill="none" filter="url(#haloGlow)" />
            <defs>
              <filter id="haloGlow">
                <feGaussianBlur stdDeviation="1.5" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>
          </svg>
        </div>
      );
      return null;
    };

    const AntennaPreview = () => {
      if (isInch) return null;
      const tipSz = isGlow ? 10 : 7;
      const stalkH = isGlow ? 22 : 14;
      return (
        <div style={{
          position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
          display: 'flex', gap: isGlow ? '24px' : '16px',
          marginBottom: '2px', pointerEvents: 'none',
        }}>
          {[-1, 1].map((tilt, j) => (
            <div key={j} style={{
              display: 'flex', flexDirection: 'column-reverse', alignItems: 'center',
              transform: `rotate(${tilt * 16}deg)`,
              transformOrigin: 'bottom center',
            }}>
              <div style={{ width: '3px', height: stalkH, borderRadius: '2px', background: activeSkin.antenna }} />
              <div style={{
                width: tipSz, height: tipSz, borderRadius: '50%',
                background: activeSkin.glow,
                boxShadow: isGlow ? `0 0 8px ${activeSkin.glow}, 0 0 16px ${activeSkin.glow}88` : 'none',
                marginBottom: '2px',
              }} />
            </div>
          ))}
        </div>
      );
    };

    const STAT_ROWS = [
      { icon: '⚡', label: 'Speed',   key: 'speed',   color: '#f59e0b' },
      { icon: '💚', label: 'Healing', key: 'healing', color: '#22c55e' },
      { icon: '🌀', label: 'Agility', key: 'agility', color: '#60a5fa' },
      { icon: '✨', label: 'Glow',    key: 'glow',    color: '#c084fc' },
    ];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

        {/* ── Hero-select card ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '44% 56%',
          borderRadius: '20px',
          overflow: 'hidden',
          border: '1.5px solid rgba(0,0,0,0.1)',
          boxShadow: '0 6px 28px rgba(0,0,0,0.14)',
        }}>

          {/* LEFT — dark spotlight stage */}
          <div style={{
            background: `radial-gradient(ellipse at 50% 30%, ${activeSkin.glow}2e 0%, #0d0818 55%, #060410 100%)`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: isMobile ? '28px 16px 22px' : '32px 12px 22px',
            position: 'relative',
            minHeight: isMobile ? '230px' : '300px',
            gap: '14px',
            transition: 'background 0.4s ease',
          }}>
            {/* Floor glow ellipse */}
            <div style={{
              position: 'absolute', bottom: '26px', left: '50%', transform: 'translateX(-50%)',
              width: '88px', height: '18px',
              background: `radial-gradient(ellipse, ${activeSkin.glow}55 0%, transparent 70%)`,
              borderRadius: '50%',
              transition: 'background 0.4s ease',
              pointerEvents: 'none',
            }} />

            {/* Arrows + worm */}
            <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '14px' : '10px', width: '100%', justifyContent: 'center', position: 'relative', zIndex: 1 }}>

              {/* Prev */}
              <button onClick={prevChar} style={{
                background: 'rgba(255,255,255,0.1)', border: '1.5px solid rgba(255,255,255,0.22)',
                color: '#fff', width: '34px', height: '34px', borderRadius: '50%',
                cursor: 'pointer', fontSize: '20px', lineHeight: '1',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, fontFamily: 'inherit', transition: 'all 0.15s ease',
                paddingBottom: '1px',
              }}>‹</button>

              {/* Worm body */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', transition: 'opacity 0.2s ease' }}>
                <div style={{ position: 'relative', display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
                  <HatPreview hatId={wormHatId} />
                  <div style={{
                    width: HEAD_SZ, height: HEAD_SZ,
                    borderRadius: isBook ? '14px' : '50%',
                    background: activeSkin.body,
                    boxShadow: isGlow
                      ? `0 0 32px ${activeSkin.glow}cc, 0 0 16px ${activeSkin.glow}88`
                      : `0 0 22px ${activeSkin.glow}88`,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    gap: '4px', position: 'relative', flexShrink: 0, transition: 'all 0.3s ease',
                  }}>
                    <AntennaPreview />
                    <div style={{ display: 'flex', gap: '7px' }}>
                      {[0, 1].map(e => (
                        <div key={e} style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <div style={{ width: '4.5px', height: '4.5px', borderRadius: '50%', background: '#111' }} />
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: '3px', alignItems: 'flex-end' }}>
                      {[0, 1, 2].map(i => (
                        <div key={i} style={{ width: '3.5px', height: '3.5px', borderRadius: '50%', background: '#111', opacity: 0.7, marginBottom: i === 1 ? '-2px' : '0' }} />
                      ))}
                    </div>
                    {isBook && (
                      <div style={{ position: 'absolute', top: '13px', display: 'flex', gap: '4px' }}>
                        <div style={{ width: '14px', height: '11px', border: '2px solid rgba(17,17,17,0.85)', borderRadius: '50%', boxSizing: 'border-box' }} />
                        <div style={{ width: '14px', height: '11px', border: '2px solid rgba(17,17,17,0.85)', borderRadius: '50%', boxSizing: 'border-box' }} />
                      </div>
                    )}
                  </div>
                </div>

                {bodySegs.map(({ w, h, dx }, i) => (
                  <div key={i} style={{
                    width: w, height: h,
                    borderRadius: isBook ? '9px' : '50%',
                    background: activeSkin.belly,
                    flexShrink: 0,
                    boxShadow: isGlow
                      ? `0 0 16px ${activeSkin.glow}cc, 0 0 8px ${activeSkin.glow}88`
                      : `0 0 8px ${activeSkin.glow}44`,
                    outline: isGlow ? `1.5px solid ${activeSkin.glow}66` : 'none',
                    transform: dx !== 0 ? `translateX(${dx}px)` : 'none',
                    opacity: 1 - i * 0.07,
                    transition: 'all 0.25s ease',
                  }} />
                ))}

                {isGlow && (
                  <div style={{
                    width: 19, height: 19, borderRadius: '50%',
                    background: '#ccffaa',
                    boxShadow: `0 0 12px #ccffaacc, 0 0 24px #ccffaa88`,
                    opacity: 0.85,
                  }} />
                )}
              </div>

              {/* Next */}
              <button onClick={nextChar} style={{
                background: 'rgba(255,255,255,0.1)', border: '1.5px solid rgba(255,255,255,0.22)',
                color: '#fff', width: '34px', height: '34px', borderRadius: '50%',
                cursor: 'pointer', fontSize: '20px', lineHeight: '1',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, fontFamily: 'inherit', transition: 'all 0.15s ease',
                paddingBottom: '1px',
              }}>›</button>
            </div>

            {/* Page dots */}
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              {WORM_CHARACTERS.map(c => (
                <button key={c.id} onClick={() => setWormCharacter(c.id)} style={{
                  width: c.id === wormCharacterId ? '20px' : '7px',
                  height: '7px', borderRadius: '4px',
                  background: c.id === wormCharacterId ? '#fff' : 'rgba(255,255,255,0.3)',
                  border: 'none', cursor: 'pointer', padding: 0,
                  transition: 'all 0.28s cubic-bezier(0.4,0,0.2,1)',
                }} />
              ))}
            </div>
          </div>

          {/* RIGHT — parchment stats panel */}
          <div style={{
            background: 'linear-gradient(155deg, #fdf6e3 0%, #f5e4c0 100%)',
            padding: '22px 18px',
            display: 'flex', flexDirection: 'column', gap: '10px',
            borderLeft: isMobile ? 'none' : '1.5px solid rgba(139,90,43,0.18)',
            borderTop: isMobile ? '1.5px solid rgba(139,90,43,0.18)' : 'none',
          }}>

            {/* Name + type badge */}
            <div>
              <div style={{
                fontSize: isMobile ? '17px' : '20px', fontWeight: '800',
                letterSpacing: '-0.2px', color: '#2d1400', lineHeight: 1.1, marginBottom: '7px',
              }}>{activeCharacter.label.toUpperCase()}</div>
              <div style={{
                display: 'inline-flex', alignItems: 'center',
                background: '#5c2d0a', color: '#ffd077',
                fontSize: '9px', fontWeight: '800', letterSpacing: '0.16em',
                textTransform: 'uppercase', padding: '3px 10px', borderRadius: '20px',
              }}>{activeCharacter.type}</div>
            </div>

            <div style={{ height: '1px', background: 'rgba(139,90,43,0.22)' }} />

            {/* Stat bars */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {STAT_ROWS.map(({ icon, label, key, color }) => {
                const val = activeCharacter.stats[key];
                return (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ fontSize: '13px', width: '18px', flexShrink: 0 }}>{icon}</span>
                    <span style={{ fontSize: '10px', fontWeight: '700', color: '#5c2d0a', width: '46px', textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0 }}>{label}</span>
                    <div style={{ flex: 1, height: '7px', borderRadius: '4px', background: 'rgba(0,0,0,0.12)', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', width: `${val}%`, borderRadius: '4px',
                        background: `linear-gradient(90deg, ${color}bb, ${color})`,
                        boxShadow: `0 0 5px ${color}77`,
                        transition: 'width 0.45s cubic-bezier(0.4,0,0.2,1)',
                      }} />
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: '800', color: '#2d1400', width: '26px', textAlign: 'right', flexShrink: 0 }}>{val}</span>
                  </div>
                );
              })}
            </div>

            <div style={{ height: '1px', background: 'rgba(139,90,43,0.22)' }} />

            {/* Special ability */}
            <div style={{ fontSize: '10.5px', lineHeight: 1.5, color: '#5c2d0a' }}>
              <span style={{ fontWeight: '800', color: '#2d1400', fontSize: '10px', display: 'block', marginBottom: '3px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>★ Special</span>
              <span style={{ fontStyle: 'italic' }}>{activeCharacter.special}</span>
            </div>
          </div>
        </div>

        {/* ── Skin picker — compact horizontal scroll ── */}
        <div>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(0,0,0,0.5)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '8px' }}>Skin</div>
          <div style={{ display: 'flex', gap: '7px', overflowX: 'auto', paddingBottom: '4px' }}>
            {WORM_SKINS.map(skin => {
              const owned = ownedItems.includes(`skin_${skin.id}`);
              const selected = skin.id === wormSkinId;
              return (
                <button key={skin.id} onClick={() => owned && setWormSkin(skin.id)} style={{
                  ...chipBase, flexShrink: 0,
                  padding: '8px 10px 6px',
                  background: selected ? `${skin.body}22` : 'rgba(0,0,0,0.04)',
                  border: selected ? `2px solid ${skin.body}` : '2px solid transparent',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px',
                  boxShadow: selected ? `0 0 10px ${skin.glow}55` : 'none',
                  opacity: owned ? 1 : 0.4,
                  cursor: owned ? 'pointer' : 'not-allowed',
                  position: 'relative',
                  minWidth: '58px',
                }}>
                  <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: owned ? skin.body : '#888', boxShadow: owned ? `0 0 8px ${skin.glow}88` : 'none' }} />
                  <span style={{ fontSize: '9px', fontWeight: 700, color: selected ? skin.body : 'rgba(0,0,0,0.5)', letterSpacing: '0.06em' }}>{skin.label}</span>
                  {!owned && <span style={{ position: 'absolute', top: '3px', right: '3px', fontSize: '8px' }}>🔒</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Hat picker ── */}
        <div>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(0,0,0,0.5)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '8px' }}>Hat</div>
          <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap' }}>
            {WORM_HATS.map(hat => {
              const owned = ownedItems.includes(`hat_${hat.id}`);
              const selected = hat.id === wormHatId;
              return (
                <button key={hat.id} onClick={() => owned && setWormHat(hat.id)} style={{
                  ...chipBase,
                  padding: '9px 14px',
                  background: selected ? 'rgba(168,85,247,0.12)' : 'rgba(0,0,0,0.04)',
                  border: selected ? '2px solid #a855f7' : '2px solid transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  minWidth: '60px',
                  boxShadow: selected ? '0 0 10px rgba(168,85,247,0.3)' : 'none',
                  opacity: owned ? 1 : 0.4,
                  cursor: owned ? 'pointer' : 'not-allowed',
                }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: selected ? '#7c3aed' : 'rgba(0,0,0,0.5)' }}>
                    {hat.label}{!owned ? ' 🔒' : ''}
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

  const stepContent = [renderCharacter, renderBackgrounds, renderColors, renderStyles, renderGameplay, renderSize];
  const stepTitles = ['Pick Worm Type', 'Background', 'Color Palette', 'Tile Style', 'Gameplay', 'Cube Size'];
  const stepSubtitles = [
    'Select your character, then customize skin & hat',
    'Choose your play environment',
    'Set the colors for your cube faces (or upload an image)',
    'Choose how your tiles look and feel',
    'Tune how fast and chaotic your worm run feels',
    'Pick your puzzle dimensions with tile previews loaded',
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
            background: 'rgba(168,85,247,0.12)', border: '1.5px solid rgba(168,85,247,0.35)',
            borderRadius: '20px', padding: '4px 12px', marginBottom: '16px',
            fontSize: '11px', fontWeight: '700', letterSpacing: '0.12em',
            textTransform: 'uppercase', color: '#7c3aed',
          }}>
            🐍 WORM MODE
          </div>
          <div style={S.stepIndicator}>
            {STEPS.map((_, i) => (
              <div key={i} style={S.dot(i <= step, i === step)} />
            ))}
          </div>
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
            onMouseEnter={e => { e.currentTarget.style.color = 'rgba(0,0,0,0.8)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(0,0,0,0.45)'; }}
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

export default WormModeSetupWizard;
