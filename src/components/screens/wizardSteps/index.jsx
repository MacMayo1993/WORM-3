// wizardSteps — the cosmetic half of every setup wizard, in one place.
//
// Freeplay, Worm, Disparity, and Random each asked the same four questions —
// scene, palette, tile style, cube size — from four hand-copied implementations
// that had already drifted apart. They share these now, so a change to how you
// choose a palette is one change rather than four.
//
// A wizard wires the whole cosmetic half up like this:
//
//   const cos = useWizardCosmetics({ initialSettings, accent, accentShadow });
//   ...
//   <WizardImageInput cos={cos} />
//   <SceneStep cos={cos} /> / <PaletteStep cos={cos} /> / …
//   onComplete({ ...cos.settings, cubeSize: cos.cubeSize })

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useGameStore } from '../../../hooks/useGameStore.js';
import { extractColorsFromImage } from '../../../utils/colorExtraction.js';
import { resolveWizardColors } from './shared.jsx';

export { default as SpecimenPlate, plateSurface, plateArrow } from './SpecimenPlate.jsx';
export { default as CubePlate } from './CubePlate.jsx';
export { default as CubeSizeSlider } from './CubeSizeSlider.jsx';
export { default as SceneStep } from './SceneStep.jsx';
export { default as PaletteStep } from './PaletteStep.jsx';
export { default as StyleStep } from './StyleStep.jsx';
export { default as SizeStep } from './SizeStep.jsx';
export * from './shared.jsx';

/**
 * The cosmetic state every wizard keeps: palette, tile style, scene, and size,
 * plus the store's ownership list and the uploaded-image plumbing.
 *
 * @param initialSettings the game's current settings, used as the starting point
 * @param accent          the mode's colour, threaded through every step
 * @param extra           mode-specific settings merged into the same object
 */
export function useWizardCosmetics({ initialSettings, accent, accentShadow, extra }) {
  const ownedItems = useGameStore(s => s.ownedItems);

  const [cubeSize, setCubeSize] = useState(initialSettings?.size || 3);
  const [settings, setSettings] = useState(() => ({
    colorScheme: initialSettings?.colorScheme || 'standard',
    customColors: initialSettings?.customColors || null,
    tileStyle: 'solid',
    backgroundTheme: initialSettings?.backgroundTheme || 'blackhole',
    // Per-face tile styles; null means "use the global tileStyle".
    perFaceStyles: null,
    ...extra
  }));
  const [customPreview, setCustomPreview] = useState(null);
  // Which tile-style family the tabs are showing. null means "whichever holds
  // the style you are already using".
  const [styleFamily, setStyleFamily] = useState(null);
  const fileInputRef = useRef(null);

  const select = useCallback((key, value) => setSettings(s => ({ ...s, [key]: value })), []);

  const openImagePicker = useCallback(() => fileInputRef.current?.click(), []);

  const handleImageUpload = useCallback(e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      setCustomPreview(url);
      const extracted = extractColorsFromImage(img, 6);
      const customColors = {};
      extracted.forEach((c, i) => { customColors[i + 1] = c; });
      setSettings(s => ({ ...s, colorScheme: 'custom', customColors }));
    };
    img.src = url;
  }, []);

  const colors = useMemo(() => resolveWizardColors(settings), [settings]);

  return {
    settings, setSettings, select,
    cubeSize, setCubeSize,
    colors, ownedItems,
    accent, accentShadow,
    customPreview, openImagePicker, handleImageUpload, fileInputRef,
    styleFamily, setStyleFamily
  };
}

/** The hidden file input the palette step's "Extract from Image" card opens. */
export function WizardImageInput({ cos }) {
  return (
    <input
      ref={cos.fileInputRef}
      type="file"
      accept="image/*"
      onChange={cos.handleImageUpload}
      style={{ display: 'none' }}
    />
  );
}
