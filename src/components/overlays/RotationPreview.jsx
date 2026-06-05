import React, { useRef, useEffect } from 'react';
import { chaosCountdownState } from '../../hooks/useChaosMode.js';

// maxCountdown is the reference scale for the progress bar (fixed at the
// longest possible interval so the bar always reads "time left before
// rotation" even when disparity-driven intervals are much shorter).
const MAX_COUNTDOWN = 10000;

const RotationPreview = ({ upcomingRotation, size }) => {
  const fillRef = useRef(null);
  const textRef = useRef(null);
  const arrowRef = useRef(null);

  // Poll the shared mutable countdown object every animation frame and push
  // updates straight to the DOM, bypassing React's render cycle entirely.
  useEffect(() => {
    let raf;
    const update = () => {
      const countdown = chaosCountdownState.countdown;
      const progress = Math.max(0, Math.min(1, countdown / MAX_COUNTDOWN));
      const sec = Math.max(0, countdown / 1000).toFixed(1);
      const r = Math.floor(255 * (1 - progress));
      const g = Math.floor(200 * progress);
      const color = `rgb(${r}, ${g}, 50)`;

      if (fillRef.current) {
        fillRef.current.style.width = `${progress * 100}%`;
        fillRef.current.style.background = color;
      }
      if (textRef.current) {
        textRef.current.textContent = `${sec}s`;
        textRef.current.style.color = color;
      }
      if (arrowRef.current) {
        arrowRef.current.style.color = color;
      }

      raf = requestAnimationFrame(update);
    };
    raf = requestAnimationFrame(update);
    return () => cancelAnimationFrame(raf);
  }, []);

  if (!upcomingRotation) return null;

  const { axis, dir, sliceIndex } = upcomingRotation;

  const getAxisLabel = () => {
    switch (axis) {
      case 'col': return 'X';
      case 'row': return 'Y';
      case 'depth': return 'Z';
      default: return '?';
    }
  };

  const renderGridPreview = () => {
    const cells = [];
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        let isHighlighted = false;
        if (axis === 'col' && col === sliceIndex) isHighlighted = true;
        if (axis === 'row' && row === (size - 1 - sliceIndex)) isHighlighted = true;
        if (axis === 'depth' && (row === sliceIndex || col === sliceIndex)) isHighlighted = true;

        cells.push(
          <div
            key={`${row}-${col}`}
            className={`preview-cell ${isHighlighted ? 'highlighted' : ''}`}
            style={{ gridRow: row + 1, gridColumn: col + 1 }}
          />
        );
      }
    }
    return cells;
  };

  return (
    <div className="rotation-preview">
      <div className="preview-header">
        <span className="preview-title">NEXT</span>
        <span ref={arrowRef} className="preview-arrow">{dir === 1 ? '↻' : '↺'}</span>
      </div>

      <div className="preview-grid" style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}>
        {renderGridPreview()}
      </div>

      <div className="preview-info">
        <span className="preview-axis">{getAxisLabel()}{sliceIndex + 1}</span>
      </div>

      <div className="preview-countdown-bar">
        <div ref={fillRef} className="preview-countdown-fill" />
      </div>

      <div ref={textRef} className="preview-countdown-text" />
    </div>
  );
};

export default RotationPreview;
