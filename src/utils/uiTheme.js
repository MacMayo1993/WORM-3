/**
 * uiTheme.js — Central UI theme tokens shared by every screen, menu, and HUD.
 *
 * WORM³ uses one warm field-guide visual system throughout the game. Mobi's
 * cream paper is the default surface; moss green is the shared affirmative
 * action; the STEP COMPLETE treatment is reserved for full-screen moments.
 * Dark translucent glass is not a third visual family.
 *
 * Every screen must pull its fonts and shared semantic colours from here rather
 * than introducing a new visual language. Mode colours may identify a mode or
 * cube face, but must not replace the shared hierarchy for titles, body copy,
 * cards, and actions.
 */

// ─── Fonts ────────────────────────────────────────────────────────────────────
// Keep in sync with --ui-font in App.css.
export const UI_FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif";
// Chunky display font for big titles (mode carousel, headers).
// Fallbacks are heavy sans faces — never `cursive`: on Android the generic
// cursive is Dancing Script, which flashes wildly different text while the
// webfont downloads.
export const DISPLAY_FONT = "'Bungee', 'Arial Black', 'Franklin Gothic Bold', sans-serif";
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

// ─── Legacy overlay values ────────────────────────────────────────────────────
// Existing in-game overlays still consume these while they are migrated to the
// warm field-guide system. Do not use them for new screens.
export const GLASS_BACKDROP = 'rgba(6,8,22,0.80)';
export const GLASS_BACKDROP_BLUR = 'blur(24px)';
export const GLASS_PANEL = 'rgba(4,6,20,0.94)';
export const GLASS_PANEL_DEEP = 'rgba(3,6,18,0.97)';
export const GLASS_PANEL_BORDER = 'rgba(255,255,255,0.10)';
export const GLASS_TEXT = 'rgba(230,238,255,0.92)';
export const GLASS_TEXT_MUTED = 'rgba(255,255,255,0.55)';
export const GLASS_TEXT_SOFT = 'rgba(207,230,242,0.92)';
export const GLASS_SHADOW = '0 24px 70px rgba(0,0,0,0.6)';

// ─── Shared semantic accents ─────────────────────────────────────────────────
// These are intentionally mode-neutral. Use FACE colours only for game state.
export const UI_CREAM = '#fffdf2';
export const UI_GOLD = '#ffe9ad';
export const UI_MOSS = '#5f7f4a';
export const UI_MOSS_LIGHT = '#9fdb7a';
export const UI_ACTION_SHADOW = '0 8px 20px rgba(95,127,74,0.32)';

// ─── Shared radii ─────────────────────────────────────────────────────────────
export const RADIUS_SM = '8px';
export const RADIUS_MD = '12px';
export const RADIUS_LG = '20px';
export const RADIUS_PILL = '999px';
