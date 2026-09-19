import React, { useEffect, useRef } from 'react';
import { wormBuffs } from './wormBuffs.js';
import { JUMP_RESCUE_SECONDS } from './healerWorm/constants.js';

export default function JumpRescueCue() {
  const meter = useRef(null);
  useEffect(() => {
    let frame;
    const draw = () => {
      if (meter.current) meter.current.style.transform = `scaleX(${Math.max(0, Math.min(1, wormBuffs.jumpRescueT / JUMP_RESCUE_SECONDS))})`;
      frame = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, []);
  return <span className="worm-jump-rescue-cue" role="alert">
    Body ahead — jump!
    <span className="worm-jump-rescue-meter" aria-hidden="true"><span ref={meter} /></span>
  </span>;
}
