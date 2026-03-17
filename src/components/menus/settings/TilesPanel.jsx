import React, { useRef, useEffect } from 'react';
import { COLOR_SCHEMES, TILE_STYLES } from '../../../utils/colorSchemes.js';
import { CLASSIC_STYLE_KEYS, ANTIPODAL_STYLE_KEYS, LIVING_STYLE_KEYS } from '../../../utils/tileStyleCatalog.js';
import {
  registerTilePreview,
  updateTilePreview,
  unregisterTilePreview,
} from '../../../3d/TilePreviewRenderer.js';

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

export function TilesPanel({ settings, onSettingsChange }) {
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
    const pool = [...CLASSIC_STYLE_KEYS, ...ANTIPODAL_STYLE_KEYS, ...LIVING_STYLE_KEYS];
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
      <StyleGrid keys={ANTIPODAL_STYLE_KEYS} label="Antipodal Op Art" globalStyle={globalStyle} onApply={applyToAll} />
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
                  <optgroup label="Antipodal Op Art">
                    {ANTIPODAL_STYLE_KEYS.map(k => (
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
