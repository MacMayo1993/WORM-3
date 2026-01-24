import React from 'react';

const RotationPreview = ({ upcomingRotation, countdown, maxCountdown, size }) => {
  if (!upcomingRotation) return null;

  const { axis, dir, sliceIndex } = upcomingRotation;

  // Get axis display name and direction arrow
  const getAxisLabel = () => {
    switch (axis) {
      case 'col': return 'X';
      case 'row': return 'Y';
      case 'depth': return 'Z';
      default: return '?';
    }
  };

  const getDirectionArrow = () => {
    return dir === 1 ? '↻' : '↺';
  };

  // Generate a 2D grid preview showing which slice will rotate
  const renderGridPreview = () => {
    const cells = [];
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        let isHighlighted = false;

        // Highlight the slice that will rotate
        if (axis === 'col' && col === sliceIndex) isHighlighted = true;
        if (axis === 'row' && row === (size - 1 - sliceIndex)) isHighlighted = true;
        if (axis === 'depth' && (row === sliceIndex || col === sliceIndex)) isHighlighted = true;

        cells.push(
          <div
            key={`${row}-${col}`}
            className={`preview-cell ${isHighlighted ? 'highlighted' : ''}`}
            style={{
              gridRow: row + 1,
              gridColumn: col + 1
            }}
          />
        );
      }
    }
    return cells;
  };

  const countdownProgress = Math.max(0, Math.min(1, countdown / maxCountdown));
  const countdownSec = Math.max(0, countdown / 1000).toFixed(1);

  // Color transitions from green (safe) to red (imminent)
  const r = Math.floor(255 * (1 - countdownProgress));
  const g = Math.floor(200 * countdownProgress);
  const progressColor = `rgb(${r}, ${g}, 50)`;

  return (
    <div className="rotation-preview">
      <div className="preview-header">
        <span className="preview-title">NEXT</span>
        <span className="preview-arrow" style={{ color: progressColor }}>{getDirectionArrow()}</span>
      </div>

      <div className="preview-grid" style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}>
        {renderGridPreview()}
      </div>

      <div className="preview-info">
        <span className="preview-axis">{getAxisLabel()}{sliceIndex + 1}</span>
      </div>

      <div className="preview-countdown-bar">
        <div
          className="preview-countdown-fill"
          style={{
            width: `${countdownProgress * 100}%`,
            background: progressColor
          }}
        />
      </div>

      <div className="preview-countdown-text" style={{ color: progressColor }}>
        {countdownSec}s
      </div>
    </div>
  );
};

export default RotationPreview;
