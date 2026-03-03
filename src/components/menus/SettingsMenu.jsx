import React, { useRef, useState, useEffect } from 'react';
import { COLOR_SCHEMES, SCHEME_LABELS, TILE_STYLES } from '../../utils/colorSchemes.js';
import { BACKGROUNDS, getBackgroundUrl } from '../../utils/backgrounds.js';
import {
  registerTilePreview,
  updateTilePreview,
  unregisterTilePreview,
} from '../../3d/TilePreviewRenderer.js';
import { useGameStore } from '../../hooks/useGameStore.js';

const FACE_LABELS = { 1: 'Front', 2: 'Left', 3: 'Top', 4: 'Back', 5: 'Right', 6: 'Bottom' };

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
  desert: 'linear-gradient(180deg, #edc9af 0%, #d2b48c 100%)',
  sunset: 'linear-gradient(180deg, #ff7e5f 0%, #feb47b 100%)',
  snow: 'linear-gradient(180deg, #eef7ff 0%, #cceeff 100%)',
  paris: 'linear-gradient(180deg, #aaddff 0%, #dceeff 100%)',
  shanghai: 'linear-gradient(180deg, #1a2a6c 0%, #b21f1f 100%)',
};

const BG_OPTIONS = BACKGROUNDS.map(bg => ({
  value: bg.id,
  label: bg.label,
  thumbnail: bg.thumbnail ? getBackgroundUrl(bg.thumbnail) : null,
  gradient: BG_PREVIEWS[bg.id] || 'linear-gradient(135deg, #333 0%, #000 100%)',
}));

const CLASSIC_STYLE_KEYS = ['solid', 'glossy', 'matte', 'metallic', 'carbonFiber', 'hexGrid', 'comic', 'cafeWall', 'hermanGrid', 'opticSpin', 'ouchi'];
const LIVING_STYLE_KEYS  = ['grass', 'ice', 'sand', 'water', 'wood', 'circuit', 'holographic', 'pulse', 'lava', 'galaxy', 'neural'];

