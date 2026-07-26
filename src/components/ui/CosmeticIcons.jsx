// CosmeticIcons.jsx — shared artwork for worm cosmetics (skin bodies + hats).
//
// The Parity Store and the Worm setup wizard both have to draw a skin and a hat
// at chip size. They used to do it separately: the store drew SVG hats, the
// wizard printed the hat's name as plain text. The same crown therefore looked
// like two unrelated things depending on whether you were buying it or equipping
// it. Both screens now render from here so a cosmetic looks like itself
// everywhere.

import React from 'react';
import { PAPER_TEXT_FAINT } from '../../utils/uiTheme.js';

/** Coiled worm body in a skin's colours — the store card / skin chip preview. */
export function WormSkinIcon({ skin, size = 46 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <circle cx="35" cy="14" r="16" fill={skin.glow} opacity="0.18" />
      <path d="M 9 41 Q 18 32 27 24 Q 31 19 35 14"
        stroke={skin.body} strokeWidth="10" strokeLinecap="round" fill="none" opacity="0.45" />
      <circle cx="9" cy="41" r="5" fill={skin.belly} opacity="0.8" />
      <circle cx="18" cy="33" r="7.5" fill={skin.body} />
      <ellipse cx="18" cy="35.5" rx="4" ry="2.8" fill={skin.belly} opacity="0.55" />
      <circle cx="27" cy="24" r="9.5" fill={skin.body} />
      <ellipse cx="27" cy="26.5" rx="5.5" ry="3.8" fill={skin.belly} opacity="0.55" />
      <circle cx="35" cy="14" r="12" fill={skin.body} />
      <ellipse cx="35" cy="17.5" rx="7.5" ry="5" fill={skin.belly} opacity="0.6" />
      <circle cx="30.5" cy="10" r="3.1" fill="white" opacity="0.95" />
      <circle cx="39" cy="9" r="3.1" fill="white" opacity="0.95" />
      <circle cx="31.5" cy="10.5" r="1.7" fill="#0d0d1a" />
      <circle cx="40" cy="9.5" r="1.7" fill="#0d0d1a" />
      <circle cx="30.8" cy="9.2" r="0.85" fill="white" />
      <circle cx="39.3" cy="8.2" r="0.85" fill="white" />
      <path d="M 29.5 17 Q 35 22.5 40.5 17"
        stroke="#0d0d1a" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.3" />
    </svg>
  );
}

/** Flat hat silhouette in a single ink colour, with its own accent details. */
export function HatIcon({ hatId, color = PAPER_TEXT_FAINT, size = 30 }) {
  if (hatId === 'none') return (
    <svg width={size} height={size} viewBox="0 0 32 32">
      <circle cx="16" cy="16" r="12" stroke={color} strokeWidth="1.5" fill="none" strokeDasharray="4 3" opacity="0.5" />
      <line x1="10" y1="10" x2="22" y2="22" stroke={color} strokeWidth="1.5" opacity="0.4" />
    </svg>
  );
  if (hatId === 'tophat') return (
    <svg width={size} height={size} viewBox="0 0 32 32">
      <rect x="8" y="8" width="16" height="14" rx="1" fill={color} />
      <rect x="4" y="21" width="24" height="4" rx="2" fill={color} />
      <rect x="10" y="10" width="12" height="10" rx="1" fill="rgba(0,0,0,0.18)" />
    </svg>
  );
  if (hatId === 'party') return (
    <svg width={size} height={size} viewBox="0 0 32 32">
      <polygon points="16,4 6,26 26,26" fill={color} />
      <circle cx="9" cy="20" r="1.5" fill="#f59e0b" />
      <circle cx="20" cy="15" r="1.5" fill="#ec4899" />
      <circle cx="14" cy="22" r="1.5" fill="#06b6d4" />
    </svg>
  );
  if (hatId === 'crown') return (
    <svg width={size} height={size} viewBox="0 0 32 32">
      <polygon points="4,22 4,12 10,18 16,8 22,18 28,12 28,22" fill={color} />
      <rect x="4" y="22" width="24" height="4" rx="1" fill={color} />
      <circle cx="16" cy="9" r="2" fill="#f59e0b" />
    </svg>
  );
  if (hatId === 'halo') return (
    <svg width={size} height={size} viewBox="0 0 32 32">
      <ellipse cx="16" cy="13" rx="12" ry="4" fill="none" stroke={color} strokeWidth="2.5" />
      <ellipse cx="16" cy="13" rx="12" ry="4" fill={color} opacity="0.15" />
    </svg>
  );
  if (hatId === 'beanie') return (
    <svg width={size} height={size} viewBox="0 0 32 32">
      <path d="M 6 20 Q 16 2 26 20 Z" fill={color} />
      <rect x="4" y="19" width="24" height="5" rx="2.5" fill={color} />
      <rect x="4" y="19" width="24" height="5" rx="2.5" fill="rgba(0,0,0,0.18)" />
      <circle cx="16" cy="4.5" r="2.6" fill={color} />
    </svg>
  );
  if (hatId === 'wizard') return (
    <svg width={size} height={size} viewBox="0 0 32 32">
      <ellipse cx="16" cy="25" rx="12" ry="3" fill={color} />
      <polygon points="16,3 8,25 24,25" fill={color} />
      <circle cx="15" cy="17" r="1.6" fill="#fde68a" />
      <circle cx="18" cy="11" r="1.2" fill="#fde68a" />
    </svg>
  );
  if (hatId === 'flower') return (
    <svg width={size} height={size} viewBox="0 0 32 32">
      <line x1="16" y1="28" x2="16" y2="15" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      {[0, 1, 2, 3, 4, 5].map(i => {
        const a = (i / 6) * Math.PI * 2;
        return <circle key={i} cx={16 + Math.cos(a) * 6} cy={13 + Math.sin(a) * 6} r="3.5" fill={color} />;
      })}
      <circle cx="16" cy="13" r="3.5" fill="#facc15" />
    </svg>
  );
  if (hatId === 'grad') return (
    <svg width={size} height={size} viewBox="0 0 32 32">
      <path d="M 9 13 L 9 20 Q 16 24 23 20 L 23 13 Z" fill={color} />
      <polygon points="16,6 29,12 16,18 3,12" fill={color} />
      <line x1="26" y1="12" x2="26" y2="22" stroke="#fbbf24" strokeWidth="1.5" />
      <circle cx="26" cy="23" r="2" fill="#fbbf24" />
    </svg>
  );
  return null;
}
