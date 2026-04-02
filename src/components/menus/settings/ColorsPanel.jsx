import React, { useRef, useState } from 'react';
import { COLOR_SCHEMES, SCHEME_LABELS } from '../../../utils/colorSchemes.js';
import { useGameStore } from '../../../hooks/useGameStore.js';

const FACE_LABELS = { 1: 'Front', 2: 'Left', 3: 'Top', 4: 'Back', 5: 'Right', 6: 'Bottom' };

// Extract N dominant colors from an image using pixel sampling + k-means
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

export function ColorsPanel({ settings, onSettingsChange, faceImages, onFaceImage }) {
  const fileInputRef = useRef(null);
  const faceFileRefs = useRef({});
  const [preview, setPreview] = useState(null);
  const ownedItems = useGameStore(s => s.ownedItems);

  const schemeOwned = (key) => key === 'custom' || ownedItems.includes(`scheme_${key}`);

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
        <div className="settings-radio-group scheme-grid">
          {Object.keys(SCHEME_LABELS).map(key => {
            const owned = schemeOwned(key);
            const active = settings.colorScheme === key;
            return (
              <label key={key}
                className={`settings-radio${active ? ' active' : ''}${!owned ? ' locked' : ''}`}
                style={!owned ? { opacity: 0.42, cursor: 'not-allowed', pointerEvents: 'none' } : {}}
                title={!owned ? `Locked — buy in Parity Store` : undefined}
              >
                <input type="radio" name="colorScheme" value={key}
                  checked={active}
                  disabled={!owned}
                  onChange={() => owned && update('colorScheme', key)} />
                <span className="scheme-info">
                  <span className="settings-radio-label">
                    {SCHEME_LABELS[key]}{!owned ? ' 🔒' : ''}
                  </span>
                  {key !== 'custom' && COLOR_SCHEMES[key] && (
                    <span className="scheme-preview">
                      {Object.values(COLOR_SCHEMES[key]).map((c, i) => (
                        <span key={i} className="scheme-dot" style={{ background: owned ? c : '#555' }} />
                      ))}
                    </span>
                  )}
                </span>
              </label>
            );
          })}
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
