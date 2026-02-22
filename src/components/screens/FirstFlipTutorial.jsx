import React, { useState } from 'react';
import { FACE_COLORS } from '../../utils/constants.js';

const FirstFlipTutorial = ({ onClose }) => {
  const [step, setStep] = useState(0);

  const colors = {
    ink: '#582f0e',
    inkMedium: '#7f5539',
    burntOrange: '#bc6c25',
    avocado: '#606c38',
    paper: '#f2e8cf',
    paperCream: '#fefae0'
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(88, 47, 14, 0.7)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 2000,
      fontFamily: 'Georgia, serif',
      height: '100dvh',
      padding: 'env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px) env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px)',
      boxSizing: 'border-box'
    }}>
      <div style={{
        background: colors.paper,
        border: `3px solid ${colors.burntOrange}`,
        borderRadius: '4px',
        padding: '32px 40px',
        maxWidth: '580px',
        width: '90%',
        maxHeight: 'calc(100dvh - 60px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))',
        overflow: 'auto',
        boxShadow: `4px 4px 0 rgba(88, 47, 14, 0.2), 0 12px 40px rgba(88, 47, 14, 0.4)`,
        boxSizing: 'border-box'
      }}>
        <h2 style={{
          margin: '0 0 8px 0',
          fontSize: '28px',
          fontStyle: 'italic',
          fontWeight: 700,
          color: colors.ink,
          textAlign: 'center'
        }}>
          {step === 0 && "You Just Made an Antipodal Flip!"}
          {step === 1 && "Antipodal Pairs"}
          {step === 2 && "Parity & Orientation"}
          {step === 3 && "Chaos Mode"}
          {step === 4 && "The Art of Solving"}
        </h2>

        <p style={{
          textAlign: 'center',
          fontSize: '11px',
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          color: colors.burntOrange,
          margin: '0 0 24px 0'
        }}>
          {step === 0 && "Your first flip through the manifold"}
          {step === 1 && "Every point has an opposite"}
          {step === 2 && "The mathematics of flipping"}
          {step === 3 && "When the manifold fights back"}
          {step === 4 && "Speed, strategy & elegance"}
        </p>

        <div style={{
          background: colors.paperCream,
          border: `1px solid rgba(188, 108, 37, 0.3)`,
          padding: '20px 24px',
          marginBottom: '24px',
          fontSize: '15px',
          lineHeight: 1.8,
          color: colors.inkMedium
        }}>
          {step === 0 && (
            <>
              <p style={{ margin: '0 0 16px 0' }}>
                That color flip you just witnessed? You sent a sticker through an <strong style={{ color: colors.ink }}>antipodal tunnel</strong> —
                a path connecting opposite points on the cube's surface.
              </p>
              <p style={{ margin: '0 0 16px 0' }}>
                In the <strong style={{ color: colors.ink }}>Real Projective Plane</strong>, opposite points are considered
                <em> the same point</em>. Walking infinitely far in any direction brings you back — but <em>inverted</em>.
              </p>
              <p style={{ margin: 0, fontStyle: 'italic', color: colors.burntOrange }}>
                "Imagine walking so far you return from the other side..."
              </p>
            </>
          )}

          {step === 1 && (
            <>
              <p style={{ margin: '0 0 16px 0' }}>
                Each face has a partner on the opposite side of the cube:
              </p>
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '24px',
                margin: '16px 0',
                fontSize: '14px'
              }}>
                <span><span style={{ color: FACE_COLORS[1] }}>■</span> Red ↔ Orange <span style={{ color: FACE_COLORS[4] }}>■</span></span>
                <span><span style={{ color: FACE_COLORS[5] }}>■</span> Blue ↔ Green <span style={{ color: FACE_COLORS[2] }}>■</span></span>
                <span><span style={{ color: FACE_COLORS[3] }}>■</span> White ↔ Yellow <span style={{ color: FACE_COLORS[6] }}>■</span></span>
              </div>
              <p style={{ margin: '16px 0 0 0' }}>
                When you flip a sticker, it transforms into its <strong style={{ color: colors.ink }}>antipodal color</strong>.
                The small circle on flipped tiles shows their <em>original</em> color — a breadcrumb trail of their journey.
              </p>
            </>
          )}

          {step === 2 && (
            <>
              <p style={{ margin: '0 0 16px 0' }}>
                Notice the <strong style={{ color: colors.avocado }}>EVEN</strong> / <strong style={{ color: colors.burntOrange }}>ODD</strong> indicator?
                That's <strong style={{ color: colors.ink }}>parity</strong> — the mathematical signature of your flips.
              </p>
              <p style={{ margin: '0 0 16px 0' }}>
                • <strong>Even parity:</strong> The cube can return to its original state<br />
                • <strong>Odd parity:</strong> Something is fundamentally "twisted"
              </p>
              <p style={{ margin: '0 0 16px 0' }}>
                The <strong style={{ color: colors.ink }}>tally marks</strong> on each sticker count its journeys through the manifold.
                A tile flipped 1000 times carries a different history than a fresh tile — even if they show the same color!
              </p>
              <p style={{ margin: 0, fontStyle: 'italic' }}>
                This is <em>orientation</em>: the hidden memory of transformation.
              </p>
            </>
          )}

          {step === 3 && (
            <>
              <p style={{ margin: '0 0 16px 0' }}>
                <strong style={{ color: '#9c4a1a' }}>Chaos Mode</strong> introduces <em>instability</em>.
                Flipped tiles at the cube's edges can spontaneously cascade to their neighbors!
              </p>
              <p style={{ margin: '0 0 16px 0' }}>
                <strong>Levels 1-4</strong> control how aggressively chaos spreads:
              </p>
              <ul style={{ margin: '0 0 16px 0', paddingLeft: '24px' }}>
                <li>L1: Gentle — occasional cascades</li>
                <li>L2: Moderate — regular spreading</li>
                <li>L3: Aggressive — rapid propagation</li>
                <li>L4: Maximum entropy — constant chaos</li>
              </ul>
              <p style={{ margin: 0 }}>
                Watch the <strong>Instability Tracker</strong> — when it goes critical, expect fireworks!
              </p>
            </>
          )}

          {step === 4 && (
            <>
              <p style={{ margin: '0 0 16px 0' }}>
                <strong style={{ color: colors.ink }}>Solving faster</strong> isn't just about speed — it's about <em>understanding the structure</em>.
              </p>
              <p style={{ margin: '0 0 16px 0' }}>
                <strong>Tips for mastery:</strong>
              </p>
              <ul style={{ margin: '0 0 16px 0', paddingLeft: '24px' }}>
                <li>Use <strong>EXPLODE</strong> view to see all antipodal connections</li>
                <li>Track parity — plan flips to maintain even state when possible</li>
                <li>In Chaos Mode, work from center outward to minimize cascades</li>
                <li>The <strong>face progress bars</strong> show which colors need attention</li>
              </ul>
              <p style={{ margin: 0, fontStyle: 'italic', color: colors.burntOrange }}>
                The topology is your friend once you learn to see it. Good luck, explorer!
              </p>
            </>
          )}
        </div>

        {/* Step indicators */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '8px',
          marginBottom: '20px'
        }}>
          {[0, 1, 2, 3, 4].map(i => (
            <div
              key={i}
              onClick={() => setStep(i)}
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: step === i ? colors.burntOrange : 'rgba(188, 108, 37, 0.3)',
                cursor: 'pointer',
                transition: 'background 0.2s'
              }}
            />
          ))}
        </div>

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '12px'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 24px',
              background: 'transparent',
              border: `2px solid ${colors.burntOrange}`,
              color: colors.burntOrange,
              fontFamily: 'Georgia, serif',
              fontSize: '14px',
              fontWeight: 600,
              letterSpacing: '0.1em',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            Skip
          </button>

          {step < 4 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              style={{
                padding: '10px 32px',
                background: colors.burntOrange,
                border: 'none',
                color: colors.paperCream,
                fontFamily: 'Georgia, serif',
                fontSize: '14px',
                fontWeight: 600,
                letterSpacing: '0.1em',
                cursor: 'pointer',
                boxShadow: `0 2px 0 #9c4a1a`,
                transition: 'all 0.2s'
              }}
            >
              Next →
            </button>
          ) : (
            <button
              onClick={onClose}
              style={{
                padding: '10px 32px',
                background: colors.avocado,
                border: 'none',
                color: colors.paperCream,
                fontFamily: 'Georgia, serif',
                fontSize: '14px',
                fontWeight: 600,
                letterSpacing: '0.1em',
                cursor: 'pointer',
                boxShadow: `0 2px 0 #283618`,
                transition: 'all 0.2s'
              }}
            >
              Start Exploring!
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default FirstFlipTutorial;
