// useIsMobile — the reactive companion to the static `isMobile` in utils/device.js.
//
// `device.js` evaluates its breakpoint once at module load, which is right for
// store defaults and module-scope style constants but wrong for a panel that a
// player can rotate mid-task: the setup wizards computed their whole layout from
// that frozen value, so turning a phone sideways left the sheet sized for the old
// orientation. This hook re-runs the same predicate on resize/orientation change
// so a component re-renders with the current value.
//
// It seeds from the static `isMobile` so the first paint matches device.js exactly
// (and is SSR/test-safe — no window access before mount), then keeps in step.
import { useState, useEffect } from 'react';
import { isMobile as isMobileStatic } from '../utils/device.js';

const evaluate = () =>
  typeof window !== 'undefined' &&
  (window.innerWidth <= 768 || 'ontouchstart' in window || navigator.maxTouchPoints > 0);

export function useIsMobile() {
  const [mobile, setMobile] = useState(isMobileStatic);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const update = () => setMobile(evaluate());
    // Re-sync once on mount in case the viewport changed before hydration.
    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  return mobile;
}

export default useIsMobile;
