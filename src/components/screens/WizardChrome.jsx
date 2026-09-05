// WizardChrome.jsx — shared visual chrome and layout for every mode setup wizard.
//
// All four setup wizards (Freeplay/cube, Worm, Disparity, Random) share one look
// and, since the stack below, one shell: they hand <WizardShell> their categories
// and their accent and it draws the whole sheet. They used to hand-copy the
// overlay/sheet/header/body/footer JSX four times, which is how they drifted
// apart on phones — one full-bleed at 92vh, one floating at 88vh with desktop
// padding.
//
// ── The layout ────────────────────────────────────────────────────────────────
// Everything stacks, full width, in the order you make the decisions in:
//
//     mode bar          ← back, and which mode you are configuring
//     specimen          ← the live cube (or worm), edge to edge
//     family chips      ← horizontally scrolling, only where a category has them
//     category bar      ← Character · Scene · Colors · Style · Size · Play
//     the choices       ← the scrolling grid
//     one wide action   ← confirm and go on
//
// This replaced a vertical rail down the left edge. The rail kept every category
// in view — which is the thing worth keeping, and the category bar still does it
// — but it did so by taking a quarter of a phone's width off the pane for its
// whole height, so the cube sat in a column narrower than the grid beneath it and
// the bottom half of the rail was empty paper. A phone has width to spend and
// height to hoard; this spends the width.
//
// ── The dark ──────────────────────────────────────────────────────────────────
// The wizards used to be a page from Mobi's graph-paper notebook. They are now a
// dark instrument panel: the specimen plate was already a lit case on the NIGHT
// surface, the cube previews and tile shaders are all emissive, and every one of
// them read better with the paper taken out from behind it. The paper exports
// below stay put — the store, level select, the pack screen and the merge picker
// are still notebook pages, and this is not their change.
//
// The grid survives the move. Same 18px/90px ruling, drawn in the mode's accent
// at a few percent over near-black, so a wizard still reads as ruled paper —
// backlit rather than printed.

import React from 'react';
import { UI_FONT, PAPER_BACKDROP_BLUR, PAPER_TEXT_FAINT, TEXT_MICRO, TEXT_XS, TEXT_SM, TEXT_XL, Z } from '../../utils/uiTheme.js';
import { TOUCH_TARGET } from '../ui/index.js';
import { isMobile } from '../../utils/device.js';

// ─── Paper (kept for the notebook screens) ────────────────────────────────────
// Graph-paper panel background — the exact recipe from the Mobi dialogue panel
// (MobiIntroScreen): a warm paper base, a fine 18px grid, a 90px major grid, and
// a soft corner highlight + diagonal wash. Still worn by the store, level select,
// the pack picker and the merge theme picker; no longer by the wizards.
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

// ─── The wizard's dark surface ────────────────────────────────────────────────
//
// One family, used by the chrome here and by every step's cards (wizardSteps).
// Deliberately neutral rather than a second accent: the mode's own colour does
// the accenting, and six of the app's palettes end up on screen at once in the
// palette step. Alphas over the base rather than opaque hexes, so a card sitting
// on the ruled ground still shows the ruling through it.

export const WIZ_BASE = '#0c0f14';
export const WIZ_SURFACE = 'rgba(255,255,255,0.045)';
export const WIZ_SURFACE_RAISED = 'rgba(255,255,255,0.075)';
export const WIZ_BORDER = 'rgba(255,255,255,0.13)';
export const WIZ_BORDER_SOFT = 'rgba(255,255,255,0.08)';
export const WIZ_TEXT = 'rgba(247,250,255,0.94)';
export const WIZ_TEXT_MUTED = 'rgba(247,250,255,0.62)';
export const WIZ_TEXT_FAINT = 'rgba(247,250,255,0.40)';
export const WIZ_SHADOW = '0 24px 70px rgba(0,0,0,0.62)';
export const WIZ_CARD_SHADOW = 'rgba(0,0,0,0.5)';

