import React, { useState, useEffect, useRef, useCallback } from 'react';

const DURATION = 180;

export default function ScreenTransition({ show, children, duration = DURATION }) {
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState('idle');
  const timerRef = useRef(null);

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

  return <div style={style}>{children}</div>;
}
