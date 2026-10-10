import React, { useLayoutEffect, useState } from 'react';
import { DEMO_STEPS } from '../../game/demoSequence.js';
import { UI_FONT } from '../../utils/uiTheme.js';
import './demoProgressBar.css';

// The same toolbar lives inside blocking dialogs and above the hands-on scene.
// Keeping modal actions inside their dialog also keeps them in its focus trap.
export default function DemoProgressBar({ currentStep, onSkipStep, onExit, disabled = false, inline = false, belowWormHud = false }) {
  const [top, setTop] = useState(null);
  useLayoutEffect(() => {
    if (inline || !belowWormHud) { setTop(null); return undefined; }
    const bars = [...document.querySelectorAll('.worm-hud-top')];
    const measure = () => {
      const bottom = Math.max(0, ...bars.map(bar => bar.getBoundingClientRect().bottom));
      setTop(bottom > 0 ? bottom + 12 : null);
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    bars.forEach(bar => observer?.observe(bar));
    window.addEventListener('resize', measure);
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); };
  }, [inline, belowWormHud, currentStep]);
  const total = DEMO_STEPS.length - 1;
  const index = DEMO_STEPS.findIndex(step => step.id === currentStep);
  const current = currentStep === 'end' ? total : Math.max(1, index + 1);
  const hasActions = !!(onSkipStep || onExit);
  return <div role={hasActions ? 'group' : undefined} aria-label={hasActions ? 'Demo controls' : undefined}
    className={`demo-toolbar${hasActions ? '' : ' demo-toolbar--progress'}${inline ? ' demo-toolbar--inline' : ''}`}
    style={{ fontFamily: UI_FONT, ...(top === null ? {} : { top }) }} data-camera-avoid>
    <div className="demo-toolbar-progress">
      <div className="demo-toolbar-caption"><span>Demo</span><span className="demo-progress-count">{current} / {total}</span></div>
      <div className="demo-toolbar-track" role="progressbar" aria-label="Demo progress" aria-valuemin={0} aria-valuemax={total} aria-valuenow={current}>
        <div style={{ width: `${current / total * 100}%` }} />
      </div>
    </div>
    {onSkipStep && <button type="button" disabled={disabled} onClick={onSkipStep}>Skip Step</button>}
    {onExit && <button type="button" disabled={disabled} onClick={onExit}>Exit Demo</button>}
  </div>;
}
