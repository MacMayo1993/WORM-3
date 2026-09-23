// src/worm/wormCharacterData.js
// Core playable worm character archetypes (distinct silhouette + movement personality).

export const WORM_CHARACTERS = [
  {
    id: 'mobi',
    label: 'MOBI',
    type: 'Intelligence Unit',
    subtitle: 'Multi Orientable Block Intelligence',
    stats: { speed: 55, healing: 60, agility: 65, glow: 45 },
    special: 'Create Wormhole — Open a tunnel for free. Wait 10 seconds to re-enter. Heal it before making another.',
  },
  {
    id: 'classic',
    label: 'Classic',
    type: 'Ranger',
    subtitle: 'Original rounded crawler',
    stats: { speed: 55, healing: 60, agility: 65, glow: 10 },
    special: 'Orb Abundance — 50% more orbs on the cube.',
  },
  {
    id: 'inch',
    label: 'Inch Worm',
    type: 'Brute',
    subtitle: 'Ribbed caterpillar with soft feelers',
    stats: { speed: 30, healing: 85, agility: 35, glow: 10 },
    special: 'Spring Loaded — Spring forward in a long jump. Land on a clear tile.',
  },
  {
    id: 'glow',
    label: 'Glow Worm',
    type: 'Scout',
    subtitle: 'Bioluminescent trail crawler',
    stats: { speed: 90, healing: 40, agility: 80, glow: 100 },
    special: 'Light Trail — Paint behind your tail for 8 seconds; the trail stays for 12 more seconds. Enemies glow brighter.',
  },
  {
    id: 'book',
    label: 'Book Worm',
    type: 'Sage',
    subtitle: 'Gilded pages and brass spectacles',
    stats: { speed: 40, healing: 75, agility: 50, glow: 15 },
    special: 'Time Out — Earn 25% more XP. Pause layer turns for 5 seconds.',
  },
  {
    id: 'wiggle',
    label: 'Wiggle Worm',
    type: 'Dancer',
    subtitle: 'Hyper-flexible sidewinder',
    stats: { speed: 80, healing: 50, agility: 100, glow: 20 },
    special: 'Tail Wipers — Sweep three tiles left and right twice to collect orbs. You cannot turn during the sweep.',
  },
  {
    id: 'prism',
    label: 'Prism Worm',
    type: 'Trickster',
    subtitle: 'Faceted crystal spectrum',
    stats: { speed: 70, healing: 55, agility: 75, glow: 60 },
    special: 'Spectrum — Every orb color heals any tunnel.',
  }
];

export function getWormCharacter(id) {
  return WORM_CHARACTERS.find(c => c.id === id) ?? WORM_CHARACTERS.find(c => c.id === 'classic');
}
