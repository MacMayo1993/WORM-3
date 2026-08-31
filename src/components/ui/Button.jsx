// src/components/ui/Button.jsx — the sanctioned button shapes.
//
// The game had 216 raw <button> elements, nearly all of them re-declaring the
// same padding, radius, font, and hover handlers inline. That is why the moss
// green action pill drifted into four slightly different pills, and why almost
// none of them had a visible keyboard focus state.
//
// These cover the shapes that actually recur. A button with genuinely bespoke
// chrome (the mode carousel tiles, the cube-face swatches) is still free to be
// its own thing — this is not a mandate to funnel every clickable through here.

import React from 'react';
import {
  UI_FONT, UI_CREAM, UI_MOSS, UI_ACTION_SHADOW,
  PAPER_TEXT, PAPER_TEXT_MUTED, PAPER_BORDER_SOFT,
  NIGHT_TEXT, NIGHT_TEXT_MUTED, NIGHT_BORDER, NIGHT_PANEL,
  RADIUS_MD, RADIUS_PILL, TEXT_MD, TEXT_LG
} from '../../utils/uiTheme.js';

// Comfortable minimum hit area. 44px is the figure both Apple's and Google's
// guidelines land on, and only two places in the game were honouring it.
export const TOUCH_TARGET = 44;

/**
 * Variant recipes, resolved against the surface the button sits on.
 *
 * `surface` is 'paper' or 'night' — the two families in uiTheme.js. A secondary
 * button has to know which one it is on, because its whole look is borrowed
 * from the panel behind it. Primary is moss green on both, by design: the
 * affirmative action is the one thing that stays constant across the system.
 */
function variantStyle(variant, surface) {
  const onNight = surface === 'night';

  switch (variant) {
    case 'secondary':
      return {
        background: onNight ? NIGHT_PANEL : 'rgba(255,255,255,0.56)',
        border: `1.5px solid ${onNight ? NIGHT_BORDER : PAPER_BORDER_SOFT}`,
        color: onNight ? NIGHT_TEXT : PAPER_TEXT,
        boxShadow: 'none'
      };

    case 'ghost':
      return {
        background: 'transparent',
        border: '1.5px solid transparent',
        color: onNight ? NIGHT_TEXT_MUTED : PAPER_TEXT_MUTED,
        boxShadow: 'none'
      };

    case 'danger':
      return {
        background: '#c94f3d',
        border: 'none',
        color: UI_CREAM,
        boxShadow: '0 8px 20px rgba(201,79,61,0.32)'
      };

    case 'primary':
    default:
      return {
        background: UI_MOSS,
        border: 'none',
        color: UI_CREAM,
        boxShadow: UI_ACTION_SHADOW
      };
  }
}

/**
 * The standard action button.
 *
 * Focus is handled by the `ui-focusable` class (App.css) rather than inline,
 * because `:focus-visible` cannot be expressed in a style object — which is
 * precisely why the inline-styled buttons had no focus ring to begin with.
 *
 * @param {'primary'|'secondary'|'ghost'|'danger'} variant
 * @param {'paper'|'night'} surface — which theme family the button sits on
 * @param {'sm'|'md'|'lg'} size
 * @param {boolean} pill — fully rounded rather than the standard radius
 * @param {boolean} fullWidth
 */
export function ActionButton({
  variant = 'primary',
  surface = 'paper',
  size = 'md',
  pill = false,
  fullWidth = false,
  disabled = false,
  className = '',
  style,
  children,
  ...props
}) {
  const pad = size === 'sm' ? '9px 16px' : size === 'lg' ? '15px 32px' : '12px 24px';
  const fontSize = size === 'sm' ? TEXT_MD - 2 : size === 'lg' ? TEXT_LG : TEXT_MD;

  return (
    <button
      type="button"
      disabled={disabled}
      className={`ui-focusable ${className}`.trim()}
      style={{
        ...variantStyle(variant, surface),
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        padding: pad,
        minHeight: TOUCH_TARGET,
        width: fullWidth ? '100%' : undefined,
        borderRadius: pill ? RADIUS_PILL : RADIUS_MD,
        fontFamily: UI_FONT,
        fontSize,
        fontWeight: 700,
        lineHeight: 1.2,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        transition: 'transform 0.12s ease, filter 0.15s ease, opacity 0.15s ease',
        WebkitTapHighlightColor: 'transparent',
        ...style
      }}
      {...props}
    >
      {children}
    </button>
  );
}

/**
 * A square icon button — the ⚙/☰/× cluster in the top bar and panel headers.
 * `label` is required and becomes the accessible name, since the visible
 * content is a glyph that a screen reader cannot make sense of.
 */
export function IconButton({
  label,
  surface = 'paper',
  size = TOUCH_TARGET,
  className = '',
  style,
  children,
  ...props
}) {
  const onNight = surface === 'night';
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`ui-focusable ui-icon-button ${className}`.trim()}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        flexShrink: 0,
        padding: 0,
        // Base background lives in CSS (`.ui-icon-button`) rather than here: an
        // inline `transparent` outranks the class, so setting it here is what
        // silently killed the hover state.
        border: 'none',
        borderRadius: RADIUS_PILL,
        color: onNight ? NIGHT_TEXT_MUTED : PAPER_TEXT_MUTED,
        fontFamily: UI_FONT,
        fontSize: TEXT_LG,
        lineHeight: 1,
        cursor: 'pointer',
        // `transform` is in the list because the shared press state in App.css
        // scales the button; without it the scale would snap.
        transition: 'background 0.15s ease, color 0.15s ease, transform 0.12s ease',
        WebkitTapHighlightColor: 'transparent',
        ...style
      }}
      {...props}
    >
      {children}
    </button>
  );
}

/** The × that closes a panel. Its own component only because it is everywhere. */
export function CloseButton({ onClose, surface = 'paper', style, ...props }) {
  return (
    <IconButton label="Close" surface={surface} onClick={onClose} style={style} {...props}>
      &times;
    </IconButton>
  );
}
