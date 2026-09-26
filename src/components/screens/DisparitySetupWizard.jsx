import { MODE_THEMES } from '../../utils/modeThemes.js';
import React, { useState, useMemo } from 'react';
import { useGameStore } from '../../hooks/useGameStore.js';
import '../../chaos/chaosSetup.css';
import { MAX_CHAOS_SIZE, normalizeChaosSize } from '../../utils/chaosSetup.js';
import { SIZE_TIERS } from './wizardSteps/shared.jsx';
import { useIsMobile } from '../../hooks/index.js';
import { wizardLayout, WizardShell, WIZ_BORDER_SOFT, WIZ_TEXT, WIZ_TEXT_MUTED } from './WizardChrome.jsx';
import {
  useWizardCosmetics, WizardImageInput,
  SceneStep, PaletteStep, SizeStep, styleCategory,
  cardStyle, sceneLabel, paletteLabel, sizeLabel
} from './wizardSteps/index.jsx';

const ACCENT = MODE_THEMES.chaos.accent;
const ACCENT_SHADOW = MODE_THEMES.chaos.shadow;
const CHAOS_SIZE_TIERS = SIZE_TIERS.filter(tier => tier.n <= MAX_CHAOS_SIZE);

const LEVEL_LABELS = { 1: 'Low', 2: 'Medium', 3: 'High', 4: 'Extreme', 5: 'Maximum' };

const FLIP_CAP_PRESETS = [3, 8, 13, 20].map(value => ({ value, label: `${value} flips` }));

const GAME_LENGTH_OPTIONS = [
  { value: 'short', label: 'Short', sub: '10 shuffles' },
  { value: 'medium', label: 'Medium', sub: '20 shuffles' },
  { value: 'long', label: 'Long', sub: '30 shuffles' }
];

const ToggleRow = ({ label, sub, value, onChange }) => (
  <button
    type="button"
    aria-pressed={value}
    className="chaos-gameplay-toggle"
    onClick={() => onChange(!value)}
    style={{
      ...cardStyle(value, ACCENT),
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '12px',
      padding: '12px 14px',
      textAlign: 'left'
    }}
  >
    <div>
      <div style={{ fontSize: '14px', fontWeight: 600, color: WIZ_TEXT }}>{label}</div>
      {sub && <div style={{ fontSize: '12px', color: WIZ_TEXT_MUTED, marginTop: '1px' }}>{sub}</div>}
    </div>
    <div style={{
      width: '44px', height: '26px', borderRadius: '14px',
      background: value ? ACCENT : WIZ_BORDER_SOFT, position: 'relative',
      transition: 'background 0.2s ease', flexShrink: 0,
      boxShadow: value ? `0 2px 0 ${ACCENT_SHADOW}` : '0 2px 0 #b8b2aa'
    }}>
      <div style={{
        position: 'absolute', top: '3px', left: value ? '21px' : '3px',
        width: '20px', height: '20px', borderRadius: '50%', background: '#fff',
        transition: 'left 0.2s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.20)'
      }} />
    </div>
  </button>
);

const DisparitySetupWizard = ({ onStart, onCancel, initialSettings }) => {
  const currentSettings = useGameStore(s => s.settings);
  const currentSize = useGameStore(s => s.size);
  const [step, setStep] = useState(0);
  const isMobile = useIsMobile();
  const S = useMemo(() => wizardLayout(ACCENT, ACCENT_SHADOW, isMobile), [isMobile]);
  const cos = useWizardCosmetics({
    initialSettings: { ...currentSettings, ...initialSettings, size: normalizeChaosSize(initialSettings?.cubeSize ?? currentSize) },
    accent: ACCENT,
    accentShadow: ACCENT_SHADOW,
    extra: {
      disparityLevel: 3,
      flipCap: 8,
      visualMode: 'classic',
      flipMode: true,
      showTunnels: false,
      gameLength: 'medium',
      ...initialSettings
    }
  });
  const { settings, select } = cos;

  const optionGroup = (label, key, options) => (
    <fieldset className="chaos-gameplay-group">
      <legend>{label}</legend>
      <div className="chaos-gameplay-options" data-kind={key}>
        {options.map(option => <button key={option.value} type="button"
          aria-pressed={settings[key] === option.value}
          onClick={() => select(key, option.value)}
          style={cardStyle(settings[key] === option.value, ACCENT)}>
          <strong>{option.label}</strong>{option.sub && <small>{option.sub}</small>}
          <span className="chaos-gameplay-check" aria-hidden="true">{settings[key] === option.value ? '✓' : '+'}</span>
        </button>)}
      </div>
    </fieldset>
  );

  const renderGameplay = () => (
    <div className="chaos-gameplay">
      {optionGroup('Intensity', 'disparityLevel', [1, 2, 3, 4, 5].map(value => ({ value,
        label: LEVEL_LABELS[value], sub: `${value} / 5` })))}
      {optionGroup('Flips before a tile is spent', 'flipCap', FLIP_CAP_PRESETS)}
      {optionGroup('Game length', 'gameLength', GAME_LENGTH_OPTIONS)}
      <div className="chaos-gameplay-toggles">
        <ToggleRow label="Flip" sub="Let yourself tap tiles to flip them with their twins" value={settings.flipMode} onChange={v => select('flipMode', v)} />
        <ToggleRow label="Tunnels" sub="Draw a tunnel from each tile to its twin" value={settings.showTunnels} onChange={v => select('showTunnels', v)} />
      </div>
    </div>
  );

  const categories = [
    {
      key: 'scene',
      icon: 'scene',
      label: 'Scene',
      title: 'Background',
      subtitle: '',
      summary: sceneLabel(settings),
      hero: <SceneStep cos={cos} slot="hero" />,
      content: <SceneStep cos={cos} slot="body" />
    },
    {
      key: 'colors',
      icon: 'colors',
      label: 'Colors',
      title: "Colors",
      subtitle: '',
      summary: paletteLabel(settings),
      hero: <PaletteStep cos={cos} slot="hero" />,
      content: <PaletteStep cos={cos} slot="body" />
    },
    styleCategory(cos),
    {
      key: 'gameplay',
      icon: 'gameplay',
      label: 'Gameplay',
      title: 'Gameplay',
      subtitle: '',
      // The two settings that decide how long the cube lasts, which is what a
      // player checks this category for.
      summary: `${LEVEL_LABELS[settings.disparityLevel]} · ${FLIP_CAP_PRESETS.find(p => p.value === settings.flipCap)?.label || 'Custom'}`,
      content: renderGameplay()
    },
    {
      key: 'size',
      icon: 'size',
      label: 'Size',
      title: "Cube size",
      subtitle: '',
      summary: sizeLabel(cos.cubeSize),
      hero: <SizeStep cos={cos} tiers={CHAOS_SIZE_TIERS} slot="hero" />,
      content: <SizeStep cos={cos} tiers={CHAOS_SIZE_TIERS} slot="body" />
    }
  ];


  const handleNext = () => {
    if (step < categories.length - 1) setStep(step + 1);
    else onStart({ ...settings, cubeSize: cos.cubeSize });
  };
  const handleBack = () => (step > 0 ? setStep(step - 1) : onCancel());

  return (
    <WizardShell
      styles={S}
      mode="CHAOS MODE"
      accent={ACCENT}
      categories={categories}
      active={step}
      onSelect={setStep}
      onBack={handleBack}
      onPrimary={handleNext}
      finishLabel="Make your prediction"
      mobile={isMobile}
    >
      <WizardImageInput cos={cos} />
    </WizardShell>
  );
};

export default DisparitySetupWizard;
