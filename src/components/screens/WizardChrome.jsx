// WizardChrome.jsx — shared visual chrome and layout for every mode setup wizard.
//
// All four setup wizards (Freeplay/cube, Worm, Disparity, Random) share one look:
// a page torn from Mobi's graph-paper notebook. They also shared four hand-copied
// versions of the same overlay/sheet/header/body/footer styles, which is how they
// drifted apart on phones — one full-bleed at 92vh, one floating at 88vh with
// desktop padding. The layout lives here now, so a phone fix lands in all of them
// at once. Each wizard still owns its accent and its own content styles.

import React from 'react';
import { UI_FONT, PAPER_BACKDROP, PAPER_BACKDROP_BLUR, PAPER_BORDER, PAPER_TEXT, PAPER_TEXT_MUTED, PAPER_TEXT_FAINT, PAPER_CARD_SHADOW, PAPER_SHADOW, TEXT_MICRO, TEXT_XS, TEXT_SM, TEXT_MD, TEXT_XL, Z } from '../../utils/uiTheme.js';
import { TOUCH_TARGET } from '../ui/index.js';
import { isMobile } from '../../utils/device.js';

// Graph-paper panel background — the exact recipe from the Mobi dialogue panel
// (MobiIntroScreen): a warm paper base, a fine 18px grid, a 90px major grid, and
// a soft corner highlight + diagonal wash. Spread onto a wizard's sheet in place
// of the flat cream fill.
const GRAPH_LINE = 'rgba(80, 142, 190, 0.20)';
const GRAPH_MAJOR = 'rgba(80, 142, 190, 0.32)';
export const WIZARD_PAPER_BASE = '#fbf7e9';

export const wizardPaperBackground = {
  backgroundColor: WIZARD_PAPER_BASE,
  backgroundImage: [
    `linear-gradient(${GRAPH_LINE} 1px, transparent 1px)`,
    `linear-gradient(90deg, ${GRAPH_LINE} 1px, transparent 1px)`,
    `linear-gradient(${GRAPH_MAJOR} 1px, transparent 1px)`,
    `linear-gradient(90deg, ${GRAPH_MAJOR} 1px, transparent 1px)`,
    'radial-gradient(circle at 16% 8%, rgba(255,255,255,0.6), transparent 34%)',
    'linear-gradient(160deg, rgba(255,255,255,0.34), rgba(219,205,176,0.16))'
  ].join(','),
  backgroundSize: '18px 18px, 18px 18px, 90px 90px, 90px 90px, 100% 100%, 100% 100%',
  backgroundPosition: '0 0, 0 0, -1px -1px, -1px -1px, 0 0, 0 0'
};

// Translucent paper wash for the footer strip: the action buttons keep a base to
// sit on while the graph grid still reads faintly through it.
export const WIZARD_FOOTER_BG = 'rgba(245, 238, 222, 0.82)';

// Pencil-lead ink used for handwritten copy on this paper (matches Mobi's dialogue).
// Exported so any screen writing on the paper — the store's footer note, for one —
// uses the same lead rather than picking its own grey.
export const PENCIL_LEAD = '#35404a';

/**
 * Layout styles shared by every wizard, tinted with the caller's accent and its
 * darker pressed-state companion.
 *
 * On a phone the sheet is the screen: full-bleed, square corners, and padded for
 * the home indicator. A setup wizard there is a task, not a dialog floating over
 * one — and the 24px of inset plus 16px of corner radius it used to spend were
 * coming straight out of the space the actual choices had to live in.
 *
 * `mobile` defaults to the static breakpoint (fine for a module-scope call), but
 * a wizard that wants to reflow on rotation passes a live value from
 * `useIsMobile()` and recomputes this per render.
 */