/** The ruled dark ground, ruled in the mode's own colour. */
export const wizardDarkBackground = accent => ({
  backgroundColor: WIZ_BASE,
  backgroundImage: [
    `linear-gradient(${accent}14 1px, transparent 1px)`,
    `linear-gradient(90deg, ${accent}14 1px, transparent 1px)`,
    `linear-gradient(${accent}22 1px, transparent 1px)`,
    `linear-gradient(90deg, ${accent}22 1px, transparent 1px)`,
    // A wash of the accent from the top corner, so the sheet is lit from where
    // the specimen is rather than being an even field of black.
    `radial-gradient(120% 60% at 50% 0%, ${accent}26, transparent 62%)`,
    'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(0,0,0,0.35))'
  ].join(','),
  backgroundSize: '18px 18px, 18px 18px, 90px 90px, 90px 90px, 100% 100%, 100% 100%',
  backgroundPosition: '0 0, 0 0, -1px -1px, -1px -1px, 0 0, 0 0'
});

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
  // Horizontal breathing room, matched down the whole sheet so everything sits on
  // one margin. The specimen is the exception: it runs to the edges.
  const GUTTER = mobile ? 14 : 28;
  return {
    overlay: {
      position: 'fixed',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(4,6,10,0.72)',
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
      ...wizardDarkBackground(accent),
      borderRadius: mobile ? 0 : '20px',
      width: mobile ? '100%' : 'min(720px, 96vw)',
      height: mobile ? '100%' : 'auto',
      maxHeight: mobile ? '100%' : '92vh',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      boxShadow: mobile ? 'none' : WIZ_SHADOW,
      border: mobile ? 'none' : `1px solid ${WIZ_BORDER}`,
      borderTop: `3px solid ${accent}`,
      color: WIZ_TEXT,
      animation: 'modalSheetIn 0.30s cubic-bezier(0.22, 1, 0.36, 1)'
    },

    // Back, and the name of the mode being configured. The step's own name is on
    // the specimen plate right under it, so this row never repeats it.
    modeBar: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      flexShrink: 0,
      padding: mobile
        ? `calc(8px + env(safe-area-inset-top)) ${GUTTER}px 8px`
        : `14px ${GUTTER}px 12px`,
      borderBottom: `1px solid ${WIZ_BORDER_SOFT}`
    },

    backBtn: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      minHeight: TOUCH_TARGET,
      minWidth: TOUCH_TARGET,
      padding: '6px 10px 6px 4px',
      marginLeft: -4,
      background: 'none',
      border: 'none',
      color: WIZ_TEXT_MUTED,
      fontSize: TEXT_SM,
      fontWeight: 600,
      fontFamily: 'inherit',
      cursor: 'pointer',
      WebkitTapHighlightColor: 'transparent'
    },

    modeName: {
      flex: 1,
      textAlign: 'center',
      fontSize: mobile ? TEXT_XS : TEXT_SM,
      fontWeight: 800,
      letterSpacing: '0.22em',
      textTransform: 'uppercase',
      color: WIZ_TEXT,
      textShadow: `0 0 18px ${accent}88`,
      // Balances the back button so the name sits on the sheet's centre line.
      paddingRight: TOUCH_TARGET
    },

    // The specimen runs edge to edge on a phone: the plate is the picture, and a
    // margin around a picture on a 390px screen is 28px of nothing.
    hero: {
      flexShrink: 0,
      padding: mobile ? 0 : `14px ${GUTTER}px 0`
    },

    // Categories with no specimen (gameplay tuning) get their name here instead.
    heroHeading: {
      flexShrink: 0,
      padding: mobile ? `14px ${GUTTER}px 4px` : `18px ${GUTTER}px 4px`
    },

    title: {
      fontSize: mobile ? TEXT_XL - 3 : TEXT_XL,
      fontWeight: '700',
      letterSpacing: '-0.5px',
      color: WIZ_TEXT,
      margin: '0 0 2px',
      lineHeight: 1.15
    },

    subtitle: {
      fontSize: mobile ? TEXT_SM - 1 : TEXT_SM,
      color: WIZ_TEXT_MUTED,
      margin: '0 0 10px',
      fontWeight: '400',
      lineHeight: 1.35
    },

    // Families of the open category (tile styles), as one scrolling row. They
    // were a column of rail sub-rows; a row is what a phone has space for.
    chipRow: {
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      gap: 7,
      padding: `10px ${GUTTER}px`,
      overflowX: 'auto',
      overscrollBehaviorX: 'contain',
      WebkitOverflowScrolling: 'touch',
      scrollbarWidth: 'none'
    },

    chip: active => ({
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      flexShrink: 0,
      minHeight: 34,
      padding: '7px 14px',
      borderRadius: 999,
      border: `1px solid ${active ? accent : WIZ_BORDER}`,
      background: active ? `${accent}2e` : WIZ_SURFACE,
      color: active ? '#fff' : WIZ_TEXT_MUTED,
      boxShadow: active ? `0 0 14px ${accent}55, inset 0 0 12px ${accent}33` : 'none',
      fontSize: TEXT_XS,
      fontWeight: active ? 800 : 600,
      letterSpacing: '0.04em',
      whiteSpace: 'nowrap',
      fontFamily: 'inherit',
      cursor: 'pointer',
      WebkitTapHighlightColor: 'transparent',
      transition: 'background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease'
    }),

    // The rail's job, laid on its side. Scrolls horizontally when a mode has more
    // categories than fit — six on a 360px phone is the worst case.
    categoryBar: {
      flexShrink: 0,
      display: 'flex',
      alignItems: 'stretch',
      gap: 2,
      padding: `0 ${Math.max(GUTTER - 8, 6)}px`,
      borderTop: `1px solid ${WIZ_BORDER_SOFT}`,
      borderBottom: `1px solid ${WIZ_BORDER_SOFT}`,
      background: 'rgba(0,0,0,0.28)',
      overflowX: 'auto',
      overscrollBehaviorX: 'contain',
      WebkitOverflowScrolling: 'touch',
      scrollbarWidth: 'none'
    },

    categoryTab: active => ({
      flex: '1 0 auto',
      minWidth: mobile ? 62 : 88,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 3,
      padding: mobile ? '8px 6px 7px' : '10px 10px 9px',
      border: 'none',
      borderBottom: `2px solid ${active ? accent : 'transparent'}`,
      background: 'transparent',
      cursor: 'pointer',
      fontFamily: 'inherit',
      WebkitTapHighlightColor: 'transparent',
      transition: 'border-color 0.15s ease, background 0.15s ease'
    }),

    body: {
      padding: `12px ${GUTTER}px 0`,
      overflowY: 'auto',
      overscrollBehavior: 'contain',
      WebkitOverflowScrolling: 'touch',
      flex: 1,
      minHeight: 0,
      scrollbarWidth: 'thin',
      scrollbarColor: `rgba(255,255,255,0.18) transparent`,
      // Fade the last few pixels so a list that continues under the footer reads
      // as scrollable instead of as a hard crop.
      maskImage: 'linear-gradient(to bottom, #000 calc(100% - 20px), transparent)',
      WebkitMaskImage: 'linear-gradient(to bottom, #000 calc(100% - 20px), transparent)'
    },

    footer: {
      padding: mobile
        ? `10px ${GUTTER}px calc(10px + env(safe-area-inset-bottom))`
        : `14px ${GUTTER}px 18px`,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      flexShrink: 0,
      borderTop: `1px solid ${WIZ_BORDER_SOFT}`,
      background: 'rgba(0,0,0,0.42)'
    },

    // One wide action. A wizard has exactly one thing to do next, and on a phone
    // it belongs across the thumb rather than in a corner.
    btnPrimary: {
      width: '100%',
      background: `linear-gradient(135deg, ${accent}, ${accentShadow})`,
      border: `1px solid ${accent}`,
      fontSize: TEXT_SM,
      fontWeight: '800',
      letterSpacing: '0.10em',
      textTransform: 'uppercase',
      color: '#fff',
      cursor: 'pointer',
      minHeight: TOUCH_TARGET + 4,
      padding: '13px 20px',
      borderRadius: '12px',
      transition: 'all 0.12s ease',
      fontFamily: 'inherit',
      WebkitTapHighlightColor: 'transparent',
      boxShadow: `0 6px 22px ${accent}55, inset 0 1px 0 rgba(255,255,255,0.22)`
    },

    btnSecondary: {
      background: 'none',
      border: 'none',
      fontSize: TEXT_XS,
      fontWeight: '600',
      color: WIZ_TEXT_FAINT,
      cursor: 'pointer',
      minHeight: 32,
      padding: '4px 8px',
      alignSelf: 'center',
      transition: 'color 0.15s ease',
      fontFamily: 'inherit',
      WebkitTapHighlightColor: 'transparent'
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
        color: WIZ_TEXT_FAINT,
        background: `linear-gradient(${WIZ_BASE} 70%, rgba(12,15,20,0))`,
        ...style
      }}
    >
      {children}
    </div>
  );
}

