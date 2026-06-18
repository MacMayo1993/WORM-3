// src/worm/wormCharacterData.js
// Core playable worm character archetypes (distinct silhouette + movement personality).

export const WORM_CHARACTERS = [
  {
    id: 'classic',
    label: 'Classic',
    type: 'Ranger',
    subtitle: 'Original rounded crawler',
    stats: { speed: 55, healing: 60, agility: 65, glow: 10 },
    special: 'Steady Crawler — reliable healing on every cube size, no weak spots',
  },
  {
    id: 'inch',
    label: 'Inch Worm',
    type: 'Brute',
    subtitle: 'Accordion-style movement',
    stats: { speed: 30, healing: 85, agility: 35, glow: 10 },
    special: 'Accordion Step — heals 2× on every third tile cleared',
  },
  {
    id: 'glow',
    label: 'Glow Worm',
    type: 'Scout',
    subtitle: 'Bioluminescent trail crawler',
    stats: { speed: 90, healing: 40, agility: 80, glow: 100 },
    special: 'Bioluminescence — reveals hidden stickers on all adjacent faces',
  },
  {
    id: 'book',
    label: 'Book Worm',
    type: 'Sage',
    subtitle: 'Scholar worm with specs',
    stats: { speed: 40, healing: 75, agility: 50, glow: 15 },
    special: "Scholar's Eye — highlights the most efficient heal path once per run",
  },
  {
    id: 'wiggle',
    label: 'Wiggle Worm',
    type: 'Dancer',
    subtitle: 'Hyper-flexible sidewinder',
    stats: { speed: 80, healing: 50, agility: 100, glow: 20 },
    special: 'Sidewinder — body slithers in a wide snaking wave, the most agile crawler',
  },
];

export function getWormCharacter(id) {
  return WORM_CHARACTERS.find(c => c.id === id) ?? WORM_CHARACTERS[0];
}
