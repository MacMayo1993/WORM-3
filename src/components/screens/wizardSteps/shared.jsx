// shared.jsx — the small pieces every setup-wizard step is built from.
//
// Freeplay, Worm, and Disparity each carried their own hand-copied TilePreviewCanvas,
// Checkmark, card style, palette list, and size table. Three copies is how the size
// step ended up with a different tile thumbnail in each mode. They live here now.

import React, { useRef } from 'react';
import { COLOR_SCHEMES, SCHEME_LABELS, TILE_STYLES } from '../../../utils/colorSchemes.js';
import { BACKGROUNDS, getBackgroundUrl } from '../../../utils/backgrounds.js';
import { BG_PREVIEWS } from '../../../utils/bgPreviews.js';
import { registerTilePreview, updateTilePreview, unregisterTilePreview, setTilePreviewVisible } from '../../../3d/TilePreviewRenderer.js';
import { TEXT_XS } from '../../../utils/uiTheme.js';
import { WIZ_SURFACE, WIZ_SURFACE_RAISED, WIZ_BORDER, WIZ_BORDER_SOFT, WIZ_TEXT, WIZ_TEXT_MUTED, WIZ_TEXT_FAINT, WIZ_CARD_SHADOW } from '../WizardChrome.jsx';

// ─── Catalogue data ───────────────────────────────────────────────────────────

export const BG_OPTIONS = BACKGROUNDS.map(bg => ({
  value: bg.id,
  label: bg.label,
  thumbnail: bg.thumbnail ? getBackgroundUrl(bg.thumbnail) : null,
  gradient: BG_PREVIEWS[bg.id] || 'linear-gradient(135deg, #333 0%, #000 100%)'
}));

// Palettes offered in a wizard. `biome` is a mode rather than a palette, and
// `custom` only exists once you have uploaded an image, so neither is listed.
export const WIZARD_SCHEME_KEYS = Object.keys(SCHEME_LABELS).filter(k => k !== 'biome' && k !== 'custom');

/**
 * The scene a background id names, ready to hang behind a specimen plate.
 *
 * Every plate takes it, not just the scene step's: once you have chosen where
 * you are playing, the cube should keep standing there while you pick its
 * colours, its tiles, and its size — otherwise the scene reads as a decision
 * that only mattered on the screen you made it.
 */
export const bgOptionFor = id => BG_OPTIONS.find(o => o.value === id) || null;

export const FACE_LABELS = { 1: 'Front', 2: 'Left', 3: 'Top', 4: 'Back', 5: 'Right', 6: 'Bottom' };

// One row per stop on the size slider.
export const SIZE_TIERS = [
  { n: 2, name: '2×2×2', tag: 'Mini', desc: 'Fast & approachable' },
  { n: 3, name: '3×3×3', tag: 'Classic', desc: 'The original challenge' },
  { n: 4, name: '4×4×4', tag: 'Master', desc: 'Expert territory' },
  { n: 5, name: '5×5×5', tag: 'Ultra', desc: '150 stickers of chaos' },
  { n: 6, name: '6×6×6', tag: 'Mega', desc: '216 stickers of madness' },
  { n: 7, name: '7×7×7', tag: 'Titan', desc: '294 stickers of insanity' }
];

export const MIN_CUBE_SIZE = SIZE_TIERS[0].n;
export const MAX_CUBE_SIZE = SIZE_TIERS[SIZE_TIERS.length - 1].n;

export const sizeTier = (n, tiers = SIZE_TIERS) => tiers.find(t => t.n === n) || tiers[1];

// ─── Category value labels ────────────────────────────────────────────────────
//
// What each wizard category currently holds, in one line. The rail writes these
// under its category names and the specimen plates put them under the cube, so
// they have to be the same words — three steps used to compute their own and had
// already drifted on what an uploaded palette is called.

export const sceneLabel = settings => bgOptionFor(settings.backgroundTheme)?.label || 'Scene';

export const paletteLabel = settings =>
  (settings.colorScheme === 'custom' ? 'Your Photo' : SCHEME_LABELS[settings.colorScheme] || 'Standard');

/**
 * The one style all six faces are wearing, or null when they disagree. Faces
 * left out of the override map fall back to the global style, so a non-null map
 * is not by itself a mixed cube.
 */
export const uniformStyle = settings => {
  const perFace = settings.perFaceStyles;
  const values = [1, 2, 3, 4, 5, 6].map(id => perFace?.[id] || settings.tileStyle || 'solid');
  return values.every(v => v === values[0]) ? values[0] : null;
};

export const styleLabel = settings => {
  if (settings.tileStyle === 'random' && !settings.perFaceStyles) return 'Random Mix';
  const uniform = uniformStyle(settings);
  return uniform ? TILE_STYLES[uniform]?.label || uniform : 'Per Face';
};

export const sizeLabel = (n, tiers = SIZE_TIERS) => sizeTier(n, tiers).name;

