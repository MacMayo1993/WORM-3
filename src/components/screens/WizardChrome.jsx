import ModeArtwork from '../ui/ModeArtwork.jsx';
import { wormMenuFeedback } from './wormMenuFeedback.js';
// Shared forecast-style setup shell for CUBE, WORM, CHAOS and RANDOM.
// Scoped CSS variables keep paper styling for notebook and store consumers.

import React from 'react';
import { useDialogBehavior } from '../ui/Panel.jsx';
import { UI_FONT, PAPER_SHEET, PAPER_SHEET_RAISED, PAPER_BG_MUTED, PAPER_BORDER, PAPER_BORDER_SOFT, PAPER_TEXT, PAPER_TEXT_MUTED, PAPER_SHADOW, PAPER_CARD_SHADOW, PAPER_BACKDROP_BLUR, PAPER_TEXT_FAINT, TEXT_MICRO, TEXT_XS, TEXT_SM, TEXT_XL, Z } from '../../utils/uiTheme.js';
import { modeTheme } from '../../utils/modeThemes.js';
import { ARCADE_PAPER, ARCADE_CARD, ARCADE_INK, ARCADE_INK_STRONG, ARCADE_MUTED, ARCADE_LINE, ARCADE_LINE_SOFT,
  ARCADE_GRID_SIZE, ARCADE_KEY_SHADOW, ARCADE_PRIMARY_SHADOW, ARCADE_CARD_SHADOW, DISPLAY_FONT, HEADING_FONT } from '../../utils/uiTheme.js';
import { arcadeModeVars } from '../../utils/arcadeTheme.js';
import './modeWizard.css';
import { TOUCH_TARGET } from '../ui/index.js';
import { isMobile } from '../../utils/device.js';

// ─── Paper (kept for the notebook screens) ────────────────────────────────────
// Graph-paper panel background — the exact recipe from the Mobi dialogue panel
// (MobiIntroScreen): a warm paper base, a fine 18px grid, a 90px major grid, and
// a soft corner highlight + diagonal wash. Still worn by the store, level select,
// the pack picker and the merge theme picker.
// The mode carousel's graph paper (MenuPaperBackdrop), as CSS: one warm base,
// one even grid, a soft centre highlight.
const GRAPH_LINE = 'rgba(207,205,191,0.40)';
export const WIZARD_PAPER_BASE = ARCADE_PAPER;

export const wizardPaperBackground = {
  backgroundColor: WIZARD_PAPER_BASE,
  backgroundImage: [
    'radial-gradient(ellipse at 50% 45%, rgba(255,253,245,0.85), transparent 72%)',
    `linear-gradient(${GRAPH_LINE} 1px, transparent 1px)`,
    `linear-gradient(90deg, ${GRAPH_LINE} 1px, transparent 1px)`
  ].join(','),
  backgroundSize: `100% 100%, ${ARCADE_GRID_SIZE}, ${ARCADE_GRID_SIZE}`
};

// Translucent paper wash for the footer strip: the action buttons keep a base to
// sit on while the graph grid still reads faintly through it.
export const WIZARD_FOOTER_BG = 'rgba(255, 252, 241, 0.92)';

// Pencil-lead ink used for handwritten copy on this paper (matches Mobi's dialogue).
// Exported so any screen writing on the paper — the store's footer note, for one —
// uses the same lead rather than picking its own grey.
export const PENCIL_LEAD = '#35404a';

// Shared paper surfaces keep every mode in the same field-guide family.
export const WIZ_BASE = `var(--wiz-base, ${PAPER_SHEET})`;
export const WIZ_SURFACE = `var(--wiz-surface, ${PAPER_BG_MUTED})`;
export const WIZ_SURFACE_RAISED = `var(--wiz-surface-raised, ${PAPER_SHEET_RAISED})`;
export const WIZ_BORDER = `var(--wiz-border, ${PAPER_BORDER})`;
export const WIZ_BORDER_SOFT = `var(--wiz-border-soft, ${PAPER_BORDER_SOFT})`;
export const WIZ_TEXT = `var(--wiz-text, ${PAPER_TEXT})`;
export const WIZ_TEXT_MUTED = `var(--wiz-text-muted, ${PAPER_TEXT_MUTED})`;
// Small interactive labels need the stronger secondary ink on cream.
export const WIZ_TEXT_FAINT = `var(--wiz-text-faint, ${PAPER_TEXT_MUTED})`;
export const WIZ_SHADOW = PAPER_SHADOW;
export const WIZ_CARD_SHADOW = `var(--wiz-card-shadow, ${PAPER_CARD_SHADOW})`;

