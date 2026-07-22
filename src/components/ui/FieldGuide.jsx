import React from 'react';
import { UI_CREAM, UI_GOLD, UI_MOSS, UI_MOSS_LIGHT, UI_ACTION_SHADOW, UI_FONT } from '../../utils/uiTheme.js';

export const FIELD_GUIDE_PAPER = 'rgba(250,247,238,0.95)';
export const FIELD_GUIDE_BORDER = '1px solid rgba(111,126,86,0.25)';
export const FIELD_GUIDE_INK = '#26331f';
export const FIELD_GUIDE_MUTED = '#657156';
// UI_GOLD is intentionally pale for copy shown over the dark STEP COMPLETE
// overlay. Paper surfaces need this darker companion for readable notation.
export const FIELD_GUIDE_GOLD_INK = '#715719';

export function FieldGuideSheet({ children, style, ...props }) {
  return <section {...props} style={{ background: FIELD_GUIDE_PAPER, border: FIELD_GUIDE_BORDER, borderRadius: 18, boxShadow: '0 14px 34px rgba(40,48,32,0.22)', fontFamily: UI_FONT, color: FIELD_GUIDE_INK, ...style }}>{children}</section>;
}

export function FieldGuideEyebrow({ children, style }) {
  return <p style={{ margin: 0, color: UI_GOLD, fontSize: 11, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', ...style }}>{children}</p>;
}

export function FieldGuideButton({ children, secondary = false, style, ...props }) {
  return <button {...props} style={{ padding: '10px 18px', borderRadius: 999, border: secondary ? FIELD_GUIDE_BORDER : '1px solid rgba(95,127,74,0.55)', background: secondary ? 'rgba(255,255,255,0.56)' : UI_MOSS, color: secondary ? FIELD_GUIDE_INK : UI_CREAM, fontFamily: UI_FONT, fontSize: 12, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer', boxShadow: secondary ? 'none' : UI_ACTION_SHADOW, ...style }}>{children}</button>;
}

export const fieldGuide = { paper: FIELD_GUIDE_PAPER, border: FIELD_GUIDE_BORDER, ink: FIELD_GUIDE_INK, muted: FIELD_GUIDE_MUTED, goldInk: FIELD_GUIDE_GOLD_INK, moss: UI_MOSS, mossLight: UI_MOSS_LIGHT, cream: UI_CREAM, gold: UI_GOLD };
