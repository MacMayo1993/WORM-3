import React, { useState, useMemo } from 'react';
import { PAPER_TEXT, PAPER_TEXT_MUTED, PAPER_BORDER_SOFT } from '../../utils/uiTheme.js';
import { useIsMobile } from '../../hooks/index.js';
import { wizardLayout, WizardSteps } from './WizardChrome.jsx';
import { useWizardCosmetics, SceneStep, SizeStep } from './wizardSteps/index.jsx';

const ACCENT = '#C44B00';
const ACCENT_SHADOW = '#7a2e00';

const STEPS = ['Scene', 'Size'];
const STEP_TITLES = ['Pick Your Scene', 'Cube Size'];
const STEP_SUBTITLES = [
  'This stays fixed — color schemes, tile styles, and a per-cubelet mix of view styles will cycle automatically every 10 seconds.',
  'Slide to size — this stays fixed during play.'
];

const RandomModeSetupWizard = ({ onComplete, onCancel, initialSettings }) => {
  const [step, setStep] = useState(0);
  const isMobile = useIsMobile();
  const S = useMemo(() => wizardLayout(ACCENT, ACCENT_SHADOW, isMobile), [isMobile]);
  // Random Mode reshuffles the cosmetics as you play, so the plate wears a
  // random mix rather than pretending you picked something.
  const cos = useWizardCosmetics({
    initialSettings,
    accent: ACCENT,
    accentShadow: ACCENT_SHADOW,
    extra: { tileStyle: 'random' }
  });

  const handleNext = () => {
    if (step < STEPS.length - 1) setStep(step + 1);
    else onComplete({ backgroundTheme: cos.settings.backgroundTheme, cubeSize: cos.cubeSize });
  };
  const handleBack = () => (step > 0 ? setStep(step - 1) : onCancel());

  const stepContent = [<SceneStep key="scene" cos={cos} />, <SizeStep key="size" cos={cos} />];

  return (
    <div style={S.overlay}>
      <div style={S.sheet}>
        <div style={S.header}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px', background: ACCENT,
            borderRadius: '6px', padding: '4px 12px', marginBottom: '14px', boxShadow: `0 2px 0 ${ACCENT_SHADOW}`
          }}>
            <span style={{ fontSize: '13px' }}>🎲</span>
            <span style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#fff' }}>
              Random Mode
            </span>
          </div>
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
          <button
            style={S.btnPrimary}
            onClick={handleNext}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'none'; }}
            onMouseDown={e => { e.currentTarget.style.transform = 'translateY(3px)'; e.currentTarget.style.boxShadow = `0 1px 0 ${ACCENT_SHADOW}`; }}
            onMouseUp={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = `0 4px 0 ${ACCENT_SHADOW}, 0 6px 16px ${ACCENT}44`; }}
          >
            {step === STEPS.length - 1 ? 'Start Random Mode' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RandomModeSetupWizard;
