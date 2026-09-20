import { STORE_ITEMS, getStoreItem } from '../utils/storeCatalog.js';
import { CLASSIC_STYLE_KEYS, ANTIPODAL_STYLE_KEYS } from '../utils/tileStyleCatalog.js';

// Ascending rarity. The die faces are weighted, not a physics simulation.
export const CHEST_TIERS = [
  { id: 'white', name: 'Common', color: '#eee9dc', label: 'Parity Points + XP', compensation: 0 },
  { id: 'green', name: 'Uncommon', color: '#53b968', label: 'Color palettes', compensation: 2 },
  { id: 'blue', name: 'Rare', color: '#469dea', label: 'Tile styles', compensation: 4 },
  { id: 'yellow', name: 'Very rare', color: '#f4cd46', label: 'Advanced tile styles', compensation: 6 },
  { id: 'orange', name: 'Legendary', color: '#ed8a39', label: 'Hats, skins + trails', compensation: 10 },
  { id: 'red', name: 'Mythic', color: '#ed5353', label: 'Worm characters', compensation: 15 },
];
export const CHEST_MODES = {
  single: { label: 'One cubie', cost: 10, dice: 1, weights: [5000, 2500, 1300, 750, 350, 100] },
  double: { label: 'Two cubies', cost: 15, dice: 2, weights: [2000, 2500, 2200, 1600, 1200, 500] },
};
export const GEM_EXCHANGE = { points: 100, gems: 10 };
export const WELCOME_GEMS = 20;
export const GEM_LEVEL_REWARD = 5;
export const GEM_STORY_REWARD = 10;
const safeCount = n => Number.isSafeInteger(n) && n >= 0 ? Math.min(n, 1e9) : 0;
export const newChestWallet = () => ({ version: 1, gems: WELCOME_GEMS, rolls: 0, claimedLevel: 1, claimedStory: [], history: [] });
const validTier = n => Number.isInteger(n) && n >= 0 && n < CHEST_TIERS.length;
export function resolveChestFaces(faces) {
  if (![1, 2].includes(faces.length) || !faces.every(validTier)) throw new Error('Invalid cubie faces');
  return faces.length === 1 ? faces[0] : faces[0] === faces[1] ? Math.min(5, faces[0] + 1) : Math.min(...faces);
}
export function chestOdds(mode) {
  const def = CHEST_MODES[mode];
  if (!def) return [];
  const p = def.weights.map(w => w / 10000);
  if (def.dice === 1) return p;
  const result = Array(6).fill(0);
  for (let a = 0; a < 6; a++) for (let b = 0; b < 6; b++) result[resolveChestFaces([a, b])] += p[a] * p[b];
  return result;
}
const basicStyles = new Set([...CLASSIC_STYLE_KEYS, ...ANTIPODAL_STYLE_KEYS]);
export function chestItemTier(item) {
  if (!item || item.price <= 0) return null;
  if (item.type === 'character') return 5;
  if (['hat', 'skin', 'trail'].includes(item.type)) return 4;
  if (item.type === 'tile') return basicStyles.has(item.tileKey) ? 2 : 3;
  if (item.type === 'scheme') return 1;
  return null;
}
export const chestPool = tier => STORE_ITEMS.filter(item => chestItemTier(item) === tier);
export function randomUnit() {
  const value = new Uint32Array(1);
  globalThis.crypto.getRandomValues(value);
  return value[0] / 4294967296;
}
function sampleUnit(random) {
  const n = random();
  if (!Number.isFinite(n) || n < 0 || n >= 1) throw new Error('Random source unavailable');
  return n;
}
export function drawChestFace(weights, random = randomUnit) {
  const n = sampleUnit(random) * 10000;
  let boundary = 0;
  for (let i = 0; i < weights.length; i++) { boundary += weights[i]; if (n < boundary) return i; }
  throw new Error('Invalid chest weights');
}
export function rollChest(mode, ownedItems, random = randomUnit) {
  const def = CHEST_MODES[mode];
  if (!def) throw new Error('Unknown chest');
  const faces = Array.from({ length: def.dice }, () => drawChestFace(def.weights, random));
  const tier = resolveChestFaces(faces);
  let reward;
  if (tier === 0) reward = { kind: 'currency', points: 25, xp: 25 };
  else {
    const pool = chestPool(tier);
    const unowned = pool.filter(item => !ownedItems.includes(item.id));
    const owned = pool.filter(item => ownedItems.includes(item.id));
    const itemIds = [];
    // Prefer new cosmetics, then fill the reveal with distinct owned items.
    // A completed collection still gets three real options and a saved choice.
    for (const candidates of [unowned, owned]) {
      while (candidates.length && itemIds.length < 3) {
        itemIds.push(candidates.splice(Math.floor(sampleUnit(random) * candidates.length), 1)[0].id);
      }
    }
    // Mix new and owned options so neither is tied to a fixed card position.
    for (let i = itemIds.length - 1; i > 0; i--) {
      const j = Math.floor(sampleUnit(random) * (i + 1));
      [itemIds[i], itemIds[j]] = [itemIds[j], itemIds[i]];
    }
    reward = itemIds.length ? { kind: 'choice', itemIds }
      : { kind: 'complete', gems: CHEST_TIERS[tier].compensation };
  }
  return { mode, faces, tier, reward, cost: def.cost };
}
export function sanitizeChestWallet(raw) {
  if (raw == null) return newChestWallet(); // one-time migration; the next snapshot includes the wallet
  const wallet = { version: 1, gems: safeCount(raw.gems), rolls: safeCount(raw.rolls),
    claimedLevel: Math.max(1, Math.min(50, safeCount(raw.claimedLevel))),
    claimedStory: [...new Set((Array.isArray(raw.claimedStory) ? raw.claimedStory : []).filter(id => Number.isInteger(id) && id >= 1 && id <= 10))], history: [] };
  for (const r of (Array.isArray(raw.history) ? raw.history : []).slice(-20)) {
    if (!r || !CHEST_MODES[r.mode] || !Array.isArray(r.faces) || r.faces.length !== CHEST_MODES[r.mode].dice ||
        !r.faces.every(validTier) || r.tier !== resolveChestFaces(r.faces) || !Number.isSafeInteger(r.id) || r.id <= 0 || r.id > wallet.rolls) continue;
    const reward = r.reward;
    const validChoice = reward?.kind === 'choice' && r.id === wallet.rolls && r.tier > 0 &&
      Array.isArray(reward.itemIds) && reward.itemIds.length >= 1 && reward.itemIds.length <= 3 &&
      new Set(reward.itemIds).size === reward.itemIds.length && reward.itemIds.every(id => chestItemTier(getStoreItem(id)) === r.tier);
    const valid = reward?.kind === 'choice' ? validChoice : reward?.kind === 'item' ? chestItemTier(getStoreItem(reward.itemId)) === r.tier
      : reward?.kind === 'currency' ? r.tier === 0 && reward.points === 25 && reward.xp === 25
      : reward?.kind === 'complete' && r.tier > 0 && reward.gems === CHEST_TIERS[r.tier].compensation;
    if (!valid || wallet.history.some(old => old.id === r.id)) continue;
    wallet.history.push({ id: r.id, mode: r.mode, faces: [...r.faces], tier: r.tier, reward: reward.kind === 'choice' ? { kind: 'choice', itemIds: [...reward.itemIds] } : reward.kind === 'item' ? { kind: 'item', itemId: reward.itemId }
      : reward.kind === 'currency' ? { kind: 'currency', points: 25, xp: 25 } : { kind: 'complete', gems: reward.gems }, cost: CHEST_MODES[r.mode].cost });
  }
  return wallet;
}
