import React, { useState, useEffect } from 'react';
import { COLORS } from '../../utils/constants.js';

const Tutorial = ({ onClose }) => {
  const [step, setStep] = useState(1);
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <div className="tutorial-overlay">
      <div className="tutorial-card">
        <h2>WORM³ — Quick Start</h2>
        {step === 1 && (
          <>
            <p>Click a sticker to flip <b>it</b> and its <b>permanent antipodal twin</b>.</p>
            <p>Colored tunnels appear showing each antipodal pair: <span style={{ color: COLORS.blue }}>Blue↔Green</span>, <span style={{ color: COLORS.red }}>Red↔Orange</span>, <span style={{ color: COLORS.yellow }}>Yellow↔White</span></p>
          </>
        )}
        {step === 2 && (
          <>
            <p>Drag on the cube to twist rows/columns/slices. <b>Antipodal pairs stay permanently linked</b> by original position.</p>
            <p>Tunnels gradient from one color to its antipodal partner, with up to 50 strands per connection!</p>
          </>
        )}
        {step === 3 && (
          <>
            <p>Chaos Mode spreads flips to <b>N-S-E-W neighbors</b>—fight the cascade.</p>
            <p><b>Explode</b> view reveals the structure. Good luck, topologist!</p>
          </>
        )}
        <div className="tutorial-actions">
          <button className="bauhaus-btn" onClick={onClose}>Skip</button>
          {step < 3
            ? <button className="bauhaus-btn" onClick={() => setStep(s => s + 1)}>Next</button>
            : <button className="bauhaus-btn" onClick={onClose}>Let's play</button>}
        </div>
      </div>
    </div>
  );
};

export default Tutorial;