// ─── Colour helpers ───────────────────────────────────────────────────────────

/** Perceived brightness of a hex colour (0–255); higher = lighter. */
export const hexLum = hex => {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b;
};

// COLOR_SCHEMES is static, so the brightness-sorted preview swatches only need
// computing once at module load rather than re-sorting on every render.
export const SORTED_SCHEME_COLORS = Object.fromEntries(
  Object.keys(SCHEME_LABELS).map(key => [
    key,
    Object.values(COLOR_SCHEMES[key] || {}).slice(0, 6).sort((a, b) => hexLum(b) - hexLum(a))
  ])
);

/** The six face colours a wizard's current settings resolve to. */
export function resolveWizardColors(settings) {
  if (settings.colorScheme === 'custom' && settings.customColors) {
    return { ...COLOR_SCHEMES.standard, ...settings.customColors };
  }
  return COLOR_SCHEMES[settings.colorScheme] || COLOR_SCHEMES.standard;
}

// ─── Card chrome ──────────────────────────────────────────────────────────────

/**
 * The card every picker option sits on. On the dark sheet a selected card lights
 * up rather than pressing in: the paper version leaned on an inset shadow and a
 * white top edge, and neither reads on near-black.
 */
export const cardStyle = (selected, accent) => ({
  display: 'flex',
  padding: '14px 16px',
  borderRadius: '10px',
  border: `2px solid ${selected ? accent : WIZ_BORDER_SOFT}`,
  background: selected ? `${accent}26` : WIZ_SURFACE,
  boxShadow: selected
    ? `0 0 18px ${accent}44, inset 0 0 22px ${accent}22`
    : `0 2px 10px ${WIZ_CARD_SHADOW}`,
  color: WIZ_TEXT,
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  WebkitTapHighlightColor: 'transparent',
  textAlign: 'left',
  width: '100%',
  fontFamily: 'inherit',
  position: 'relative'
});

export function Checkmark({ accent, accentShadow, size = 20 }) {
  return (
    <div style={{
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: '5px',
      background: accent,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      boxShadow: `0 2px 0 ${accentShadow}`
    }}>
      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
        <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

/** Small padlock for cosmetics that have to be bought in the Parity Store first. */
export function LockPip({ size = 10, color = WIZ_TEXT_FAINT }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" style={{ display: 'block', flexShrink: 0 }} aria-hidden="true">
      <path d="M5 7V5a3 3 0 0 1 6 0v2" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      <rect x="3.2" y="7" width="9.6" height="7" rx="2" fill={color} />
    </svg>
  );
}

/** Heading above a picker, with a live count of what is still locked. */
export function PickerHeading({ label, hint, locked = 0, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '9px', margin: '0 0 8px' }}>
      <span style={{ fontSize: '11px', fontWeight: 700, color: WIZ_TEXT_MUTED, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
        {label}
      </span>
      {hint && <span style={{ fontSize: '10px', color: WIZ_TEXT_FAINT }}>{hint}</span>}
      {children}
      {locked > 0 && (
        <span style={{
          marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '5px',
          fontSize: TEXT_XS, fontWeight: 700, letterSpacing: '0.06em', color: WIZ_TEXT_FAINT
        }}>
          <LockPip size={9} /> {locked} in the store
        </span>
      )}
    </div>
  );
}

// ─── Flat tile thumbnail ──────────────────────────────────────────────────────

/**
 * A single tile drawn with its real shader — the chip used in the style rail and
 * the palette cards. The hero cube is CubePreviewCanvas; this is the cheap one.
 */
export function TilePreviewCanvas({ styleKey, colorHex = '#4a7fa5', size = 48, canvasStyle }) {
  const canvasRef = useRef(null);
  const idRef = useRef(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = size;
    canvas.height = size;
    const id = registerTilePreview(canvas, styleKey, colorHex);
    idRef.current = id;

    // A style family is a scrolling grid of dozens of these, and every animated
    // one costs a GPU readback per drawn frame. Only the tiles actually in the
    // scroller's viewport need to keep moving; the rest hold their last frame
    // until they come back into view. No IntersectionObserver (jsdom, old
    // WebViews) just means everything animates, as before.
    let observer = null;
    if (typeof IntersectionObserver === 'function') {
      setTilePreviewVisible(id, false);
      observer = new IntersectionObserver(
        entries => { for (const entry of entries) setTilePreviewVisible(id, entry.isIntersecting); },
        // A little margin so a tile is already moving by the time it is read.
        { rootMargin: '120px' }
      );
      observer.observe(canvas);
    }

    return () => {
      observer?.disconnect();
      unregisterTilePreview(id);
      idRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    if (idRef.current !== null) updateTilePreview(idRef.current, styleKey, colorHex);
  }, [styleKey, colorHex]);

  return <canvas ref={canvasRef} width={size} height={size} style={{ display: 'block', borderRadius: '6px', ...canvasStyle }} />;
}