// ── Inline style tokens — mirrors FreeplaySetupWizard.jsx ─────────────────────
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
    zIndex: 10000,
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
    padding: '32px 40px 0',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  title: {
    fontSize: '26px',
    fontWeight: '700',
    letterSpacing: '-0.5px',
    color: '#0a0a0a',
    margin: 0,
    lineHeight: 1.15,
  },

  closeBtn: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    background: 'rgba(0,0,0,0.06)',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '17px',
    color: 'rgba(0,0,0,0.45)',
    flexShrink: 0,
    fontFamily: 'inherit',
    transition: 'background 0.15s ease',
  },

  tabBar: {
    display: 'flex',
    gap: '4px',
    padding: '16px 40px 0',
    flexShrink: 0,
    overflowX: 'auto',
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
  },

  tab: (active) => ({
    padding: '8px 16px',
    borderRadius: '8px',
    border: 'none',
    fontSize: '13px',
    fontWeight: active ? '600' : '400',
    color: active ? '#fff' : 'rgba(0,0,0,0.5)',
    background: active ? '#0a0a0a' : 'rgba(0,0,0,0.05)',
    cursor: 'pointer',
    transition: 'all 0.18s ease',
    whiteSpace: 'nowrap',
    fontFamily: 'inherit',
    letterSpacing: '-0.1px',
  }),

  divider: {
    height: '1px',
    background: 'rgba(0,0,0,0.07)',
    margin: '16px 0 0',
    flexShrink: 0,
  },

  body: {
    padding: '0 40px',
    overflowY: 'auto',
    flex: 1,
    scrollbarWidth: 'thin',
    scrollbarColor: 'rgba(0,0,0,0.15) transparent',
  },

  sectionTitle: {
    fontSize: '11px',
    fontWeight: '600',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'rgba(0,0,0,0.35)',
    margin: '24px 0 12px',
  },

  hint: {
    fontSize: '12px',
    color: 'rgba(0,0,0,0.4)',
    marginBottom: '12px',
    lineHeight: 1.5,
  },

  // ── Color scheme cards ──
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
    width: '100%',
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

  // ── Tile style chips ──
  styleSection: { marginBottom: '20px' },

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
    WebkitOverflowScrolling: 'touch',
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

  // ── Background grid ──
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

  // ── Toggle rows ──
  toggleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 0',
    borderBottom: '1px solid rgba(0,0,0,0.06)',
  },

  toggleRowLast: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 0',
  },

  toggleLabelText: {
    fontSize: '14px',
    color: '#0a0a0a',
    fontWeight: '400',
    letterSpacing: '-0.1px',
  },

  toggleHint: {
    fontSize: '12px',
    color: 'rgba(0,0,0,0.4)',
    marginTop: '2px',
    lineHeight: 1.4,
  },

  // Slider
  sliderLabel: {
    fontSize: '13px',
    color: 'rgba(0,0,0,0.7)',
    marginBottom: '8px',
    display: 'block',
    letterSpacing: '-0.1px',
  },

  sliderHints: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '11px',
    color: 'rgba(0,0,0,0.38)',
    marginTop: '4px',
  },

  // Color picker grid
  colorPickerGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '12px',
    marginBottom: '8px',
  },

  colorPickerItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
  },

  colorPickerLabel: {
    fontSize: '11px',
    color: 'rgba(0,0,0,0.5)',
    letterSpacing: '0.03em',
  },

  // Face texture grid
  faceTextureGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '12px',
    marginBottom: '8px',
  },

  faceTextureItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
  },

  faceTextureUpload: {
    width: '60px',
    height: '60px',
    borderRadius: '12px',
    border: '2px dashed rgba(0,0,0,0.18)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    fontSize: '22px',
    color: 'rgba(0,0,0,0.3)',
    transition: 'border-color 0.18s ease, background 0.18s ease',
    background: 'rgba(0,0,0,0.025)',
  },

  faceTexturePreview: {
    width: '60px',
    height: '60px',
    borderRadius: '12px',
    overflow: 'hidden',
    position: 'relative',
    cursor: 'pointer',
    border: '2px solid rgba(0,0,0,0.1)',
  },

  infoBox: (accent) => ({
    padding: '12px 16px',
    borderRadius: '12px',
    background: `rgba(${accent}, 0.06)`,
    border: `1px solid rgba(${accent}, 0.18)`,
    fontSize: '12px',
    color: `rgba(${accent}, 0.85)`,
    lineHeight: 1.5,
    marginTop: '12px',
  }),

  uploadBtn: {
    background: 'rgba(0,0,0,0.06)',
    border: 'none',
    borderRadius: '10px',
    padding: '10px 18px',
    fontSize: '13px',
    fontWeight: '500',
    color: '#0a0a0a',
    cursor: 'pointer',
    fontFamily: 'inherit',
    letterSpacing: '-0.1px',
    transition: 'background 0.15s ease',
  },

  perFaceGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '12px',
    paddingBottom: '8px',
  },

  perFaceItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
  },

  perFacePreviewWrap: {
    width: '52px',
    height: '52px',
    borderRadius: '12px',
    border: '2px solid rgba(0,0,0,0.1)',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  perFaceSelect: {
    width: '100%',
    fontSize: '11px',
    padding: '5px 6px',
    borderRadius: '8px',
    border: '1px solid rgba(0,0,0,0.15)',
    background: 'rgba(0,0,0,0.03)',
    color: '#0a0a0a',
    cursor: 'pointer',
    fontFamily: 'inherit',
    outline: 'none',
  },
};

// ── Shared helpers ─────────────────────────────────────────────────────────────

