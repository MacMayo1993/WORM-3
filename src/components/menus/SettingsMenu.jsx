import React, { useRef, useState, useEffect } from 'react';
import { COLOR_SCHEMES, TILE_STYLES } from '../../utils/colorSchemes.js';
import {
  registerTilePreview,
  updateTilePreview,
  unregisterTilePreview,
} from '../../3d/TilePreviewRenderer.js';
import { useGameStore } from '../../hooks/useGameStore.js';

const FACE_LABELS = { 1: 'Front', 2: 'Left', 3: 'Top', 4: 'Back', 5: 'Right', 6: 'Bottom' };

const SCHEME_LABELS = {
  standard: 'Standard',
  neon: 'Neon',
  pastel: 'Pastel',
  mono: 'Mono',
  custom: 'Custom',
};

const BG_OPTIONS = [
  { value: 'blackhole', label: 'Black Hole' },
  { value: 'cave', label: 'Cave' },
  { value: 'beach', label: 'Beach' },
  // 7 Wonders removed as per user request
  { value: 'forest', label: 'Forest' },
  { value: 'park', label: 'Park' },
  { value: 'night', label: 'Night Sky' },
  { value: 'city', label: 'City Skyline' },
  { value: 'apartment', label: 'Apartment' },
  { value: 'lobby', label: 'Modern Lobby' },
  { value: 'warehouse', label: 'Warehouse' },
  { value: 'studio', label: 'Photo Studio' },
  { value: 'dark', label: 'Dark' },
  { value: 'midnight', label: 'Midnight Blue' },
];

// Styles shown in the Classic (2D) section
const CLASSIC_STYLE_KEYS = ['solid', 'glossy', 'matte', 'metallic', 'carbonFiber', 'hexGrid', 'comic', 'cafeWall', 'hermanGrid', 'opticSpin', 'ouchi'];
// Styles shown in the Living (3D / animated) section
const LIVING_STYLE_KEYS = ['grass', 'ice', 'sand', 'water', 'wood', 'circuit', 'holographic', 'pulse', 'lava', 'galaxy', 'neural'];

// Extract N dominant colors from an ima ge using pixel sampling + k-means
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
        const dr = px[0] - centroids[c][0];
        const dg = px[1] - centroids[c][1];
        const db = px[2] - centroids[c][2];
        if (dr * dr + dg * dg + db * db < minDist) { minDist = dr * dr + dg * dg + db * db; best = c; }
      }
      clusters[best].push(px);
    }
    for (let c = 0; c < count; c++) {
      if (!clusters[c].length) continue;
      const sum = [0, 0, 0];
      for (const px of clusters[c]) { sum[0] += px[0]; sum[1] += px[1]; sum[2] += px[2]; }
      centroids[c] = [
        Math.round(sum[0] / clusters[c].length),
        Math.round(sum[1] / clusters[c].length),
        Math.round(sum[2] / clusters[c].length),
      ];
    }
  }
  centroids.sort((a, b) => {
    const hA = Math.atan2(Math.sqrt(3) * (a[1] - a[2]), 2 * a[0] - a[1] - a[2]);
    const hB = Math.atan2(Math.sqrt(3) * (b[1] - b[2]), 2 * b[0] - b[1] - b[2]);
    return hA - hB;
  });
  return centroids.map(([r, g, b]) =>
    '#' + [r, g, b].map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('')
  );
}

// ─── Sub-panels ──────────────────────────────────────────────────────────────

