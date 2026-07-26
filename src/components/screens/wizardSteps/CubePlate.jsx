// CubePlate.jsx — the hero of every cosmetic step: your actual cube, alive.
//
// Modelled on the worm wizard's character plate, which is the one place in the
// app where picking something showed you the thing itself. The cube gets the
// same treatment: a warm dark specimen plate on Mobi's paper, the live 3D cube
// tumbling in the middle of it, and a name plate underneath that re-labels
// itself for whichever choice the current step is making.
//
// It sticks to the top of the wizard body, so the palette you scroll to on the
// far side of the list still lands on a cube you can see.

import React from 'react';
import CubePreviewCanvas from '../../../3d/CubePreviewCanvas.jsx';
import { isMobile } from '../../../utils/device.js';
import {
  DISPLAY_FONT, UI_CREAM,
  NIGHT_BORDER, NIGHT_TEXT, NIGHT_TEXT_MUTED, NIGHT_SHADOW, NIGHT_TITLE_SHADOW
} from '../../../utils/uiTheme.js';
import { WIZARD_PAPER_BASE } from '../WizardChrome.jsx';

// The plate surface: NIGHT_SHEET's colour taken opaque (it sits on cream paper,
// not over the 3D scene), lit from behind by whatever colour the specimen on it
// is wearing. Exported because the worm wizard's character plate is the same
// piece of furniture with a worm on it instead of a cube.
export const plateSurface = glow => ({
  backgroundColor: '#1c2316',
  backgroundImage: [
    `radial-gradient(ellipse at 50% 46%, ${glow}30 0%, transparent 64%)`,
    'linear-gradient(rgba(255,245,220,0.05) 1px, transparent 1px)',
    'linear-gradient(90deg, rgba(255,245,220,0.05) 1px, transparent 1px)',
    'linear-gradient(165deg, rgba(255,245,220,0.07), rgba(12,16,9,0.55))'
  ].join(','),
  backgroundSize: '100% 100%, 22px 22px, 22px 22px, 100% 100%',
  transition: 'background-image 0.4s ease'
});

export const plateArrow = {
  background: 'rgba(255,245,220,0.10)',
  border: `1.5px solid ${NIGHT_BORDER}`,
  color: UI_CREAM,
  width: '38px',
  height: '38px',
  borderRadius: '50%',
  cursor: 'pointer',
  fontSize: '22px',
  lineHeight: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  fontFamily: 'inherit',
  transition: 'all 0.15s ease',
  paddingBottom: '2px',
  WebkitTapHighlightColor: 'transparent',
  zIndex: 2
};

/**
 * @param caption   small uppercase label for what the arrows step through
 * @param index     1-based position in that set (omit to hide the counter)
 * @param total     size of that set
 * @param title     the big name — palette, style, or cube size
 * @param subtitle  the pill under it, usually the other two choices
 * @param onPrev    previous option (omit for no arrows)
 * @param onNext    next option
 * @param cube      { size, colors, tileStyle, perFaceStyles } for the live cube
 * @param glow      hex tinting the plate wash and the floor glow
 * @param backdrop  { thumbnail, gradient } — the chosen scene, behind the cube
 * @param swatches  the palette's six colours, as a strip under the name plate
 */
