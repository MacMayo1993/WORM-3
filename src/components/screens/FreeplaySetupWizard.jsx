import React, { useState, useRef } from 'react';
import { COLOR_SCHEMES, TILE_STYLES } from '../../utils/colorSchemes.js';
import { registerTilePreview, updateTilePreview, unregisterTilePreview } from '../../3d/TilePreviewRenderer.js';

const SCHEME_LABELS = {
  standard: 'Standard',
  neon: 'Neon',
  pastel: 'Pastel',
  mono: 'Mono',
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
    tileStyle: initialSettings?.tileStyle || 'solid',
    backgroundTheme: initialSettings?.backgroundTheme || 'blackhole',
  });

  const steps = [
    {
      title: 'Choose Your Colors',
      subtitle: 'Pick a color scheme for your cube',
      key: 'colorScheme',
      options: Object.keys(SCHEME_LABELS).map(key => ({
        value: key,
        label: SCHEME_LABELS[key],
        preview: (
          <div className="wizard-color-preview">
            {Object.values(COLOR_SCHEMES[key]).map((c, i) => (
              <div key={i} className="wizard-color-dot" style={{ background: c }} />
            ))}
          </div>
        ),
      })),
    },
    {
      title: 'Choose Your Tile Style',
      subtitle: 'Select how your cube faces should look',
      key: 'tileStyle',
      options: [...CLASSIC_STYLE_KEYS.slice(0, 5), ...LIVING_STYLE_KEYS.slice(0, 5)].map(key => ({
        value: key,
        label: TILE_STYLES[key]?.label || key,
        preview: <TilePreviewCanvas styleKey={key} size={64} />,
      })),
    },
    {
      title: 'Choose Your Background',
      subtitle: 'Pick the scene where you want to play',
      key: 'backgroundTheme',
      options: BG_OPTIONS.slice(0, 8).map(opt => ({
        value: opt.value,
        label: opt.label,
      })),
    },
  ];

  const currentStep = steps[step];

  const handleSelect = (value) => {
    setSettings({ ...settings, [currentStep.key]: value });
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
                onClick={() => handleSelect(option.value)}
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