export function wizardLayout(accent, accentShadow = `${accent}99`, mobile = isMobile) {
  // Horizontal breathing room, matched between header, body, and footer so the
  // content sits on one margin down the whole sheet.
  const GUTTER = mobile ? 16 : 36;
  return {
    overlay: {
      position: 'fixed',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: PAPER_BACKDROP,
      backdropFilter: PAPER_BACKDROP_BLUR,
      WebkitBackdropFilter: PAPER_BACKDROP_BLUR,
      zIndex: Z.MODAL,
      fontFamily: UI_FONT,
      // dvh tracks the collapsing mobile URL bar; browsers without it fall back
      // to the inset:0 box, which is what this used to rely on entirely.
      height: '100dvh',
      padding: 0,
      boxSizing: 'border-box',
      animation: 'modalBackdropIn 0.22s ease'
    },

    sheet: {
      ...wizardPaperBackground,
      borderRadius: mobile ? 0 : '20px',
      width: mobile ? '100%' : 'min(640px, 96vw)',
      height: mobile ? '100%' : 'auto',
      maxHeight: mobile ? '100%' : '88vh',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      boxShadow: mobile ? 'none' : PAPER_SHADOW,
      border: mobile ? 'none' : '1px solid #cec8be',
      borderTop: `3px solid ${accent}`,
      animation: 'modalSheetIn 0.30s cubic-bezier(0.22, 1, 0.36, 1)'
    },

    header: {
      // Top padding clears the status bar / notch on a full-bleed phone sheet.
      padding: mobile
        ? `calc(12px + env(safe-area-inset-top)) ${GUTTER}px 0`
        : `28px ${GUTTER}px 0`,
      flexShrink: 0
    },

    stepIndicator: {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      marginBottom: mobile ? '12px' : '20px'
    },

    dot: (active, current) => ({
      height: mobile ? '5px' : '8px',
      borderRadius: '3px',
      background: current ? accent : active ? `${accent}66` : PAPER_BORDER,
      flex: current ? '2' : '1',
      transition: 'all 0.35s cubic-bezier(0.4,0,0.2,1)',
      boxShadow: current ? `0 1px 4px ${accent}55` : 'none'
    }),

    stepCount: {
      flexShrink: 0,
      marginLeft: '4px',
      fontSize: TEXT_MICRO,
      fontWeight: 800,
      letterSpacing: '0.12em',
      color: PAPER_TEXT_FAINT,
      fontVariantNumeric: 'tabular-nums'
    },

    title: {
      fontSize: mobile ? TEXT_XL - 3 : TEXT_XL,
      fontWeight: '700',
      letterSpacing: '-0.5px',
      color: PAPER_TEXT,
      margin: '0 0 2px',
      lineHeight: 1.15
    },

    subtitle: {
      fontSize: mobile ? TEXT_SM - 1 : TEXT_SM,
      color: PAPER_TEXT_MUTED,
      margin: mobile ? '0 0 12px' : '0 0 18px',
      fontWeight: '400',
      lineHeight: 1.35
    },

    body: {
      padding: `0 ${GUTTER}px`,
      overflowY: 'auto',
      overscrollBehavior: 'contain',
      WebkitOverflowScrolling: 'touch',
      flex: 1,
      scrollbarWidth: 'thin',
      scrollbarColor: `${PAPER_CARD_SHADOW} transparent`,
      // Fade the last few pixels so a list that continues under the footer reads
      // as scrollable instead of as a hard crop.
      maskImage: 'linear-gradient(to bottom, #000 calc(100% - 20px), transparent)',
      WebkitMaskImage: 'linear-gradient(to bottom, #000 calc(100% - 20px), transparent)'
    },

    footer: {
      padding: mobile
        ? `12px ${GUTTER}px calc(12px + env(safe-area-inset-bottom))`
        : `18px ${GUTTER}px 24px`,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: '8px',
      flexShrink: 0,
      borderTop: '1px solid #d6d0c8',
      background: WIZARD_FOOTER_BG
    },

    btnSecondary: {
      background: 'none',
      border: '1.5px solid #d6d0c8',
      fontSize: TEXT_MD,
      fontWeight: '500',
      color: PAPER_TEXT_MUTED,
      cursor: 'pointer',
      // Both footer buttons clear the 44px comfortable-tap floor; the secondary
      // one (Back) was the smaller of the two and the easier one to fat-finger.
      minHeight: TOUCH_TARGET,
      padding: mobile ? '11px 14px' : '10px 16px',
      borderRadius: '10px',
      transition: 'all 0.15s ease',
      fontFamily: 'inherit',
      WebkitTapHighlightColor: 'transparent'
    },

    btnPrimary: {
      background: accent,
      border: 'none',
      fontSize: TEXT_MD,
      fontWeight: '700',
      color: '#fff',
      cursor: 'pointer',
      minHeight: TOUCH_TARGET,
      padding: mobile ? '13px 24px' : '12px 28px',
      borderRadius: '10px',
      transition: 'all 0.12s ease',
      fontFamily: 'inherit',
      WebkitTapHighlightColor: 'transparent',
      boxShadow: `0 4px 0 ${accentShadow}, 0 6px 16px ${accent}44`
    }
  };
}

