// src/worm/wormCharacterData.js
// Core playable worm character archetypes (distinct silhouette + movement personality).
import { SIGNATURES } from './signatureCatalog.js';

export const WORM_CHARACTERS = [
  {
    id: 'mobi',
    label: 'MOBI',
    type: 'Intelligence Unit',
    subtitle: 'Multi-Oriented Block Intelligence',
  },
  {
    id: 'classic',
    label: 'Classic',
    type: 'Ranger',
    subtitle: 'Original rounded crawler',
  },
  {
    id: 'inch',
    label: 'Inch Worm',
    type: 'Brute',
    subtitle: 'Ribbed caterpillar with soft feelers',
  },
  {
    id: 'glow',
    label: 'Glow Worm',
    type: 'Scout',
    subtitle: 'Bioluminescent trail crawler',
  },
  {
    id: 'book',
    label: 'Book Worm',
    type: 'Sage',
    subtitle: 'Gilded pages and brass spectacles',
  },
  {
    id: 'wiggle',
    label: 'Wiggle Worm',
    type: 'Dancer',
    subtitle: 'Hyper-flexible sidewinder',
  },
  {
    id: 'prism',
    label: 'Prism Worm',
    type: 'Trickster',
    subtitle: 'Faceted crystal spectrum',
  }
].map(character => ({
  ...character,
  ability: SIGNATURES[character.id],
  special: `${SIGNATURES[character.id].name} — ${SIGNATURES[character.id].hint}`,
}));

export function getWormCharacter(id) {
  return WORM_CHARACTERS.find(c => c.id === id) ?? WORM_CHARACTERS.find(c => c.id === 'classic');
}
