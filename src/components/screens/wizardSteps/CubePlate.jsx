// CubePlate.jsx — the hero of every cosmetic step: your actual cube, alive.
//
// Modelled on the worm wizard's character plate, which is the one place in the
// app where picking something showed you the thing itself. The cube gets the
// same display case (SpecimenPlate), with a name plate that re-labels itself for
// whichever choice the current step is making.
//
// It sticks to the top of the wizard body, so the palette you scroll to on the
// far side of the list still lands on a cube you can see.

import React from 'react';
import CubePreviewCanvas from '../../../3d/CubePreviewCanvas.jsx';
import { isMobile } from '../../../utils/device.js';
import SpecimenPlate from './SpecimenPlate.jsx';

export { plateSurface, plateArrow } from './SpecimenPlate.jsx';

/**
 * @param cube      { size, colors, tileStyle, perFaceStyles } for the live cube
 * @param swatches  the palette's six colours, as a strip under the name plate
 * plus everything SpecimenPlate takes.
 */
export default function CubePlate({
  caption,
  index,
  total,
  title,
  subtitle,
  onPrev,
  onNext,
  cube,
  glow = '#9fdb7a',
  backdrop = null,
  swatches = null
}) {
  const cubePx = isMobile ? 138 : 176;

  return (
    <SpecimenPlate
      sticky
      caption={caption}
      index={index}
      total={total}
      title={title}
      subtitle={subtitle}
      onPrev={onPrev}
      onNext={onNext}
      glow={glow}
      backdrop={backdrop}
      hint={onPrev ? 'drag the cube to turn it' : null}
      art={
        <CubePreviewCanvas
          px={cubePx}
          size={cube.size}
          colors={cube.colors}
          tileStyle={cube.tileStyle}
          perFaceStyles={cube.perFaceStyles}
        />
      }
    >
      {/* The palette itself, in face order, so a scheme is readable even on the
          faces the tumble has turned away. */}
      {swatches && (
        <div style={{ display: 'flex', gap: '5px', zIndex: 1 }}>
          {swatches.map((hex, i) => (
            <div key={i} style={{
              width: '18px', height: '7px', borderRadius: '3px', background: hex,
              boxShadow: '0 1px 3px rgba(0,0,0,0.35)', transition: 'background 0.3s ease'
            }} />
          ))}
        </div>
      )}
    </SpecimenPlate>
  );
}
