import React, { useState } from 'react';
import { FACE_COLORS } from '../../utils/constants.js';
import {
  UI_FONT, PAPER_BACKDROP, PAPER_BACKDROP_BLUR, PAPER_SHEET, PAPER_BORDER,
  PAPER_BORDER_SOFT, PAPER_TEXT, PAPER_TEXT_MUTED, PAPER_TEXT_FAINT,
  PAPER_BG_MUTED, PAPER_CARD_SHADOW, PAPER_SHADOW, UI_MOSS,
 Z } from '../../utils/uiTheme.js';

const FONT = UI_FONT;

const steps = [
  {
    title: "You Just Made an Antipodal Flip!",
    subtitle: "Your first journey through the manifold",
    content: (
      <>
        <p style={{ margin: '0 0 14px 0' }}>
          That color change you just saw? You sent a sticker through an <strong>antipodal tunnel</strong>—a wormhole connecting two opposite points on the cube's surface.
        </p>
        <p style={{ margin: '0 0 14px 0' }}>
          In WORM³, opposite faces of the cube are secretly linked. Flip a sticker on one face and its partner on the opposite face changes color simultaneously.
        </p>
        <p style={{ margin: 0, color: PAPER_TEXT_FAINT, fontStyle: 'italic' }}>
          "Walk far enough in any direction and you return from the other side—inverted."
        </p>
      </>
    ),
  },
  {
    title: "Antipodal Pairs",
    subtitle: "Every point has an opposite",
    content: (
      <>
        <p style={{ margin: '0 0 14px 0' }}>Each face is permanently paired with the face directly across from it:</p>
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '20px',
          margin: '0 0 14px 0',
          fontSize: '14px',
          flexWrap: 'wrap',
        }}>
          <span><span style={{ color: FACE_COLORS[1] }}>■</span> Red ↔ Orange <span style={{ color: FACE_COLORS[4] }}>■</span></span>
          <span><span style={{ color: FACE_COLORS[5] }}>■</span> Blue ↔ Green <span style={{ color: FACE_COLORS[2] }}>■</span></span>
          <span><span style={{ color: FACE_COLORS[3] }}>■</span> White ↔ Yellow <span style={{ color: FACE_COLORS[6] }}>■</span></span>
        </div>
        <p style={{ margin: '0 0 10px 0' }}>
          When a sticker flips, it takes on its <strong>antipodal color</strong>. The small dot on a flipped sticker shows its original color—a breadcrumb of where it came from.
        </p>
        <p style={{ margin: 0, color: PAPER_TEXT_FAINT }}>
          Every flip affects two stickers at once: one on each side of the cube.
        </p>
      </>
    ),
  },
  {
    title: "Parity & Orientation",
    subtitle: "The mathematics of flipping",
    content: (
      <>
        <p style={{ margin: '0 0 14px 0' }}>
          The <strong>EVEN / ODD</strong> parity indicator tracks the mathematical signature of all your flips combined.
        </p>
        <p style={{ margin: '0 0 14px 0' }}>
          <strong>Even parity</strong> — the cube can return to its original state through flips alone.<br />
          <strong>Odd parity</strong> — something is fundamentally "twisted" and needs an odd number of additional flips to unwind.
        </p>
        <p style={{ margin: '0 0 14px 0' }}>
          <strong>Tally marks</strong> on each sticker count how many times it has traveled through the manifold. Two stickers showing the same color can have entirely different histories.
        </p>
        <p style={{ margin: 0, color: PAPER_TEXT_FAINT, fontStyle: 'italic' }}>
          This hidden memory of transformation is called <em>orientation</em>.
        </p>
      </>
    ),
  },
  {
    title: "Chaos Mode",
    subtitle: "When the manifold fights back",
    content: (
      <>
        <p style={{ margin: '0 0 14px 0' }}>
          <strong>Chaos Mode</strong> introduces instability. Flipped stickers at the edges of face groups can spontaneously cascade to their neighbors.
        </p>
        <p style={{ margin: '0 0 10px 0' }}>Levels 1–5 control how aggressively chaos spreads:</p>
        <ul style={{ margin: '0 0 14px 0', paddingLeft: '20px', fontSize: '13px', lineHeight: 1.7 }}>
          <li><strong>L1:</strong> Gentle — occasional cascades</li>
          <li><strong>L2:</strong> Moderate — regular spreading</li>
          <li><strong>L3:</strong> Aggressive — rapid propagation</li>
          <li><strong>L4:</strong> Heavy sustained chaos</li>
          <li><strong>L5:</strong> Deep-manifold surges — strong hops with pacing control</li>
        </ul>
        <p style={{ margin: 0, color: PAPER_TEXT_FAINT }}>
          Toggle Chaos Mode with the <strong>C</strong> key or the Chaos button in the menu.
        </p>
      </>
    ),
  },
  {
    title: "The Art of Solving",
    subtitle: "Speed, strategy & elegance",
    content: (
      <>
        <p style={{ margin: '0 0 10px 0' }}>Tips for mastering WORM³:</p>
        <ul style={{ margin: '0 0 14px 0', paddingLeft: '20px', fontSize: '13px', lineHeight: 1.8 }}>
          <li>Use <strong>Explode view (X)</strong> to see all antipodal connections clearly</li>
          <li>Track parity — plan flips to stay on even parity when possible</li>
          <li>In Chaos Mode, work from the center outward to minimize cascade spread</li>
          <li>For WORM³ victory, ensure every sticker has flipped before your final solve</li>
          <li>Use <strong>Teach Mode</strong> (available for 3×3) to learn step-by-step algorithms</li>
        </ul>
        <p style={{ margin: 0, color: PAPER_TEXT_FAINT, fontStyle: 'italic' }}>
          The topology is your friend once you learn to see it. Good luck, explorer!
        </p>
      </>
    ),
  },
];

