import { fusionLookOf } from './healerWorm/fusionLooks.js';
import { SIGIL_ICONS } from './healerWorm/fusionSigils.js';

// A fusion's glyph: its sigil (fusionSigils.js), the same motif its reaction draws on
// the cube, bright on dark enamel inside a ring in the reaction's colour, so the HUD and
// the cube teach one picture per recipe.
export default function FusionSigilIcon({ recipe, size = 18, className }) {
    const look = fusionLookOf(recipe);
    const path = look && SIGIL_ICONS[look.sigil];
    if (!path) return null;
    return (
        <svg className={className} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false"
            data-sigil={look.sigil} style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="11" fill="#173d2a" stroke={look.color} strokeWidth="2" />
            <g transform="translate(12 12) scale(0.68) translate(-12 -12)">
                <path d={path} fill="none" stroke={look.sigilColor} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </g>
        </svg>
    );
}
