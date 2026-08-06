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

// ─── Type scale ───────────────────────────────────────────────────────────────
// Before this existed the game shipped twenty distinct inline `fontSize` values
// between 7px and 54px, most of them clustered in the 9–13px range where the
// difference between two steps is invisible but the inconsistency is not.
//
// These are the sanctioned steps. TEXT_MICRO is deliberately the floor: it is
// for uppercase letter-spaced eyebrows and tabular counters only, never for
// prose. If body copy wants to be smaller than TEXT_SM, the panel is too full.
//
// Numbers, not strings, so callers can do arithmetic (`TEXT_LG * 1.5`) and pass
// them straight to React's style prop, which appends `px` for bare numbers.
export const TEXT_MICRO = 10; // eyebrows, step counters, badge numerals
export const TEXT_XS = 11; // dense labels, tile captions
export const TEXT_SM = 13; // secondary copy, list rows
export const TEXT_MD = 15; // body copy, buttons — the default
export const TEXT_LG = 18; // card titles, section headings
export const TEXT_XL = 24; // panel titles
export const TEXT_2XL = 34; // screen titles
export const TEXT_DISPLAY = 54; // celebration headlines

// Fluid variants for the big steps, so a screen title does not overflow a
// 360px-wide phone and does not look undersized on a desktop monitor. Strings
// (they carry their own units) — use these where the text owns a full-width row.
export const TEXT_XL_FLUID = 'clamp(20px, 5vw, 24px)';
export const TEXT_2XL_FLUID = 'clamp(26px, 7vw, 34px)';
export const TEXT_DISPLAY_FLUID = 'clamp(34px, 11vw, 54px)';

// ─── Layer scale (z-index) ────────────────────────────────────────────────────
// The game had 75 distinct z-index literals spread across 40 files, ranging from
// 0 to 100000 with no ordering scheme — which is how you end up with a countdown
// rendering under a tutorial, and no way to reason about it short of grepping.
//
// These values are the ones already in use, named. Adopting a token is therefore
// a no-op at runtime; the win is that the ordering is now written down in one
// place and a new overlay picks a layer instead of inventing a bigger number.
//
// Only for elements that escape their parent's flow (`position: fixed`, or a
// portal). Small local values — a sticky heading at `zIndex: 2` inside its own
// scroller — stay local and are not part of this scale.
export const Z = {
  // In-scene chrome, drawn over the 3D canvas but under everything else.
  SCENE_FX: 50, // screen-space flip glow, scene loading tint
  HUD: 100, // undo pill, platformer stat readouts
  HUD_RAISED: 200, // floating parity/chaos notifications, RIP log
  CONTROLS: 500, // mobile control cluster, holonomy HUD
  PANEL: 600, // teach-mode panel
  NAV: 900, // Möbius HUD, dimmers behind a briefing panel

  // Panels the player interacts with while the scene stays alive underneath.
  MODAL: 1000, // setup wizards, help, solve mode, rotation selectors
  MODAL_RAISED: 2000, // first-flip tutorial, level & pack select
  BRIEFING: 2500, // Mobi's level briefing (its own 2500–2502 band)
  CELEBRATION: 3000, // victory screen, finale cutscene

  // Transient full-screen beats. Nothing routine belongs above here.
  COUNTDOWN: 8000, // 3-2-1-GO
  CAPTION: 9000, // first-flip caption
  FLASH: 9990, // view-change and random-style ripples
  FULLSCREEN: 9998, // mode screens that replace the whole view
  MENU: 10000, // main menu
  // A dialog opened *from* the main menu has to clear it. Help is the case that
  // exists today: the mode carousel's "How to Play" closes the carousel and
  // opens Help, which drops you back to the menu — and at MODAL the panel
  // rendered underneath it, fully obscured by the logo and START button.
  MENU_DIALOG: 10200,
  INTRO: 10500, // Mobi's intro screen
  DEMO: 12000, // guided demo chrome, above the UI it is pointing at
  TOAST: 99999, // store purchase confirmations
  DEBUG: 100000 // dev console — always on top, by definition
};
