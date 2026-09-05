import React, { useState, useMemo } from 'react';
import { useIsMobile } from '../../hooks/index.js';
import { wizardLayout, WizardShell } from './WizardChrome.jsx';
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
      hero: <SceneStep cos={cos} slot="hero" />,
      content: <SceneStep cos={cos} slot="body" />
    },
    {
      key: 'size',
      icon: 'size',
      label: 'Size',
      title: 'Cube Size',
      subtitle: 'Slide to size — this stays fixed during play.',
      summary: sizeLabel(cos.cubeSize),
      hero: <SizeStep cos={cos} slot="hero" />,
      content: <SizeStep cos={cos} slot="body" />
    }
  ];


  const handleNext = () => {
    if (step < categories.length - 1) setStep(step + 1);
    else onComplete({ backgroundTheme: cos.settings.backgroundTheme, cubeSize: cos.cubeSize });
  };
  const handleBack = () => (step > 0 ? setStep(step - 1) : onCancel());

  return (
    <WizardShell
      styles={S}
      mode="RANDOM MODE"
      accent={ACCENT}
      categories={categories}
      active={step}
      onSelect={setStep}
      onBack={handleBack}
      onPrimary={handleNext}
      finishLabel="Start Playing"
      mobile={isMobile}
    />
  );
};

export default RandomModeSetupWizard;
