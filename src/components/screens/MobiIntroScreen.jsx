// src/components/screens/MobiIntroScreen.jsx
/**
 * MobiIntroScreen — Civ 6-style dialogue: full-width panel at bottom,
 * character portrait on the left peaking above, nameplate tab on top-left edge.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { UI_FONT, HAND_FONT, Z } from '../../utils/uiTheme.js';

// ── Dialogue banks ────────────────────────────────────────────────────────────

// Demo cold open — the framing beat before step 1. Sets up the game's one
// core promise (opposite tiles are twins) so the player twists the first cube
// knowing why, then hands off to the interactive steps.
//
// Deliberately jargon-free: no "antipodal", no "manifold", no topology. The
// idea a first-timer needs is spatial, not mathematical — "the tile dead
// opposite this one is the same tile" — so every line points at the cube
// instead of at the theory. The formal name shows up once, later, as an aside
// (TWIN_ASIDE in demoStepCopy.js).
export const MOBI_LINES_DEMO_INTRO = [
  "Aloha! I'm Mobi.",
  "Looks like an ordinary Rubik's cube, right? Look again.",
  "Pick a tile. Now find the tile dead opposite it — straight through the middle.",
  "Those two are twins. Tap one and it travels through the cube to the other.",
  "That's the whole trick. Let me show you, then you pick where to play.",
];

export const MOBI_LINES_WORM = [
  "Aloha! I'm a Multi Orientable Block Intelligence...",
  "...but you can call me Mobi for short!",
  "This ain't your mama's old Nokia SNAKE game — this is WORM³",
  "In my world...Rubik's cubes are flat",
  "But then one day....",
  "We uncovered the TRUE secret of the cube.",
  "Each tile has a twin!  And they can switch places!",
  "But not for too long....",
];

export const MOBI_LINES_FREEPLAY = [
  "Aloha! I'm a Multi Orientable Block Intelligence...",
  "...but you can call me Mobi for short!",
  "Welcome to Freeplay — the cube on your terms.",
  "Scramble it, solve it, explore it. No objectives, no pressure.",
  "Flip Mode is your best friend here — toggle it on to visit a tile's twin on the opposite face.",
  "Ready? The cube's already shuffled. Dig in.",
];

export const MOBI_LINES_TEACH = [
  "Aloha! I'm a Multi Orientable Block Intelligence...",
  "...but you can call me Mobi for short!",
  "Welcome to Teach Mode — I'll walk you through this one step at a time.",
  "Three sub-modes: Guided, Demo, and Quiz. Start with Demo if you want to watch first.",
  "The beginner method uses layers — bottom, middle, then top. Simple in theory.",
  "Your move, student.",
];

export const MOBI_LINES_HOLONOMY = [
  "Aloha! I'm a Multi Orientable Block Intelligence...",
  "...but you can call me Mobi for short!",
  "Holonomy Mode — where the cube has a memory.",
  "On a flat surface, a rotation is just a rotation. But here? Space is curved.",
  "Trace a closed loop and you return... but your orientation may not.",
  "Explore what happens when geometry fights back.",
];

export const MOBI_LINES_MERGE = [
  "Aloha! I'm a Multi Orientable Block Intelligence...",
  "...but you can call me Mobi for short!",
  "Welcome to Merge Mode!",
  "Match identical tiles to merge them into higher values.",
  "Think 2048 — except the board is a Rubik's Cube. And it rotates.",
  "Plan your merges. The cube rewards patience over panic.",
];

export const MOBI_LINES_HOLLOW = [
  "Aloha! I'm a Multi Orientable Block Intelligence...",
  "...but you can call me Mobi for short!",
  "Hollow Void — the shell remains, the core is gone.",
  "Only the outer layer exists here. Rotate carefully.",
  "Solve the surface. Ignore the void within.",
];

export const MOBI_LINES_MIRROR = [
  "Aloha! I'm a Multi Orientable Block Intelligence...",
  "...but you can call me Mobi for short!",
  "Mirror Mode — every move you make, the other side mirrors it.",
  "Symmetry is both your tool and your constraint.",
  "Solve one half and the other follows. Or does it?",
];

export const MOBI_LINES_CHAOS = [
  "Aloha! I'm a Multi Orientable Block Intelligence...",
  "...but you can call me Mobi for short!",
  "Chaos Mode. Some tiles have already... wandered.",
  "Your job is to restore order — but the manifold has other ideas.",
  "Every flip you make, the chaos counter rises. Flip smart.",
  "You've placed your bet. Time to earn it.",
];

export const MOBI_LINES_CAMPAIGN = [
  "Aloha! I'm a Multi Orientable Block Intelligence...",
  "...but you can call me Mobi for short!",
  "Ten levels. Three rule sets. One manifold.",
  "Classic, Sudokube, Ultimate — each plays by different rules.",
  "The cube always has a solution. So do you.",
  "Let's begin.",
];

export const MOBI_LINES_COOP = [
  "Aloha! I'm a Multi Orientable Block Intelligence...",
  "...but you can call me Mobi for short!",
  "Co-op Mode — one cube, two minds.",
  "Coordinate. Don't cancel each other out.",
  "The manifold doesn't care about your disagreements.",
  "Solve it together.",
];

export const MOBI_LINES_BIOME = [
  "Aloha! I'm a Multi Orientable Block Intelligence...",
  "...but you can call me Mobi for short!",
  "Biome Mode — six faces, six ecosystems.",
  "Each face of the cube represents a living world.",
  "Solve the cube to restore balance across all biomes.",
  "Nature is watching.",
];

export const MOBI_LINES_RANDOM = [
  "Aloha! I'm a Multi Orientable Block Intelligence...",
  "...but you can call me Mobi for short!",
  "Random Mode — the cube picks the rules. You just solve it.",
  "Settings have been randomized. Embrace the chaos.",
  "Every run is different. Adapt.",
];

// ── CSS ───────────────────────────────────────────────────────────────────────
const _STYLE_ID = 'mobi-hud-keyframes';
if (typeof document !== 'undefined' && !document.getElementById(_STYLE_ID)) {
  const s = document.createElement('style');
  s.id = _STYLE_ID;
  s.textContent = `
    @keyframes mobiSlideIn {
      from { transform: translateX(-30px); opacity: 0; }
      to   { transform: translateX(0);     opacity: 1; }
    }
    @keyframes mobiDissolveOut {
      from { opacity: 1; transform: translateX(0) scale(1); }
      to   { opacity: 0; transform: translateX(-22px) scale(0.95); }
    }
    @keyframes panelRise {
      from { opacity: 0; transform: translateY(12px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes panelFadeDown {
      from { opacity: 1; transform: translateY(0); }
      to   { opacity: 0; transform: translateY(10px); }
    }
    @keyframes textFadeIn {
      from { opacity: 0; transform: translateY(2px); filter: blur(0.4px); }
      to   { opacity: 1; transform: translateY(0); filter: blur(0); }
    }
    @keyframes cursorBlink {
      0%,100% { opacity: 1; }
      50%      { opacity: 0; }
    }
    @keyframes pencilCursorWiggle {
      0%, 100% { transform: translateY(0) rotate(-7deg); }
      50% { transform: translateY(-1px) rotate(-3deg); }
    }
    @keyframes paperSettle {
      from { transform: translateY(16px) rotate(-0.4deg); opacity: 0; }
      to { transform: translateY(0) rotate(0deg); opacity: 1; }
    }
  `;
  document.head.appendChild(s);
}

// ── Main component ────────────────────────────────────────────────────────────

// Optional props for reuse beyond mode intros (demo step dialogues):
//   primaryLabel — overrides the last-line button label ('▶ Launch' default)
//   skipLabel    — overrides the secondary button label ('Skip' default)
//   onSkip       — alternate completion for the secondary button / Escape;
//                  falls back to onComplete when absent
//   topInset     — CSS length to start the overlay below (e.g. the top app
//                  bar's height). Dialogues that play while the in-game HUD is
//                  up pass this so the bar stays above the dim + blur instead
//                  of being buried under it.
const MobiIntroScreen = ({ lines, modeName, _accentColor, onComplete, primaryLabel, skipLabel, onSkip, topInset }) => {
  const [index, setIndex]           = useState(0);
  const [isDismissing, setDismissing] = useState(false);
  const isLast = index === lines.length - 1;

  // webp is ~10x smaller than the source png; fall back to png on decode error.
  const mobiImgSrc = `${import.meta.env.BASE_URL}Mobi.webp`;
  const mobiImgFallback = `${import.meta.env.BASE_URL}Mobi.png`;

  // Trigger dissolve then hand off to parent after animation finishes
  const dismiss = useCallback(() => {
    setDismissing(true);
    setTimeout(() => onComplete(), 750);
  }, [onComplete]);

  const skip = useCallback(() => {
    if (isDismissing) return;
    setDismissing(true);
    const done = onSkip || onComplete;
    setTimeout(() => done(), 750);
  }, [isDismissing, onSkip, onComplete]);

  const advance = useCallback(() => {
    if (isDismissing) return;
    if (isLast) dismiss();
    else setIndex(i => i + 1);
  }, [isDismissing, isLast, dismiss]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') {
        e.preventDefault();
        advance();
      } else if (e.key === 'Escape') {
        skip();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [advance, skip]);

  if (!lines || lines.length === 0) {
    onComplete();
    return null;
  }

  const accent      = 'rgba(98, 132, 164, 0.78)';
  const accentSolid = '#486f95';
  const pencilLead  = '#35404a';
  const paperBase   = '#fbf7e9';
  const graphLine   = 'rgba(80, 142, 190, 0.20)';
  const graphMajor  = 'rgba(80, 142, 190, 0.32)';
  const PANEL_H     = 'clamp(166px, 24vh, 230px)';
  const NAMEPLATE_H = 34;

  const mobiAnim = isDismissing
    ? 'mobiDissolveOut 0.55s ease forwards'
    : 'mobiSlideIn 0.45s cubic-bezier(0.16,1,0.3,1) forwards';

  const uiAnim = isDismissing
    ? 'panelFadeDown 0.35s ease forwards'
    : 'panelRise 0.4s cubic-bezier(0.16,1,0.3,1) forwards';

  return (
    <div
      onClick={advance}
      style={{
        position: 'fixed',
        inset: 0,
        // Docked below the top app bar when the caller asks for it, so the bar
        // (and its Home / Settings / far-side buttons) stays legible and
        // reachable above the dialogue rather than under its dim and blur.
        top: topInset || 0,
        // Above all in-game chrome (nav bar, HUD, mobile controls) — a Mobi
        // dialogue is a blocking beat; only demo shell overlays sit higher.
        zIndex: Z.INTRO,
        background: 'linear-gradient(to top, rgba(34, 31, 25, 0.38) 0%, rgba(34, 31, 25, 0.10) 42%, transparent 68%)',
        pointerEvents: isDismissing ? 'none' : 'auto',
        cursor: isDismissing ? 'default' : 'pointer',
      }}
    >
      {/* Background blur layer — always transitioning so backdrop-filter animates correctly */}
      <div style={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        backdropFilter:       isDismissing ? 'blur(0px)' : 'blur(5px)',
        WebkitBackdropFilter: isDismissing ? 'blur(0px)' : 'blur(5px)',
        transition: 'backdrop-filter 0.7s ease, -webkit-backdrop-filter 0.7s ease',
      }} />
      {/* ── Mobi portrait — bottom-left, behind panel (z:901 < panel z:903) ── */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        zIndex: 901,
        pointerEvents: 'none',
        lineHeight: 0,
        animation: mobiAnim,
      }}>
        <img
          src={mobiImgSrc}
          alt="Mobi"
          style={{ display: 'block', height: 'clamp(384px, 62vh, 672px)', width: 'auto' }}
          onError={e => {
            if (e.currentTarget.src !== mobiImgFallback) e.currentTarget.src = mobiImgFallback;
            else e.currentTarget.style.display = 'none';
          }}
        />
      </div>

      {/* ── Dialogue panel — full screen width, anchored at bottom ──
          The nameplate tab is rendered INSIDE this element (below), pinned to
          its top edge. It used to be a sibling positioned `bottom: PANEL_H`,
          which assumed the panel was exactly that tall — a long line wraps to
          more rows, the panel grows past PANEL_H, and the tab ended up sitting
          on top of the first line of dialogue. */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          minHeight: PANEL_H,
          backgroundColor: paperBase,
          backgroundImage: `
            linear-gradient(${graphLine} 1px, transparent 1px),
            linear-gradient(90deg, ${graphLine} 1px, transparent 1px),
            linear-gradient(${graphMajor} 1px, transparent 1px),
            linear-gradient(90deg, ${graphMajor} 1px, transparent 1px),
            radial-gradient(circle at 18% 24%, rgba(255,255,255,0.64), transparent 28%),
            linear-gradient(115deg, rgba(255,255,255,0.34), rgba(219,205,176,0.20))
          `,
          backgroundSize: '18px 18px, 18px 18px, 90px 90px, 90px 90px, 100% 100%, 100% 100%',
          backgroundPosition: '0 0, 0 0, -1px -1px, -1px -1px, 0 0, 0 0',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          borderTop: `2px solid ${accent}`,
          boxShadow: '0 -14px 42px rgba(48, 39, 28, 0.22), inset 0 1px 0 rgba(255,255,255,0.72)',
          zIndex: 903,
          pointerEvents: 'auto',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          paddingTop:    'clamp(12px, 2vh, 18px)',
          paddingLeft:   'clamp(16px, 3vw, 32px)',
          paddingRight:  'clamp(16px, 3vw, 32px)',
          paddingBottom: 'max(clamp(20px, 3.5vh, 30px), env(safe-area-inset-bottom, 0px))',
          boxSizing: 'border-box',
          animation: uiAnim,
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Nameplate tab — pinned to this panel's top edge, whatever its height */}
        <div style={{
          position: 'absolute',
          top: -(NAMEPLATE_H + 4),
          left: 0,
          pointerEvents: 'none',
          animation: isDismissing ? uiAnim : 'paperSettle 0.48s cubic-bezier(0.16,1,0.3,1) forwards',
        }}>
          {/* Outer layer = border color */}
          <div style={{
            background: accent,
            clipPath: 'polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%)',
            padding: '2px',
            display: 'inline-block',
          }}>
            {/* Inner layer = fill */}
            <div style={{
              background: paperBase,
              height: NAMEPLATE_H,
              padding: '0 22px 0 14px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              boxShadow: 'inset 0 0 0 1px rgba(91, 72, 45, 0.10)',
            }}>
              <span style={{
                fontFamily: UI_FONT,
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: pencilLead,
              }}>
                MOBI
              </span>
              <span style={{
                fontFamily: UI_FONT,
                fontSize: 9,
                fontWeight: 600,
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                color: accentSolid,
                opacity: 0.78,
              }}>
                {modeName || 'WORM MODE'}
              </span>
            </div>
          </div>
        </div>

        {/* Dialogue text */}
        <div
          key={index}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            animation: 'textFadeIn 0.2s ease forwards',
          }}
        >
          <p style={{
            margin: 0,
            fontFamily: HAND_FONT,
            fontSize: 'clamp(30px, 7vw, 42px)',
            fontWeight: '400',
            color: pencilLead,
            lineHeight: 1.45,
            letterSpacing: '0.02em',
            textShadow: '0.35px 0.35px 0 rgba(53,64,74,0.22), -0.25px 0 rgba(53,64,74,0.12)',
          }}>
            {lines[index]}
            <span style={{
              display: 'inline-block',
              width: '2px',
              height: '1em',
              background: pencilLead,
              marginLeft: '5px',
              verticalAlign: 'middle',
              opacity: 0.7,
              animation: 'cursorBlink 1s step-end infinite, pencilCursorWiggle 1.4s ease-in-out infinite',
            }} />
          </p>
        </div>

        {/* Footer: dots + buttons */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px' }}>
          <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
            {lines.map((_, i) => (
              <div key={i} style={{
                width: i === index ? '16px' : '5px',
                height: '5px',
                borderRadius: '3px',
                background: i === index ? accentSolid : 'rgba(72,111,149,0.24)',
                transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
              }} />
            ))}
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); skip(); }}
              style={{
                background: 'none',
                border: '1px solid rgba(53,64,74,0.22)',
                color: 'rgba(53,64,74,0.58)',
                fontSize: '11px',
                fontWeight: '500',
                padding: '5px 12px',
                borderRadius: '999px',
                cursor: 'pointer',
                fontFamily: UI_FONT,
                letterSpacing: '0.06em',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = pencilLead; e.currentTarget.style.borderColor = 'rgba(53,64,74,0.42)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'rgba(53,64,74,0.58)'; e.currentTarget.style.borderColor = 'rgba(53,64,74,0.22)'; }}
            >
              {skipLabel || 'Skip'}
            </button>

            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); advance(); }}
              style={{
                background: isLast ? pencilLead : 'rgba(251,247,233,0.72)',
                border: `1px solid ${accentSolid}`,
                color: isLast ? '#fbf7e9' : accentSolid,
                fontSize: '12px',
                fontWeight: '700',
                padding: '5px 20px',
                borderRadius: '999px',
                cursor: 'pointer',
                fontFamily: UI_FONT,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                boxShadow: isLast ? '0 6px 14px rgba(53,64,74,0.20)' : '0 3px 8px rgba(53,64,74,0.08)',
                transition: 'all 0.18s',
              }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 7px 16px rgba(53,64,74,0.24)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = isLast ? '0 6px 14px rgba(53,64,74,0.20)' : '0 3px 8px rgba(53,64,74,0.08)'; e.currentTarget.style.transform = 'none'; }}
            >
              {isLast ? (primaryLabel || '▶ Launch') : 'Next ▶'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MobiIntroScreen;
