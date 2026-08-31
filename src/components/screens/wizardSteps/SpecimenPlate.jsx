// SpecimenPlate.jsx — the warm dark plate a chosen thing stands on.
//
// One piece of furniture, three specimens: the worm in the worm wizard's
// character step, the cube in every wizard's cosmetic steps, and whatever the
// store is currently showing you. All three want the same frame — a caption row
// with your position in the set, arrows either side of the artwork, a floor glow
// in the specimen's own colour, and a name plate underneath — so the frame lives
// here and the artwork is passed in.
//
// It takes the NIGHT surface: this is a lit display case sitting on Mobi's cream
// paper, and the contrast is what makes the thing on it the subject.

import React from 'react';
import {
  DISPLAY_FONT, UI_CREAM,
  NIGHT_BORDER, NIGHT_TEXT, NIGHT_TEXT_MUTED, NIGHT_SHADOW, NIGHT_TITLE_SHADOW, TEXT_MICRO, TEXT_XS } from '../../../utils/uiTheme.js';
import { useIsMobile } from '../../../hooks/index.js';
import { WIZARD_PAPER_BASE } from '../WizardChrome.jsx';

// NIGHT_SHEET's colour taken opaque — the plate sits on paper rather than over
// the 3D scene — lit from behind by whatever the specimen is wearing.
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
 * @param title     the big name across the plate
 * @param subtitle  the pill under it — a string, or your own node
 * @param onPrev    previous specimen (omit for no arrows)
 * @param onNext    next specimen
 * @param art       the specimen itself: a live cube, a worm, anything
 * @param glow      hex tinting the plate wash, the floor glow, and the pill
 * @param backdrop  { thumbnail, gradient } shown dimmed behind the specimen
 * @param hint      faint line at the bottom ("drag the cube to turn it")
 * @param sticky    pin to the top of a scrolling parent (the wizards do)
 * @param children  anything else below the name plate — swatches, a price, dots
 */
export default function SpecimenPlate({
  caption,
  index,
  total,
  title,
  subtitle,
  onPrev,
  onNext,
  art,
  glow = '#9fdb7a',
  backdrop = null,
  hint = null,
  sticky = false,
  children
}) {
  const isMobile = useIsMobile();
  const plate = (
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
        {/* The chosen scene, under a scrim. The scrim is not decoration: the
            scenes run from a black hole to a snow field, and without it a bright
            one bleaches the name plate off the bottom of the plate. Dimming the
            image alone can't fix that — a pale photo at low opacity is still
            pale — so the darkness is painted on top and the photo reads through
            it at whatever brightness it happens to be.

            It is weighted rather than flat: heavy across the bottom third where
            the name and the action sit, and light through the middle, which is
            the band the specimen occupies. A scrim strong enough to carry white
            text everywhere leaves the whole plate looking like a lights-out
            photo of a cube. */}
        {backdrop && (
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: [
                'linear-gradient(180deg, rgba(14,18,10,0.46) 0%, rgba(14,18,10,0.34) 34%, rgba(14,18,10,0.62) 72%, rgba(14,18,10,0.93) 100%)',
                backdrop.thumbnail ? `url("${backdrop.thumbnail}")` : backdrop.gradient
              ].join(','),
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              // Thrown slightly out of focus, and scaled just past the frame so
              // the blur has no soft edge to show. The scene is depth behind the
              // specimen, not a second thing competing to be looked at.
              filter: 'blur(2px)',
              transform: 'scale(1.08)',
              transition: 'background-image 0.3s ease',
              pointerEvents: 'none'
            }}
          />
        )}

        {/* Caption row */}
        {(caption || index != null) && (
          <div style={{ alignSelf: 'stretch', display: 'flex', alignItems: 'center', gap: '10px', zIndex: 1 }}>
            <span style={{ fontSize: TEXT_MICRO, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: NIGHT_TEXT_MUTED }}>
              {caption}
            </span>
            <div style={{ flex: 1, height: '1px', background: NIGHT_BORDER }} />
            {index != null && total != null && (
              <span style={{ fontSize: TEXT_MICRO, fontWeight: 800, letterSpacing: '0.1em', color: NIGHT_TEXT_MUTED, fontVariantNumeric: 'tabular-nums' }}>
                {index} / {total}
              </span>
            )}
          </div>
        )}

        {/* Arrows + the specimen */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: isMobile ? '4px' : '10px',
          justifyContent: 'center', position: 'relative', alignSelf: 'stretch'
        }}>
          <div style={{
            position: 'absolute', bottom: '2px', left: '50%', transform: 'translateX(-50%)',
            width: '60%', maxWidth: '190px', height: '16px',
            background: `radial-gradient(ellipse, ${glow}4d 0%, transparent 70%)`,
            borderRadius: '50%', pointerEvents: 'none', transition: 'background 0.4s ease'
          }} />

          {onPrev
            ? <button onClick={onPrev} aria-label={`Previous ${caption?.toLowerCase() || 'option'}`} style={plateArrow}>‹</button>
            : <span style={{ width: '38px', flexShrink: 0 }} />}

          <div style={{ zIndex: 1, display: 'flex', justifyContent: 'center', flex: 1, minWidth: 0 }}>
            {art}
          </div>

          {onNext
            ? <button onClick={onNext} aria-label={`Next ${caption?.toLowerCase() || 'option'}`} style={plateArrow}>›</button>
            : <span style={{ width: '38px', flexShrink: 0 }} />}
        </div>

        {/* Name plate */}
        {title != null && (
          <div style={{ textAlign: 'center', zIndex: 1 }}>
            <div style={{
              fontFamily: DISPLAY_FONT,
              fontSize: isMobile ? '15px' : '18px',
              color: UI_CREAM, letterSpacing: '0.02em', lineHeight: 1.15,
              textShadow: NIGHT_TITLE_SHADOW, marginBottom: subtitle ? '7px' : 0
            }}>
              {String(title).toUpperCase()}
            </div>
            {typeof subtitle === 'string' ? (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                background: `${glow}28`, border: `1px solid ${glow}55`,
                color: glow, fontSize: TEXT_MICRO, fontWeight: 800,
                letterSpacing: '0.14em', textTransform: 'uppercase',
                padding: '3px 11px', borderRadius: '999px',
                transition: 'all 0.4s ease'
              }}>
                {subtitle}
              </div>
            ) : subtitle}
          </div>
        )}

        {children}

        {hint && (
          <div style={{ fontSize: TEXT_XS, color: NIGHT_TEXT, opacity: 0.4, letterSpacing: '0.06em', zIndex: 1 }}>
            {hint}
          </div>
        )}
      </div>
    </div>
  );

  if (!sticky) return plate;

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
      {plate}
    </div>
  );
}
