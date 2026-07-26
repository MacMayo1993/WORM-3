import React, { useState } from 'react';
import { PAPER_TEXT, PAPER_TEXT_MUTED, PAPER_BORDER_SOFT } from '../../utils/uiTheme.js';
import { wizardLayout, WizardSteps } from './WizardChrome.jsx';
import {
  useWizardCosmetics, WizardImageInput,
  SceneStep, PaletteStep, StyleStep, SizeStep
} from './wizardSteps/index.jsx';

const ACCENT = '#1565C0';
const ACCENT_SHADOW = '#0a3872';

const S = wizardLayout(ACCENT, ACCENT_SHADOW);

// Colours before style before size: the style step draws every tile in the
// palette you just chose, and the size step shows both of them on the cube you
// are actually about to play. Scene leads because it is the one choice that
// doesn't depend on the others.
const STEPS = ['Scene', 'Colors', 'Style', 'Size'];

const STEP_TITLES = ['Pick Your Scene', 'Color Palette', 'Tile Style', 'Cube Size'];
const STEP_SUBTITLES = [
  'Choose your play environment',
  'Pick a palette — the cube wears it as you go',
  'Choose how your tiles look and feel',
  'Slide to size — everything else is already decided'
];

const FreeplaySetupWizard = ({ onComplete, onCancel, initialSettings }) => {
  const [step, setStep] = useState(0);
  const cos = useWizardCosmetics({ initialSettings, accent: ACCENT, accentShadow: ACCENT_SHADOW });

  const finish = () => onComplete({ ...cos.settings, cubeSize: cos.cubeSize });

  const handleNext = () => (step < STEPS.length - 1 ? setStep(step + 1) : finish());
  const handleBack = () => (step > 0 ? setStep(step - 1) : onCancel());

  const stepContent = [
    <SceneStep key="scene" cos={cos} />,
    <PaletteStep key="palette" cos={cos} />,
    <StyleStep key="style" cos={cos} />,
    <SizeStep key="size" cos={cos} />
  ];

  return (
    <div style={S.overlay}>
      <WizardImageInput cos={cos} />

      <div style={S.sheet}>
        <div style={S.header}>
          <WizardSteps styles={S} steps={STEPS} step={step} />
          <h2 style={S.title}>{STEP_TITLES[step]}</h2>
          <p style={S.subtitle}>{STEP_SUBTITLES[step]}</p>
        </div>

        <div style={S.body}>
          <div style={{ paddingBottom: '24px' }}>{stepContent[step]}</div>
        </div>

        <div style={S.footer}>
          <button
            style={S.btnSecondary}
            onClick={handleBack}
            onMouseEnter={e => { e.currentTarget.style.color = PAPER_TEXT; e.currentTarget.style.borderColor = '#b8b2aa'; }}
            onMouseLeave={e => { e.currentTarget.style.color = PAPER_TEXT_MUTED; e.currentTarget.style.borderColor = PAPER_BORDER_SOFT; }}
          >
            {step === 0 ? 'Cancel' : 'Back'}
          </button>

          {/* Every choice here has a sane default, so a player who only wants a
              3×3 can leave at any point. */}
          {step < STEPS.length - 1 && (
            <button
              style={{ ...S.btnSecondary, marginLeft: 'auto', marginRight: '10px' }}
              onClick={finish}
              onMouseEnter={e => { e.currentTarget.style.color = PAPER_TEXT; e.currentTarget.style.borderColor = '#b8b2aa'; }}
              onMouseLeave={e => { e.currentTarget.style.color = PAPER_TEXT_MUTED; e.currentTarget.style.borderColor = PAPER_BORDER_SOFT; }}
            >
              Just play
            </button>
          )}

          <button
            style={S.btnPrimary}
            onClick={handleNext}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'none'; }}
            onMouseDown={e => { e.currentTarget.style.transform = 'translateY(3px)'; e.currentTarget.style.boxShadow = `0 1px 0 ${ACCENT_SHADOW}`; }}
            onMouseUp={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = `0 4px 0 ${ACCENT_SHADOW}, 0 6px 16px ${ACCENT}44`; }}
          >
            {step === STEPS.length - 1 ? 'Start Playing' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FreeplaySetupWizard;
