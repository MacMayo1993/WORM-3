export const ENEMIES = Object.freeze({
  crawler: { label: 'Crawler', hp: 1, speed: 0.85, points: 100, color: '#ff8bc4', scale: 1 },
  scout: { label: 'Dasher', hp: 1, speed: 1.05, points: 150, color: '#ffca70', scale: 0.8 },
  brute: { label: 'Armored crawler', hp: 3, speed: 0.62, points: 300, color: '#b79bff', scale: 1.2 },
});
export const WAVES = [
  { enemies: ['crawler','crawler','scout'], cap: 2, interval: 4 },
  { enemies: ['scout','crawler','brute','scout','crawler'], cap: 3, interval: 3.5 },
  { enemies: ['brute','scout','crawler','brute','scout','crawler','brute'], cap: 4, interval: 3 },
];
export const ELEMENTS = Object.freeze({
  fire: { label: 'Fire', color: '#ff955c', effect: 'Burns armor' },
  ice: { label: 'Ice', color: '#a0e7ff', effect: 'Freezes crawlers' },
  water: { label: 'Water', color: '#58bbff', effect: 'Pushes enemies back' },
  grass: { label: 'Nature', color: '#b6ed80', effect: 'Roots enemies in place' },
  lightning: { label: 'Lightning', color: '#d39bff', effect: 'Chains to nearby enemies' },
});
export const ELEMENT_ORDER = ['fire','ice','water','grass','lightning'];
export const ELEMENT_DURATION = 14;
