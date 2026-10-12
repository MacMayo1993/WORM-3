// The mission sentence on the map and pause card, built from a level's own
// targets so every count the checklist tracks is stated exactly once, in the
// same words on every level. Mobi's story lines live in narrative.js; this
// text stays literal.
const ELEMENT_NAMES = ['water', 'fire', 'grass', 'ice', 'lightning'];
export const TAIL_KINDS = ['tunnel', 'collector', 'restore'];
export const TUNNEL_KINDS = ['tunnel', 'collector', 'restore', 'mastery'];

const times = n => n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`;
const count = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const names = n => {
  const list = ELEMENT_NAMES.slice(0, n);
  return list.length > 1 ? `${list.slice(0, -1).join(', ')} and ${list.at(-1)}` : list[0];
};
const sentence = parts => parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : parts[0];

const PRIMARY = {
  orbs: n => `Collect ${count(n, 'orb')}`,
  tunnel: n => `Ride through ${count(n, 'different tunnel pair')}`,
  jump: n => `Land ${count(n, 'jump')} over your own body`,
  rotation: n => `Survive ${count(n, 'layer turn')}`,
};

// Display order of the extra tasks, after the primary goal.
const TASKS = [
  ['bodyLength', n => `grow to ${n} segments`],
  ['selfPasses', n => `pass yourself in the Core ${times(n)}`],
  ['multiHeals', n => `make ${count(n, 'double heal')}`],
  ['bodyJumps', n => `land ${count(n, 'jump')} over your body`],
  ['ringHeals', n => `surround ${count(n, 'tunnel')} to heal ${n === 1 ? 'it' : 'them'}`],
  ['boosts', n => `finish ${count(n, 'boost')}`],
  ['doubleJumps', n => `land ${count(n, 'double jump')}`],
  ['rockets', n => n === 1 ? 'land a rocket flight' : `land ${n} rocket flights`],
  ['magnetOrbs', n => `catch ${count(n, 'remote orb')} with a magnet`],
  ['explodes', n => n === 1 ? 'ride out an explosion' : `ride out ${n} explosions`],
  ['elementPickups', n => `pick up ${count(n, 'elemental orb')}`],
  ['uniqueElements', n => `collect ${n} different elements (${names(n)})`],
  ['elements', n => n >= ELEMENT_NAMES.length ? `master all ${n} elements` : `master ${count(n, 'element')} (${names(n)})`],
  ['steamFusions', n => `make Steam (Water → Fire)${n > 1 ? ` ${times(n)}` : ''}`],
  ['quenchFusions', n => `make Quench (Fire → Water)${n > 1 ? ` ${times(n)}` : ''}`],
  ['fusions', n => `fuse two elements ${times(n)}`],
  ['uniqueFusions', n => `make ${n} different fusions`],
  ['signatures', n => `use your ability ${times(n)}`],
  ['bombs', n => `disarm ${count(n, 'bomb')}`],
  ['kills', n => `defeat ${count(n, 'enemy', 'enemies')}`],
];

export function storyGoalText(level) {
  const m = level.mechanics ?? {};
  const primary = PRIMARY[level.kind]?.(level.target) ?? `Heal ${count(level.target, 'tunnel pair')}`;
  const tasks = [];
  if (level.kind === 'orbs' && level.colors) tasks.push(`${primary} in all ${level.colors} colors`);
  else tasks.push(primary);
  if (level.orbs) tasks.push(`collect ${count(level.orbs, 'orb')}`);
  if (level.colors && level.kind !== 'orbs') tasks.push(`collect all ${level.colors} colors`);
  if (level.rotations) tasks.push(`survive ${count(level.rotations, 'layer turn')}`);
  for (const [key, phrase] of TASKS) if (m[key]) tasks.push(phrase(m[key]));

  const notes = [];
  if (TAIL_KINDS.includes(level.kind)) notes.push('Clear your tail to finish.');
  if (level.kind === 'jump' || m.bodyJumps) notes.push('Empty jumps do not count.');
  if (m.selfPasses) notes.push('A pass counts when you dive into a tunnel while your tail is still inside one.');
  if (m.multiHeals) notes.push(level.kind === 'tunnel'
    ? 'For a double heal, ride a second pair before your tail leaves the first.'
    : 'For a double heal, carry both tolls and ride a second pair before your tail leaves the first.');
  if (m.selfPasses || m.multiHeals) notes.push('Missed a chain? Retry doors open after the last pair and your tail clear.');
  if ((m.ringHeals || m.signatures) && TUNNEL_KINDS.includes(level.kind)) notes.push('Tunnel deposits seal only after the surround and ability tasks.');
  if (level.rotateEvery && (level.kind === 'rotation' || level.rotations)) notes.push(`Turns come every ${level.rotateEvery} seconds.`);
  if (level.tip) notes.push(level.tip);
  return `${sentence(tasks)}.${notes.length ? ` ${notes.join(' ')}` : ''}`;
}
