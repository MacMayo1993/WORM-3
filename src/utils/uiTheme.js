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
// Four self-hosted faces, one job each. Every one ships with the bundle via
// Fontsource (imported in main.jsx) — never a CDN <link>, which silently falls
// back to a system serif on a blocked or slow connection and destroys the
// game's typography on exactly the devices that can least afford it.
//
//   UI_FONT      Nunito   — body, buttons, labels, HUD. Rounded terminals and a
//                           tall x-height, so 11px tile captions stay legible
//                           and the warm paper surfaces do not read as a form.
//   HEADING_FONT Outfit   — screen and card titles. Geometric and wide where
//                           Nunito is soft and narrow, which is what makes a
//                           heading read as a heading without a size jump.
//   DISPLAY_FONT Bungee   — mode names, screen/result titles and the brand.
//   HAND_FONT    Annie…   — Mobi's dialogue.
//
// Both new faces are variable (wght axis), so weight is a free axis: use 400
// for body, 600 for emphasis, 700–800 for headings, rather than reaching for a
// different family. Keep in sync with --ui-font / --heading-font in App.css.
export const UI_FONT = "'Nunito Variable', -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif";
// Geometric headings for compact sections; Bungee carries major game titles.
export const HEADING_FONT = "'Outfit Variable', 'Nunito Variable', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
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
export const PAPER_BACKDROP_BLUR = 'var(--paper-blur, blur(8px))';
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
// Semantic status inks on the paper surface — a warm terracotta for "over
// budget" (over par) and a moss green for "on track". Read against PAPER_SHEET.
export const PAPER_WARN = '#b06a2e';
export const PAPER_GOOD = '#426b2e';

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
export const NIGHT_BACKDROP_BLUR = 'var(--night-blur, blur(6px))';
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
export const UI_ACTION_SHADOW = '0 4px 0 #405832, 0 6px 12px rgba(30,22,18,0.12)';

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

// ARCADE_* — the mode carousel's look, shared by every screen that stops play
// or sets it up: cream graph paper, deep green ink, ivory keys that sit on a
// hard 4px ledge, and one chunky primary key in the mode's cube-face colour.
// PAPER_* and NIGHT_* remain for panels this family has not replaced yet.
export const ARCADE_INK = '#26372d';
export const ARCADE_INK_STRONG = '#354d3c';
export const ARCADE_MUTED = '#6a705e';
export const ARCADE_PAPER = '#f8f4e8';
export const ARCADE_CARD = '#fffcf1';
export const ARCADE_LINE = '#c6c5ac';
export const ARCADE_LINE_SOFT = '#d1d0b8';
export const ARCADE_FOCUS = '#2774ad';
// Graph paper: the carousel's in-scene backdrop, as CSS for DOM screens.
export const ARCADE_GRID = 'linear-gradient(#cfcdbf66 1px, transparent 1px), linear-gradient(90deg, #cfcdbf66 1px, transparent 1px)';
export const ARCADE_GRID_SIZE = '30px 30px';
export const ARCADE_KEY_SHADOW = `0 4px 0 ${ARCADE_LINE}, inset 0 2px 0 #fff`;
export const ARCADE_PRIMARY_SHADOW = `0 6px 0 ${ARCADE_INK_STRONG}, 0 10px 18px ${ARCADE_INK_STRONG}20, inset 0 3px 0 #ffffff70`;
export const ARCADE_CARD_SHADOW = `0 6px 0 ${ARCADE_LINE}, 0 18px 40px ${ARCADE_INK_STRONG}24`;

/** CSS screens consume the same tokens as inline React styles. */
export const UI_CSS_VARS = {
  '--bg-primary': PAPER_SHEET,
  '--bg-secondary': PAPER_FOOTER_BG,
  '--bg-elevated': PAPER_SHEET_RAISED,
  '--text-primary': PAPER_TEXT,
  '--text-secondary': PAPER_TEXT_MUTED,
  '--ui-font': UI_FONT,
  '--heading-font': HEADING_FONT,
  '--display-font': DISPLAY_FONT,
  '--mono-font': MONO_FONT,
  '--ui-title-size': TEXT_DISPLAY_FLUID,
  '--ui-heading-size': TEXT_2XL_FLUID,
  '--ui-body-size': `${TEXT_MD}px`,
  '--ui-small-size': `${TEXT_SM}px`,
  '--ui-micro-size': `${TEXT_MICRO}px`,
  '--ui-ink': PAPER_TEXT,
  '--ui-ink-subtle': PAPER_TEXT_MUTED,
  '--ui-border': PAPER_BORDER_SOFT,
  '--night-sheet': NIGHT_SHEET,
  '--night-backdrop': NIGHT_BACKDROP,
  '--night-panel': NIGHT_PANEL,
  '--night-border': NIGHT_BORDER,
  '--night-text': NIGHT_TEXT,
  '--night-text-muted': NIGHT_TEXT_MUTED,
  '--night-shadow': NIGHT_SHADOW,
  '--ui-moss': UI_MOSS,
  '--arcade-ink': ARCADE_INK,
  '--arcade-ink-strong': ARCADE_INK_STRONG,
  '--arcade-muted': ARCADE_MUTED,
  '--arcade-paper': ARCADE_PAPER,
  '--arcade-card': ARCADE_CARD,
  '--arcade-line': ARCADE_LINE,
  '--arcade-line-soft': ARCADE_LINE_SOFT,
  '--arcade-focus': ARCADE_FOCUS,
  '--arcade-grid': ARCADE_GRID,
  '--arcade-grid-size': ARCADE_GRID_SIZE,
  '--arcade-key-shadow': ARCADE_KEY_SHADOW,
  '--arcade-primary-shadow': ARCADE_PRIMARY_SHADOW,
  '--arcade-card-shadow': ARCADE_CARD_SHADOW,
  '--ui-action-shadow': UI_ACTION_SHADOW,
};

// In-game instruments: neutral warm charcoal with one active-control accent.
// Face colours remain reserved for the cube and its inventory samples.
export const GAME_HUD = {
  surface: 'rgba(32,35,29,0.94)',
  raised: '#34372f',
  inset: '#1b1e19',
  border: 'rgba(255,245,220,0.18)',
  text: '#fff6e8',
  muted: '#b8b6aa',
  accent: '#d8a1cf',
  active: '#574052',
  warning: '#eab879',
};
export const GAME_HUD_VARS = Object.fromEntries(
  Object.entries(GAME_HUD).map(([key, value]) => [`--hud-${key}`, value])
);
