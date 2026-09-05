import React, { useState, useMemo } from 'react';
import { PAPER_TEXT, PAPER_TEXT_MUTED, PAPER_BORDER_SOFT } from '../../utils/uiTheme.js';
import { useIsMobile } from '../../hooks/index.js';
import { wizardLayout, WizardRail, WIZARD_PANEL_ID } from './WizardChrome.jsx';
import {
  useWizardCosmetics, WizardImageInput,
  SceneStep, PaletteStep, StyleStep, SizeStep,
  sceneLabel, paletteLabel, styleLabel, sizeLabel
} from './wizardSteps/index.jsx';

const ACCENT = '#1565C0';
const ACCENT_SHADOW = '#0a3872';

const FreeplaySetupWizard = ({ onComplete, onCancel, initialSettings }) => {
  // Which category the pane is showing. The rail sets it directly; Back and
  // Continue walk it, which is the order the categories are listed in below.
  const [step, setStep] = useState(0);
  const isMobile = useIsMobile();
  const S = useMemo(() => wizardLayout(ACCENT, ACCENT_SHADOW, isMobile), [isMobile]);
  const cos = useWizardCosmetics({ initialSettings, accent: ACCENT, accentShadow: ACCENT_SHADOW });

  // Colours before style before size: the style category draws every tile in the
  // palette you just chose, and size shows both of them on the cube you are
  // about to play. Scene leads because it is the one choice that doesn't depend
  // on the others — but nothing forces that route any more, it is just the order
  // the rail reads top to bottom.
  const categories = [
    {
      key: 'scene',
      icon: 'scene',
      label: 'Scene',
      title: 'Pick Your Scene',
      subtitle: 'Choose your play environment',
      summary: sceneLabel(cos.settings),
      content: <SceneStep cos={cos} />
    },
    {
      key: 'colors',
      icon: 'colors',
      label: 'Colors',
      title: 'Color Palette',
      subtitle: 'Pick a palette — the cube wears it as you go',
      summary: paletteLabel(cos.settings),
      content: <PaletteStep cos={cos} />
    },
    {
      key: 'style',
      icon: 'style',
      label: 'Style',
      title: 'Tile Style',
      subtitle: 'Choose how your tiles look and feel',
      summary: styleLabel(cos.settings),
      content: <StyleStep cos={cos} />
    },
    {
      key: 'size',
      icon: 'size',
      label: 'Size',
      title: 'Cube Size',
      subtitle: 'Slide to size — everything else is already decided',
      summary: sizeLabel(cos.cubeSize),
      content: <SizeStep cos={cos} />
    }
  ];

  const active = categories[step];
  const finish = () => onComplete({ ...cos.settings, cubeSize: cos.cubeSize });

  const handleNext = () => (step < categories.length - 1 ? setStep(step + 1) : finish());
  const handleBack = () => (step > 0 ? setStep(step - 1) : onCancel());

  return (
    <div style={S.overlay}>
      <WizardImageInput cos={cos} />

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
              <h2 style={S.title}>{active.title}</h2>
              <p style={S.subtitle}>{active.subtitle}</p>
            </div>

            <div style={S.body} id={WIZARD_PANEL_ID} role="tabpanel" aria-label={active.label}>
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

          {/* Every choice here has a sane default, so a player who only wants a
              3×3 can leave at any point. */}
          {step < categories.length - 1 && (
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
            {step === categories.length - 1 ? 'Start Playing' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FreeplaySetupWizard;
