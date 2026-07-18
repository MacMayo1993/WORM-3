/**
 * uiTheme.js — Central UI theme tokens shared by every screen, menu, and HUD.
 *
 * WORM³ has two deliberate visual families:
 *
 *  1. PAPER — warm cream modal sheets used by all pre-game setup surfaces
 *     (setup wizards, betting screen, store, help menu).
 *  2. GLASS — dark navy translucent panels used by all in-game overlays
 *     (tutorials, victory, cutscene chrome, coming soon, HUD cards, mode carousel).
 *
 * Every screen must pull its fonts and family colors from here rather than
 * hardcoding literals, so the two families stay uniform across game modes.
 * Accent colors (per-mode blues/greens/oranges) intentionally stay local.
 */

// ─── Fonts ────────────────────────────────────────────────────────────────────
// Keep in sync with --ui-font in App.css.
export const UI_FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif";
// Chunky display font for big titles (mode carousel, headers).
export const DISPLAY_FONT = "'Bungee', cursive";
// Monospace is reserved for manifold grid IDs (M1-001) and algorithm notation.
export const MONO_FONT = "'SF Mono', ui-monospace, 'Cascadia Code', Menlo, monospace";
// Handwritten pencil font for Mobi's dialogue (self-hosted via
// @fontsource/annie-use-your-telescope, imported in main.jsx).
export const HAND_FONT = "'Annie Use Your Telescope', 'Bradley Hand', 'Segoe Print', cursive";

// ─── PAPER family (light modal sheets) ────────────────────────────────────────
export const PAPER_BACKDROP = 'rgba(160,152,140,0.60)';
export const PAPER_BACKDROP_BLUR = 'blur(18px)';
export const PAPER_SHEET = '#f5f0e8';
export const PAPER_SHEET_RAISED = '#ffffff';
export const PAPER_BORDER = '#cec8be';
export const PAPER_BORDER_SOFT = '#d6d0c8';
export const PAPER_TEXT = '#1e1612';
export const PAPER_TEXT_MUTED = '#7a6e62';
export const PAPER_TEXT_FAINT = '#9a8e82';
export const PAPER_FOOTER_BG = '#ede8df';
export const PAPER_BG_MUTED = '#f0ebe2';
export const PAPER_CARD_SHADOW = '#c4beb6';
export const PAPER_SHADOW = '0 20px 56px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.10)';

// ─── GLASS family (dark in-game overlays) ─────────────────────────────────────
export const GLASS_BACKDROP = 'rgba(6,8,22,0.80)';
export const GLASS_BACKDROP_BLUR = 'blur(24px)';
export const GLASS_PANEL = 'rgba(4,6,20,0.94)';
export const GLASS_PANEL_DEEP = 'rgba(3,6,18,0.97)';
export const GLASS_PANEL_BORDER = 'rgba(255,255,255,0.10)';
export const GLASS_TEXT = 'rgba(230,238,255,0.92)';
export const GLASS_TEXT_MUTED = 'rgba(255,255,255,0.55)';
export const GLASS_TEXT_SOFT = 'rgba(207,230,242,0.92)';
export const GLASS_SHADOW = '0 24px 70px rgba(0,0,0,0.6)';

// ─── Shared radii ─────────────────────────────────────────────────────────────
export const RADIUS_SM = '8px';
export const RADIUS_MD = '12px';
export const RADIUS_LG = '20px';
export const RADIUS_PILL = '999px';
