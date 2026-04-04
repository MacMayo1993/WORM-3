import React from 'react';

// Replace the setInterval/setState pulse (20 re-renders/sec) with a pure CSS
// animation. The bar's opacity ranged from 0.7 to 1.0; we replicate that with
// a keyframe that drives opacity on the fill element itself — zero JS cost.

const InstabilityTracker = ({ entropy, wormholes, chaosLevel: _chaosLevel }) => {
  const instability = Math.min(100, entropy + wormholes * 3);
  const level = instability < 25 ? 'STABLE' : instability < 50 ? 'UNSTABLE' : instability < 75 ? 'CRITICAL' : 'CHAOS';
  const color = instability < 25 ? '#22c55e' : instability < 50 ? '#eab308' : instability < 75 ? '#f97316' : '#ef4444';

  return (
    <div className="instability-tracker">
      <style>{`
        @keyframes instability-pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.7; }
        }
        .instability-bar-fill {
          animation: instability-pulse 1.67s ease-in-out infinite;
        }
      `}</style>
      <div className="tracker-label">
        <span style={{ color }}>◆</span> {level}
      </div>
      <div className="tracker-bar-container">
        <div
          className="tracker-bar-fill instability-bar-fill"
          style={{
            width: `${instability}%`,
            background: `linear-gradient(90deg, ${color}, ${color}dd)`,
          }}
        />
      </div>
      <div className="tracker-value">{instability.toFixed(0)}%</div>
    </div>
  );
};

export default InstabilityTracker;