// The scrolling pane the category bar drives. Fixed rather than generated: only
// one wizard is ever mounted, and the bar and the wizard both have to name it.
export const WIZARD_PANEL_ID = 'wizard-category-panel';

// One glyph per category kind, drawn at 16×16 on the current stroke colour. Small
// enough to read at the 18px the phone bar gives them, which rules out anything
// with interior detail.
const ICON_GLYPHS = {
  scene: (
    <>
      <path d="M2 12.5h12" />
      <path d="M3 12.5l3.4-4.7 2.3 3 1.9-2.4L14 12.5" />
      <circle cx="11.3" cy="4.4" r="1.5" />
    </>
  ),
  colors: (
    <>
      <circle cx="6.1" cy="6.2" r="3.3" />
      <circle cx="9.9" cy="6.2" r="3.3" />
      <circle cx="8" cy="10" r="3.3" />
    </>
  ),
  style: (
    <>
      <rect x="2.2" y="2.2" width="5.1" height="5.1" rx="1.2" />
      <rect x="8.7" y="2.2" width="5.1" height="5.1" rx="1.2" />
      <rect x="2.2" y="8.7" width="5.1" height="5.1" rx="1.2" />
      <rect x="8.7" y="8.7" width="5.1" height="5.1" rx="1.2" />
    </>
  ),
  size: (
    <>
      <rect x="2" y="2" width="7.2" height="7.2" rx="1.2" />
      <path d="M6.8 6.8h7.2v7.2H6.8" />
    </>
  ),
  gameplay: (
    <>
      <path d="M2.5 4.6h11M2.5 11.4h11" />
      <circle cx="5.9" cy="4.6" r="1.8" />
      <circle cx="10.1" cy="11.4" r="1.8" />
    </>
  ),
  character: (
    <>
      <path d="M1.8 11.2c1.5 0 1.5-3.1 3-3.1s1.5 3.1 3 3.1 1.5-3.1 3-3.1 1.5 3.1 3.4 3.1" />
      <circle cx="12.6" cy="4.6" r="1.5" />
    </>
  )
};

