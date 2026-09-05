import React, { useState, useMemo } from 'react';
import { useIsMobile } from '../../hooks/index.js';
import { wizardLayout, WizardShell } from './WizardChrome.jsx';
import {
  useWizardCosmetics, WizardImageInput,
  SceneStep, PaletteStep, SizeStep, styleCategory,
  sceneLabel, paletteLabel, sizeLabel
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
      hero: <SceneStep cos={cos} slot="hero" />,
      content: <SceneStep cos={cos} slot="body" />
    },
    {
      key: 'colors',
      icon: 'colors',
      label: 'Colors',
      title: 'Color Palette',
      subtitle: 'Pick a palette — the cube wears it as you go',
      summary: paletteLabel(cos.settings),
      hero: <PaletteStep cos={cos} slot="hero" />,
      content: <PaletteStep cos={cos} slot="body" />
    },
    styleCategory(cos),
    {
      key: 'size',
      icon: 'size',
      label: 'Size',
      title: 'Cube Size',
      subtitle: 'Slide to size — everything else is already decided',
      summary: sizeLabel(cos.cubeSize),
      hero: <SizeStep cos={cos} slot="hero" />,
      content: <SizeStep cos={cos} slot="body" />
    }
  ];

  const finish = () => onComplete({ ...cos.settings, cubeSize: cos.cubeSize });

  const handleNext = () => (step < categories.length - 1 ? setStep(step + 1) : finish());
  const handleBack = () => (step > 0 ? setStep(step - 1) : onCancel());

  return (
    <WizardShell
      styles={S}
      mode="CUBE MODE"
      accent={ACCENT}
      categories={categories}
      active={step}
      onSelect={setStep}
      onBack={handleBack}
      onPrimary={handleNext}
      finishLabel="Start Playing"
      mobile={isMobile}
      secondary={step < categories.length - 1 ? { label: 'Just play — 3×3 with what is set', onClick: finish } : null}
    >
      <WizardImageInput cos={cos} />
    </WizardShell>
  );
};

export default FreeplaySetupWizard;