/**
 * Sticky heading for a long grouped list (tile styles, palettes). On a phone the
 * tile catalogue runs to several screens, and without this you lose track of
 * which family you are scrolling through.
 */
export function WizardSectionHeading({ children, style }) {
  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 2,
        margin: '0 0 8px',
        padding: '6px 0',
        fontSize: TEXT_MICRO,
        fontWeight: '700',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: PAPER_TEXT_FAINT,
        background: `linear-gradient(${WIZARD_PAPER_BASE} 70%, rgba(251,247,233,0))`,
        ...style
      }}
    >
      {children}
    </div>
  );
}

/**
 * One collapsible family in a long grouped list.
 *
 * The tile catalogue is ~90 styles in four families; laid out flat it is about
 * three thousand pixels of scrolling on a phone, and the family you actually
 * want is usually the one you are already using. Collapsed, each family is a
 * single tappable row, so the whole catalogue fits on one screen and opening a
 * family costs one tap.
 *
 * The header stays sticky while its own contents scroll, so a long open family
 * never leaves you wondering which one you are in. Pass `sticky={false}` where
 * something else already owns the top of the scroller — the wizards' cube plate
 * does — so two elements aren't competing for the same perch.
 */
export function WizardSection({ label, note, accent, open, onToggle, sticky = true, children }) {
  const ref = React.useRef(null);
  const wasOpen = React.useRef(open);

  // Opening a section that sits below the fold should bring it to you — the
  // family you just asked for is otherwise off-screen, under the one that
  // collapsed above it.
  React.useEffect(() => {
    if (open && !wasOpen.current) {
      ref.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
    wasOpen.current = open;
  }, [open]);

  return (
    <div
      ref={ref}
      style={{
        marginBottom: '8px',
        borderRadius: '12px',
        border: `1.5px solid ${open ? `${accent}55` : '#ded7cb'}`,
        background: open ? 'rgba(255,255,255,0.52)' : 'rgba(255,255,255,0.34)',
        boxShadow: open ? 'none' : `0 2px 0 ${PAPER_CARD_SHADOW}`,
        // Not `overflow: hidden` — that would trap the sticky header inside a
        // box that scrolls away, which is the whole thing it exists to avoid.
        // The header rounds its own corners instead.
        transition: 'border-color 0.18s ease, background 0.18s ease'
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="ui-focusable"
        style={{
          position: sticky ? 'sticky' : 'static',
          top: 0,
          zIndex: 2,
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          minHeight: TOUCH_TARGET,
          padding: '13px 12px',
          background: open ? 'rgba(252,249,241,0.97)' : 'transparent',
          border: 'none',
          borderRadius: open ? '11px 11px 0 0' : '11px',
          borderBottom: open ? '1px solid #e4ddd0' : 'none',
          cursor: 'pointer',
          fontFamily: 'inherit',
          textAlign: 'left',
          WebkitTapHighlightColor: 'transparent'
        }}
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          style={{
            flexShrink: 0,
            transform: open ? 'rotate(90deg)' : 'none',
            transition: 'transform 0.2s cubic-bezier(0.22,1,0.36,1)'
          }}
          aria-hidden="true"
        >
          <path d="M3 1L7 5L3 9" fill="none" stroke={open ? accent : PAPER_TEXT_FAINT} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span
          style={{
            flex: 1,
            fontSize: TEXT_XS,
            fontWeight: 800,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: open ? accent : PAPER_TEXT_MUTED
          }}
        >
          {label}
        </span>
        {note && (
          <span style={{ fontSize: TEXT_MICRO, fontWeight: 600, color: PAPER_TEXT_FAINT, flexShrink: 0 }}>{note}</span>
        )}
      </button>
      {open && <div style={{ padding: '10px 10px 12px' }}>{children}</div>}
    </div>
  );
}

/**
 * Progress bars plus a step count. The count is the part that survives on a
 * phone, where the bars get thin enough to read as decoration.
 */
export function WizardSteps({ styles, steps, step }) {
  return (
    <div style={styles.stepIndicator}>
      {steps.map((_, i) => (
        <div key={i} style={styles.dot(i <= step, i === step)} />
      ))}
      <span style={styles.stepCount}>{step + 1}/{steps.length}</span>
    </div>
  );
}