/** A category glyph. Falls back to the tile grid for an unknown name. */
export function WizardIcon({ name, size = 17, color = 'currentColor' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: 'block', flexShrink: 0 }}
      aria-hidden="true"
    >
      {ICON_GLYPHS[name] || ICON_GLYPHS.style}
    </svg>
  );
}

/**
 * The families of the open category, as a scrolling row of chips.
 *
 * Only the tile-style category has any: seven of them, which used to be a
 * horizontally scrolling pill row *inside* the panel (a phone showed four and hid
 * the rest behind a swipe you had no reason to try), then rail sub-rows, and are
 * now the row directly under the specimen — where the thing they change is the
 * next thing on screen.
 */
export function WizardChipRow({ styles, families, activeChild, onSelect, label }) {
  if (!families?.length) return null;
  return (
    <div role="group" aria-label={label} style={styles.chipRow}>
      {families.map(child => {
        const active = child.key === activeChild;
        return (
          <button
            key={child.key}
            type="button"
            aria-pressed={active}
            className="ui-focusable"
            onClick={() => onSelect(child.key)}
            style={styles.chip(active)}
          >
            {child.label}
            {child.locked > 0 && <LockPip size={9} color={active ? '#fff' : WIZ_TEXT_FAINT} />}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Every category the wizard offers, across the sheet, with the value it currently
 * holds written under its name.
 *
 * The value line is the point of the thing. A tab strip alone would still only
 * tell you where you are; `summary` is what you already picked, so the palette you
 * chose two categories ago is legible while you are choosing tiles. On a phone it
 * is one truncated word — still enough to catch "Sunset" changing to "Neon".
 *
 * Marked up as navigation rather than as a tablist: every tab is a normal tab
 * stop, and arrow keys additionally move between categories and take the
 * selection with them.
 */
export function WizardCategoryBar({ styles, categories, active, onSelect, accent, mobile }) {
  const tabs = React.useRef([]);

  const focus = index => {
    onSelect(index);
    tabs.current[index]?.focus();
  };

  const handleKeyDown = (e, i) => {
    const last = categories.length - 1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') focus(i === last ? 0 : i + 1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') focus(i === 0 ? last : i - 1);
    else if (e.key === 'Home') focus(0);
    else if (e.key === 'End') focus(last);
    else return;
    e.preventDefault();
  };

  return (
    <nav aria-label="Setup categories" style={styles.categoryBar}>
      {categories.map((cat, i) => {
        const isActive = i === active;
        return (
          <button
            key={cat.key}
            ref={el => { tabs.current[i] = el; }}
            type="button"
            aria-current={isActive ? 'true' : undefined}
            aria-controls={WIZARD_PANEL_ID}
            className="ui-focusable"
            onClick={() => onSelect(i)}
            onKeyDown={e => handleKeyDown(e, i)}
            style={styles.categoryTab(isActive)}
          >
            <WizardIcon name={cat.icon} size={mobile ? 17 : 18} color={isActive ? accent : WIZ_TEXT_FAINT} />
            <span
              style={{
                fontSize: mobile ? 9 : TEXT_MICRO,
                fontWeight: 800,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                lineHeight: 1.2,
                color: isActive ? WIZ_TEXT : WIZ_TEXT_MUTED,
                whiteSpace: 'nowrap'
              }}
            >
              {cat.label}
            </span>
            {cat.summary && (
              <span
                style={{
                  maxWidth: mobile ? 62 : 96,
                  fontSize: mobile ? 8 : 9,
                  fontWeight: 600,
                  lineHeight: 1.2,
                  color: isActive ? accent : WIZ_TEXT_FAINT,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                {cat.summary}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

/**
 * The whole sheet: mode bar, specimen, chips, categories, choices, action.
 *
 * A wizard builds its `categories` — each `{ key, icon, label, title, subtitle,
 * summary, hero, content }`, plus `children`/`activeChild`/`onSelectChild` for a
 * category with families — and hands them over. Everything else here is the same
 * for all four, which is exactly why it lives here: the four hand-copied shells
 * this replaced had already drifted on sheet height, gutters and footer padding.
 *
 * @param mode       the badge across the top ("WORM MODE")
 * @param onBack     back one category, or leave the wizard from the first
 * @param onPrimary  confirm this category and go on; finishes on the last
 * @param finishLabel   what the action says on the last category
 * @param secondary  optional { label, onClick } escape hatch under the action
 */
export function WizardShell({
  styles,
  mode,
  accent,
  categories,
  active,
  onSelect,
  onBack,
  onPrimary,
  finishLabel = 'Start Playing',
  secondary = null,
  mobile = isMobile,
  children
}) {
  const cat = categories[active];
  const last = active === categories.length - 1;

  return (
    <div style={styles.overlay}>
      {children}

      <div style={styles.sheet}>
        <div style={styles.modeBar}>
          <button type="button" onClick={onBack} className="ui-focusable" style={styles.backBtn} aria-label="Back">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M10 3L5 8l5 5" />
            </svg>
            {!mobile && (active === 0 ? 'Cancel' : 'Back')}
          </button>
          <span style={styles.modeName}>{mode}</span>
        </div>

        {cat.hero ? (
          <div style={styles.hero}>{cat.hero}</div>
        ) : (
          <div style={styles.heroHeading}>
            <h2 style={styles.title}>{cat.title}</h2>
            <p style={styles.subtitle}>{cat.subtitle}</p>
          </div>
        )}

        <WizardChipRow
          styles={styles}
          families={cat.children}
          activeChild={cat.activeChild}
          onSelect={cat.onSelectChild}
          label={`${cat.label} groups`}
        />

        <WizardCategoryBar
          styles={styles}
          categories={categories}
          active={active}
          onSelect={onSelect}
          accent={accent}
          mobile={mobile}
        />

        <div style={styles.body} id={WIZARD_PANEL_ID} role="region" aria-label={cat.label}>
          <div style={{ paddingBottom: '24px' }}>{cat.content}</div>
        </div>

        <div style={styles.footer}>
          <button
            type="button"
            style={styles.btnPrimary}
            onClick={onPrimary}
            onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(1.08)'; }}
            onMouseLeave={e => { e.currentTarget.style.filter = 'none'; }}
          >
            {last ? finishLabel : `Confirm ${cat.label} & Continue`}
          </button>

          {secondary && (
            <button
              type="button"
              style={styles.btnSecondary}
              onClick={secondary.onClick}
              onMouseEnter={e => { e.currentTarget.style.color = WIZ_TEXT; }}
              onMouseLeave={e => { e.currentTarget.style.color = WIZ_TEXT_FAINT; }}
            >
              {secondary.label}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Small padlock, matching the one the pickers use for unbought cosmetics.
 *
 * Deliberately not the one in wizardSteps/shared.jsx: that module reaches the
 * tile-preview renderer and Three.js behind it, and WizardChrome is imported by
 * the store, level select, and pack screens, which have no business paying for
 * that. Eight lines of SVG is the cheaper duplicate.
 */
function LockPip({ size = 10, color = PAPER_TEXT_FAINT }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" style={{ display: 'block', flexShrink: 0 }} aria-hidden="true">
      <path d="M5 7V5a3 3 0 0 1 6 0v2" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      <rect x="3.2" y="7" width="9.6" height="7" rx="2" fill={color} />
    </svg>
  );
}
