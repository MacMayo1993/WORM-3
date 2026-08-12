// shared.jsx — the small pieces every setup-wizard step is built from.
//
// Freeplay, Worm, and Disparity each carried their own hand-copied TilePreviewCanvas,
// Checkmark, card style, palette list, and size table. Three copies is how the size
// step ended up with a different tile thumbnail in each mode. They live here now.

import React, { useRef } from 'react';
import { COLOR_SCHEMES, SCHEME_LABELS } from '../../../utils/colorSchemes.js';
import { BACKGROUNDS, getBackgroundUrl } from '../../../utils/backgrounds.js';
import { BG_PREVIEWS } from '../../../utils/bgPreviews.js';
import { registerTilePreview, updateTilePreview, unregisterTilePreview } from '../../../3d/TilePreviewRenderer.js';
import { PAPER_SHEET_RAISED, PAPER_TEXT_FAINT, PAPER_CARD_SHADOW } from '../../../utils/uiTheme.js';

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

/** The raised paper card every picker option sits on, pressed in when selected. */
export const cardStyle = (selected, accent) => ({
  display: 'flex',
  padding: '14px 16px',
  borderRadius: '10px',
  border: selected ? `2px solid ${accent}` : '2px solid #d6d0c8',
  background: selected ? `${accent}12` : PAPER_SHEET_RAISED,
  boxShadow: selected
    ? 'inset 0 2px 5px rgba(0,0,0,0.10), 0 1px 0 rgba(255,255,255,0.6)'
    : `0 3px 0 ${PAPER_CARD_SHADOW}, 0 4px 10px rgba(0,0,0,0.06)`,
  transform: selected ? 'translateY(1px)' : 'none',
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
export function LockPip({ size = 10, color = PAPER_TEXT_FAINT }) {
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
      <span style={{ fontSize: '11px', fontWeight: 700, color: PAPER_TEXT_FAINT, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
        {label}
      </span>
      {hint && <span style={{ fontSize: '10px', color: PAPER_TEXT_FAINT }}>{hint}</span>}
      {children}
      {locked > 0 && (
        <span style={{
          marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '5px',
          fontSize: '9px', fontWeight: 700, letterSpacing: '0.06em', color: PAPER_TEXT_FAINT
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
    idRef.current = registerTilePreview(canvas, styleKey, colorHex);
    return () => { if (idRef.current !== null) unregisterTilePreview(idRef.current); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    if (idRef.current !== null) updateTilePreview(idRef.current, styleKey, colorHex);
  }, [styleKey, colorHex]);

  return <canvas ref={canvasRef} width={size} height={size} style={{ display: 'block', borderRadius: '6px', ...canvasStyle }} />;
}
