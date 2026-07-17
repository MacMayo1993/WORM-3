import React, { useState, useEffect, useRef, useCallback } from 'react';

const DURATION = 180;

// `freezeOnExit`: render a cached snapshot of the last shown children during the
// exit fade. Use for surfaces whose props reset the moment they are dismissed
// (TeachMode analysis, demo cards, etc.) so the fade-out never renders nulls.
export default function ScreenTransition({ show, children, duration = DURATION, freezeOnExit = false }) {
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState('idle');
  const timerRef = useRef(null);
  const frozenRef = useRef(null);
  if (show) frozenRef.current = children;

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    cleanup();

    if (show && !mounted) {
      setMounted(true);
      setPhase('entering');
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setPhase('entered'));
      });
    } else if (!show && mounted) {
      setPhase('exiting');
      timerRef.current = setTimeout(() => {
        setMounted(false);
        setPhase('idle');
        frozenRef.current = null;
      }, duration);
    }

    return cleanup;
  }, [show, mounted, duration, cleanup]);

  if (!mounted) return null;

  const style = {
    transition: `opacity ${duration}ms ease`,
    opacity: phase === 'entered' ? 1 : 0,
    willChange: 'opacity',
  };

  return <div style={style}>{freezeOnExit && !show ? frozenRef.current : children}</div>;
}