const CheckSVG = () => (
  <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
    <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const Toggle = ({ on, onChange }) => (
  <div
    onClick={onChange}
    style={{
      width: '44px',
      height: '26px',
      borderRadius: '13px',
      background: on ? '#0a0a0a' : 'rgba(0,0,0,0.12)',
      position: 'relative',
      cursor: 'pointer',
      transition: 'background 0.2s ease',
      flexShrink: 0,
    }}
  >
    <div style={{
      position: 'absolute',
      top: '3px',
      left: on ? '21px' : '3px',
      width: '20px',
      height: '20px',
      borderRadius: '50%',
      background: '#fff',
      boxShadow: '0 1px 4px rgba(0,0,0,0.22)',
      transition: 'left 0.2s ease',
    }} />
  </div>
);

// Shared image color extractor (same k-means as FreeplaySetupWizard)
function extractColorsFromImage(img, count = 6) {
  const canvas = document.createElement('canvas');
  const size = 64;
  canvas.width = size; canvas.height = size;
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
  for (let i = 0; i < count; i++) centroids.push([...pixels[Math.floor((i / count) * pixels.length)]]);
  for (let iter = 0; iter < 10; iter++) {
    const clusters = Array.from({ length: count }, () => []);
    for (const px of pixels) {
      let minDist = Infinity, best = 0;
      for (let c = 0; c < count; c++) {
        const dr = px[0]-centroids[c][0], dg = px[1]-centroids[c][1], db = px[2]-centroids[c][2];
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

// ── TilePreviewCanvas ─────────────────────────────────────────────────────────

function TilePreviewCanvas({ styleKey, colorHex = '#4a7fa5', size = 48 }) {
  const canvasRef = useRef(null);
  const idRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = size; canvas.height = size;
    idRef.current = registerTilePreview(canvas, styleKey, colorHex);
    return () => { if (idRef.current !== null) unregisterTilePreview(idRef.current); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (idRef.current !== null) updateTilePreview(idRef.current, styleKey, colorHex);
  }, [styleKey, colorHex]);

  return <canvas ref={canvasRef} width={size} height={size} style={{ display: 'block', borderRadius: '8px' }} />;
}

// ── Sub-panels ────────────────────────────────────────────────────────────────

function ColorsPanel({ settings, onSettingsChange, faceImages, onFaceImage }) {
  const fileInputRef = useRef(null);
  const faceFileRefs = useRef({});
  const [preview, setPreview] = useState(null);

  const update = (key, val) => onSettingsChange({ ...settings, [key]: val });

  const updateCustomColor = (faceId, color) => {
    const current = settings.customColors || { ...COLOR_SCHEMES.standard };
    onSettingsChange({ ...settings, colorScheme: 'custom', customColors: { ...current, [faceId]: color } });
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      setPreview(url);
      const colors = extractColorsFromImage(img, 6);
      const customColors = {};
      colors.forEach((c, i) => { customColors[i + 1] = c; });
      onSettingsChange({ ...settings, colorScheme: 'custom', customColors });
    };
    img.src = url;
  };

  const handleFaceImageUpload = (faceId, e) => {
    const file = e.target.files?.[0];
    if (!file || !onFaceImage) return;
    onFaceImage(faceId, URL.createObjectURL(file));
  };

  const resolvedColors = settings.colorScheme === 'custom' && settings.customColors
    ? { ...COLOR_SCHEMES.standard, ...settings.customColors }
    : COLOR_SCHEMES[settings.colorScheme] || COLOR_SCHEMES.standard;

  return (
    <>
      {/* Color Scheme */}
      <p style={S.sectionTitle}>Color Scheme</p>
      <div style={S.colorGrid}>
        {Object.keys(SCHEME_LABELS).map(key => {
          const selected = settings.colorScheme === key;
          const isCustom = key === 'custom';
          const colors = !isCustom ? Object.values(COLOR_SCHEMES[key] || {}) : [];
          return (
            <button
              key={key}
              style={S.colorCard(selected)}
              onClick={() => { if (isCustom) fileInputRef.current?.click(); else update('colorScheme', key); }}
            >
              {isCustom ? (
                preview
                  ? <img src={preview} alt="Custom" style={{ width: '52px', height: '30px', objectFit: 'cover', borderRadius: '6px', flexShrink: 0 }} />
                  : <div style={{ width: '52px', height: '30px', borderRadius: '6px', background: 'rgba(0,0,0,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>📷</div>
              ) : (
                <div style={S.colorDots}>
                  {colors.slice(0, 6).map((c, i) => <div key={i} style={S.dot6(c)} />)}
                </div>
              )}
              <span style={S.cardLabel(selected)}>{SCHEME_LABELS[key]}</span>
              {selected && <div style={S.checkmark}><CheckSVG /></div>}
            </button>
          );
        })}
      </div>
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />

      {/* Custom color pickers */}
      {settings.colorScheme === 'custom' && (
        <>
          <p style={S.sectionTitle}>Custom Colors</p>
          <div style={S.colorPickerGrid}>
            {[1, 2, 3, 4, 5, 6].map(faceId => (
              <div key={faceId} style={S.colorPickerItem}>
                <input
                  type="color"
                  value={resolvedColors[faceId]}
                  onChange={e => updateCustomColor(faceId, e.target.value)}
                  style={{ width: '44px', height: '44px', borderRadius: '10px', border: '2px solid rgba(0,0,0,0.1)', cursor: 'pointer', padding: '2px' }}
                />
                <span style={S.colorPickerLabel}>{FACE_LABELS[faceId]}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Face Textures */}
      <p style={S.sectionTitle}>Face Textures</p>
      <p style={S.hint}>Upload an image to map onto a cube face</p>
      <div style={S.faceTextureGrid}>
        {[1, 2, 3, 4, 5, 6].map(faceId => (
          <div key={faceId} style={S.faceTextureItem}>
            <input
              ref={el => { faceFileRefs.current[faceId] = el; }}
              type="file" accept="image/*"
              onChange={e => handleFaceImageUpload(faceId, e)}
              style={{ display: 'none' }}
            />
            {faceImages[faceId] ? (
              <div style={S.faceTexturePreview} onClick={() => faceFileRefs.current[faceId]?.click()}>
                <img src={faceImages[faceId]} alt={FACE_LABELS[faceId]} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                <button
                  onClick={e => { e.stopPropagation(); onFaceImage?.(faceId, null); }}
                  style={{ position: 'absolute', top: '3px', right: '3px', width: '18px', height: '18px', borderRadius: '50%', background: 'rgba(0,0,0,0.55)', border: 'none', color: '#fff', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
                >×</button>
              </div>
            ) : (
              <div
                style={{ ...S.faceTextureUpload, borderColor: resolvedColors[faceId] + '55' }}
                onClick={() => faceFileRefs.current[faceId]?.click()}
              >+</div>
            )}
            <span style={S.colorPickerLabel}>{FACE_LABELS[faceId]}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function TilesPanel({ settings, onSettingsChange }) {
  const resolvedColors = settings.colorScheme === 'custom' && settings.customColors
    ? { ...COLOR_SCHEMES.standard, ...settings.customColors }
    : COLOR_SCHEMES[settings.colorScheme] || COLOR_SCHEMES.standard;

  const currentStyles = settings.manifoldStyles || {};
  const faceValues = [1, 2, 3, 4, 5, 6].map(id => currentStyles[id] || 'solid');
  const allSame = faceValues.every(v => v === faceValues[0]);
  const globalStyle = allSame ? faceValues[0] : null;

  const applyToAll = (styleKey) => {
    const newStyles = {};
    [1, 2, 3, 4, 5, 6].forEach(id => { newStyles[id] = styleKey; });
    onSettingsChange({ ...settings, manifoldStyles: newStyles });
  };

  const applyToFace = (faceId, styleKey) => {
    onSettingsChange({ ...settings, manifoldStyles: { ...currentStyles, [faceId]: styleKey } });
  };

  const randomizeStyles = () => {
    const pool = [...CLASSIC_STYLE_KEYS, ...LIVING_STYLE_KEYS];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const newStyles = {};
    [1, 2, 3, 4, 5, 6].forEach((id, i) => { newStyles[id] = pool[i]; });
    onSettingsChange({ ...settings, manifoldStyles: newStyles });
  };

  const renderStrip = (keys, label) => (
    <div style={S.styleSection}>
      <div style={S.styleSectionLabel}>{label}</div>
      <div style={S.styleStrip}>
        {keys.map(key => {
          const selected = globalStyle === key;
          return (
            <button key={key} style={S.styleChip(selected)} onClick={() => applyToAll(key)}>
              <TilePreviewCanvas styleKey={key} size={56} />
              <span style={S.styleLabel(selected)}>{TILE_STYLES[key]?.label || key}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <>
      {renderStrip(CLASSIC_STYLE_KEYS, 'Classic')}
      {renderStrip(LIVING_STYLE_KEYS, 'Living')}

      {/* Random Mix */}
      <div style={{ marginBottom: '20px' }}>
        <button
          style={{ ...S.colorCard(false), justifyContent: 'flex-start', gap: '16px' }}
          onClick={randomizeStyles}
        >
          <div style={{ width: '56px', height: '56px', borderRadius: '10px', background: 'rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', flexShrink: 0 }}>🎲</div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: '500', color: '#0a0a0a', marginBottom: '2px' }}>Random Mix</div>
            <div style={{ fontSize: '12px', color: 'rgba(0,0,0,0.4)' }}>Assign a unique style to each face</div>
          </div>
        </button>
      </div>

      {/* Per-face overrides */}
      <p style={S.sectionTitle}>Per Face</p>
      <div style={S.perFaceGrid}>
        {[1, 2, 3, 4, 5, 6].map(faceId => {
          const faceStyle = currentStyles[faceId] || 'solid';
          const faceColor = resolvedColors[faceId];
          return (
            <div key={faceId} style={S.perFaceItem}>
              <div style={{ ...S.perFacePreviewWrap, borderColor: faceColor + '88' }}>
                <TilePreviewCanvas styleKey={faceStyle} colorHex={faceColor} size={48} />
              </div>
              <span style={{ ...S.colorPickerLabel, fontWeight: '500', color: '#0a0a0a' }}>{FACE_LABELS[faceId]}</span>
              <select style={S.perFaceSelect} value={faceStyle} onChange={e => applyToFace(faceId, e.target.value)}>
                <optgroup label="Classic">
                  {CLASSIC_STYLE_KEYS.map(k => <option key={k} value={k}>{TILE_STYLES[k]?.label}</option>)}
                </optgroup>
                <optgroup label="Living">
                  {LIVING_STYLE_KEYS.map(k => <option key={k} value={k}>{TILE_STYLES[k]?.label}</option>)}
                </optgroup>
              </select>
            </div>
          );
        })}
      </div>
    </>
  );
}

function ScenePanel({ settings, onSettingsChange }) {
  return (
    <>
      <p style={S.sectionTitle}>Background</p>
      <div style={S.bgGrid}>
        {BG_OPTIONS.map(opt => {
          const selected = settings.backgroundTheme === opt.value;
          return (
            <button key={opt.value} style={S.bgCard(selected)} onClick={() => onSettingsChange({ ...settings, backgroundTheme: opt.value })}>
              {opt.thumbnail
                ? <img src={opt.thumbnail} alt={opt.label} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                : <div style={{ width: '100%', height: '100%', background: opt.gradient }} />
              }
              <div style={S.bgLabel}>{opt.label}</div>
              {selected && (
                <div style={{ position: 'absolute', top: '8px', right: '8px', width: '20px', height: '20px', borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 6px rgba(0,0,0,0.25)' }}>
                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                    <path d="M1 4L3.5 6.5L9 1" stroke="#0a0a0a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}

function DisplayPanel({ settings, onSettingsChange }) {
  const update = (key, val) => onSettingsChange({ ...settings, [key]: val });
  const toggles = [
    { key: 'showStats', label: 'Stats Bar', hint: 'Move counter, time, and parity display' },
    { key: 'showManifoldFooter', label: 'Manifold Footer', hint: 'Grid ID and topology labels' },
    { key: 'showFaceProgress', label: 'Face Progress Bars', hint: 'Per-face solve progress indicators' },
  ];
  return (
    <>
      <p style={S.sectionTitle}>UI Layout</p>
      <div style={{ paddingBottom: '8px' }}>
        {toggles.map((item, idx) => (
          <div key={item.key} style={idx < toggles.length - 1 ? S.toggleRow : S.toggleRowLast}>
            <div>
              <div style={S.toggleLabelText}>{item.label}</div>
              <div style={S.toggleHint}>{item.hint}</div>
            </div>
            <Toggle on={!!settings[item.key]} onChange={() => update(item.key, !settings[item.key])} />
          </div>
        ))}
      </div>
    </>
  );
}

function ModesPanel() {
  const antipodalMode        = useGameStore(s => s.antipodalMode);
  const echoDelay            = useGameStore(s => s.echoDelay);
  const antipodalVizIntensity = useGameStore(s => s.antipodalVizIntensity);
  const setAntipodalMode     = useGameStore(s => s.setAntipodalMode);
  const setEchoDelay         = useGameStore(s => s.setEchoDelay);
  const setAntipodalVizIntensity = useGameStore(s => s.setAntipodalVizIntensity);
  const hollowMode           = useGameStore(s => s.hollowMode);
  const setHollowMode        = useGameStore(s => s.setHollowMode);
  const mirrorMode           = useGameStore(s => s.mirrorMode);
  const setMirrorMode        = useGameStore(s => s.setMirrorMode);

  const modeCard = (title, hint, on, onToggle, accent = '0,0,0') => (
    <div style={{ padding: '18px', borderRadius: '14px', background: 'rgba(0,0,0,0.025)', border: '1px solid rgba(0,0,0,0.07)', marginBottom: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '14px', fontWeight: '600', color: '#0a0a0a', marginBottom: '4px', letterSpacing: '-0.1px' }}>{title}</div>
          <div style={{ fontSize: '12px', color: 'rgba(0,0,0,0.45)', lineHeight: 1.5 }}>{hint}</div>
        </div>
        <Toggle on={on} onChange={onToggle} />
      </div>
    </div>
  );

  return (
    <>
      <p style={S.sectionTitle}>Gameplay Modes</p>

      {modeCard(
        'Hollow Void Cube',
        'Cube with 20 mini-cubes and 7 void tunnels. Tunnel glow reacts to parity and chaos levels.',
        hollowMode,
        () => setHollowMode(!hollowMode),
      )}

      {modeCard(
        'Mirror Blocks',
        'Each piece has a unique size instead of colored stickers. Solve by restoring the perfect rectangular form.',
        mirrorMode,
        () => setMirrorMode(!mirrorMode),
      )}

      {/* Antipodal Mode card — expanded when on */}
      <div style={{ padding: '18px', borderRadius: '14px', background: 'rgba(0,0,0,0.025)', border: '1px solid rgba(0,0,0,0.07)', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#0a0a0a', marginBottom: '4px', letterSpacing: '-0.1px' }}>Antipodal Mode</div>
            <div style={{ fontSize: '12px', color: 'rgba(0,0,0,0.45)', lineHeight: 1.5 }}>
              Rotating one face triggers its antipodal face to rotate in the opposite direction after a brief echo delay.
            </div>
          </div>
          <Toggle on={antipodalMode} onChange={() => setAntipodalMode(!antipodalMode)} />
        </div>

        {antipodalMode && (
          <div style={{ marginTop: '18px', borderTop: '1px solid rgba(0,0,0,0.07)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Echo delay */}
            <div>
              <label style={S.sliderLabel}>Echo Delay — {echoDelay.toFixed(2)}s</label>
              <input
                type="range" min="0.05" max="0.8" step="0.05"
                value={echoDelay}
                onChange={e => setEchoDelay(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: '#0a0a0a' }}
              />
              <div style={S.sliderHints}><span>Fast (0.05s)</span><span>Slow (0.8s)</span></div>
            </div>

            {/* Viz intensity */}
            <div>
              <div style={{ ...S.sliderLabel, marginBottom: '10px' }}>Visual Effects Intensity</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {['low', 'medium', 'high'].map(opt => {
                  const sel = antipodalVizIntensity === opt;
                  return (
                    <button
                      key={opt}
                      onClick={() => setAntipodalVizIntensity(opt)}
                      style={{
                        flex: 1, padding: '8px', borderRadius: '10px',
                        border: sel ? '2px solid #000' : '2px solid transparent',
                        background: sel ? 'rgba(0,0,0,0.05)' : 'rgba(0,0,0,0.03)',
                        fontSize: '12px', fontWeight: sel ? '600' : '400',
                        color: sel ? '#0a0a0a' : 'rgba(0,0,0,0.5)',
                        cursor: 'pointer', fontFamily: 'inherit',
                        textTransform: 'capitalize', letterSpacing: '-0.1px',
                        transition: 'all 0.18s ease',
                      }}
                    >
                      {opt.charAt(0).toUpperCase() + opt.slice(1)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

const TABS = [
  { id: 'colors',  label: 'Colors'  },
  { id: 'tiles',   label: 'Tiles'   },
  { id: 'scene',   label: 'Scene'   },
  { id: 'display', label: 'Display' },
  { id: 'modes',   label: 'Modes'   },
];

const SettingsMenu = ({ onClose, settings, onSettingsChange, faceImages = {}, onFaceImage }) => {
  const [activeTab, setActiveTab] = useState('colors');

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.sheet} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={S.header}>
          <h2 style={S.title}>Settings</h2>
          <button
            style={S.closeBtn}
            onClick={onClose}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.1)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.06)'; }}
          >
            ✕
          </button>
        </div>

        {/* Tab bar */}
        <div style={S.tabBar}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              style={S.tab(activeTab === tab.id)}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={S.divider} />

        {/* Scrollable body */}
        <div style={S.body}>
          <div style={{ paddingBottom: '32px' }}>
            {activeTab === 'colors'  && <ColorsPanel  settings={settings} onSettingsChange={onSettingsChange} faceImages={faceImages} onFaceImage={onFaceImage} />}
            {activeTab === 'tiles'   && <TilesPanel   settings={settings} onSettingsChange={onSettingsChange} />}
            {activeTab === 'scene'   && <ScenePanel   settings={settings} onSettingsChange={onSettingsChange} />}
            {activeTab === 'display' && <DisplayPanel settings={settings} onSettingsChange={onSettingsChange} />}
            {activeTab === 'modes'   && <ModesPanel />}
          </div>
        </div>

      </div>
    </div>
  );
};

export default SettingsMenu;
