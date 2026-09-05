import React, { useState, useMemo } from 'react';
import { PAPER_TEXT, PAPER_TEXT_MUTED, PAPER_BORDER_SOFT } from '../../utils/uiTheme.js';
import { useIsMobile } from '../../hooks/index.js';
import { wizardLayout, WizardRail, WIZARD_PANEL_ID } from './WizardChrome.jsx';
import { useWizardCosmetics, SceneStep, SizeStep, sceneLabel, sizeLabel } from './wizardSteps/index.jsx';

const ACCENT = '#C44B00';
const ACCENT_SHADOW = '#7a2e00';

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

  // Only two categories, so the rail is short — but a short rail still shows the
  // scene and the size at the same time, which the two-screen walk did not.
  const categories = [
    {
      key: 'scene',
      icon: 'scene',
      label: 'Scene',
      title: 'Pick Your Scene',
      subtitle: 'This stays fixed — color schemes, tile styles, and a per-cubelet mix of view styles will cycle automatically every 10 seconds.',
      summary: sceneLabel(cos.settings),
      content: <SceneStep cos={cos} />
    },
    {
      key: 'size',
      icon: 'size',
      label: 'Size',
      title: 'Cube Size',
      subtitle: 'Slide to size — this stays fixed during play.',
      summary: sizeLabel(cos.cubeSize),
      content: <SizeStep cos={cos} />
    }
  ];

  const active = categories[step];

  const handleNext = () => {
    if (step < categories.length - 1) setStep(step + 1);
    else onComplete({ backgroundTheme: cos.settings.backgroundTheme, cubeSize: cos.cubeSize });
  };
  const handleBack = () => (step > 0 ? setStep(step - 1) : onCancel());

  return (
    <div style={S.overlay}>
      <div style={S.sheet}>
        <div style={S.main}>
          <WizardRail
            styles={S}
            categories={categories}
            active={step}
            onSelect={setStep}
            accent={ACCENT}
            mobile={isMobile}
          />

          <div style={S.pane}>
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
              <h2 style={S.title}>{active.title}</h2>
              <p style={S.subtitle}>{active.subtitle}</p>
            </div>

            <div style={S.body} id={WIZARD_PANEL_ID} role="region" aria-label={active.label}>
              <div style={{ paddingBottom: '24px' }}>{active.content}</div>
            </div>
          </div>
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
            {step === categories.length - 1 ? 'Start Random Mode' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RandomModeSetupWizard;
