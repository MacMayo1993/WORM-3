import React, { useState, useRef } from 'react';
import { resolveBiomeManifoldStyles } from '../../modes/CityBiomeMode.js';
import { COLOR_SCHEMES, TILE_STYLES, SCHEME_LABELS } from '../../utils/colorSchemes.js';
import { BACKGROUNDS, getBackgroundUrl } from '../../utils/backgrounds.js';
import { registerTilePreview, updateTilePreview, unregisterTilePreview } from '../../3d/TilePreviewRenderer.js';


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
  gradient: BG_PREVIEWS[bg.id] || 'linear-gradient(135deg, #333 0%, #000 100%)'
}));

const CLASSIC_STYLE_KEYS = ['solid', 'glossy', 'matte', 'metallic', 'carbonFiber', 'hexGrid', 'comic', 'cafeWall', 'hermanGrid', 'opticSpin', 'ouchi'];
const LIVING_STYLE_KEYS = ['grass', 'ice', 'sand', 'water', 'wood', 'circuit', 'holographic', 'pulse', 'lava', 'galaxy', 'neural'];

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
        if (dr*dr+dg*dg+db*db < minDist) { minDist = dr*dr+dg*dg+db*db; best = c; }
      }
      clusters[best].push(px);
    }
    for (let c = 0; c < count; c++) {
      if (!clusters[c].length) continue;
      const sum = [0, 0, 0];
      for (const px of clusters[c]) { sum[0] += px[0]; sum[1] += px[1]; sum[2] += px[2]; }
      centroids[c] = [Math.round(sum[0]/clusters[c].length), Math.round(sum[1]/clusters[c].length), Math.round(sum[2]/clusters[c].length)];
    }
  }
  centroids.sort((a, b) => {
    const hA = Math.atan2(Math.sqrt(3)*(a[1]-a[2]), 2*a[0]-a[1]-a[2]);
    const hB = Math.atan2(Math.sqrt(3)*(b[1]-b[2]), 2*b[0]-b[1]-b[2]);
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
  return <canvas ref={canvasRef} width={size} height={size} style={{ display: 'block', borderRadius: '8px' }} />;
}

// ── Inline styles (zero className dependencies) ──────────────────────────────

const S = {
  overlay: {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0,0,0,0.55)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    zIndex: 1000,
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif',
  },

  sheet: {
    background: 'rgba(255,255,255,0.96)',
    borderRadius: '24px',
    width: 'min(640px, 96vw)',
    maxHeight: '88vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 32px 80px rgba(0,0,0,0.28), 0 0 0 1px rgba(0,0,0,0.06)',
  },

  header: {
    padding: '36px 40px 0',
    flexShrink: 0,
  },

  stepIndicator: {
    display: 'flex',
    gap: '6px',
    marginBottom: '28px',
  },

  dot: (active, current) => ({
    height: '3px',
    borderRadius: '2px',
    background: current ? '#000' : active ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.12)',
    flex: current ? '2' : '1',
    transition: 'all 0.35s cubic-bezier(0.4,0,0.2,1)',
  }),

  title: {
    fontSize: '26px',
    fontWeight: '700',
    letterSpacing: '-0.5px',
    color: '#0a0a0a',
    margin: '0 0 6px',
    lineHeight: 1.15,
  },

  subtitle: {
    fontSize: '14px',
    color: 'rgba(0,0,0,0.42)',
    margin: '0 0 24px',
    letterSpacing: '0.01em',
    fontWeight: '400',
  },

  body: {
    padding: '0 40px',
    overflowY: 'auto',
    flex: 1,
    // Custom scrollbar
    scrollbarWidth: 'thin',
    scrollbarColor: 'rgba(0,0,0,0.15) transparent',
  },

  // Color scheme grid — 2 per row, tall enough to feel considered
  colorGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '10px',
    paddingBottom: '8px',
  },

  colorCard: (selected) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    padding: '14px 16px',
    borderRadius: '14px',
    border: selected ? '2px solid #000' : '2px solid transparent',
    background: selected ? 'rgba(0,0,0,0.04)' : 'rgba(0,0,0,0.025)',
    cursor: 'pointer',
    transition: 'all 0.18s ease',
    textAlign: 'left',
    outline: 'none',
    WebkitTapHighlightColor: 'transparent',
  }),

  colorDots: {
    display: 'flex',
    gap: '3px',
    flexWrap: 'wrap',
    width: '52px',
    flexShrink: 0,
  },

  dot6: (color) => ({
    width: '14px',
    height: '14px',
    borderRadius: '50%',
    background: color,
    boxShadow: '0 1px 3px rgba(0,0,0,0.18)',
  }),

  cardLabel: (selected) => ({
    fontSize: '13px',
    fontWeight: selected ? '600' : '400',
    color: selected ? '#0a0a0a' : 'rgba(0,0,0,0.6)',
    letterSpacing: '-0.1px',
  }),

  checkmark: {
    marginLeft: 'auto',
    width: '18px',
    height: '18px',
    borderRadius: '50%',
    background: '#000',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  // Tile style — horizontal scroll strip
  styleSection: {
    marginBottom: '20px',
  },

  styleSectionLabel: {
    fontSize: '11px',
    fontWeight: '600',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'rgba(0,0,0,0.35)',
    marginBottom: '10px',
  },

  styleStrip: {
    display: 'flex',
    gap: '8px',
    overflowX: 'auto',
    paddingBottom: '8px',
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
  },

  styleChip: (selected) => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '7px',
    padding: '10px 10px 8px',
    borderRadius: '14px',
    border: selected ? '2px solid #000' : '2px solid transparent',
    background: selected ? 'rgba(0,0,0,0.05)' : 'rgba(0,0,0,0.03)',
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'all 0.18s ease',
    outline: 'none',
    WebkitTapHighlightColor: 'transparent',
    minWidth: '72px',
  }),

  styleLabel: (selected) => ({
    fontSize: '10px',
    fontWeight: selected ? '600' : '400',
    color: selected ? '#0a0a0a' : 'rgba(0,0,0,0.5)',
    letterSpacing: '0.01em',
    textAlign: 'center',
    lineHeight: 1.2,
  }),

  // Background — tighter grid
  bgGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '8px',
    paddingBottom: '8px',
  },

  bgCard: (selected) => ({
    borderRadius: '12px',
    overflow: 'hidden',
    border: selected ? '2px solid #000' : '2px solid transparent',
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
    fontSize: '11px',
    fontWeight: '500',
    color: '#fff',
    textAlign: 'center',
    letterSpacing: '0.01em',
  },

  footer: {
    padding: '20px 40px 28px',
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
    letterSpacing: '-0.1px',
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
    letterSpacing: '-0.2px',
  },

  uploadPlaceholder: {
    width: '52px',
    height: '30px',
    borderRadius: '8px',
    background: 'rgba(0,0,0,0.07)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
    flexShrink: 0,
  },
};

