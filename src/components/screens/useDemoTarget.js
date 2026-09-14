import { useLayoutEffect, useRef } from 'react';

// Measure the real key: the dock has four unequal-width slots and can resize.
export function useDemoTarget(key) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const card = ref.current;
    const target = document.querySelector(`[data-demo-control="${key}"]`);
    if (!card || !target) return;
    const measure = () => {
      const a = card.getBoundingClientRect(), b = target.getBoundingClientRect();
      card.style.setProperty('--tour-pointer', `${b.left + b.width / 2 - a.left}px`);
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(card); observer?.observe(target);
    if (target.parentElement) observer?.observe(target.parentElement);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true); };
  }, [key]);
  return ref;
}