function ColorsPanel({ settings, onSettingsChange, faceImages, onFaceImage }) {
  const fileInputRef = useRef(null);
  const faceFileRefs = useRef({});
  const [preview, setPreview] = useState(null);

  const update = (key, val) => onSettingsChange({ ...settings, [key]: val });

  const updateCustomColor = (faceId, color) => {
    const current = settings.customColors || { ...COLOR_SCHEMES.standard };
    onSettingsChange({
      ...settings,
      colorScheme: 'custom',
      customColors: { ...current, [faceId]: color },
    });
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
      <section className="settings-section">
        <h3 className="settings-section-title">Color Scheme</h3>
        <div className="settings-radio-group">
          {Object.keys(SCHEME_LABELS).map(key => (
            <label key={key} className={`settings-radio${settings.colorScheme === key ? ' active' : ''}`}>
              <input type="radio" name="colorScheme" value={key}
                checked={settings.colorScheme === key}
                onChange={() => update('colorScheme', key)} />
              <span className="settings-radio-label">{SCHEME_LABELS[key]}</span>
              {key !== 'custom' && (
                <span className="scheme-preview">
                  {Object.values(COLOR_SCHEMES[key]).map((c, i) => (
                    <span key={i} className="scheme-dot" style={{ background: c }} />
                  ))}
                </span>
              )}
            </label>
          ))}
        </div>
      </section>

      {/* Custom Colors — only shown when custom scheme is active */}
      {settings.colorScheme === 'custom' && (
        <section className="settings-section">
          <h3 className="settings-section-title">Custom Colors</h3>
          <div className="image-upload-area">
            <input ref={fileInputRef} type="file" accept="image/*"
              onChange={handleImageUpload} style={{ display: 'none' }} />
            <button className="image-upload-btn" onClick={() => fileInputRef.current?.click()}>
              Extract from Image
            </button>
            {preview && (
              <div className="image-preview-row">
                <img src={preview} alt="Source" className="image-preview-thumb" />
                <span className="scheme-preview">
                  {[1, 2, 3, 4, 5, 6].map(i => (
                    <span key={i} className="scheme-dot" style={{ background: resolvedColors[i] }} />
                  ))}
                </span>
              </div>
            )}
          </div>
          <div className="color-picker-grid">
            {[1, 2, 3, 4, 5, 6].map(faceId => (
              <div key={faceId} className="color-picker-item">
                <input type="color" value={resolvedColors[faceId]}
                  onChange={e => updateCustomColor(faceId, e.target.value)}
                  className="color-input" />
                <span className="color-picker-label">{FACE_LABELS[faceId]}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Face Textures */}
      <section className="settings-section">
        <h3 className="settings-section-title">Face Textures</h3>
        <p className="settings-hint">Upload an image to map onto a cube face</p>
        <div className="face-texture-grid">
          {[1, 2, 3, 4, 5, 6].map(faceId => (
            <div key={faceId} className="face-texture-item">
              <input
                ref={el => faceFileRefs.current[faceId] = el}
                type="file" accept="image/*"
                onChange={e => handleFaceImageUpload(faceId, e)}
                style={{ display: 'none' }} />
              {faceImages[faceId] ? (
                <div className="face-texture-preview"
                  onClick={() => faceFileRefs.current[faceId]?.click()}>
                  <img src={faceImages[faceId]} alt={FACE_LABELS[faceId]}
                    className="face-texture-thumb" />
                  <button className="face-texture-remove"
                    onClick={e => { e.stopPropagation(); onFaceImage?.(faceId, null); }}>
                    &times;
                  </button>
                </div>
              ) : (
                <div className="face-texture-upload"
                  style={{ borderColor: resolvedColors[faceId] + '66' }}
                  onClick={() => faceFileRefs.current[faceId]?.click()}>
                  <span className="face-texture-plus">+</span>
                </div>
              )}
              <span className="color-picker-label">{FACE_LABELS[faceId]}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

// ─── Tile preview canvas ──────────────────────────────────────────────────────

/**
 * Renders a live tile-style preview using the shared off-screen WebGL renderer.
 * `colorHex` defaults to a neutral mid-blue so style-card previews look good
 * without needing a specific face color.
 */
function TilePreviewCanvas({ styleKey, colorHex = '#4a7fa5', size = 48, className = '' }) {
  const canvasRef = useRef(null);
  const idRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = size;
    canvas.height = size;
    idRef.current = registerTilePreview(canvas, styleKey, colorHex);
    return () => {
      if (idRef.current !== null) unregisterTilePreview(idRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally mount-only

  useEffect(() => {
    if (idRef.current !== null) updateTilePreview(idRef.current, styleKey, colorHex);
  }, [styleKey, colorHex]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className={`tile-preview-canvas${className ? ` ${className}` : ''}`}
    />
  );
}

function StyleGrid({ keys, label, globalStyle, onApply }) {
  return (
    <section className="settings-section">
      <h3 className="settings-section-title">{label}</h3>
      <div className="style-card-grid">
        {keys.map(key => {
          const style = TILE_STYLES[key];
          if (!style) return null;
          return (
            <button
              key={key}
              className={`style-card${globalStyle === key ? ' selected' : ''}`}
              onClick={() => onApply(key)}
              title={`Apply ${style.label} to all faces`}
            >
              <TilePreviewCanvas styleKey={key} size={56} className="style-card-preview" />
              <span className="style-card-label">{style.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function TilesPanel({ settings, onSettingsChange }) {
  const resolvedColors = settings.colorScheme === 'custom' && settings.customColors
    ? { ...COLOR_SCHEMES.standard, ...settings.customColors }
    : COLOR_SCHEMES[settings.colorScheme] || COLOR_SCHEMES.standard;

  const currentStyles = settings.manifoldStyles || {};

  // If all 6 faces share the same style, highlight it in the grid
  const faceValues = [1, 2, 3, 4, 5, 6].map(id => currentStyles[id] || 'solid');
  const allSame = faceValues.every(v => v === faceValues[0]);
  const globalStyle = allSame ? faceValues[0] : null;

  const applyToAll = (styleKey) => {
    const newStyles = {};
    [1, 2, 3, 4, 5, 6].forEach(id => { newStyles[id] = styleKey; });
    onSettingsChange({ ...settings, manifoldStyles: newStyles });
  };

  const applyToFace = (faceId, styleKey) => {
    onSettingsChange({
      ...settings,
      manifoldStyles: { ...currentStyles, [faceId]: styleKey },
    });
  };

  // Pick 6 unique styles (no repeats) from the full pool and assign one per face
  const randomizeStyles = () => {
    const pool = [...CLASSIC_STYLE_KEYS, ...LIVING_STYLE_KEYS];
    // Fisher-Yates shuffle then take first 6
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const newStyles = {};
    [1, 2, 3, 4, 5, 6].forEach((id, i) => { newStyles[id] = pool[i]; });
    onSettingsChange({ ...settings, manifoldStyles: newStyles });
  };

  return (
    <>
      <StyleGrid keys={CLASSIC_STYLE_KEYS} label="Classic" globalStyle={globalStyle} onApply={applyToAll} />
      <StyleGrid keys={LIVING_STYLE_KEYS} label="Living" globalStyle={globalStyle} onApply={applyToAll} />

      {/* Randomize — assigns a unique style to each of the 6 faces */}
      <section className="settings-section">
        <button className="style-card style-card--random" onClick={randomizeStyles}
          title="Assign a different random style to each face (no repeats)">
          <span className="style-card-label">Random Mix</span>
        </button>
      </section>

      {/* Per-face overrides */}
      <section className="settings-section">
        <h3 className="settings-section-title">Per Face</h3>
        <div className="per-face-grid">
          {[1, 2, 3, 4, 5, 6].map(faceId => {
            const faceStyle = currentStyles[faceId] || 'solid';
            const faceColor = resolvedColors[faceId];
            return (
              <div key={faceId} className="per-face-item">
                {/* Tile preview thumbnail for the active style + face color */}
                <div className="per-face-preview-wrap" style={{ borderColor: faceColor + '88' }}>
                  <TilePreviewCanvas
                    styleKey={faceStyle}
                    colorHex={faceColor}
                    size={36}
                    className="per-face-preview"
                  />
                </div>
                <select
                  className="per-face-select"
                  value={faceStyle}
                  onChange={e => applyToFace(faceId, e.target.value)}
                >
                  <optgroup label="Classic">
                    {CLASSIC_STYLE_KEYS.map(k => (
                      <option key={k} value={k}>{TILE_STYLES[k]?.label}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Living">
                    {LIVING_STYLE_KEYS.map(k => (
                      <option key={k} value={k}>{TILE_STYLES[k]?.label}</option>
                    ))}
                  </optgroup>
                </select>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}

function ScenePanel({ settings, onSettingsChange }) {
  const update = (key, val) => onSettingsChange({ ...settings, [key]: val });
  return (
    <section className="settings-section">
      <h3 className="settings-section-title">Background</h3>
      <div className="settings-radio-group">
        {BG_OPTIONS.map(opt => (
          <label key={opt.value}
            className={`settings-radio${settings.backgroundTheme === opt.value ? ' active' : ''}`}>
            <input type="radio" name="backgroundTheme" value={opt.value}
              checked={settings.backgroundTheme === opt.value}
              onChange={() => update('backgroundTheme', opt.value)} />
            <span className="settings-radio-label">{opt.label}</span>
          </label>
        ))}
      </div>
    </section>
  );
}

function DisplayPanel({ settings, onSettingsChange }) {
  const update = (key, val) => onSettingsChange({ ...settings, [key]: val });
  return (
    <section className="settings-section">
      <h3 className="settings-section-title">UI Layout</h3>
      <div className="settings-toggles">
        {[
          { key: 'showStats', label: 'Stats Bar' },
          { key: 'showManifoldFooter', label: 'Manifold Footer' },
          { key: 'showFaceProgress', label: 'Face Progress Bars' },
        ].map(item => (
          <label key={item.key} className="settings-toggle-row">
            <span className="toggle-label">{item.label}</span>
            <div className={`toggle-switch${settings[item.key] ? ' on' : ''}`}
              onClick={() => update(item.key, !settings[item.key])}>
              <div className="toggle-knob" />
            </div>
          </label>
        ))}
      </div>
    </section>
  );
}

function ModesPanel() {
  // Access game store directly for mode settings
  const antipodalMode = useGameStore((state) => state.antipodalMode);
  const echoDelay = useGameStore((state) => state.echoDelay);
  const antipodalVizIntensity = useGameStore((state) => state.antipodalVizIntensity);
  const setAntipodalMode = useGameStore((state) => state.setAntipodalMode);
  const setEchoDelay = useGameStore((state) => state.setEchoDelay);
  const setAntipodalVizIntensity = useGameStore((state) => state.setAntipodalVizIntensity);

  const hollowMode = useGameStore((state) => state.hollowMode);
  const setHollowMode = useGameStore((state) => state.setHollowMode);

  const mirrorMode = useGameStore((state) => state.mirrorMode);
  const setMirrorMode = useGameStore((state) => state.setMirrorMode);

  return (
    <>
      {/* Hollow Void Cube Mode */}
      <section className="settings-section">
        <h3 className="settings-section-title">Hollow Void Cube Mode</h3>
        <p style={{
          fontSize: '13px',
          color: 'rgba(255, 255, 255, 0.6)',
          marginBottom: '16px',
          lineHeight: '1.5'
        }}>
          Hollow cube with 20 mini-cubes and 7 void tunnels. Tunnel glow reacts to parity and chaos levels.
        </p>

        <div className="settings-toggles">
          <label className="settings-toggle-row">
            <span className="toggle-label">Enable Hollow Mode</span>
            <div className={`toggle-switch${hollowMode ? ' on' : ''}`}
              onClick={() => setHollowMode(!hollowMode)}>
              <div className="toggle-knob" />
            </div>
          </label>
        </div>
      </section>

      {/* Mirror Blocks Mode */}
      <section className="settings-section">
        <h3 className="settings-section-title">Mirror Blocks Mode</h3>
        <p style={{
          fontSize: '13px',
          color: 'rgba(255, 255, 255, 0.6)',
          marginBottom: '16px',
          lineHeight: '1.5'
        }}>
          Each piece has a unique size instead of colored stickers. Solve the puzzle by restoring the cube to its perfect rectangular form.
        </p>

        <div className="settings-toggles">
          <label className="settings-toggle-row">
            <span className="toggle-label">Enable Mirror Mode</span>
            <div className={`toggle-switch${mirrorMode ? ' on' : ''}`}
              onClick={() => setMirrorMode(!mirrorMode)}>
              <div className="toggle-knob" />
            </div>
          </label>
        </div>
      </section>

      {/* Antipodal Mode */}
      <section className="settings-section">
        <h3 className="settings-section-title">Antipodal Mode - "Mirror Quotient"</h3>
        <p style={{
          fontSize: '13px',
          color: 'rgba(255, 255, 255, 0.6)',
          marginBottom: '16px',
          lineHeight: '1.5'
        }}>
          Enhanced RP² dynamics: rotating one face triggers its antipodal face to rotate in the OPPOSITE direction after a brief echo delay.
        </p>

        <div className="settings-toggles">
          {/* Enable/Disable Toggle */}
          <label className="settings-toggle-row">
            <span className="toggle-label">Enable Antipodal Mode</span>
            <div className={`toggle-switch${antipodalMode ? ' on' : ''}`}
              onClick={() => setAntipodalMode(!antipodalMode)}>
              <div className="toggle-knob" />
            </div>
          </label>

          {/* Echo Delay Slider */}
          {antipodalMode && (
            <>
              <div style={{ marginTop: '16px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '13px',
                  color: 'rgba(255, 255, 255, 0.8)',
                  marginBottom: '8px'
                }}>
                  Echo Delay: {echoDelay.toFixed(2)}s
                </label>
                <input
                  type="range"
                  min="0.05"
                  max="0.8"
                  step="0.05"
                  value={echoDelay}
                  onChange={(e) => setEchoDelay(parseFloat(e.target.value))}
                  style={{
                    width: '100%',
                    accentColor: '#3b82f6'
                  }}
                />
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '11px',
                  color: 'rgba(255, 255, 255, 0.5)',
                  marginTop: '4px'
                }}>
                  <span>Fast (0.05s)</span>
                  <span>Slow (0.8s)</span>
                </div>
              </div>

              {/* Visualization Intensity */}
              <div style={{ marginTop: '16px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '13px',
                  color: 'rgba(255, 255, 255, 0.8)',
                  marginBottom: '8px'
                }}>
                  Visual Effects Intensity
                </label>
                <div className="settings-radio-group">
                  {[
                    { value: 'low', label: 'Low' },
                    { value: 'medium', label: 'Medium' },
                    { value: 'high', label: 'High' }
                  ].map(opt => (
                    <label key={opt.value}
                      className={`settings-radio${antipodalVizIntensity === opt.value ? ' active' : ''}`}>
                      <input type="radio" name="antipodalVizIntensity" value={opt.value}
                        checked={antipodalVizIntensity === opt.value}
                        onChange={() => setAntipodalVizIntensity(opt.value)} />
                      <span className="settings-radio-label">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </section>
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const TABS = [
  { id: 'colors', label: 'Colors' },
  { id: 'tiles', label: 'Tiles' },
  { id: 'scene', label: 'Scene' },
  { id: 'display', label: 'Display' },
  { id: 'modes', label: 'Modes' },
];

const SettingsMenu = ({ onClose, settings, onSettingsChange, faceImages = {}, onFaceImage }) => {
  const [activeTab, setActiveTab] = useState('colors');

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="settings-header">
          <h2 className="settings-title">Settings</h2>
          <button className="settings-close-btn" onClick={onClose}>&times;</button>
        </div>

        {/* Tab bar */}
        <div className="settings-tabs">
          {TABS.map(tab => (
            <button
              key={tab.id}
              className={`settings-tab${activeTab === tab.id ? ' active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Active panel */}
        <div className="settings-body">
          {activeTab === 'colors' && (
            <ColorsPanel
              settings={settings}
              onSettingsChange={onSettingsChange}
              faceImages={faceImages}
              onFaceImage={onFaceImage}
            />
          )}
          {activeTab === 'tiles' && (
            <TilesPanel settings={settings} onSettingsChange={onSettingsChange} />
          )}
          {activeTab === 'scene' && (
            <ScenePanel settings={settings} onSettingsChange={onSettingsChange} />
          )}
          {activeTab === 'display' && (
            <DisplayPanel settings={settings} onSettingsChange={onSettingsChange} />
          )}
          {activeTab === 'modes' && (
            <ModesPanel />
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsMenu;
