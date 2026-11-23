// src/components/screens/loadingDepths.js
// Layout for the loading cover's depth layers (LoadingScene.jsx, styled in
// LoadingScene.css): the tunnel of hoops and the sticker storm. Pure data.

// The tunnel the cube falls down: rounded-square hoops, one per sticker colour
// in turn, rushing out from the shaft past the viewer. Each runs two beats, the
// next a seventh of that behind, so one passes about every 0.6 s.
export const RING_COLORS = ['red', 'orange', 'yellow', 'green', 'blue', 'white'];
export const TUNNEL_RINGS = 7;
export const RING_SECONDS = 4;

// The sticker storm: loose cube stickers streaming up past the falling cube, at
// three depths. Far ones are small, faint and slow; near ones are big and fast
// and pass in front of the scene, but only at the screen's sides, so they never
// cross the shaft. Laid out from a fixed seed so every cover is the same.
export const STORM_LAYERS = [
  { depth: 'far', count: 12, size: 0.11, seconds: 6.5, opacity: 0.5, sides: false },
  { depth: 'mid', count: 9, size: 0.19, seconds: 3.9, opacity: 0.8, sides: false },
  { depth: 'near', count: 6, size: 0.34, seconds: 2.3, opacity: 0.95, sides: true }
];

function seeded(seed) {
  let v = seed >>> 0;
  return () => {
    v = (Math.imul(v, 1664525) + 1013904223) >>> 0;
    return v / 4294967296;
  };
}

/** Every sticker in the storm: its layer, colour, lane (% across), size, timing and tumble. */
export function stormLayout(seed = 3) {
  const rand = seeded(seed);
  return STORM_LAYERS.map((layer) => ({
    ...layer,
    chips: Array.from({ length: layer.count }, (_, i) => {
      // Spread the lanes evenly with a little jitter; near stickers keep to the
      // outer sixth of each side.
      const slot = (i + 0.2 + 0.6 * rand()) / layer.count;
      const x = layer.sides ? (slot < 0.5 ? 2 + slot * 2 * 15 : 83 + (slot - 0.5) * 2 * 15) : 2 + slot * 96;
      return {
        key: `${layer.depth}-${i}`,
        color: RING_COLORS[Math.floor(rand() * RING_COLORS.length)],
        x: +x.toFixed(2),
        delay: +(-(i / layer.count + 0.15 * rand()) * layer.seconds).toFixed(3),
        tz: Math.round((rand() < 0.5 ? -1 : 1) * (120 + rand() * 300)),
        tx: Math.round(180 + rand() * 360),
        sway: Math.round((rand() - 0.5) * 60),
        // Where it rests under reduced motion (% down the cover).
        y: Math.round(6 + rand() * 84)
      };
    })
  }));
}
