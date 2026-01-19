import React, { useState, useEffect } from 'react';

const InstabilityTracker = ({ entropy, wormholes, chaosLevel }) => {
  const [pulse, setPulse] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPulse(Math.sin(Date.now() * 0.003) * 0.5 + 0.5);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  const instability = Math.min(100, entropy + wormholes * 3);
  const level = instability < 25 ? 'STABLE' : instability < 50 ? 'UNSTABLE' : instability < 75 ? 'CRITICAL' : 'CHAOS';
  const color = instability < 25 ? '#22c55e' : instability < 50 ? '#eab308' : instability < 75 ? '#f97316' : '#ef4444';

  return (
    <div className="instability-tracker">
      <div className="tracker-label">
        <span style={{ color }}>◆</span> {level}
      </div>
      <div className="tracker-bar-container">
        <div
          className="tracker-bar-fill"
          style={{
            width: `${instability}%`,
            background: `linear-gradient(90deg, ${color}, ${color}dd)`,
            opacity: 0.7 + pulse * 0.3
          }}
        />
      </div>
      <div className="tracker-value">{instability.toFixed(0)}%</div>
    </div>
  );
};

export default InstabilityTracker;
