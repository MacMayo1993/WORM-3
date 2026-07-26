// WizardChrome.jsx — shared visual chrome and layout for every mode setup wizard.
//
// All four setup wizards (Freeplay/cube, Worm, Disparity, Random) share one look:
// a page torn from Mobi's graph-paper notebook. They also shared four hand-copied
// versions of the same overlay/sheet/header/body/footer styles, which is how they
// drifted apart on phones — one full-bleed at 92vh, one floating at 88vh with
// desktop padding. The layout lives here now, so a phone fix lands in all of them
// at once. Each wizard still owns its accent and its own content styles.

import React from 'react';
import { UI_FONT, PAPER_BACKDROP, PAPER_BACKDROP_BLUR, PAPER_BORDER, PAPER_TEXT, PAPER_TEXT_MUTED, PAPER_TEXT_FAINT, PAPER_CARD_SHADOW, PAPER_SHADOW } from '../../utils/uiTheme.js';
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

// Horizontal breathing room, matched between header, body, and footer so the
// content sits on one margin down the whole sheet.
const GUTTER = isMobile ? 16 : 36;

/**
 * Layout styles shared by every wizard, tinted with the caller's accent and its
 * darker pressed-state companion.
 *
 * On a phone the sheet is the screen: full-bleed, square corners, and padded for
 * the home indicator. A setup wizard there is a task, not a dialog floating over
 * one — and the 24px of inset plus 16px of corner radius it used to spend were
 * coming straight out of the space the actual choices had to live in.
 */
export function wizardLayout(accent, accentShadow = `${accent}99`) {
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
      zIndex: 1000,
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
      borderRadius: isMobile ? 0 : '20px',
      width: isMobile ? '100%' : 'min(640px, 96vw)',
      height: isMobile ? '100%' : 'auto',
      maxHeight: isMobile ? '100%' : '88vh',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      boxShadow: isMobile ? 'none' : PAPER_SHADOW,
      border: isMobile ? 'none' : '1px solid #cec8be',
      borderTop: `3px solid ${accent}`,
      animation: 'modalSheetIn 0.30s cubic-bezier(0.22, 1, 0.36, 1)'
    },

    header: {
      // Top padding clears the status bar / notch on a full-bleed phone sheet.
      padding: isMobile
        ? `calc(12px + env(safe-area-inset-top)) ${GUTTER}px 0`
        : `28px ${GUTTER}px 0`,
      flexShrink: 0
    },

    stepIndicator: {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      marginBottom: isMobile ? '12px' : '20px'
    },

    dot: (active, current) => ({
      height: isMobile ? '5px' : '8px',
      borderRadius: '3px',
      background: current ? accent : active ? `${accent}66` : PAPER_BORDER,
      flex: current ? '2' : '1',
      transition: 'all 0.35s cubic-bezier(0.4,0,0.2,1)',
      boxShadow: current ? `0 1px 4px ${accent}55` : 'none'
    }),

    stepCount: {
      flexShrink: 0,
      marginLeft: '4px',
      fontSize: '9px',
      fontWeight: 800,
      letterSpacing: '0.12em',
      color: PAPER_TEXT_FAINT,
      fontVariantNumeric: 'tabular-nums'
    },

    title: {
      fontSize: isMobile ? '21px' : '24px',
      fontWeight: '700',
      letterSpacing: '-0.5px',
      color: PAPER_TEXT,
      margin: '0 0 2px',
      lineHeight: 1.15
    },

    subtitle: {
      fontSize: isMobile ? '12px' : '13px',
      color: PAPER_TEXT_MUTED,
      margin: isMobile ? '0 0 12px' : '0 0 18px',
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
      padding: isMobile
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
      fontSize: isMobile ? '14px' : '15px',
      fontWeight: '500',
      color: PAPER_TEXT_MUTED,
      cursor: 'pointer',
      padding: isMobile ? '11px 14px' : '10px 16px',
      borderRadius: '10px',
      transition: 'all 0.15s ease',
      fontFamily: 'inherit',
      WebkitTapHighlightColor: 'transparent'
    },

    btnPrimary: {
      background: accent,
      border: 'none',
      fontSize: isMobile ? '15px' : '15px',
      fontWeight: '700',
      color: '#fff',
      cursor: 'pointer',
      padding: isMobile ? '13px 24px' : '12px 28px',
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
        fontSize: '10px',
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
