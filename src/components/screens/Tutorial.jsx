import React, { useState, useEffect } from 'react';
import { COLORS } from '../../utils/constants.js';

const Tutorial = ({ onClose }) => {
  const [step, setStep] = useState(1);
  const totalSteps = 9;

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Shared image style
  const imageStyle = {
    width: '100%',
    maxWidth: '280px',
    borderRadius: '8px',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    margin: '8px auto',
    display: 'block'
  };

  const imageRowStyle = {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center',
    flexWrap: 'wrap',
    margin: '12px 0'
  };

  const smallImageStyle = {
    ...imageStyle,
    maxWidth: '180px'
  };

  const stepContent = {
    1: {
      title: "Welcome to WORM³",
      content: (
        <>
          <p><b>WORM³</b> is a Rubik's Cube puzzle with a twist—literally through <b>wormholes</b>!</p>
          <p>Before we dive in, let's understand the key concept that makes this puzzle unique: <b>antipodal pairs</b>.</p>
          <p style={{ fontSize: '13px', marginTop: '12px', fontStyle: 'italic', color: 'rgba(255, 255, 255, 0.7)' }}>
            Don't worry—it's simpler than it sounds!
          </p>
        </>
      )
    },
    2: {
      title: "What Are Antipodal Pairs?",
      content: (
        <>
          <p>On any Rubik's Cube, every color has an <b>opposite</b>—the color on the face directly across from it. These opposites are called <b>antipodal pairs</b>.</p>

          <div style={{
            background: 'rgba(255, 255, 255, 0.08)',
            borderRadius: '8px',
            padding: '12px',
            margin: '12px 0',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            <p style={{ margin: '0 0 8px 0', fontWeight: 600, fontSize: '13px', color: 'rgba(255, 255, 255, 0.9)' }}>The Three Antipodal Pairs:</p>
            <div style={{ display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: '8px' }}>
              <span><span style={{ color: COLORS.red }}>●</span> Red ↔ Orange <span style={{ color: COLORS.orange }}>●</span></span>
              <span><span style={{ color: COLORS.green }}>●</span> Green ↔ Blue <span style={{ color: COLORS.blue }}>●</span></span>
              <span><span style={{ color: COLORS.white }}>●</span> White ↔ Yellow <span style={{ color: COLORS.yellow }}>●</span></span>
            </div>
          </div>

          <p>Think of it like the Earth: if you're standing on one spot, your <b>antipodal point</b> is the exact opposite side of the planet—where you'd end up if you dug straight through!</p>

          <img
            src="/images/tutorial/solved-cube.png"
            alt="Solved Rubik's cube showing green and orange faces"
            style={imageStyle}
            onError={(e) => { e.target.style.display = 'none'; }}
          />
          <p style={{ fontSize: '12px', textAlign: 'center', color: 'rgba(255, 255, 255, 0.6)', marginTop: '4px' }}>
            A solved cube—green face visible, orange on the left (its pair, blue, is hidden on the right)
          </p>
        </>
      )
    },
    3: {
      title: "The Wormhole Connection",
      content: (
        <>
          <p>In WORM³, antipodal stickers are <b>linked through wormholes</b>. When you flip one sticker, its antipodal partner flips too!</p>

          <p>Watch what happens when we flip the green center sticker:</p>

          <div style={imageRowStyle}>
            <div style={{ textAlign: 'center' }}>
              <img
                src="/images/tutorial/flip-result.png"
                alt="Cube after flip - green sticker now shows blue"
                style={smallImageStyle}
                onError={(e) => { e.target.style.display = 'none'; }}
              />
              <p style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.6)', margin: '4px 0 0 0' }}>Green → Blue</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <img
                src="/images/tutorial/exploded-tunnel.png"
                alt="Exploded view showing wormhole tunnel between antipodal stickers"
                style={smallImageStyle}
                onError={(e) => { e.target.style.display = 'none'; }}
              />
              <p style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.6)', margin: '4px 0 0 0' }}>The wormhole tunnel</p>
            </div>
          </div>

          <p>The <b>tunnel</b> shows the wormhole connection. Both the green sticker AND its blue antipodal partner swapped colors simultaneously!</p>

          <p style={{ fontSize: '13px', marginTop: '8px', color: 'rgba(255, 255, 255, 0.7)' }}>
            <b>Key insight:</b> You're not just changing one sticker—you're affecting TWO stickers on opposite sides of the cube!
          </p>
        </>
      )
    },
    4: {
      title: "Basic Controls",
      content: (
        <>
          <p><b>Rotate Cube:</b> Drag anywhere to rotate freely in any direction (360° rotation!)</p>
          <p><b>Twist Slices:</b> Drag on a face to rotate rows, columns, or depth slices</p>
          <p><b>Face Twist:</b> Hold <b>Shift</b> while dragging to rotate the entire face clockwise/counter-clockwise</p>
          <p><b>On Mobile:</b> Simply tap and drag—full touch support with responsive UI!</p>
          <p style={{ fontSize: '13px', marginTop: '8px', color: 'rgba(255, 255, 255, 0.7)' }}>
            <b>Tip:</b> You can drag in any direction continuously without hitting rotation limits
          </p>
        </>
      )
    },
    5: {
      title: "Flipping Through Wormholes",
      content: (
        <>
          <p><b>Enable FLIP mode</b> (button at bottom), then tap/click any sticker to flip it!</p>

          <img
            src="/images/tutorial/chaos-tunnels.png"
            alt="Exploded cube showing multiple wormhole tunnels during chaos"
            style={imageStyle}
            onError={(e) => { e.target.style.display = 'none'; }}
          />
          <p style={{ fontSize: '12px', textAlign: 'center', color: 'rgba(255, 255, 255, 0.6)', marginTop: '4px' }}>
            Multiple wormhole tunnels connecting flipped antipodal pairs
          </p>

          <p>Tunnels get <b>thicker and brighter</b> with more flips, and occasionally spark with electricity!</p>
          <p><b>Tally marks</b> appear on stickers showing how many times they've been flipped.</p>
          <p><b>Right-click</b> (or long-press on mobile) to flip without enabling FLIP mode.</p>
        </>
      )
    },
    6: {
      title: "Visual Modes",
      content: (
        <>
          <p>Press the <b>CLASSIC</b> button or press <b>V</b> to cycle through visual modes:</p>
          <ul style={{ margin: '8px 0', paddingLeft: '20px', fontSize: '14px', lineHeight: '1.8' }}>
            <li><b>Classic:</b> Traditional Rubik's Cube appearance with solid colors</li>
            <li><b>Grid:</b> Manifold IDs overlaid (M1-001 format) showing topology</li>
            <li><b>Sudokube:</b> Latin square numbers (1-3 for 3×3) on each face</li>
            <li><b>Wireframe:</b> Skeletal view with LED-style edges</li>
          </ul>
          <p><b>EXPLODE:</b> Spread the cube apart to see wormhole connections clearly!</p>
          <p><b>TUNNELS:</b> Toggle wormhole visibility (press <b>T</b>)</p>
        </>
      )
    },
    7: {
      title: "Chaos Mode",
      content: (
        <>
          <p><b>CHAOS Mode</b> makes unstable flipped stickers spread to their neighbors!</p>
          <ul style={{ margin: '6px 0', paddingLeft: '20px', fontSize: '13px', lineHeight: '1.7' }}>
            <li><b>Level 1:</b> 1-second bursts, 3% spread per flip tally</li>
            <li><b>Level 2:</b> 2-second bursts, 6% spread per flip tally</li>
            <li><b>Level 3:</b> 3-second bursts, 9% spread per flip tally</li>
            <li><b>Level 4:</b> 4-second bursts, 12% spread—extreme chaos!</li>
          </ul>
          <p><b>AUTO Mode:</b> Enable within chaos for automatic rotations based on cube instability!</p>
          <ul style={{ margin: '4px 0', paddingLeft: '20px', fontSize: '12px' }}>
            <li>Stable cube = 10 seconds between rotations</li>
            <li>Chaotic cube = as fast as 0.75 seconds!</li>
          </ul>
          <p style={{ fontSize: '13px', marginTop: '8px', color: 'rgba(255, 255, 255, 0.7)' }}>
            The Tetris-style preview shows your next incoming rotation!
          </p>
        </>
      )
    },
    8: {
      title: "Keyboard Controls",
      content: (
        <>
          <p><b>Arrow Keys:</b> Move cursor across faces (wraps around edges!)</p>
          <p><b>Slice Rotations:</b></p>
          <ul style={{ margin: '4px 0', paddingLeft: '20px', fontSize: '13px' }}>
            <li><b>W/S:</b> Rotate column slice up/down</li>
            <li><b>A/D:</b> Rotate row slice left/right</li>
            <li><b>Q/E:</b> Rotate face counter-clockwise/clockwise</li>
          </ul>
          <p><b>Quick Toggles:</b></p>
          <ul style={{ margin: '4px 0', paddingLeft: '20px', fontSize: '13px' }}>
            <li><b>F</b> - Flip sticker at cursor</li>
            <li><b>G</b> - Toggle flip mode</li>
            <li><b>C</b> - Toggle chaos mode</li>
            <li><b>X</b> - Toggle explode view</li>
            <li><b>T</b> - Toggle tunnels</li>
            <li><b>V</b> - Cycle visual modes</li>
            <li><b>Space</b> - Shuffle | <b>R</b> - Reset</li>
            <li><b>H</b> or <b>?</b> - Help | <b>Esc</b> - Close menus</li>
          </ul>
        </>
      )
    },
    9: {
      title: "Victory Conditions",
      content: (
        <>
          <p>Four different ways to win—each more challenging!</p>
          <ul style={{ margin: '8px 0', paddingLeft: '20px', fontSize: '14px', lineHeight: '1.8' }}>
            <li><b>Classic:</b> Solve all faces to uniform colors</li>
            <li><b>Sudokube:</b> Valid Latin squares on all faces (no repeated numbers in rows/columns)</li>
            <li><b>Ultimate:</b> Both Classic AND Sudokube simultaneously!</li>
            <li><b>WORM³:</b> Solve with every sticker having traveled through a wormhole at least once!</li>
          </ul>
          <p style={{ marginTop: '12px', padding: '12px', background: 'rgba(59, 130, 246, 0.15)', borderRadius: '8px', fontSize: '13px', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
            <b>Tip:</b> Use <b>SHUFFLE</b> to start a new game. Achievement badges appear when you complete each victory type!
          </p>
          <p style={{ marginTop: '12px', fontStyle: 'italic', fontSize: '13px', color: 'rgba(255, 255, 255, 0.7)', textAlign: 'center' }}>
            Good luck, topologist! Press SHUFFLE to begin.
          </p>
        </>
      )
    }
  };

  const currentStep = stepContent[step];

  return (
    <div className="tutorial-overlay">
      <div className="tutorial-card" style={{ maxWidth: '620px', maxHeight: '80vh', overflowY: 'auto' }}>
        <h2 style={{ marginBottom: '4px', color: 'rgba(255, 255, 255, 0.95)', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>{currentStep.title}</h2>
        <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '16px', letterSpacing: '0.08em', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
          Step {step} of {totalSteps}
        </div>
        <div style={{ fontSize: '14px', lineHeight: '1.6', color: 'rgba(255, 255, 255, 0.9)', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
          {currentStep.content}
        </div>
        <div className="tutorial-actions" style={{ marginTop: '20px' }}>
          <button className="bauhaus-btn" onClick={onClose}>Skip Tutorial</button>
          <div style={{ display: 'flex', gap: '8px' }}>
            {step > 1 && (
              <button className="bauhaus-btn" onClick={() => setStep(s => s - 1)}>
                Back
              </button>
            )}
            {step < totalSteps ? (
              <button className="bauhaus-btn" onClick={() => setStep(s => s + 1)}>
                Next
              </button>
            ) : (
              <button className="bauhaus-btn" onClick={onClose} style={{
                background: 'rgba(16, 185, 129, 0.85)',
                borderColor: 'rgba(52, 211, 153, 0.5)',
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
