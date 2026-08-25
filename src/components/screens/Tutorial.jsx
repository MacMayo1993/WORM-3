import React, { useState, useEffect } from 'react';
import { COLORS } from '../../utils/constants.js';
import { UI_FONT, NIGHT_TEXT, NIGHT_TEXT_MUTED } from '../../utils/uiTheme.js';

const Tutorial = ({ onClose, onMainMenu }) => {
  const [step, setStep] = useState(1);
  const totalSteps = 9;

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const stepContent = {
    1: {
      title: "Welcome to WORM³",
      content: (
        <>
          <p><b>WORM³</b> is a Rubik's Cube puzzle built on real projective plane topology—every face is secretly connected to its opposite through <b>wormholes</b>.</p>
          <p>Flip a sticker and it travels through the manifold, swapping color with its <b>antipodal partner</b> on the opposite side of the cube.</p>
          <p>Solve the cube while managing these wormhole connections—that's what makes WORM³ unique.</p>
        </>
      )
    },
    2: {
      title: "What Are Antipodal Pairs?",
      content: (
        <>
          <p>Every face on the cube has an opposite directly across from it. These opposites are <b>antipodal pairs</b>—they share a wormhole connection.</p>

          <div style={{
            background: 'rgba(255, 255, 255, 0.06)',
            borderRadius: '10px',
            padding: '12px',
            margin: '12px 0',
            border: '1px solid rgba(255, 255, 255, 0.10)'
          }}>
            <p style={{ margin: '0 0 8px 0', fontWeight: 700, fontSize: '13px', color: 'rgba(255, 255, 255, 0.85)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>The Three Antipodal Pairs:</p>
            <div style={{ display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: '8px' }}>
              <span><span style={{ color: COLORS.red }}>●</span> Red ↔ Orange <span style={{ color: COLORS.orange }}>●</span></span>
              <span><span style={{ color: COLORS.green }}>●</span> Green ↔ Blue <span style={{ color: COLORS.blue }}>●</span></span>
              <span><span style={{ color: COLORS.white }}>●</span> White ↔ Yellow <span style={{ color: COLORS.yellow }}>●</span></span>
            </div>
          </div>

          <p>Think of the Earth: your antipodal point is the exact opposite side of the planet—where you'd emerge if you dug straight through. In WORM³, flipping a sticker sends it on exactly that journey.</p>
          <p style={{ fontSize: '13px', color: NIGHT_TEXT_MUTED }}><b>Small circle on a sticker</b> = its original color, a breadcrumb of its journey through the manifold.</p>
        </>
      )
    },
    3: {
      title: "The Wormhole Connection",
      content: (
        <>
          <p>When you flip a sticker, a glowing <b>tunnel</b> appears connecting it to its antipodal partner. Both stickers swap colors simultaneously—you're changing two points at once.</p>

          <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '10px', padding: '12px', margin: '12px 0', border: '1px solid rgba(255,255,255,0.10)', fontSize: '13px', lineHeight: 1.7 }}>
            <p style={{ margin: '0 0 6px 0' }}>Tunnels grow <b>thicker and brighter</b> the more times a pair has been flipped.</p>
            <p style={{ margin: '0 0 6px 0' }}><b>Tally marks</b> on each sticker count its total wormhole journeys.</p>
            <p style={{ margin: 0 }}>Press <b>T</b> or use the Tunnels button to toggle tunnel visibility.</p>
          </div>

          <p style={{ fontSize: '13px', color: NIGHT_TEXT_MUTED }}>
            <b>Key insight:</b> Every flip affects two stickers on opposite sides of the cube. Plan accordingly!
          </p>
        </>
      )
    },
    4: {
      title: "Basic Controls",
      content: (
        <>
          <p><b>Rotate Cube:</b> Drag anywhere on the canvas to spin the cube freely in any direction.</p>
          <p><b>Twist a Slice:</b> Drag directly on a sticker to rotate that row, column, or depth slice.</p>
          <p><b>Face Twist:</b> Hold <b>Shift</b> while dragging on a face to rotate the entire face clockwise or counter-clockwise.</p>
          <p><b>Undo:</b> Use the Undo button (or the undo control in the menu) to reverse your last move.</p>
          <p><b>On Mobile:</b> Tap and drag for all interactions—full touch support with responsive layout.</p>
        </>
      )
    },
    5: {
      title: "Flipping Through Wormholes",
      content: (
        <>
          <p>Press <b>G</b> or tap the <b>Flip</b> button to toggle Flip Mode. In Flip Mode, tapping any sticker sends it through the wormhole.</p>
          <p><b>Right-click</b> (or <b>long-press</b> on mobile) to flip a single sticker without enabling Flip Mode globally.</p>
          <p>In Flip Mode with the keyboard cursor active, press <b>F</b> to flip the sticker under the cursor.</p>

          <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '10px', padding: '12px', margin: '12px 0', border: '1px solid rgba(255,255,255,0.10)', fontSize: '13px', lineHeight: 1.7 }}>
            <p style={{ margin: '0 0 4px 0' }}>Every flip is tracked—tally marks accumulate on each sticker.</p>
            <p style={{ margin: 0 }}>The WORM³ victory condition requires <em>every</em> sticker to have flipped at least once.</p>
          </div>
        </>
      )
    },
    6: {
      title: "Visual Modes",
      content: (
        <>
          <p>Press <b>V</b> to cycle through four visual modes:</p>
          <ul style={{ margin: '8px 0', paddingLeft: '20px', fontSize: '14px', lineHeight: '1.8' }}>
            <li><b>Classic:</b> Standard face colors—the familiar Rubik's Cube look</li>
            <li><b>Grid:</b> Manifold IDs overlaid on each sticker (M1-001 format)</li>
            <li><b>Sudokube:</b> Numbers on each face (1–9 for 3×3, 1–16 for 4×4)</li>
            <li><b>Colors:</b> Custom color palette from your settings applied to the cube</li>
          </ul>
          <p><b>Explode (X):</b> Spread the cubies apart to see all wormhole tunnel connections clearly.</p>
          <p><b>Tunnels (T):</b> Toggle the glowing wormhole tunnel visualization on or off.</p>
          <p><b>Net Panel (N):</b> Open a flat 2D map showing all six faces unfolded.</p>
        </>
      )
    },
    7: {
      title: "Chaos Mode",
      content: (
        <>
          <p>Press <b>C</b> or use the Chaos button to toggle <b>Chaos Mode</b>. Flipped stickers become unstable and can cascade to neighboring stickers over time.</p>
          <ul style={{ margin: '6px 0', paddingLeft: '20px', fontSize: '13px', lineHeight: '1.7' }}>
            <li><b>Level 1:</b> Gentle, occasional cascades</li>
            <li><b>Level 2:</b> Moderate, regular spreading</li>
            <li><b>Level 3:</b> Aggressive chain propagation</li>
            <li><b>Level 4:</b> Heavy sustained chaos</li>
            <li><b>Level 5:</b> Deep-manifold surges — strong hops with pacing</li>
          </ul>
          <p><b>AUTO Mode:</b> The cube rotates automatically based on instability — fast when chaotic, slow when stable.</p>
          <p style={{ fontSize: '13px', color: NIGHT_TEXT_MUTED, marginTop: '6px' }}>
            Chaos mode is used in the CHAOS game mode and can be toggled freely in Classic and Free Play.
          </p>
        </>
      )
    },
    8: {
      title: "Keyboard Controls",
      content: (
        <>
          <p><b>Arrow Keys:</b> Move the cursor across stickers (wraps around face edges!)</p>
          <p><b>Slice Rotations:</b></p>
          <ul style={{ margin: '4px 0', paddingLeft: '20px', fontSize: '13px' }}>
            <li><b>W / S:</b> Rotate column slice up / down</li>
            <li><b>A / D:</b> Rotate row slice left / right</li>
            <li><b>Q / E:</b> Rotate face counter-clockwise / clockwise</li>
          </ul>
          <p><b>Quick Toggles:</b></p>
          <ul style={{ margin: '4px 0', paddingLeft: '20px', fontSize: '13px' }}>
            <li><b>F</b> — Flip sticker at cursor (requires Flip Mode on)</li>
            <li><b>G</b> — Toggle Flip Mode on / off</li>
            <li><b>C</b> — Toggle Chaos Mode</li>
            <li><b>V</b> — Cycle visual mode (Classic → Grid → Sudokube → Colors)</li>
            <li><b>X</b> — Toggle explode view</li>
            <li><b>T</b> — Toggle tunnel visibility</li>
            <li><b>N</b> — Toggle net panel (flat 2D cube map)</li>
            <li><b>H</b> or <b>?</b> — Help &nbsp;|&nbsp; <b>Esc</b> — Close menus</li>
          </ul>
        </>
      )
    },
    9: {
      title: "Victory Conditions",
      content: (
        <>
          <p>Four ways to win—mix and match for the ultimate challenge:</p>
          <ul style={{ margin: '8px 0', paddingLeft: '20px', fontSize: '14px', lineHeight: '1.8' }}>
            <li><b>Classic:</b> All six faces show a single uniform color</li>
            <li><b>Sudokube:</b> Every face shows all its numbers once — 1–9 on a 3×3, no repeats</li>
            <li><b>Ultimate:</b> Classic AND Sudokube simultaneously — the hardest challenge</li>
            <li><b>WORM³:</b> Solve the cube after every sticker has traveled through a wormhole at least once</li>
          </ul>
          <p style={{ marginTop: '12px', padding: '12px', background: 'rgba(168, 85, 247, 0.12)', borderRadius: '10px', fontSize: '13px', border: '1px solid rgba(168, 85, 247, 0.28)' }}>
            <b>Tip:</b> Hit <b>SHUFFLE</b> in the menu to scramble and start a new game. Victory badges unlock as you achieve each condition!
          </p>
        </>
      )
    }
  };

  const currentStep = stepContent[step];

  return (
    <div className="tutorial-overlay">
      <div className="tutorial-card" style={{ maxWidth: '620px' }}>
        <h2 style={{ marginBottom: '4px', color: '#e8edf8', fontFamily: UI_FONT, fontWeight: 800, letterSpacing: '-0.01em' }}>{currentStep.title}</h2>
        <div style={{ fontSize: '11px', color: NIGHT_TEXT_MUTED, marginBottom: '16px', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: UI_FONT }}>
          Step {step} of {totalSteps}
        </div>
        <div style={{ fontSize: '14px', lineHeight: '1.65', color: NIGHT_TEXT, fontFamily: UI_FONT }}>
          {currentStep.content}
        </div>
        <div className="tutorial-actions" style={{ marginTop: '20px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button className="bauhaus-btn" onClick={onClose}>Skip Tutorial</button>
            {onMainMenu && (
              <button className="bauhaus-btn" onClick={onMainMenu} style={{ opacity: 0.7 }}>
                Main Menu
              </button>
            )}
          </div>
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
