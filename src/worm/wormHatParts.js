// src/worm/wormHatParts.js
// One description of every 3D hat, shared by the in-game hat (WormHat3D, R3F)
// and the worm preview renderer (imperative three.js in WormPreviewRenderer).
//
// The hats used to exist only as JSX inside wormCosmetics.jsx, so anything that
// could not mount an R3F tree — the store, the character picker — had to draw
// its own flat lookalike. A crown was three different drawings depending on
// where you were standing. Everything now builds from these parts, so a hat is
// the same object wherever it appears.
//
// Parts are in the parent's local space with +Y outward from the head, and `s`
// is the head sphere radius in world units. Group offsets from the original JSX
// are baked into each part's position so the list stays flat.

/**
 * @param {string} type  hat id ('tophat', 'crown', …); 'none'/unknown → []
 * @param {number} s     head radius in world units
 * @returns {Array<{geo: [string, number[]], pos: number[], rot?: number[], scale?: number[], mat: object}>}
 */
export function getHatParts(type, s = 0.28) {
  if (!type || type === 'none') return [];

  if (type === 'tophat') {
    const felt = { color: '#111111', roughness: 0.4, metalness: 0.1 };
    return [
      { geo: ['cylinder', [s * 1.35, s * 1.35, s * 0.18, 16]], pos: [0, s * 0.9, 0], mat: felt },
      { geo: ['cylinder', [s * 0.74, s * 0.82, s * 1.6, 16]], pos: [0, s * 1.8, 0], mat: felt },
      { geo: ['cylinder', [s * 0.84, s * 0.84, s * 0.22, 16]], pos: [0, s * 1.08, 0], mat: { color: '#ef4444', roughness: 0.3 } }
    ];
  }

  if (type === 'party') {
    return [
      { geo: ['cone', [s * 0.82, s * 2.4, 12]], pos: [0, s * 1.8, 0], mat: { color: '#f97316', emissive: '#f97316', emissiveIntensity: 0.2, roughness: 0.5 } },
      { geo: ['torus', [s * 0.72, s * 0.07, 6, 16]], pos: [0, s * 0.85, 0], mat: { color: '#ef4444' } },
      { geo: ['torus', [s * 0.42, s * 0.07, 6, 16]], pos: [0, s * 1.45, 0], mat: { color: '#FFD500' } },
      { geo: ['sphere', [s * 0.2, 8, 8]], pos: [0, s * 3.0, 0], mat: { color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.5 } }
    ];
  }

  if (type === 'crown') {
    const base = s * 0.82;
    const gold = { color: '#fbbf24', emissive: '#fbbf24', emissiveIntensity: 0.5, metalness: 0.6, roughness: 0.2 };
    const spikes = 5;
    return [
      { geo: ['cylinder', [s * 1.1, s * 1.0, s * 0.55, 20]], pos: [0, base, 0], mat: { color: '#f59e0b', emissive: '#f59e0b', emissiveIntensity: 0.4, metalness: 0.6, roughness: 0.2 } },
      ...Array.from({ length: spikes }, (_, i) => {
        const angle = (i / spikes) * Math.PI * 2;
        return {
          geo: ['cone', [s * 0.2, s * 0.75, 6]],
          pos: [Math.cos(angle) * s * 0.95, base + s * 0.65, Math.sin(angle) * s * 0.95],
          mat: gold
        };
      })
    ];
  }

  if (type === 'halo') {
    return [
      { geo: ['torus', [s * 0.8, s * 0.09, 8, 32]], pos: [0, s * 1.9, 0], mat: { color: '#fde68a', emissive: '#fde68a', emissiveIntensity: 1.4 } }
    ];
  }

  if (type === 'beanie') {
    return [
      // Snug knit dome (top hemisphere only)
      { geo: ['sphere', [s * 1.04, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55]], pos: [0, s * 0.78, 0], mat: { color: '#6d28d9', roughness: 0.9, metalness: 0 } },
      { geo: ['torus', [s * 0.98, s * 0.22, 10, 24]], pos: [0, s * 0.84, 0], rot: [Math.PI / 2, 0, 0], mat: { color: '#5b21b6', roughness: 0.95 } },
      { geo: ['sphere', [s * 0.28, 10, 10]], pos: [0, s * 1.72, 0], mat: { color: '#ede9fe', roughness: 1 } }
    ];
  }

  if (type === 'wizard') {
    const star = { color: '#fde68a', emissive: '#fde68a', emissiveIntensity: 1.2 };
    const stars = [
      [s * 0.34, s * 1.6, s * 0.55],
      [-s * 0.42, s * 2.35, s * 0.32],
      [s * 0.12, s * 2.95, -s * 0.4]
    ];
    return [
      { geo: ['cylinder', [s * 1.55, s * 1.55, s * 0.1, 24]], pos: [0, s * 0.88, 0], mat: { color: '#3b0764', roughness: 0.6 } },
      { geo: ['cone', [s * 0.95, s * 2.6, 24]], pos: [0, s * 2.15, 0], mat: { color: '#4c1d95', emissive: '#1e1b4b', emissiveIntensity: 0.25, roughness: 0.6 } },
      ...stars.map(pos => ({ geo: ['octahedron', [s * 0.16, 0]], pos, mat: star }))
    ];
  }

  if (type === 'flower') {
    const base = s * 1.1;
    const petals = 6;
    return [
      { geo: ['cylinder', [s * 0.06, s * 0.06, s * 0.7, 8]], pos: [0, base - s * 0.45, 0], mat: { color: '#16a34a', roughness: 0.7 } },
      ...Array.from({ length: petals }, (_, i) => {
        const a = (i / petals) * Math.PI * 2;
        return {
          geo: ['sphere', [1, 10, 10]],
          pos: [Math.cos(a) * s * 0.5, base, Math.sin(a) * s * 0.5],
          scale: [s * 0.42, s * 0.16, s * 0.26],
          mat: { color: '#f472b6', roughness: 0.55 }
        };
      }),
      { geo: ['sphere', [s * 0.3, 12, 12]], pos: [0, base, 0], mat: { color: '#facc15', emissive: '#facc15', emissiveIntensity: 0.45 } }
    ];
  }

  if (type === 'grad') {
    const base = s * 0.95;
    return [
      { geo: ['cylinder', [s * 0.78, s * 0.86, s * 0.5, 16]], pos: [0, base, 0], mat: { color: '#111827', roughness: 0.7 } },
      { geo: ['box', [s * 2.0, s * 0.12, s * 2.0]], pos: [0, base + s * 0.3, 0], mat: { color: '#111827', roughness: 0.55 } },
      { geo: ['sphere', [s * 0.12, 8, 8]], pos: [0, base + s * 0.4, 0], mat: { color: '#fbbf24', metalness: 0.5, roughness: 0.3 } },
      // Tassel cord + knob hanging off one corner
      { geo: ['cylinder', [s * 0.03, s * 0.03, s * 0.7, 6]], pos: [s * 0.9, base + s * 0.16, s * 0.9], mat: { color: '#fbbf24' } },
      { geo: ['sphere', [s * 0.14, 8, 8]], pos: [s * 0.9, base - s * 0.18, s * 0.9], mat: { color: '#fbbf24', emissive: '#fbbf24', emissiveIntensity: 0.3 } }
    ];
  }

  return [];
}