/** The same graph-paper recipe used by the store. */
export const wizardBackground = () => ({ ...wizardPaperBackground });

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
export function wizardLayout(accent, _accentShadow = `${accent}99`, mobile = isMobile) {
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
      // The wizard owns the screen, like the mode carousel it follows: the same
      // graph paper, with the sheet as an ivory card on it.
      ...wizardPaperBackground,
      zIndex: Z.MODAL,
      fontFamily: UI_FONT,
      // dvh tracks the collapsing mobile URL bar; browsers without it fall back
      // to the inset:0 box, which is what this used to rely on entirely.
      height: '100dvh',
      padding: mobile ? 'max(8px, env(safe-area-inset-top)) max(8px, env(safe-area-inset-right)) max(8px, env(safe-area-inset-bottom)) max(8px, env(safe-area-inset-left))' : 18,
      boxSizing: 'border-box',
      animation: 'modalBackdropIn 0.22s ease'
    },

    sheet: {
      background: ARCADE_CARD,
      borderRadius: mobile ? 20 : 24,
      width: mobile ? '100%' : 'min(720px, 96vw)',
      height: '100%',
      maxHeight: mobile ? '100%' : '94dvh',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      boxShadow: mobile ? 'none' : ARCADE_CARD_SHADOW,
      border: `2px solid ${ARCADE_LINE}`,
      color: ARCADE_INK,
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

    // The carousel's ivory icon key.
    backBtn: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      minHeight: TOUCH_TARGET,
      minWidth: TOUCH_TARGET,
      padding: mobile ? 0 : '0 14px 0 10px',
      boxSizing: 'border-box',
      background: ARCADE_CARD,
      border: `2px solid ${ARCADE_LINE}`,
      borderRadius: 16,
      boxShadow: ARCADE_KEY_SHADOW,
      color: ARCADE_INK_STRONG,
      font: `800 12px/1.2 ${HEADING_FONT}`,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      cursor: 'pointer',
      touchAction: 'manipulation',
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
      textShadow: 'none',
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
      fontFamily: DISPLAY_FONT,
      fontSize: mobile ? TEXT_XL - 3 : TEXT_XL,
      fontWeight: 400,
      textTransform: 'uppercase',
      color: ARCADE_INK,
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
      minHeight: TOUCH_TARGET,
      padding: '7px 14px',
      borderRadius: 10,
      border: `2px solid ${active ? ARCADE_INK_STRONG : ARCADE_LINE_SOFT}`,
      background: active ? 'color-mix(in srgb, var(--mode-accent) 22%, #fffcf1)' : ARCADE_CARD,
      color: active ? ARCADE_INK : ARCADE_INK_STRONG,
      boxShadow: active ? `0 2px 0 ${ARCADE_INK_STRONG}` : `0 3px 0 ${ARCADE_LINE_SOFT}`,
      font: `800 11px/1.2 ${HEADING_FONT}`,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
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
      borderTop: `1px solid ${ARCADE_LINE_SOFT}`,
      borderBottom: `1px solid ${ARCADE_LINE_SOFT}`,
      background: '#f7f2e3',
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
      borderBottom: `3px solid ${active ? ARCADE_INK_STRONG : 'transparent'}`,
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
      scrollbarColor: `${WIZ_BORDER} transparent`,
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
      borderTop: `2px solid ${ARCADE_LINE_SOFT}`,
      background: WIZARD_FOOTER_BG
    },

    // One wide action. A wizard has exactly one thing to do next, and on a phone
    // it belongs across the thumb rather than in a corner.
    btnPrimary: {
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      background: 'var(--arcade-accent)',
      border: `2px solid ${ARCADE_INK_STRONG}`,
      font: `400 clamp(15px, 4.5vw, 20px)/1.25 ${DISPLAY_FONT}`,
      textTransform: 'uppercase',
      color: 'var(--arcade-accent-ink)',
      cursor: 'pointer',
      minHeight: 60,
      padding: '12px 18px',
      marginBottom: 6,
      borderRadius: 18,
      fontFamily: DISPLAY_FONT,
      WebkitTapHighlightColor: 'transparent',
      touchAction: 'manipulation',
      boxShadow: ARCADE_PRIMARY_SHADOW
    },

    btnSecondary: {
      background: 'none',
      border: 'none',
      font: `800 11px/1.3 ${HEADING_FONT}`,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      textDecoration: 'underline',
      textDecorationColor: ARCADE_LINE,
      textUnderlineOffset: 4,
      color: ARCADE_INK_STRONG,
      cursor: 'pointer',
      minHeight: TOUCH_TARGET,
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
        background: WIZ_BASE,
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
            onClick={() => { wormMenuFeedback(); onSelect(child.key); }}
            style={styles.chip(active)}
          >
            {child.label}
            {child.locked > 0 && <LockPip size={9} color={active ? WIZ_TEXT : WIZ_TEXT_FAINT} />}
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
    wormMenuFeedback();
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
            onClick={() => { wormMenuFeedback(); onSelect(i); }}
            onKeyDown={e => handleKeyDown(e, i)}
            style={styles.categoryTab(isActive)}
          >
            <WizardIcon name={cat.icon} size={mobile ? 17 : 18} color={isActive ? accent : WIZ_TEXT_FAINT} />
            <span
              style={{
                fontSize: TEXT_MICRO,
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
                  fontSize: TEXT_MICRO,
                  fontWeight: 600,
                  lineHeight: 1.2,
                  color: isActive ? 'var(--mode-ink)' : WIZ_TEXT_FAINT,
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
 * The shared setup sheet. Tile styles place categories and family chips before
 * the specimen; other steps retain their preview-first layout.
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
  finishLabel = "Play",
  secondary = null,
  mobile = isMobile,
  children
}) {
  const scrollRef = React.useRef(null);
  const dialogRef = React.useRef(null);
  const onDialogKeyDown = useDialogBehavior(dialogRef, onBack);
  React.useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = 0; }, [active]);
  const theme = modeTheme(mode);
  // The carousel's face colour for this mode drives the primary key and the
  // selection tint; the shell's own lines and ink are the arcade neutrals.
  const modeVars = arcadeModeVars(mode);
  const cat = categories[active];
  const last = active === categories.length - 1;
  // Keep the cube above the setup selector and its style-family controls.
  const isStyle = cat.key === 'style';
  const specimen = cat.hero ? <div style={styles.hero}>{cat.hero}</div> : null;
  const categoryBar = (
    <WizardCategoryBar
      styles={styles}
      categories={categories}
      active={active}
      onSelect={onSelect}
      accent={accent}
      mobile={mobile}
    />
  );

  return (
    <div ref={dialogRef} onKeyDown={onDialogKeyDown} tabIndex={-1} role="dialog" aria-modal="true" aria-label={`${theme.name} setup`} className="mode-wizard" style={{ ...styles.overlay, ...modeVars, '--mode-accent': modeVars['--arcade-accent'], '--mode-ink': ARCADE_INK_STRONG }}>
      {children}

      <div className="mode-wizard-sheet" style={styles.sheet}>
        <div style={styles.modeBar}>
          <button type="button" onClick={onBack} className="ui-focusable" style={styles.backBtn} aria-label="Back">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M10 3L5 8l5 5" />
            </svg>
            {!mobile && (active === 0 ? 'Cancel' : 'Back')}
          </button>
          <span className="mode-wizard-kicker">{theme.name}</span>
          <span className="mode-wizard-count">{String(active + 1).padStart(2, '0')} / {String(categories.length).padStart(2, '0')}</span>
        </div>

        <div className="mode-wizard-scroll" ref={scrollRef}>
        <header className="mode-wizard-heading">
          <div><h1>{cat.hero ? cat.label : cat.title}</h1>{!cat.hero && cat.subtitle && <p>{cat.subtitle}</p>}</div>
          <ModeArtwork mode={theme.art} />
        </header>
        {specimen}
        {isStyle && categoryBar}

        <WizardChipRow
          styles={styles}
          families={cat.children}
          activeChild={cat.activeChild}
          onSelect={cat.onSelectChild}
          label={`${cat.label} groups`}
        />

        {!isStyle && categoryBar}

        <div style={{ ...styles.body, overflowY: 'visible', maskImage: 'none', WebkitMaskImage: 'none' }} id={WIZARD_PANEL_ID} role="region" aria-label={cat.label}>
          <div style={{ paddingBottom: '24px' }}>{cat.content}</div>
        </div>

        </div>
        <div style={styles.footer}>
          <div className="mode-wizard-step-track" aria-hidden="true">{categories.map((item, i) => <i key={item.key} data-reached={i <= active} />)}</div>
          <button
            type="button"
            style={styles.btnPrimary}
            onClick={() => { wormMenuFeedback(); onPrimary(); }}
            className="mode-wizard-primary"
            onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(1.06)'; }}
            onMouseLeave={e => { e.currentTarget.style.filter = 'none'; }}
          >
            {last ? finishLabel : (cat.primaryLabel || 'Next')} <span aria-hidden="true">→</span>
          </button>

          {secondary && (
            <button
              type="button"
              style={styles.btnSecondary}
              onClick={() => { wormMenuFeedback(); secondary.onClick(); }}
              onMouseEnter={e => { e.currentTarget.style.color = ARCADE_INK; }}
              onMouseLeave={e => { e.currentTarget.style.color = ARCADE_INK_STRONG; }}
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
