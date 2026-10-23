// src/worm/useCountUp.js
// A result number that climbs from zero as its card lands (the death card's orbs,
// the free-play win's Parity Points). DOM-side only: never used in a frame loop.
import { useEffect, useState } from 'react';

/** Count a number up from zero as the card lands; the final value at once without motion. */
export function useCountUp(target, still, ms = 900) {
    const animate = !still && target > 0 && typeof requestAnimationFrame === 'function';
    const [shown, setShown] = useState(animate ? 0 : target);
    useEffect(() => {
        if (!animate) { setShown(target); return undefined; }
        let raf = 0, start = null;
        const step = (now) => {
            start ??= now;
            const t = Math.min(1, (now - start) / ms);
            setShown(Math.round(target * (1 - (1 - t) ** 3)));
            if (t < 1) raf = requestAnimationFrame(step);
        };
        // Let the card land before the number starts to climb.
        const delay = setTimeout(() => { raf = requestAnimationFrame(step); }, 350);
        return () => { clearTimeout(delay); cancelAnimationFrame(raf); };
    }, [animate, target, ms]);
    return shown;
}
