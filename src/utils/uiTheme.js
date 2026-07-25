/**
 * uiTheme.js — Central UI theme tokens shared by every screen, menu, and HUD.
 *
 * WORM³ uses one warm field-guide visual system throughout the game. Mobi's
 * cream paper (PAPER_*) is the default surface; the warm dark STEP COMPLETE
 * treatment (NIGHT_*) covers moments layered over the live 3D scene; moss green
 * is the shared affirmative action across both. Cold navy glass was a third
 * family and has been removed — if a screen needs a dark surface it takes
 * NIGHT_*, which is the same world as the paper rather than a different app.
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

// ─── NIGHT family (the STEP COMPLETE treatment) ───────────────────────────────
// The second half of the field-guide system: a warm, dark surface for moments
// that sit over the live 3D scene — full-screen celebrations, in-scene viewers,
// and the mode carousel. Warm charcoal-green rather than the old cold navy, so
// it reads as the same world as Mobi's paper rather than a different app.
//
// Choosing between the two families:
//   PAPER — the player is reading or deciding, and the panel owns the screen
//           (setup wizards, the store, help, level select, teaching modals).
//   NIGHT — the panel is a layer over something alive that must stay visible
//           (victory, the carousel over the menu cube, in-scene viewers).
//
// These values were previously copied by hand into VictoryScreen and SolveMode;
// they live here now so the treatment stays one thing.
export const NIGHT_BACKDROP = 'radial-gradient(ellipse at center, rgba(24,31,18,0.55) 0%, rgba(24,31,18,0.86) 100%)';
export const NIGHT_BACKDROP_BLUR = 'blur(9px) saturate(1.03)';
export const NIGHT_SHEET = 'rgba(28,35,22,0.94)';
export const NIGHT_PANEL = 'rgba(250,247,238,0.08)';
export const NIGHT_BORDER = 'rgba(255,245,220,0.18)';
export const NIGHT_TEXT = 'rgba(255,253,242,0.86)';
export const NIGHT_TEXT_MUTED = 'rgba(255,253,242,0.60)';
export const NIGHT_TITLE_SHADOW = '0 3px 0 rgba(43,53,35,0.55), 0 10px 34px rgba(24,31,18,0.6)';
export const NIGHT_SOFT_SHADOW = '0 2px 12px rgba(24,31,18,0.7)';
export const NIGHT_SHADOW = '0 24px 70px rgba(24,31,18,0.55)';

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