const FirstFlipTutorial = ({ onClose, onMainMenu }) => {
  const [step, setStep] = useState(0);
  const cur = steps[step];
  const total = steps.length;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: PAPER_BACKDROP,
      backdropFilter: PAPER_BACKDROP_BLUR,
      WebkitBackdropFilter: PAPER_BACKDROP_BLUR,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: Z.MODAL_RAISED,
      fontFamily: FONT,
      height: '100dvh',
      padding: 'env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px) env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px)',
      boxSizing: 'border-box',
    }}>
      <div style={{
        background: PAPER_SHEET,
        border: `1px solid ${PAPER_BORDER}`,
        borderRadius: '20px',
        padding: '32px 36px',
        maxWidth: '560px',
        width: '90%',
        maxHeight: 'calc(100dvh - 60px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))',
        overflow: 'auto',
        boxShadow: PAPER_SHADOW,
        boxSizing: 'border-box',
        color: PAPER_TEXT,
      }}>
        <h2 style={{
          margin: '0 0 4px 0',
          fontSize: '22px',
          fontWeight: 800,
          color: PAPER_TEXT,
          letterSpacing: '-0.01em',
        }}>
          {cur.title}
        </h2>

        <p style={{
          textAlign: 'left',
          fontSize: '11px',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: PAPER_TEXT_FAINT,
          margin: '0 0 20px 0',
        }}>
          {cur.subtitle}
        </p>

        <div style={{
          background: PAPER_BG_MUTED,
          border: `1px solid ${PAPER_BORDER_SOFT}`,
          borderRadius: '12px',
          padding: '18px 20px',
          marginBottom: '22px',
          fontSize: '14px',
          lineHeight: 1.7,
          color: PAPER_TEXT_MUTED,
        }}>
          {cur.content}
        </div>

        {/* Step dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '7px', marginBottom: '20px' }}>
          {steps.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setStep(i)}
              style={{
                width: i === step ? '20px' : '6px',
                height: '6px',
                borderRadius: '100px',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                background: i === step ? UI_MOSS : PAPER_CARD_SHADOW,
                transition: 'width 300ms cubic-bezier(0.34,1.56,0.64,1), background 300ms ease',
                boxShadow: 'none',
                WebkitTapHighlightColor: 'transparent',
              }}
            />
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '10px 22px',
              border: `1.5px solid ${PAPER_BORDER_SOFT}`,
              background: PAPER_BG_MUTED,
              color: PAPER_TEXT_MUTED,
              fontFamily: FONT,
              fontSize: '12px',
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              borderRadius: '100px',
              transition: 'background 0.15s ease, border-color 0.15s ease, color 0.15s ease',
              WebkitTapHighlightColor: 'transparent',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#b8b2aa'; e.currentTarget.style.color = PAPER_TEXT; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = PAPER_BORDER_SOFT; e.currentTarget.style.color = PAPER_TEXT_MUTED; }}
          >
            Skip
          </button>

          {step < total - 1 ? (
            <button
              type="button"
              onClick={() => setStep(s => s + 1)}
              style={{
                padding: '10px 28px',
                border: 'none',
                background: UI_MOSS,
                color: '#fffdf5',
                fontFamily: FONT,
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                borderRadius: '100px',
                transition: 'background 0.15s ease, border-color 0.15s ease',
                WebkitTapHighlightColor: 'transparent',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#6b8f53'; }}
              onMouseLeave={e => { e.currentTarget.style.background = UI_MOSS; }}
            >
              Next →
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '10px 28px',
                border: 'none',
                background: UI_MOSS,
                color: '#fffdf5',
                fontFamily: FONT,
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                borderRadius: '100px',
                transition: 'background 0.15s ease, border-color 0.15s ease',
                WebkitTapHighlightColor: 'transparent',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#6b8f53'; }}
              onMouseLeave={e => { e.currentTarget.style.background = UI_MOSS; }}
            >
              Start Exploring!
            </button>
          )}
        </div>

        {onMainMenu && (
          <div style={{ textAlign: 'center', marginTop: '14px' }}>
            <button
              type="button"
              onClick={onMainMenu}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: PAPER_TEXT_FAINT,
                fontSize: '12px',
                fontFamily: FONT,
                letterSpacing: '0.08em',
                padding: '4px 8px',
                transition: 'color 0.15s ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = PAPER_TEXT; }}
              onMouseLeave={e => { e.currentTarget.style.color = PAPER_TEXT_FAINT; }}
            >
              ← Main Menu
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default FirstFlipTutorial;