export default function CubePlate({
  caption,
  index,
  total,
  title,
  subtitle,
  onPrev,
  onNext,
  cube,
  glow = '#9fdb7a',
  backdrop = null,
  swatches = null
}) {
  const cubePx = isMobile ? 138 : 176;

  return (
    <div style={{
      position: 'sticky',
      top: 0,
      zIndex: 3,
      // The plate is opaque, but the paper has to fill the gap its rounded
      // corners leave or the list scrolls visibly through them.
      background: `linear-gradient(${WIZARD_PAPER_BASE} calc(100% - 10px), rgba(251,247,233,0))`,
      paddingBottom: '10px',
      marginBottom: '4px'
    }}>
      <div style={{
        borderRadius: '18px',
        overflow: 'hidden',
        border: `1.5px solid ${NIGHT_BORDER}`,
        boxShadow: NIGHT_SHADOW
      }}>
        <div style={{
          ...plateSurface(glow),
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: isMobile ? '8px' : '10px',
          padding: isMobile ? '12px 12px 14px' : '14px 18px 16px'
        }}>
          {/* The chosen scene, dimmed right down — enough to tell two backgrounds
              apart without turning the cube into a silhouette against it. */}
          {backdrop && (
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: backdrop.thumbnail ? `url(${backdrop.thumbnail})` : backdrop.gradient,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                opacity: 0.34,
                transition: 'opacity 0.3s ease',
                pointerEvents: 'none'
              }}
            />
          )}

          {/* Caption row */}
          <div style={{ alignSelf: 'stretch', display: 'flex', alignItems: 'center', gap: '10px', zIndex: 1 }}>
            <span style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: NIGHT_TEXT_MUTED }}>
              {caption}
            </span>
            <div style={{ flex: 1, height: '1px', background: NIGHT_BORDER }} />
            {index != null && total != null && (
              <span style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '0.1em', color: NIGHT_TEXT_MUTED, fontVariantNumeric: 'tabular-nums' }}>
                {index} / {total}
              </span>
            )}
          </div>

          {/* Arrows + the cube itself */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: isMobile ? '4px' : '10px',
            justifyContent: 'center', position: 'relative', alignSelf: 'stretch'
          }}>
            <div style={{
              position: 'absolute', bottom: '2px', left: '50%', transform: 'translateX(-50%)',
              width: '150px', height: '16px',
              background: `radial-gradient(ellipse, ${glow}4d 0%, transparent 70%)`,
              borderRadius: '50%', pointerEvents: 'none', transition: 'background 0.4s ease'
            }} />

            {onPrev
              ? <button onClick={onPrev} aria-label={`Previous ${caption?.toLowerCase() || 'option'}`} style={plateArrow}>‹</button>
              : <span style={{ width: '38px', flexShrink: 0 }} />}

            <div style={{ zIndex: 1, display: 'flex', justifyContent: 'center', flex: 1 }}>
              <CubePreviewCanvas
                px={cubePx}
                size={cube.size}
                colors={cube.colors}
                tileStyle={cube.tileStyle}
                perFaceStyles={cube.perFaceStyles}
              />
            </div>

            {onNext
              ? <button onClick={onNext} aria-label={`Next ${caption?.toLowerCase() || 'option'}`} style={plateArrow}>›</button>
              : <span style={{ width: '38px', flexShrink: 0 }} />}
          </div>

          {/* Name plate */}
          <div style={{ textAlign: 'center', zIndex: 1 }}>
            <div style={{
              fontFamily: DISPLAY_FONT,
              fontSize: isMobile ? '15px' : '18px',
              color: UI_CREAM, letterSpacing: '0.02em', lineHeight: 1.15,
              textShadow: NIGHT_TITLE_SHADOW, marginBottom: subtitle ? '7px' : 0
            }}>
              {String(title).toUpperCase()}
            </div>
            {subtitle && (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                background: `${glow}28`, border: `1px solid ${glow}55`,
                color: glow, fontSize: '9px', fontWeight: 800,
                letterSpacing: '0.14em', textTransform: 'uppercase',
                padding: '3px 11px', borderRadius: '999px',
                transition: 'all 0.4s ease'
              }}>
                {subtitle}
              </div>
            )}
          </div>

          {/* The palette itself, in face order, so a scheme is readable even on
              the faces the tumble has turned away. */}
          {swatches && (
            <div style={{ display: 'flex', gap: '5px', zIndex: 1 }}>
              {swatches.map((hex, i) => (
                <div key={i} style={{
                  width: '18px', height: '7px', borderRadius: '3px', background: hex,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.35)', transition: 'background 0.3s ease'
                }} />
              ))}
            </div>
          )}

          {onPrev && (
            <div style={{ fontSize: '9px', color: NIGHT_TEXT, opacity: 0.4, letterSpacing: '0.06em', zIndex: 1 }}>
              drag the cube to turn it
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
