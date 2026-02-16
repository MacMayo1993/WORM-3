import React, { useState, useRef } from 'react';
import { COLOR_SCHEMES, TILE_STYLES } from '../../utils/colorSchemes.js';
import { registerTilePreview, updateTilePreview, unregisterTilePreview } from '../../3d/TilePreviewRenderer.js';

const SCHEME_LABELS = {
  standard: 'Standard',
  neon: 'Neon Glow',
  pastel: 'Pastel',
  mono: 'Monochrome',
  spiderman: 'Spiderman',
  ocean: 'Ocean Depths',
  sunset: 'Sunset',
  forest: 'Forest',
  candy: 'Candy Pop',
  retro: 'Retro',
  custom: 'Custom Upload',
};

const BG_OPTIONS = [
  { value: 'blackhole', label: 'Black Hole' },
  { value: 'cave', label: 'Cave' },
  { value: 'beach', label: 'Beach' },
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

const CLASSIC_STYLE_KEYS = ['solid', 'glossy', 'matte', 'metallic', 'carbonFiber', 'hexGrid', 'comic', 'cafeWall', 'hermanGrid', 'opticSpin', 'ouchi'];
const LIVING_STYLE_KEYS = ['grass', 'ice', 'sand', 'water', 'wood', 'circuit', 'holographic', 'pulse', 'lava', 'galaxy', 'neural'];

// Extract colors from uploaded image
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

function TilePreviewCanvas({ styleKey, colorHex = '#4a7fa5', size = 48, className = '' }) {
  const canvasRef = useRef(null);
  const idRef = useRef(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = size;
    canvas.height = size;
    idRef.current = registerTilePreview(canvas, styleKey, colorHex);
    return () => {
      if (idRef.current !== null) unregisterTilePreview(idRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
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

const FreeplaySetupWizard = ({ onComplete, onCancel, initialSettings }) => {
  const [step, setStep] = useState(0);
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
      setSettings({
        ...settings,
        colorScheme: 'custom',
        customColors
      });
    };
    img.src = url;
  };

  const colorOptions = Object.keys(SCHEME_LABELS).map(key => {
    if (key === 'custom') {
      return {
        value: key,
        label: SCHEME_LABELS[key],
        isCustom: true,
        preview: customPreview ? (
          <img src={customPreview} alt="Custom" style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '8px' }} />
        ) : (
          <div className="wizard-upload-placeholder">
            <span style={{ fontSize: '32px' }}>📷</span>
          </div>
        ),
      };
    }
    return {
      value: key,
      label: SCHEME_LABELS[key],
      preview: (
        <div className="wizard-color-preview">
          {Object.values(COLOR_SCHEMES[key]).map((c, i) => (
            <div key={i} className="wizard-color-dot" style={{ background: c }} />
          ))}
        </div>
      ),
    };
  });

  const steps = [
    {
      title: 'Choose Your Colors',
      subtitle: 'Pick a color scheme or upload an image',
      key: 'colorScheme',
      options: colorOptions,
    },
    {
      title: 'Choose Your Tile Style',
      subtitle: 'Select how your cube faces should look',
      key: 'tileStyle',
      options: [...CLASSIC_STYLE_KEYS, ...LIVING_STYLE_KEYS].map(key => ({
        value: key,
        label: TILE_STYLES[key]?.label || key,
        preview: <TilePreviewCanvas styleKey={key} size={56} />,
      })),
    },
    {
      title: 'Choose Your Background',
      subtitle: 'Pick the scene where you want to play',
      key: 'backgroundTheme',
      options: BG_OPTIONS.map(opt => ({
        value: opt.value,
        label: opt.label,
      })),
    },
  ];

  const currentStep = steps[step];

  const handleSelect = (value, option) => {
    if (option?.isCustom) {
      fileInputRef.current?.click();
    } else {
      setSettings({ ...settings, [currentStep.key]: value });
    }
  };

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      onComplete(settings);
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
    } else {
      onCancel();
    }
  };

  return (
    <div className="wizard-overlay">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        style={{ display: 'none' }}
      />
      <div className="wizard-container">
        {/* Header */}
        <div className="wizard-header">
          <div className="wizard-progress">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`wizard-progress-dot${i <= step ? ' active' : ''}${i === step ? ' current' : ''}`}
              />
            ))}
          </div>
          <h2 className="wizard-title">{currentStep.title}</h2>
          <p className="wizard-subtitle">{currentStep.subtitle}</p>
        </div>

        {/* Options */}
        <div className="wizard-body">
          <div className="wizard-options">
            {currentStep.options.map((option) => (
              <button
                key={option.value}
                className={`wizard-option${settings[currentStep.key] === option.value ? ' selected' : ''}`}
                onClick={() => handleSelect(option.value, option)}
              >
                {option.preview && <div className="wizard-option-preview">{option.preview}</div>}
                <div className="wizard-option-label">{option.label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="wizard-footer">
          <button className="wizard-btn wizard-btn-secondary" onClick={handleBack}>
            {step === 0 ? 'Cancel' : 'Back'}
          </button>
          <button className="wizard-btn wizard-btn-primary" onClick={handleNext}>
            {step === steps.length - 1 ? 'Start Playing!' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FreeplaySetupWizard;