// ── Component ─────────────────────────────────────────────────────────────────

const FreeplaySetupWizard = ({ onComplete, onCancel, initialSettings }) => {
  const [step, setStep] = useState(0);
  const [gameMode, setGameMode] = useState('freeplay'); // 'freeplay' | 'biome'
  const [settings, setSettings] = useState({
    colorScheme: initialSettings?.colorScheme || 'standard',
    customColors: initialSettings?.customColors || null,
    tileStyle: initialSettings?.tileStyle || 'solid',
    backgroundTheme: initialSettings?.backgroundTheme || 'blackhole',
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

  const STEPS = ['Mode', 'Colors', 'Style', 'Scene'];
  const totalSteps = 4;

  const handleNext = () => {
    if (step < totalSteps - 1) {
      setStep(step + 1);
    } else {
      const finalSettings = { ...settings };
      if (gameMode === 'biome') {
        finalSettings.biomeMode = { enabled: true, faceAssignment: null };
        finalSettings.colorScheme = 'biome';
        finalSettings.manifoldStyles = resolveBiomeManifoldStyles(null);
      }
      onComplete(finalSettings);
    }
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
    else onCancel();
  };

  const select = (key, value) => setSettings(s => ({ ...s, [key]: value }));

  // ── Step 0: Mode ───────────────────────────────────────────────────────────
  const renderMode = () => {
    const modes = [
      {
        key: 'freeplay',
        icon: '∞',
        title: 'Free Play',
        description: 'Classic puzzle with your choice of colors, tile styles, and background.',
        accent: '#0a0a0a',
      },
      {
        key: 'biome',
        icon: '🏙',
        title: 'City Biome',
        description: 'Six living cities — one per face. Procedural 3D buildings, seam pulses, and manifold entanglement.',
        accent: '#4a00e0',
      },
    ];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingBottom: '8px' }}>
        {modes.map(m => {
          const selected = gameMode === m.key;
          return (
            <button
              key={m.key}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '18px',
                padding: '20px 20px',
                borderRadius: '16px',
                border: selected ? `2px solid ${m.accent}` : '2px solid transparent',
                background: selected ? (m.key === 'biome' ? 'rgba(74,0,224,0.05)' : 'rgba(0,0,0,0.04)') : 'rgba(0,0,0,0.025)',
                cursor: 'pointer',
                textAlign: 'left',
                outline: 'none',
                WebkitTapHighlightColor: 'transparent',
                transition: 'all 0.18s ease',
                width: '100%',
              }}
              onClick={() => {
                setGameMode(m.key);
                if (m.key === 'biome') {
                  setSettings(s => ({ ...s, colorScheme: 'biome' }));
                } else if (gameMode === 'biome') {
                  setSettings(s => ({ ...s, colorScheme: initialSettings?.colorScheme || 'standard' }));
                }
              }}
            >
              <div style={{
                width: '52px', height: '52px', borderRadius: '14px',
                background: selected ? m.accent : 'rgba(0,0,0,0.07)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '24px', flexShrink: 0,
                transition: 'all 0.18s ease',
              }}>
                <span style={selected && m.key === 'biome' ? { filter: 'none' } : {}}>{m.icon}</span>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: '16px', fontWeight: selected ? '700' : '500',
                  color: selected ? m.accent : '#0a0a0a',
                  marginBottom: '4px', letterSpacing: '-0.2px',
                }}>
                  {m.title}
                </div>
                <div style={{ fontSize: '13px', color: 'rgba(0,0,0,0.5)', lineHeight: 1.45 }}>
                  {m.description}
                </div>
              </div>
              {selected && (
                <div style={{
                  width: '20px', height: '20px', borderRadius: '50%',
                  background: m.accent, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', flexShrink: 0, marginTop: '2px',
                }}>
                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                    <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              )}
            </button>
          );
        })}
        {gameMode === 'biome' && (
          <div style={{
            padding: '12px 16px', borderRadius: '12px',
            background: 'rgba(74,0,224,0.06)', border: '1px solid rgba(74,0,224,0.15)',
            fontSize: '12px', color: 'rgba(74,0,224,0.8)', lineHeight: 1.5,
          }}>
            City-to-face assignment will be available in a future update. For now, cities are assigned by face color (White → Frozen Citadel, Blue → Deep Station, Red → Volcanic Foundry, Yellow → Solar Arcology, Green → Bio-Dome, Orange → Neural Hub).
          </div>
        )}
      </div>
    );
  };

  // ── Step 1: Colors ─────────────────────────────────────────────────────────
  const renderColors = () => {
    const schemeKeys = Object.keys(SCHEME_LABELS);
    return (
      <div style={S.colorGrid}>
        {schemeKeys.map(key => {
          const selected = settings.colorScheme === key;
          const isCustom = key === 'custom';
          const colors = !isCustom ? Object.values(COLOR_SCHEMES[key] || {}) : [];

          return (
            <button
              key={key}
              style={S.colorCard(selected)}
              onClick={() => {
                if (isCustom) fileInputRef.current?.click();
                else select('colorScheme', key);
              }}
            >
              {/* Color preview */}
              {isCustom ? (
                customPreview ? (
                  <img src={customPreview} alt="Custom"
                    style={{ width: '52px', height: '30px', objectFit: 'cover', borderRadius: '6px', flexShrink: 0 }} />
                ) : (
                  <div style={S.uploadPlaceholder}>📷</div>
                )
              ) : (
                <div style={S.colorDots}>
                  {colors.slice(0, 6).map((c, i) => (
                    <div key={i} style={S.dot6(c)} />
                  ))}
                </div>
              )}

              <span style={S.cardLabel(selected)}>{SCHEME_LABELS[key]}</span>

              {selected && (
                <div style={S.checkmark}>
                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                    <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>
    );
  };

  // ── Step 1: Tile Style ─────────────────────────────────────────────────────
  const renderStyles = () => {
    const schemeColor = settings.colorScheme !== 'custom'
      ? Object.values(COLOR_SCHEMES[settings.colorScheme] || {})[0] || '#4a7fa5'
      : '#4a7fa5';

    const renderStrip = (keys, label) => (
      <div style={S.styleSection}>
        <div style={S.styleSectionLabel}>{label}</div>
        <div style={{ ...S.styleStrip, WebkitOverflowScrolling: 'touch' }}>
          {keys.map(key => {
            const selected = settings.tileStyle === key;
            const label2 = TILE_STYLES[key]?.label || key;
            return (
              <button key={key} style={S.styleChip(selected)} onClick={() => select('tileStyle', key)}>
                <TilePreviewCanvas styleKey={key} colorHex={schemeColor} size={56} />
                <span style={S.styleLabel(selected)}>{label2}</span>
              </button>
            );
          })}
        </div>
      </div>
    );

    return (
      <>
        {/* Random option */}
        <div style={{ marginBottom: '16px' }}>
          <button
            style={{
              ...S.colorCard(settings.tileStyle === 'random'),
              width: '100%',
              justifyContent: 'flex-start',
            }}
            onClick={() => select('tileStyle', 'random')}
          >
            <div style={{ ...S.uploadPlaceholder, fontSize: '22px', width: '56px', height: '56px', borderRadius: '10px' }}>🎲</div>
            <div>
              <div style={S.cardLabel(settings.tileStyle === 'random')}>Random Mix</div>
              <div style={{ fontSize: '12px', color: 'rgba(0,0,0,0.38)', marginTop: '2px' }}>Different style on every face</div>
            </div>
            {settings.tileStyle === 'random' && (
              <div style={{ ...S.checkmark, marginLeft: 'auto' }}>
                <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                  <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            )}
          </button>
        </div>

        {renderStrip(CLASSIC_STYLE_KEYS, 'Classic')}
        {renderStrip(LIVING_STYLE_KEYS, 'Living')}
      </>
    );
  };

  // ── Step 2: Background ─────────────────────────────────────────────────────
  const renderBackgrounds = () => (
    <div style={S.bgGrid}>
      {BG_OPTIONS.map(opt => {
        const selected = settings.backgroundTheme === opt.value;
        return (
          <button
            key={opt.value}
            style={S.bgCard(selected)}
            onClick={() => select('backgroundTheme', opt.value)}
          >
            {opt.thumbnail ? (
              <img src={opt.thumbnail} alt={opt.label}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            ) : (
              <div style={{ width: '100%', height: '100%', background: opt.gradient }} />
            )}
            <div style={S.bgLabel}>{opt.label}</div>
            {selected && (
              <div style={{
                position: 'absolute', top: '8px', right: '8px',
                width: '20px', height: '20px', borderRadius: '50%',
                background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 1px 6px rgba(0,0,0,0.25)',
              }}>
                <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                  <path d="M1 4L3.5 6.5L9 1" stroke="#0a0a0a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );

  const stepContent = [renderMode, renderColors, renderStyles, renderBackgrounds];
  const stepTitles = ['Choose Mode', 'Choose Colors', 'Choose Style', 'Choose Scene'];
  const stepSubtitles = [
    'Pick how you want to play',
    'Set the color palette for your cube',
    'Pick how your tiles look and feel',
    'Select your play environment',
  ];

  return (
    <div style={S.overlay}>
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />

      <div style={S.sheet}>
        {/* Header */}
        <div style={S.header}>
          {/* Step indicator — segmented bar */}
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
            onMouseEnter={e => e.currentTarget.style.color = 'rgba(0,0,0,0.8)'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(0,0,0,0.45)'}
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

export default FreeplaySetupWizard;
