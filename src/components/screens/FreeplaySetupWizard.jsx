import { MODE_THEMES } from '../../utils/modeThemes.js';
import React, { useState, useMemo } from 'react';
import { useIsMobile } from '../../hooks/index.js';
import { wizardLayout, WizardShell } from './WizardChrome.jsx';
import {
  useWizardCosmetics, WizardImageInput,
  SceneStep, PaletteStep, SizeStep, styleCategory,
  sceneLabel, paletteLabel, sizeLabel
} from './wizardSteps/index.jsx';

const ACCENT = MODE_THEMES.cube.accent;
const ACCENT_SHADOW = MODE_THEMES.cube.shadow;

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
      subtitle: '',
      summary: sceneLabel(cos.settings),
      hero: <SceneStep cos={cos} slot="hero" />,
      content: <SceneStep cos={cos} slot="body" />
    },
    {
      key: 'colors',
      icon: 'colors',
      label: 'Colors',
      title: 'Color Palette',
      subtitle: '',
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
      subtitle: '',
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
      finishLabel="Play cube"
      mobile={isMobile}
      secondary={step < categories.length - 1 ? { label: 'Play now', onClick: finish } : null}
    >
      <WizardImageInput cos={cos} />
    </WizardShell>
  );
};

export default FreeplaySetupWizard;
