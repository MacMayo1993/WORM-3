import React, { useState, useEffect } from 'react';
import { COLORS } from '../../utils/constants.js';

const Tutorial = ({ onClose }) => {
  const [step, setStep] = useState(1);
  const totalSteps = 6;

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const stepContent = {
    1: {
      title: "Welcome to WORM³",
      content: (
        <>
          <p><b>WORM³</b> is a Rubik's Cube puzzle exploring <b>antipodal topology</b> on the real projective plane.</p>
          <p>Each sticker has a <b>permanent antipodal twin</b> that flips with it through wormholes!</p>
          <p>🪱 Look for the <b>wiggling worms</b> on flipped stickers—they show disparity that needs fixing!</p>
        </>
      )
    },
    2: {
      title: "Basic Controls",
      content: (
        <>
          <p><b>Rotate Cube:</b> Drag anywhere on the cube to rotate freely (360° rotation enabled!)</p>
          <p><b>Twist Slices:</b> Drag on a face to rotate rows, columns, or depth slices</p>
          <p><b>Face Twist:</b> Hold <b>Shift</b> while dragging to rotate the entire face</p>
          <p><b>On Mobile:</b> Simply tap and drag—full touch support!</p>
        </>
      )
    },
    3: {
      title: "Flipping Through Wormholes",
      content: (
        <>
          <p><b>Enable FLIP mode</b> (button at bottom), then tap/click any sticker to flip it!</p>
          <p>Colored tunnels connect antipodal pairs:</p>
          <ul style={{ margin: '8px 0', paddingLeft: '20px', fontSize: '14px' }}>
            <li><span style={{ color: COLORS.blue }}>Blue ↔ Green</span></li>
            <li><span style={{ color: COLORS.red }}>Red ↔ Orange</span></li>
            <li><span style={{ color: COLORS.yellow }}>Yellow ↔ White</span></li>
          </ul>
          <p>🪱 <b>Worms appear</b> when stickers are flipped—fix them by flipping back!</p>
        </>
      )
    },
    4: {
      title: "Keyboard Controls (Speedcubing)",
      content: (
        <>
          <p><b>Arrow Keys:</b> Move cursor across faces</p>
          <p><b>W/A/S/D:</b> Rotate slices relative to cursor position</p>
          <p><b>Q/E:</b> Rotate face counter-clockwise/clockwise</p>
          <p><b>F:</b> Flip sticker at cursor (when FLIP mode is on)</p>
          <p><b>Other shortcuts:</b> H (help), V (visual mode), C (chaos), X (explode), T (tunnels)</p>
        </>
      )
    },
    5: {
      title: "Chaos Mode & Special Features",
      content: (
        <>
          <p><b>CHAOS Mode:</b> Unstable flipped stickers randomly spread to neighbors—fight back by fixing disparity!</p>
          <p><b>EXPLODE:</b> Spread the cube apart to see internal structure</p>
          <p><b>TUNNELS:</b> Toggle visibility of wormhole connections</p>
          <p><b>Visual Modes:</b> Classic, Grid, Sudokube (Latin squares), or Wireframe</p>
          <p>Try different cube sizes: 3×3, 4×4, or 5×5!</p>
        </>
      )
    },
    6: {
      title: "Victory Conditions",
      content: (
        <>
          <p><b>🎲 Classic Victory:</b> Solve all faces to uniform colors</p>
          <p><b>🔢 Sudokube Victory:</b> Create Latin squares on all faces (no repeated numbers in rows/columns)</p>
          <p><b>👑 Ultimate Victory:</b> Achieve BOTH victories simultaneously!</p>
          <p><b>🪱 Secret WORM³ Victory:</b> Solve the entire cube where EVERY sticker has traveled through a wormhole!</p>
          <p style={{ marginTop: '12px', fontStyle: 'italic', fontSize: '13px', color: '#7f5539' }}>
            Good luck, topologist! Press SHUFFLE to begin.
          </p>
        </>
      )
    }
  };

  const currentStep = stepContent[step];

  return (
    <div className="tutorial-overlay">
      <div className="tutorial-card" style={{ maxWidth: '600px' }}>
        <h2 style={{ marginBottom: '4px' }}>{currentStep.title}</h2>
        <div style={{ fontSize: '11px', color: '#9c6644', marginBottom: '16px', letterSpacing: '0.1em' }}>
          Step {step} of {totalSteps}
        </div>
        <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
          {currentStep.content}
        </div>
        <div className="tutorial-actions" style={{ marginTop: '20px' }}>
          <button className="bauhaus-btn" onClick={onClose}>Skip Tutorial</button>
          <div style={{ display: 'flex', gap: '8px' }}>
            {step > 1 && (
              <button className="bauhaus-btn" onClick={() => setStep(s => s - 1)}>
                ← Back
              </button>
            )}
            {step < totalSteps ? (
              <button className="bauhaus-btn" onClick={() => setStep(s => s + 1)}>
                Next →
              </button>
            ) : (
              <button className="bauhaus-btn" onClick={onClose} style={{
                background: '#606c38',
                fontWeight: 700
              }}>
                Start Playing!
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Tutorial;
