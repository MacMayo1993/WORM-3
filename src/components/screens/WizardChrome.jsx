// WizardChrome.jsx — shared visual chrome for every mode setup wizard.
//
// All four setup wizards (Freeplay/cube, Worm, Disparity, Random) share one look:
// a page torn from Mobi's graph-paper notebook, with the demo's step-preview line
// written across the top in Mobi's pencil hand. Each wizard keeps its own accent
// color; only the panel surface and the preview note are shared from here.

import React from 'react';
import { UI_FONT, HAND_FONT } from '../../utils/uiTheme.js';

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

// Pencil-lead ink used for the handwritten preview line (matches Mobi's dialogue).
const PENCIL_LEAD = '#35404a';

/**
 * WizardPreviewNote — the demo's step-preview line for this mode, tabbed with the
 * wizard's accent and set in Mobi's pencil hand so the panel reads as a note in
 * her notebook. Renders nothing when `text` is empty.
 */
export function WizardPreviewNote({ accent, text }) {
  if (!text) return null;
  return (
    <div
      style={{
        display: 'flex',
        gap: '11px',
        alignItems: 'center',
        margin: '0 0 20px',
        padding: '11px 14px',
        borderRadius: '10px',
        borderLeft: `3px solid ${accent}`,
        background: 'rgba(255,255,255,0.46)',
        boxShadow: 'inset 0 0 0 1px rgba(91,72,45,0.08)'
      }}
    >
      <span
        style={{
          fontFamily: UI_FONT,
          fontSize: '9px',
          fontWeight: 700,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: accent,
          opacity: 0.85,
          flexShrink: 0
        }}
      >
        Preview
      </span>
      <span style={{ fontFamily: HAND_FONT, fontSize: '18px', lineHeight: 1.25, color: PENCIL_LEAD }}>{text}</span>
    </div>
  );
}
