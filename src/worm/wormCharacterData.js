// src/worm/wormCharacterData.js
// Core playable worm character archetypes (distinct silhouette + movement personality).

export const WORM_CHARACTERS = [
  {
    id: 'classic',
    label: 'Classic',
    subtitle: 'Original rounded crawler',
  },
  {
    id: 'inch',
    label: 'Inch Worm',
    subtitle: 'Accordion-style movement',
  },
  {
    id: 'glow',
    label: 'Glow Worm',
    subtitle: 'Bioluminescent trail crawler',
  },
  {
    id: 'book',
    label: 'Book Worm',
    subtitle: 'Scholar worm with specs',
  },
];

export function getWormCharacter(id) {
  return WORM_CHARACTERS.find(c => c.id === id) ?? WORM_CHARACTERS[0];
}

