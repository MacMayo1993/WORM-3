// src/worm/wormCharacterData.js
// Core playable worm character archetypes (distinct silhouette + movement personality).

export const WORM_CHARACTERS = [
  {
    id: 'mobi',
    label: 'MOBI',
    type: 'Intelligence Unit',
    subtitle: 'Multi Orientable Block Intelligence',
    stats: { speed: 55, healing: 60, agility: 65, glow: 45 },
    special: 'Parity Core — a living parity core turns inside a transparent cube body',
  },
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
    special: 'Accordion Step — gathers into low arches as it crawls',
  },
  {
    id: 'glow',
    label: 'Glow Worm',
    type: 'Scout',
    subtitle: 'Bioluminescent trail crawler',
    stats: { speed: 90, healing: 40, agility: 80, glow: 100 },
    special: 'Bioluminescence — lights nearby tiles and adds a glow to surface orbs',
  },
  {
    id: 'book',
    label: 'Book Worm',
    type: 'Sage',
    subtitle: 'Open-book body with specs',
    stats: { speed: 40, healing: 75, agility: 50, glow: 15 },
    special: "Page Turner — curved pages and a coloured binding bank gently into turns",
  },
  {
    id: 'wiggle',
    label: 'Wiggle Worm',
    type: 'Dancer',
    subtitle: 'Hyper-flexible sidewinder',
    stats: { speed: 80, healing: 50, agility: 100, glow: 20 },
    special: 'Sidewinder — a wide lateral wave follows the cube surface',
  },
  {
    id: 'prism',
    label: 'Prism Worm',
    type: 'Trickster',
    subtitle: 'Rainbow wildcard crawler',
    stats: { speed: 70, healing: 55, agility: 75, glow: 60 },
    special: 'Spectrum — body cycles every color; carried orbs deposit as any color (wildcard)',
  }
];

export function getWormCharacter(id) {
  return WORM_CHARACTERS.find(c => c.id === id) ?? WORM_CHARACTERS.find(c => c.id === 'classic');
}
