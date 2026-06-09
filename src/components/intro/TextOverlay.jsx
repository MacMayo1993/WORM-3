import React, { useMemo } from 'react';

const ease     = t => t < 0.5 ? 4 * t ** 3 : 1 - Math.pow(-2 * t + 2, 3) / 2;
const clamp01  = t => Math.max(0, Math.min(1, t));
const fadeWin  = (t, start, end, dur = 0.22) =>
  Math.min(ease(clamp01((t - start) / dur)), ease(clamp01((end - t) / dur)));

// Antipodal color palette — W O R M
const C = ['#ef4444', '#f97316', '#22c55e', '#3b82f6'];

// One word at a time. "FLIP" holds much longer.
const SEQUENCE = [
  { text: "DON'T",   start: 0.5,  end: 1.2,  c: 0 },
  { text: 'JUST',    start: 1.3,  end: 2.0,  c: 1 },
  { text: 'THINK',   start: 2.1,  end: 2.8,  c: 2 },
  { text: 'OUTSIDE', start: 2.9,  end: 3.6,  c: 3 },
  { text: 'THE',     start: 3.7,  end: 4.4,  c: 0 },
  { text: 'BOX',     start: 4.5,  end: 5.9,  c: 1 },
  { text: 'FLIP',    start: 6.4,  end: 8.3,  c: 2 }, // long hold — tile flip phase
  { text: 'THROUGH', start: 8.8,  end: 9.6,  c: 3 },
  { text: 'THE',     start: 9.7,  end: 10.4, c: 0 },
];

// WORM³ logo drops in after "THE", stays through the end
const LOGO_START = 10.6;

const TextOverlay = ({ time }) => {
  const word = useMemo(() => {
    for (const w of SEQUENCE) {
      const op = fadeWin(time, w.start, w.end);
      if (op > 0.005) return { ...w, opacity: op };
    }
    return null;
  }, [time]);

  const showLogo = time >= LOGO_START;

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      {/* Single word — centered, large, Bungee */}
      {word && (
        <div style={{
          opacity: word.opacity,
          color: C[word.c],
          fontFamily: "'Bungee', cursive",
          fontSize: 'clamp(64px, 16vw, 108px)',
          letterSpacing: '0.04em',
          textShadow: `0 0 48px ${C[word.c]}90, 0 2px 10px rgba(0,0,0,0.9)`,
          transition: 'opacity 0.08s linear',
          userSelect: 'none',
        }}>
          {word.text}
        </div>
      )}

      {/* WORM³ — same as main menu: Bungee letters + 3D cube sup */}
      {showLogo && (
        <div style={{
          position: 'absolute',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
        }}>
          <div style={{ display: 'flex', transform: 'skewX(-5deg)' }}>
            <span className="worm-title-letter" style={{ '--bounce-delay': '0s',    color: '#ef4444', fontSize: 'clamp(64px, 16vw, 108px)', letterSpacing: '2px', lineHeight: 1 }}>W</span>
            <span className="worm-title-letter" style={{ '--bounce-delay': '0.12s', color: '#f97316', fontSize: 'clamp(64px, 16vw, 108px)', letterSpacing: '2px', lineHeight: 1 }}>O</span>
            <span className="worm-title-letter" style={{ '--bounce-delay': '0.24s', color: '#22c55e', fontSize: 'clamp(64px, 16vw, 108px)', letterSpacing: '2px', lineHeight: 1 }}>R</span>
            <span className="worm-title-letter" style={{ '--bounce-delay': '0.36s', color: '#3b82f6', fontSize: 'clamp(64px, 16vw, 108px)', letterSpacing: '2px', lineHeight: 1 }}>M</span>
          </div>
          {/* Scaled 3D cube superscript */}
          <div style={{ position: 'relative', width: '22px', height: '22px', alignSelf: 'flex-start', marginLeft: '4px', marginTop: '6px', flexShrink: 0 }}>
            <div style={{ position: 'absolute', top: 0, left: 0, transform: 'scale(0.70)', transformOrigin: 'top left' }}>
              <div className="worm-cube-sup" style={{ marginLeft: 0 }}>
                <div className="worm-cube-inner">
                  <div className="worm-cube-face worm-cube-face--front">3</div>
                  <div className="worm-cube-face worm-cube-face--right">3</div>
                  <div className="worm-cube-face worm-cube-face--top">3</div>
                  <div className="worm-cube-face worm-cube-face--back" />
                  <div className="worm-cube-face worm-cube-face--left">3</div>
                  <div className="worm-cube-face worm-cube-face--bottom" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TextOverlay;
