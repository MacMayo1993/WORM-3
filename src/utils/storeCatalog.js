// src/utils/storeCatalog.js
// All purchasable items in the Parity Store.
// price: 0 = free / default-owned item.

export const STORE_ITEMS = [
  // ── Skins ──────────────────────────────────────────────────────────────────
  { id: 'skin_slime',  type: 'skin', skinId: 'slime',  label: 'Slime',  price: 0,   body: '#00ff88', belly: '#00cc66', glow: '#00ff88' },
  { id: 'skin_royal',  type: 'skin', skinId: 'royal',  label: 'Royal',  price: 150, body: '#a855f7', belly: '#7e22ce', glow: '#a855f7' },
  { id: 'skin_lava',   type: 'skin', skinId: 'lava',   label: 'Lava',   price: 150, body: '#f97316', belly: '#ea580c', glow: '#f97316' },
  { id: 'skin_ocean',  type: 'skin', skinId: 'ocean',  label: 'Ocean',  price: 150, body: '#06b6d4', belly: '#0891b2', glow: '#22d3ee' },
  { id: 'skin_cherry', type: 'skin', skinId: 'cherry', label: 'Cherry', price: 150, body: '#ec4899', belly: '#db2777', glow: '#f472b6' },
  { id: 'skin_ice',    type: 'skin', skinId: 'ice',    label: 'Ice',    price: 200, body: '#bae6fd', belly: '#7dd3fc', glow: '#38bdf8' },
  { id: 'skin_void',   type: 'skin', skinId: 'void',   label: 'Void',   price: 200, body: '#6366f1', belly: '#4338ca', glow: '#818cf8' },
  { id: 'skin_gold',   type: 'skin', skinId: 'gold',   label: 'Gold',   price: 300, body: '#f59e0b', belly: '#d97706', glow: '#fbbf24' },

  // ── Hats ───────────────────────────────────────────────────────────────────
  { id: 'hat_none',   type: 'hat', hatId: 'none',   label: 'No Hat',  price: 0 },
  { id: 'hat_tophat', type: 'hat', hatId: 'tophat', label: 'Top Hat', price: 100 },
  { id: 'hat_party',  type: 'hat', hatId: 'party',  label: 'Party',   price: 100 },
  { id: 'hat_crown',  type: 'hat', hatId: 'crown',  label: 'Crown',   price: 150 },
  { id: 'hat_halo',   type: 'hat', hatId: 'halo',   label: 'Halo',    price: 200 },
];

// Items owned from the start (price === 0)
export const DEFAULT_OWNED = STORE_ITEMS.filter(i => i.price === 0).map(i => i.id);

export const getStoreItem = (id) => STORE_ITEMS.find(i => i.id === id) ?? null;

export const getSkins = () => STORE_ITEMS.filter(i => i.type === 'skin');
export const getHats  = () => STORE_ITEMS.filter(i => i.type === 'hat');
