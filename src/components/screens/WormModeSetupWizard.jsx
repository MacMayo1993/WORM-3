import { MODE_THEMES } from '../../utils/modeThemes.js';
import React, { useState, useMemo } from 'react';
import { useGameStore } from '../../hooks/useGameStore.js';
import { useIsMobile } from '../../hooks/index.js';
import { WORM_SKINS } from '../../worm/wormCosmeticsData.js';
import { WORM_CHARACTERS } from '../../worm/wormCharacterData.js';
import { wizardLayout, WizardShell, WIZ_BORDER_SOFT, WIZ_SURFACE_RAISED, WIZ_TEXT } from './WizardChrome.jsx';
import WormProfile from './WormProfile.jsx';
import { wormMenuFeedback } from './wormMenuFeedback.js';
import { WORM_DIFFICULTIES } from '../../worm/wormDifficulty.js';
import {
  useWizardCosmetics, WizardImageInput,
  SceneStep, PaletteStep, SizeStep, styleCategory,
  SIZE_TIERS,
  sceneLabel, paletteLabel, sizeLabel
} from './wizardSteps/index.jsx';

const ACCENT = MODE_THEMES.worm.accent;
const ACCENT_SHADOW = MODE_THEMES.worm.shadow;
const MEGA_CUBE_SIZE = 15;
const WORM_SIZE_TIERS = [
  ...SIZE_TIERS,
  { n: MEGA_CUBE_SIZE, name: '15×15×15' }
];

const WormModeSetupWizard = ({ onComplete, onCancel, initialSettings }) => {
  const [step, setStep] = useState(0);
  const isMobile = useIsMobile();
  const S = useMemo(() => wizardLayout(ACCENT, ACCENT_SHADOW, isMobile), [isMobile]);
  const cos = useWizardCosmetics({
    initialSettings,
    accent: ACCENT,
    accentShadow: ACCENT_SHADOW,
    extra: {
      ...WORM_DIFFICULTIES[1].settings,
      wormColor: '#33ff66', wormCombatMode: false,
      wormEnemiesEnabled: initialSettings?.wormEnemiesEnabled !== false
    }
  });
  const { settings } = cos;
  const difficulty = WORM_DIFFICULTIES.find(option => option.settings.wormSpeed === settings.wormSpeed) || WORM_DIFFICULTIES[1];

  const wormSkinId = useGameStore(s => s.wormSkin ?? 'slime');
  const wormCharacterId = useGameStore(s => s.wormCharacter ?? 'classic');

  const activeSkin = WORM_SKINS.find(s => s.id === wormSkinId) ?? WORM_SKINS[0];
  const activeCharacter = WORM_CHARACTERS.find(c => c.id === wormCharacterId) ?? WORM_CHARACTERS[0];

  const renderPlay = () => (
    <div style={{ display: 'grid', gap: 18 }}>
      <label style={{ display: 'flex', gap: 12, alignItems: 'center', minHeight: 48, color: WIZ_TEXT, cursor: 'pointer' }}>
        <input type="checkbox" checked={!!settings.wormCombatMode} onChange={e => cos.setSettings(current => ({ ...current, wormCombatMode: e.target.checked }))} style={{ width: 22, height: 22, flexShrink: 0 }} />
        <span><strong>Portal Combat · Preview</strong><br /><small>3 waves · 5×5 · No Layer Turns</small></span>
      </label>
      {!settings.wormCombatMode && <label style={{ display: 'flex', gap: 12, alignItems: 'center', minHeight: 64, padding: 14, borderRadius: 12, border: `1px solid ${WIZ_BORDER_SOFT}`, background: WIZ_SURFACE_RAISED, color: WIZ_TEXT, cursor: 'pointer' }}>
        <input type="checkbox" role="switch" aria-label="Portal enemies" aria-describedby="worm-enemies-description"
          checked={settings.wormEnemiesEnabled}
          onChange={e => cos.setSettings(current => ({ ...current, wormEnemiesEnabled: e.target.checked }))}
          style={{ width: 24, height: 24, flexShrink: 0, accentColor: ACCENT }} />
        <span style={{ flex: 1 }}><strong>Enemies</strong><br />
          <small id="worm-enemies-description">{settings.wormEnemiesEnabled
            ? 'Steer to aim. Hold Fire to shoot.'
            : 'No enemies.'}</small>
        </span>
        <strong style={{ color: ACCENT }}>{settings.wormEnemiesEnabled ? 'On' : 'Off'}</strong>
      </label>}
      {!settings.wormCombatMode && <fieldset style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <legend style={{ fontSize: 13, fontWeight: 700, color: WIZ_TEXT, marginBottom: 10 }}>Cube Size</legend>
        <SizeStep cos={cos} tiers={WORM_SIZE_TIERS} slot="body" compact />
      </fieldset>}
      {!settings.wormCombatMode && <fieldset style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <legend style={{ fontSize: 13, fontWeight: 700, color: WIZ_TEXT, marginBottom: 10 }}>Difficulty</legend>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
          {WORM_DIFFICULTIES.map(option => <button
            type="button" key={option.id} aria-pressed={difficulty.id === option.id}
            onClick={() => cos.setSettings(current => ({ ...current, ...option.settings }))}
            style={{ minHeight: 48, padding: '12px 6px', borderRadius: 10,
              border: `2px solid ${difficulty.id === option.id ? ACCENT : WIZ_BORDER_SOFT}`,
              background: difficulty.id === option.id ? ACCENT : WIZ_SURFACE_RAISED,
              color: difficulty.id === option.id ? '#111d20' : WIZ_TEXT,
              cursor: 'pointer', font: 'inherit', fontSize: 14, fontWeight: 700 }}
          >{option.label}</button>)}
        </div>
      </fieldset>}
    </div>
  );

  const categories = [
    {
      key: 'character',
      icon: 'character',
      label: 'Character',
      title: "Character",
      primaryLabel: 'Continue',
      summary: `${activeCharacter.label} · ${activeSkin.label}`,
      content: <WormProfile defaultExpanded />
    },
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
      key: 'play',
      icon: 'gameplay',
      label: 'Gameplay',
      title: 'Gameplay',
      summary: settings.wormCombatMode ? 'Portal Combat · 5×5' : `${sizeLabel(cos.cubeSize, WORM_SIZE_TIERS)} · ${difficulty.label}`,
      hero: <SizeStep cos={settings.wormCombatMode ? { ...cos, cubeSize: 5 } : cos} tiers={WORM_SIZE_TIERS} slot="hero" compact locked={!!settings.wormCombatMode} />,
      content: renderPlay()
    }
  ];


  const handleNext = () => {
    wormMenuFeedback();
    if (step < categories.length - 1) setStep(step + 1);
    else onComplete({
      ...settings,
      wormColor: activeSkin.body,
      cubeSize: settings.wormCombatMode ? 5 : cos.cubeSize,
      wormSpeed: settings.wormCombatMode ? 1.25 : settings.wormSpeed,
      megaMode: !settings.wormCombatMode && cos.cubeSize === MEGA_CUBE_SIZE
    });
  };
  const handleBack = () => { wormMenuFeedback(); if (step > 0) setStep(step - 1); else onCancel(); };

  return (
    <WizardShell
      styles={S}
      mode="WORM MODE"
      accent={ACCENT}
      categories={categories}
      active={step}
      onSelect={value => { wormMenuFeedback(); setStep(value); }}
      onBack={handleBack}
      onPrimary={handleNext}
      finishLabel="Play"
      mobile={isMobile}
    >
      <WizardImageInput cos={cos} />
    </WizardShell>
  );
};

export default WormModeSetupWizard;
