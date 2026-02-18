import React, { useState, useRef } from 'react';
import { COLOR_SCHEMES, TILE_STYLES } from '../../utils/colorSchemes.js';
import { BACKGROUNDS, getBackgroundUrl } from '../../utils/backgrounds.js';
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
  // New backgrounds fallback gradients
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

  const allTileStyles = [...CLASSIC_STYLE_KEYS, ...LIVING_STYLE_KEYS];

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
      options: [
        {
          value: 'random',
          label: 'Random Mix',
          preview: (
            <div className="wizard-random-tile-preview">
              <span style={{ fontSize: '28px' }}>🎲</span>
            </div>
          ),
        },
        ...allTileStyles.map(key => ({
          value: key,
          label: TILE_STYLES[key]?.label || key,
          preview: <TilePreviewCanvas styleKey={key} size={56} />,
        })),
      ],
    },
    {
      title: 'Choose Your Background',
      subtitle: 'Scroll to explore all scenes',
      key: 'backgroundTheme',
      options: BG_OPTIONS.map(opt => ({
        value: opt.value,
        label: opt.label,
        preview: opt.thumbnail ? (
          <img
            src={opt.thumbnail}
            alt={opt.label}
            className="wizard-bg-thumb"
            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }}
          />
        ) : (
          <div className="wizard-bg-preview" style={{ background: opt.gradient }} />
        ),
      })),
    },
  ];

  const currentStep = steps[step];

  const optionsRef = useRef(null);

  const scrollMap = (direction) => {
    if (optionsRef.current) {
      const scrollAmount = 300;
      optionsRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

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
          {currentStep.key === 'backgroundTheme' && (
            <button className="wizard-scroll-btn left" onClick={() => scrollMap('left')}>‹</button>
          )}

          <div className="wizard-options" ref={optionsRef}>
            {currentStep.options.map((option) => (
              <button
                key={option.value}
                className={`wizard-option${settings[currentStep.key] === option.value ? ' selected' : ''} ${currentStep.key === 'backgroundTheme' ? 'compact' : ''}`}
                onClick={() => handleSelect(option.value, option)}
              >
                {option.preview && <div className="wizard-option-preview">{option.preview}</div>}
                <div className="wizard-option-label">{option.label}</div>
              </button>
            ))}
          </div>

          {currentStep.key === 'backgroundTheme' && (
            <button className="wizard-scroll-btn right" onClick={() => scrollMap('right')}>›</button>
          )}
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
