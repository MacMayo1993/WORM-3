// MobiStage — the one dialogue look Mobi uses everywhere (mode intros, the demo,
// level briefings): Mobi peeking up bottom-left behind a full-width sheet of the
// same cream graph paper, dark-green ink and chunky arcade keys as the opening
// and the menus. Each line is "spoken" onto the page left to right (see
// mobiSpeech.js) while Mobi bobs; a tap on the line, or on Next, finishes it.
//
// Styles are inline and the keyframes injected once: this screen is in the
// initial bundle, and the initial CSS is capped by bundle:check.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  HEADING_FONT, DISPLAY_FONT, ARCADE_INK, ARCADE_INK_STRONG, ARCADE_PAPER, ARCADE_CARD,
  ARCADE_GRID, ARCADE_GRID_SIZE
} from '../../utils/uiTheme.js';
import { MODE_THEMES } from '../../utils/modeThemes.js';
import { speechSchedule, charsSpoken, speechDuration } from './mobiSpeech.js';

const STYLE_ID = 'mobi-stage-keyframes';
if (typeof document !== 'undefined' && !document.getElementById(STYLE_ID)) {
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = `
    @keyframes mobiStageIn { from { transform: translateX(-30px); opacity: 0; } to { transform: none; opacity: 1; } }
    @keyframes mobiStageOut { to { transform: translateX(-22px) scale(.95); opacity: 0; } }
    @keyframes mobiSheetIn { from { transform: translateY(18px); opacity: 0; } to { transform: none; opacity: 1; } }
    @keyframes mobiSheetOut { to { transform: translateY(12px); opacity: 0; } }
    @keyframes mobiTalk { 0%,100% { transform: translateY(0) rotate(0); } 30% { transform: translateY(-5px) rotate(-1deg); } 65% { transform: translateY(-2px) rotate(.6deg); } }
    @keyframes mobiCaret { 0%,100% { opacity: 1; } 50% { opacity: .2; } }
    @media (prefers-reduced-motion: reduce) { .mobi-stage * { animation: none !important; } }
  `;
  document.head.appendChild(s);
}

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Speaks `text` onto the page. Returns how many characters show, whether the
 * line is finished, and `finish()`, which shows it all at once and reports
 * whether there was anything left to show. It reads a ref, not state, so two
 * taps in one tick finish the line and then move on rather than finishing twice.
 */
