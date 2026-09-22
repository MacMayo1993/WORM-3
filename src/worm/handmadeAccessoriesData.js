// Small, independent equipment slots. Existing hats keep their IDs and save key.
export const ACCESSORY_SLOTS = ['face', 'neck', 'body', 'tail'];
export const EMPTY_ACCESSORIES = Object.freeze(Object.fromEntries(ACCESSORY_SLOTS.map(slot => [slot, 'none'])));
export const HANDMADE_HATS = [
  { id: 'toadstool', label: 'Toadstool Cap', price: 175 },
  { id: 'acorn', label: 'Acorn Helmet', price: 125 },
  { id: 'paperboat', label: 'Paper Boat', price: 100 },
  { id: 'daisy', label: 'Daisy Hat', price: 125 },
  { id: 'thimble', label: 'Thimble Helmet', price: 175 },
  { id: 'leafBeret', label: 'Leaf Beret', price: 125 },
  { id: 'sprout', label: 'Sprout', price: 100 },
];
export const WORM_ACCESSORIES = [
  { id: 'bottlecapGlasses', slot: 'face', label: 'Bottle-cap Glasses', price: 150 },
  { id: 'yarnMustache', slot: 'face', label: 'Yarn Mustache', price: 100 },
  { id: 'daisyCollar', slot: 'neck', label: 'Daisy Collar', price: 125 },
  { id: 'knittedScarf', slot: 'neck', label: 'Knitted Scarf', price: 150 },
  { id: 'spoolBackpack', slot: 'body', label: 'Spool Backpack', price: 175 },
  { id: 'matchboxBackpack', slot: 'body', label: 'Matchbox Backpack', price: 175 },
  { id: 'buttonTrail', slot: 'body', label: 'Button Trail', price: 125 },
  { id: 'leafCape', slot: 'body', label: 'Leaf Cape', price: 150 },
  { id: 'fireflyJar', slot: 'body', label: 'Firefly Jar', price: 200 },
  { id: 'windupKey', slot: 'tail', label: 'Wind-up Key', price: 175 },
  { id: 'paperPinwheel', slot: 'tail', label: 'Paper Pinwheel', price: 150 },
  { id: 'buttonGoggles', slot: 'face', label: 'Button Goggles', price: 150 },
  { id: 'patchworkBandana', slot: 'neck', label: 'Patchwork Bandana', price: 125 },
  { id: 'crookedBow', slot: 'neck', label: 'Crooked Bow Tie', price: 100 },
  { id: 'seedSatchel', slot: 'body', label: 'Seed Satchel', price: 175 },
  { id: 'friendshipBeads', slot: 'body', label: 'Friendship Beads', price: 150 },
  { id: 'quiltPatches', slot: 'body', label: 'Quilt Patches', price: 125 },
  { id: 'ribbonTail', slot: 'tail', label: 'Ribbon Tail', price: 100 },
  { id: 'paintbrushTail', slot: 'tail', label: 'Paintbrush Tail', price: 175 },
];
export const getAccessory = id => WORM_ACCESSORIES.find(item => item.id === id);
export function safeAccessories(value, ownedItems = null) {
  return Object.fromEntries(ACCESSORY_SLOTS.map(slot => {
    const item = getAccessory(value?.[slot]);
    return [slot, item?.slot === slot && (!ownedItems || ownedItems.includes(`accessory_${item.id}`)) ? item.id : 'none'];
  }));
}

export function accessoryPreviewEquipment(item, equipment={}) {
  return item?.type==='accessory' && getAccessory(item.accessoryId) ? {...equipment,[item.slot]:item.accessoryId} : equipment;
}

export const accessoryFraming = slot => slot === 'tail' ? 'tail' : slot === 'face' ? 'portrait' : slot === 'neck' ? 'portrait' : 'body';

// Shared editorial details keep the store and dressing room in sync.
export const CRAFT_COLLECTIONS = {
  woodland: { label: 'Woodland', color: '#789858' },
  patchwork: { label: 'Patchwork', color: '#bd7986' },
  workshop: { label: 'Workshop', color: '#bd914b' },
};
const CRAFT_DETAILS = {
  toadstool: ['woodland', 'A spotted mushroom cap with a soft, rounded brim.'],
  acorn: ['woodland', 'A little woodland helmet with a knobbly acorn shell.'],
  paperboat: ['workshop', 'Folded paper, crisp corners, ready for a tiny voyage.'],
  daisy: ['woodland', 'A bright daisy perched above your crawler.'],
  thimble: ['workshop', 'A sewing-box helmet for a very small adventurer.'],
  leafBeret: ['woodland', 'A leaf folded into a jaunty forest beret.'],
  sprout: ['woodland', 'A fresh green shoot growing from the top of your head.'],
  bottlecapGlasses: ['workshop', 'Bottle-cap frames give your crawler a curious little face.'],
  yarnMustache: ['patchwork', 'A curled yarn mustache with handmade charm.'],
  daisyCollar: ['woodland', 'A circle of daisies nestled just behind the head.'],
  knittedScarf: ['patchwork', 'A cozy knit wrapped around your smallest adventurer.'],
  spoolBackpack: ['workshop', 'A thread-spool pack for carrying tiny treasures.'],
  matchboxBackpack: ['workshop', 'A pocket-sized matchbox turned traveling pack.'],
  buttonTrail: ['patchwork', 'A row of colorful buttons stitched along the body.'],
  leafCape: ['woodland', 'A broad leaf draped over your crawler like a cape.'],
  fireflyJar: ['woodland', 'A little lantern jar with a warm firefly glow.'],
  windupKey: ['workshop', 'A toy-box winding key riding at the end of the tail.'],
  paperPinwheel: ['workshop', 'A folded pinwheel for a playful finishing touch.'],
  buttonGoggles: ['patchwork', 'Mismatched button lenses, made for a curious explorer.'],
  patchworkBandana: ['patchwork', 'A small triangle of patchwork tied around the neck.'],
  crookedBow: ['patchwork', 'A slightly crooked bow with plenty of personality.'],
  seedSatchel: ['woodland', 'A little seed pouch that sways with your crawl.'],
  friendshipBeads: ['patchwork', 'Bright beads along the body, colored by your palette.'],
  quiltPatches: ['patchwork', 'Soft quilt squares scattered along the body.'],
  ribbonTail: ['patchwork', 'A trailing ribbon with a gentle flutter.'],
  paintbrushTail: ['workshop', 'A tiny paintbrush to finish your artist’s outfit.'],
};
export function getCraftDetails(id) {
  const detail = CRAFT_DETAILS[id];
  return detail ? { ...CRAFT_COLLECTIONS[detail[0]], description: detail[1] } : null;
}
