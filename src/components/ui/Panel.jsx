// src/components/ui/Panel.jsx — the two sanctioned panel surfaces, plus the
// dialog behaviour every overlay in the game was supposed to have and mostly
// did not.
//
// uiTheme.js defines two families — PAPER (the player is reading or deciding,
// and the panel owns the screen) and NIGHT (the panel layers over something
// alive that must stay visible). Both were being hand-assembled per screen from
// six or seven tokens, which is how HelpMenu ended up still wearing the cold
// navy glass that the theme file says was removed.
//
// Behaviour that comes free with <Overlay>, and previously existed in roughly
// three screens out of twenty:
//   - Escape closes the panel
//   - focus moves into the panel on open and returns where it came from on close
//   - Tab is trapped inside while it is open
//   - role="dialog" + aria-modal, so it is announced as a dialog
//   - background scroll is locked

import React, { useCallback, useEffect, useRef } from 'react';
import {
  UI_FONT,
  PAPER_BACKDROP, PAPER_BACKDROP_BLUR, PAPER_SHEET, PAPER_BORDER, PAPER_TEXT,
  PAPER_TEXT_MUTED, PAPER_FOOTER_BG, PAPER_SHADOW,
  NIGHT_BACKDROP, NIGHT_BACKDROP_BLUR, NIGHT_SHEET, NIGHT_BORDER, NIGHT_TEXT,
  NIGHT_TEXT_MUTED, NIGHT_SHADOW,
  RADIUS_LG, TEXT_SM, TEXT_LG, Z
} from '../../utils/uiTheme.js';
import { CloseButton } from './Button.jsx';

const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled])',
  'select:not([disabled])', 'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])'
].join(',');

/**
 * Escape-to-close, focus trap, focus restore, and scroll lock for a dialog.
 *
 * Split out from <Overlay> so a screen with bespoke chrome — the setup wizards
 * own their graph-paper sheet and are not going to become <PaperPanel> — can
 * still adopt the behaviour by calling this with its own container ref.
 */
export function useDialogBehavior(ref, onClose, { trapFocus = true, lockScroll = true } = {}) {
  const restoreRef = useRef(null);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape' && onClose) {
      e.stopPropagation();
      onClose();
      return;
    }

    if (e.key !== 'Tab' || !trapFocus || !ref.current) return;

    const items = Array.from(ref.current.querySelectorAll(FOCUSABLE)).filter(el => el.offsetParent !== null || el === document.activeElement);
    if (items.length === 0) {
      // Nothing focusable inside — keep focus on the panel rather than letting
      // Tab escape to the page behind it.
      e.preventDefault();
      return;
    }

    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }, [ref, onClose, trapFocus]);

  useEffect(() => {
    restoreRef.current = document.activeElement;
    const node = ref.current;

    // Focus the first real control if there is one, otherwise the panel itself,
    // so the Escape/Tab handling below actually receives keys.
    const firstItem = node?.querySelector(FOCUSABLE);
    (firstItem || node)?.focus?.({ preventScroll: true });

    const prevOverflow = lockScroll ? document.body.style.overflow : null;
    if (lockScroll) document.body.style.overflow = 'hidden';

    return () => {
      if (lockScroll) document.body.style.overflow = prevOverflow || '';
      // Only pull focus back if it is still inside the panel we are unmounting;
      // if something else has claimed it in the meantime, leave it alone.
      const active = document.activeElement;
      if (!active || active === document.body || node?.contains(active)) {
        restoreRef.current?.focus?.({ preventScroll: true });
      }
    };
  }, [ref, lockScroll]);

  return handleKeyDown;
}

const SURFACES = {
  paper: {
    backdrop: PAPER_BACKDROP,
    blur: PAPER_BACKDROP_BLUR,
    sheet: PAPER_SHEET,
    border: PAPER_BORDER,
    text: PAPER_TEXT,
    muted: PAPER_TEXT_MUTED,
    footer: PAPER_FOOTER_BG,
    shadow: PAPER_SHADOW,
    divider: PAPER_BORDER
  },
  night: {
    backdrop: NIGHT_BACKDROP,
    blur: NIGHT_BACKDROP_BLUR,
    sheet: NIGHT_SHEET,
    border: NIGHT_BORDER,
    text: NIGHT_TEXT,
    muted: NIGHT_TEXT_MUTED,
    footer: 'rgba(0,0,0,0.16)',
    shadow: NIGHT_SHADOW,
    divider: NIGHT_BORDER
  }
};

export const surfaceTokens = (surface) => SURFACES[surface] || SURFACES.paper;