export function useMobiSpeech(text) {
  const times = useMemo(() => speechSchedule(text ?? ''), [text]);
  const [shown, setShown] = useState(() => reducedMotion() ? times.length : 0);
  const doneRef = useRef(false);
  const raf = useRef(0);
  useEffect(() => {
    cancelAnimationFrame(raf.current);
    if (reducedMotion() || !times.length) { doneRef.current = true; setShown(times.length); return undefined; }
    doneRef.current = false;
    setShown(0);
    const started = performance.now();
    const end = speechDuration(times);
    const tick = now => {
      const elapsed = (now - started) / 1000;
      if (doneRef.current) return;
      setShown(charsSpoken(times, elapsed));
      if (elapsed < end) raf.current = requestAnimationFrame(tick);
      else doneRef.current = true;
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [times]);
  const finish = useCallback(() => {
    if (doneRef.current) return false;
    doneRef.current = true;
    cancelAnimationFrame(raf.current);
    setShown(times.length);
    return true;
  }, [times]);
  return { shown, done: shown >= times.length, finish };
}

// ── Arcade keys (the same plastic as the menus) ──────────────────────────────
const KEY = {
  minHeight: 48, padding: '0 18px', borderRadius: 14, border: `2px solid ${ARCADE_INK_STRONG}`,
  background: ARCADE_CARD, color: ARCADE_INK, boxShadow: `0 4px 0 ${ARCADE_INK_STRONG}, inset 0 2px 0 #fff`,
  font: `800 12px/1 ${HEADING_FONT}`, letterSpacing: '.08em', textTransform: 'uppercase',
  cursor: 'pointer', touchAction: 'manipulation', whiteSpace: 'nowrap'
};
const WORM = MODE_THEMES.worm;
const PRIMARY = {
  ...KEY, padding: '0 22px', background: WORM.accent, color: '#fffdf2', border: `3px solid ${ARCADE_INK}`,
  boxShadow: `0 5px 0 ${ARCADE_INK}, inset 0 3px 0 #ffffff55`, font: `400 15px/1 ${DISPLAY_FONT}`, letterSpacing: '.03em'
};
const press = e => { e.currentTarget.style.transform = 'translateY(3px)'; };
const release = e => { e.currentTarget.style.transform = 'none'; };

export function MobiKey({ primary = false, style, children, ...props }) {
  return <button type="button" {...props} style={{ ...(primary ? PRIMARY : KEY), ...style }}
    onPointerDown={press} onPointerUp={release} onPointerLeave={release}>{children}</button>;
}

/**
 * The stage itself. `line` is spoken; `index`/`count` drive the progress pips;
 * `tag` sits beside MOBI on the nameplate; `meta` renders above the line;
 * `actions` renders on the right of the footer (the caller's keys).
 */
export default function MobiStage({ line, lineKey, index = 0, count = 1, tag, meta, actions, dismissing = false, speech }) {
  const { shown, done, finish } = speech;
  const mobiSrc = `${import.meta.env.BASE_URL}Mobi.webp`;
  const mobiFallback = `${import.meta.env.BASE_URL}Mobi.png`;
  return <div className="mobi-stage" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
    <div style={{ position: 'absolute', bottom: 0, left: 0, zIndex: 1, lineHeight: 0,
      animation: dismissing ? 'mobiStageOut .25s ease forwards' : 'mobiStageIn .45s cubic-bezier(.16,1,.3,1) both' }}>
      <img src={mobiSrc} alt="Mobi" style={{ display: 'block', height: 'min(62dvh, 560px)', width: 'auto',
        transformOrigin: '50% 100%', animation: done ? 'none' : 'mobiTalk .42s ease-in-out infinite' }}
        onError={e => {
          if (e.currentTarget.src !== mobiFallback) e.currentTarget.src = mobiFallback;
          else e.currentTarget.style.display = 'none';
        }} />
    </div>

    <div onClick={e => e.stopPropagation()} style={{
      position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 2, pointerEvents: 'auto',
      minHeight: 'min(clamp(170px, 25vh, 236px), 65dvh)', maxHeight: 'calc(100dvh - 100px)',
      display: 'flex', flexDirection: 'column', boxSizing: 'border-box',
      padding: 'clamp(16px, 2.4vh, 22px) clamp(16px, 3vw, 32px) max(clamp(18px, 3vh, 28px), env(safe-area-inset-bottom, 0px))',
      backgroundColor: ARCADE_PAPER, backgroundImage: ARCADE_GRID, backgroundSize: ARCADE_GRID_SIZE,
      borderTop: `3px solid ${ARCADE_INK_STRONG}`, borderRadius: '22px 22px 0 0',
      boxShadow: `0 -6px 0 ${ARCADE_INK_STRONG}22, 0 -18px 44px ${ARCADE_INK_STRONG}30, inset 0 2px 0 #fff`,
      animation: dismissing ? 'mobiSheetOut .25s ease forwards' : 'mobiSheetIn .4s cubic-bezier(.16,1,.3,1) both'
    }}>
      {/* Nameplate: MOBI on an ink key, the mode or level beside it. */}
      <div style={{ position: 'absolute', top: -22, left: 'clamp(16px, 3vw, 32px)', display: 'flex', gap: 8, alignItems: 'center', pointerEvents: 'none' }}>
        <span style={{ padding: '8px 14px', borderRadius: 12, background: ARCADE_INK, color: '#fffdf2', border: `2px solid ${ARCADE_INK}`,
          boxShadow: `0 4px 0 ${ARCADE_INK}66`, font: `400 16px/1 ${DISPLAY_FONT}`, letterSpacing: '.06em' }}>MOBI</span>
        {tag && <span style={{ padding: '6px 10px', borderRadius: 10, background: ARCADE_CARD, color: ARCADE_INK,
          border: `2px solid ${ARCADE_INK_STRONG}`, font: `800 10px/1.1 ${HEADING_FONT}`, letterSpacing: '.1em', textTransform: 'uppercase',
          maxWidth: '52vw', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tag}</span>}
      </div>

      {meta}

      {/* The line. Every character is laid out from the start (unspoken ones are
          invisible) so the words never reflow as Mobi talks; the whole line is
          also given to screen readers at once. Tapping it finishes the line. */}
      <div key={lineKey} onClick={done ? undefined : finish} style={{ flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain',
        marginTop: 10, cursor: done ? 'default' : 'pointer' }}>
        <p style={{ margin: 0, font: `700 clamp(21px, 5vw, 31px)/1.36 ${HEADING_FONT}`, color: ARCADE_INK, letterSpacing: '-.005em' }}>
          <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)' }}>{line}</span>
          <span aria-hidden="true">
            {line.slice(0, shown)}
            {/* Zero-width anchor, so the caret can never push a word onto the next line. */}
            {!done && <span style={{ display: 'inline-block', width: 0, position: 'relative' }}>
              <span style={{ position: 'absolute', left: 2, bottom: '-.12em', width: '.42em', height: '.9em', borderRadius: 3,
                background: WORM.accent, animation: 'mobiCaret .5s steps(2) infinite' }} />
            </span>}
            <span style={{ visibility: 'hidden' }}>{line.slice(shown)}</span>
          </span>
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 12, flexWrap: 'wrap', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }} aria-hidden="true">
          {Array.from({ length: count }, (_, i) => <span key={i} style={{
            width: i === index ? 20 : 8, height: 8, borderRadius: 4, border: `2px solid ${ARCADE_INK_STRONG}`,
            background: i <= index ? WORM.accent : 'transparent', boxSizing: 'border-box', transition: 'width .3s'
          }} />)}
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>{actions}</div>
      </div>
    </div>
  </div>;
}
