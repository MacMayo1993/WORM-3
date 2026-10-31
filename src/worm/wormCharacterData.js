// src/worm/wormCharacterData.js
// Core playable worm character archetypes (distinct silhouette + movement personality).
import { BOOK_PAUSE_SECONDS, CLASSIC_ORB_CALL_SECONDS, CLASSIC_ORB_CALL_COOLDOWN, GLOW_TRAIL_SECONDS, GLOW_TRAIL_LINGER_SECONDS } from './characterAbilities.js';

export const WORM_CHARACTERS = [
  {
    id: 'mobi',
    label: 'MOBI',
    type: 'Intelligence Unit',
    subtitle: 'Multi-Oriented Block Intelligence',
    stats: { speed: 55, healing: 60, agility: 65, glow: 45 },
    special: 'Create Wormhole — Open a tunnel for free. Wait 10 seconds to re-enter. Heal it before making another.',
  },
  {
    id: 'classic',
    label: 'Classic',
    type: 'Ranger',
    subtitle: 'Original rounded crawler',
    stats: { speed: 55, healing: 60, agility: 65, glow: 10 },
    special: `Orb Call — Attract nearby parity orbs for ${CLASSIC_ORB_CALL_SECONDS} seconds. Recharge: ${CLASSIC_ORB_CALL_COOLDOWN} seconds.`,
  },
  {
    id: 'inch',
    label: 'Inch Worm',
    type: 'Brute',
    subtitle: 'Ribbed caterpillar with soft feelers',
    stats: { speed: 30, healing: 85, agility: 35, glow: 10 },
    special: 'Spring Loaded — Coil and leap four tiles. The landing slams: bombs beside it are defused, orbs within two tiles are yours and enemies are stunned. Land on a clear tile; you can still jump once more in the air.',
  },
  {
    id: 'glow',
    label: 'Glow Worm',
    type: 'Scout',
    subtitle: 'Bioluminescent trail crawler',
    stats: { speed: 90, healing: 40, agility: 80, glow: 100 },
    special: `Light Trail — Glow for ${GLOW_TRAIL_SECONDS} seconds and pass through your own body anywhere. The trail you leave stays ${GLOW_TRAIL_LINGER_SECONDS} seconds more: you can still slip through yourself on it, and enemies that run into it are burned.`,
  },
  {
    id: 'book',
    label: 'Book Worm',
    type: 'Sage',
    subtitle: 'Gilded pages and brass spectacles',
    stats: { speed: 40, healing: 75, agility: 50, glow: 15 },
    special: `Time Out — Stop layer turns and a Story level's timer for ${BOOK_PAUSE_SECONDS} seconds. Earn 25% more XP.`,
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