/**
 * Full-screen backdrop that centres a panel and owns the dialog behaviour.
 *
 * Clicking the backdrop closes, clicking the panel does not — but only when
 * `dismissOnBackdrop` is left on. A wizard mid-flow should turn it off, because
 * losing five steps of setup to a stray tap is not a dismissal the player meant.
 *
 * @param {'paper'|'night'} surface
 * @param {number} zIndex — pick from the Z scale in uiTheme.js
 */
export function Overlay({
  surface = 'paper',
  zIndex = Z.MODAL,
  onClose,
  dismissOnBackdrop = true,
  labelledBy,
  label,
  align = 'center',
  style,
  children,
  ...props
}) {
  const ref = useRef(null);
  const onKeyDown = useDialogBehavior(ref, onClose);
  const s = surfaceTokens(surface);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      onClick={dismissOnBackdrop && onClose ? (e) => { if (e.target === e.currentTarget) onClose(); } : undefined}
      style={{
        position: 'fixed',
        inset: 0,
        // dvh tracks the collapsing mobile URL bar; `inset: 0` is the fallback
        // for browsers that do not know the unit.
        height: '100dvh',
        display: 'flex',
        alignItems: align,
        justifyContent: 'center',
        background: s.backdrop,
        backdropFilter: s.blur,
        WebkitBackdropFilter: s.blur,
        zIndex,
        fontFamily: UI_FONT,
        padding: 'env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px) env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px)',
        boxSizing: 'border-box',
        animation: 'modalBackdropIn 0.22s ease',
        ...style
      }}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * The sheet itself. Column layout so <PanelHeader>/<PanelBody>/<PanelFooter>
 * give you a sticky header, a scrolling middle, and a pinned footer for free —
 * the arrangement every long panel in the game was rebuilding by hand.
 */
export function Panel({ surface = 'paper', width = 560, style, children, ...props }) {
  const s = surfaceTokens(surface);
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: s.sheet,
        border: `1px solid ${s.border}`,
        borderRadius: RADIUS_LG,
        color: s.text,
        width: `min(${width}px, 92vw)`,
        maxHeight: 'calc(100dvh - 48px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))',
        overflow: 'hidden',
        boxShadow: s.shadow,
        boxSizing: 'border-box',
        animation: 'modalSheetIn 0.30s cubic-bezier(0.22, 1, 0.36, 1)',
        ...style
      }}
      {...props}
    >
      {children}
    </div>
  );
}

/** Convenience wrappers, kept so callers need one import rather than three. */
export const PaperPanel = (props) => <Panel {...props} surface="paper" />;
export const NightPanel = (props) => <Panel {...props} surface="night" />;

export function PanelHeader({ surface = 'paper', title, titleId, onClose, children, style }) {
  const s = surfaceTokens(surface);
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '18px 22px',
        borderBottom: `1px solid ${s.divider}`,
        flexShrink: 0,
        ...style
      }}
    >
      {title && (
        <h2 id={titleId} style={{ margin: 0, flex: 1, fontSize: TEXT_LG, fontWeight: 700, letterSpacing: '0.01em', color: s.text }}>
          {title}
        </h2>
      )}
      {children}
      {onClose && <CloseButton surface={surface} onClose={onClose} />}
    </header>
  );
}

export function PanelBody({ style, children, ...props }) {
  return (
    <div
      style={{
        padding: '20px 22px 22px',
        overflowY: 'auto',
        overscrollBehavior: 'contain',
        WebkitOverflowScrolling: 'touch',
        flex: 1,
        minHeight: 0,
        ...style
      }}
      {...props}
    >
      {children}
    </div>
  );
}

export function PanelFooter({ surface = 'paper', style, children }) {
  const s = surfaceTokens(surface);
  return (
    <footer
      style={{
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: '10px',
        padding: '14px 22px calc(14px + env(safe-area-inset-bottom, 0px))',
        borderTop: `1px solid ${s.divider}`,
        background: s.footer,
        flexShrink: 0,
        ...style
      }}
    >
      {children}
    </footer>
  );
}

/** Small uppercase section label — the eyebrow used above grouped rows. */
export function PanelSectionTitle({ surface = 'paper', children, style }) {
  const s = surfaceTokens(surface);
  return (
    <h3
      style={{
        margin: '0 0 10px',
        fontSize: TEXT_SM - 2,
        fontWeight: 700,
        color: s.muted,
        textTransform: 'uppercase',
        letterSpacing: '0.10em',
        ...style
      }}
    >
      {children}
    </h3>
  );
}
