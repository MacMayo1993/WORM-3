import * as THREE from 'three';
import { neonBorderVertexShader } from './stickerPortalShaders.js';
import { wispyTime } from './StickerAnimationManager.js';

// ─── Worm footprint shader ────────────────────────────────────────────────────
// The tile's own grid square, lit up under the worm's weight.
//
// Same square-outline vocabulary the neon view mode uses for cubie edges (a bright
// rail traced right on the perimeter), but driven by contact rather than by view
// style, and in the worm's own skin colour so the glow reads as coming from the
// creature rather than from the cube.
//
// Two things this deliberately does NOT do, both learned the hard way:
//
// The rail's colour and brightness do not vary with how hard the tile is pressed.
// They did, and the result was that a tile under the head and a tile under the
// body lit in visibly different colours — one washing toward white, the other
// staying saturated — so a line of touched tiles read as a mess of mismatched
// squares rather than as one lit path. Depth is still allowed to vary; light is
// not. `lit` crosses to full as soon as there is any real contact.
//
// And the inner shadow is slight. A recess wants some shading against the rim
// that is now above it, but at any strength the eye notices it stops being shade
// and becomes the tile's colour — a dark square where a coloured one used to be,
// which is exactly what a dead tile looks like in this game. It stays a thin
// gradient hugging the rim and never reaches the middle of the tile.
export const wormFootprintFragmentShader = `
  uniform vec3  uColor;   // worm's skin colour
  uniform float uPress;   // 0 = flat, 1 = fully under the worm
  uniform float uTime;
  varying vec2  vUv;

  void main() {
    vec2  p = vUv - 0.5;
    vec2  a = abs(p);
    float edge = 0.5 - max(a.x, a.y);   // 0 at the tile's rim, grows inward
    float press = clamp(uPress, 0.0, 1.0);

    // The lit rail, hugging the perimeter. It fattens as the tile sinks.
    float bw   = 0.038 + press * 0.034;
    float rail = 1.0 - smoothstep(bw * 0.55, bw, edge);

    // Light spilling inward from the rail, over the tile's shoulder.
    float spill = (1.0 - smoothstep(bw, 0.22 + press * 0.12, edge)) * 0.42;

    // Inner shadow: the recess the worm is standing in. Strongest right against
    // the rim (where the wall is highest) and gone by the middle of the tile.
    float wall = 1.0 - smoothstep(0.015, 0.19, edge);
    float shade = wall * press * 0.88;

    // A slow breath so a tile held under a resting worm is not perfectly static.
    float breath = 0.94 + 0.06 * sin(uTime * 2.6);

    float glow  = (rail * (1.05 + press * 0.95) + spill * press) * breath;
    float alpha = clamp(max(glow, shade), 0.0, 1.0) * smoothstep(0.0, 0.09, press);

    // Rail runs hot toward white at the centre of the stroke; the shadow band is
    // the same hue taken almost to black, so the whole square stays one colour.
    vec3 socket = uColor * 0.025;
    vec3 hotRail = mix(uColor, vec3(1.0), rail * 0.62 * press);
    vec3 col = mix(socket, hotRail, clamp(glow, 0.0, 1.0));
    gl_FragColor = vec4(col, alpha);
  }
`;

// The footprint plane reaches the grid channel just outside the sticker.
export const footprintGeometry = new THREE.PlaneGeometry(0.94, 0.94);
// Where the lit square sits above the tile, and above a flipped tile's portal lip.
export const FOOTPRINT_Z = 0.005;
export const FOOTPRINT_RENDER_ORDER = 2;

// One material per tile effect for every tile; each tile binds its own uniform
// values just before its draw (sharedEffectMaterials.js). Used where there are no
// tile-surface batches (previews, cinematics, tests).
export const footprintMaterial = new THREE.ShaderMaterial({
  vertexShader: neonBorderVertexShader, fragmentShader: wormFootprintFragmentShader,
  uniforms: { uColor: { value: new THREE.Color('#33ff66') }, uPress: { value: 0 }, uTime: wispyTime },
  transparent: true, depthWrite: false
});

// In WORM every footprint on the cube is ONE instanced draw (the tile-surface decal
// batch, TileSurfaceInstances.jsx): the press arrives per instance as aInstanceData.x,
// and the colour is the worm's, the same on every tile. A tile at rest then carries
// no footprint mesh of its own, so the 1,350 hidden ones on a 15×15 are gone from the
// scene graph three.js walks every frame.
export const footprintDecalMaterial = new THREE.ShaderMaterial({
  vertexShader: `
    attribute vec4 aInstanceData;
    varying vec2 vUv;
    varying float vPress;
    void main() {
      vUv = uv;
      vPress = aInstanceData.x;
      vec4 local = vec4(position, 1.0);
      #ifdef USE_INSTANCING
        local = instanceMatrix * local;
      #endif
      gl_Position = projectionMatrix * modelViewMatrix * local;
    }
  `,
  fragmentShader: wormFootprintFragmentShader
    .replace(/uniform\s+float\s+uPress\s*;[^\n]*/, 'varying float vPress;')
    .replace(/\buPress\b/g, 'vPress'),
  uniforms: { uColor: { value: new THREE.Color('#33ff66') }, uTime: wispyTime },
  transparent: true, depthWrite: false
});
