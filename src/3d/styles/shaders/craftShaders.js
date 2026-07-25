// Craft / material tile shaders: monolith, patina, raku, cloisonne, nacre, amber, terrarium.
//
// The library was already deep in flat geometry, op art, sci-fi and elements —
// this set fills the gap where a tile looks like a made object: fired clay,
// beaten metal, shell, resin. Every one keeps baseColor dominant, because the
// face colour still has to be readable at a glance while solving.

import { shaderUtils } from './shaderBase.js';

// Worley cells — returns (F1, F2, cellId). F2 - F1 gives crack/wall lines,
// cellId gives each cell its own per-cell variation.
const cellUtils = `
  vec3 cells(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float f1 = 8.0;
    float f2 = 8.0;
    float id = 0.0;
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 g = vec2(float(x), float(y));
        vec2 o = vec2(hash(i + g), hash(i + g + 17.3));
        float d = length(g + o - f);
        if (d < f1) { f2 = f1; f1 = d; id = hash(i + g + 3.1); }
        else if (d < f2) { f2 = d; }
      }
    }
    return vec3(f1, f2, id);
  }
`;

export const craftShaders = {
  // ── Monolith ────────────────────────────────────────────────────────────────
  // Stone veining generated from world position instead of tile uv, so the grain
  // runs unbroken across tile seams and around cube corners: the cube reads as
  // one carved block rather than 54 painted squares. Turning a layer doesn't
  // disturb the veins — the stone stays put and the tiles slide through it.
  monolith: `
    uniform vec3 baseColor;
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    varying vec3 vWorldPos;

    ${shaderUtils}

    void main() {
      // Sample noise on all three world planes and sum — continuous in 3D, so
      // adjacent faces agree along their shared edge. The axis scaling is
      // anisotropic, which is what makes veins run long instead of blotching.
      vec3 p = vWorldPos * vec3(1.55, 0.55, 1.15);
      float n = fbm(p.xy) + fbm(p.yz + 4.7) + fbm(p.zx + 9.1);
      n /= 3.0;

      // Domain-warp, then fold into veins: a few thick ones, hairlines between.
      float warp = fbm(p.xy * 1.7 + n * 2.5);
      float v1 = pow(1.0 - abs(sin((n * 3.0 + warp * 1.6) * 3.14159)), 5.0);
      float v2 = pow(1.0 - abs(sin((n * 9.0 + warp * 3.0) * 3.14159)), 12.0);
      float vein = clamp(v1 * 0.85 + v2 * 0.35, 0.0, 1.0);

      // Fine grain and a slow large-scale value drift across the block.
      float grain = noise(p.xy * 26.0) * 0.06;
      float drift = fbm(p.zx * 0.55) * 0.22;

      vec3 stone = baseColor * (0.62 + drift + grain);
      vec3 veinCol = mix(baseColor, vec3(1.0), 0.55) * 1.05;
      vec3 color = mix(stone, veinCol, vein * 0.75);

      // Polished-slab specular.
      vec3 nrm = normalize(vNormal);
      vec3 viewDir = normalize(vViewPosition);
      float spec = pow(max(dot(reflect(-viewDir, nrm), normalize(vec3(0.4, 0.8, 0.6))), 0.0), 26.0);
      color += vec3(spec * 0.22);

      gl_FragColor = vec4(color, 1.0);
    }
  `,

  // ── Patina ──────────────────────────────────────────────────────────────────
  // Aged metal: oxide crust creeping in from the edges and corners where damp
  // would collect, bright metal surviving in the middle where a thumb would rub
  // it. Each tile seeds its noise from its own centre so no two tiles repeat.
  patina: `
    uniform vec3 baseColor;
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    varying vec3 vTileCenter;

    ${shaderUtils}

    void main() {
      vec2 uv = vUv;
      // Per-tile seed — same style, different weathering on every square.
      float seed = hash(floor(vTileCenter.xy * 8.0) + vTileCenter.z * 3.7) * 40.0;

      // Distance in from the tile edge, chewed up by noise so the oxide boundary
      // comes out ragged instead of as a neat picture-frame border.
      vec2 d2 = min(uv, 1.0 - uv);
      float ragged = min(d2.x, d2.y) + (fbm(uv * 3.2 + seed) - 0.5) * 0.22;
      float edge = 1.0 - smoothstep(0.0, 0.30, ragged);
      // Low-frequency weight so each tile corrodes from its own side, not all four.
      edge *= 0.45 + 0.75 * fbm(uv * 1.3 + seed * 3.0);

      // Treat the noise as surface relief: oxide collects in the low spots and
      // along the rim, bare metal survives on the high spots and in the middle
      // where a thumb would keep rubbing it back.
      float relief = fbm(uv * 4.5 + seed) * 0.7 + fbm(uv * 11.0 + seed) * 0.3;
      float oxide = smoothstep(0.50, 0.78, (1.0 - relief) * 0.95 + edge * 0.30);

      // Bare metal: base colour with a brushed sheen and a few run-off streaks.
      float brush = noise(vec2(uv.x * 90.0 + seed, uv.y * 5.0)) * 0.10;
      float drip = smoothstep(0.55, 0.95, noise(vec2(uv.x * 26.0 + seed, uv.y * 1.6))) * edge;
      vec3 metal = baseColor * (0.80 + brush);

      // Oxide is the same hue gone chalky — the face colour still reads.
      vec3 oxideCol = mix(baseColor, vec3(0.72, 0.82, 0.74), 0.38) * 1.02;
      vec3 color = mix(metal, oxideCol, clamp(oxide + drip * 0.35, 0.0, 1.0) * 0.85);

      // Pitting speckle, and dark tarnish settled right in the corners.
      float pit = smoothstep(0.80, 0.94, noise(uv * 42.0 + seed));
      color *= 1.0 - pit * 0.26;
      color *= mix(0.74, 1.0, smoothstep(0.0, 0.26, min(d2.x, d2.y)));

      // Metal keeps a tight highlight; oxide is matte and kills it.
      vec3 nrm = normalize(vNormal);
      vec3 viewDir = normalize(vViewPosition);
      float spec = pow(max(dot(reflect(-viewDir, nrm), normalize(vec3(0.3, 0.7, 0.65))), 0.0), 34.0);
      color += vec3(spec * 0.34 * (1.0 - oxide));

      gl_FragColor = vec4(color, 1.0);
    }
  `,

  // ── Raku ────────────────────────────────────────────────────────────────────
  // Kiln-crackled ceramic. The glaze pools thick and saturated where it ran to
  // the tile's edge and thins out over the middle; the crackle is the craze
  // pattern that opens as the piece cools.
  raku: `
    uniform vec3 baseColor;
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    varying vec3 vTileCenter;

    ${shaderUtils}
    ${cellUtils}

    void main() {
      vec2 uv = vUv;
      float seed = hash(floor(vTileCenter.xy * 8.0) + vTileCenter.z * 2.3) * 30.0;

      // Glaze thickness: thin over the centre, pooled at the rim, with the
      // pour left uneven by low-frequency noise.
      vec2 d2 = min(uv, 1.0 - uv);
      float rim = 1.0 - smoothstep(0.0, 0.38, min(d2.x, d2.y));
      float pool = clamp(rim * 0.85 + fbm(uv * 2.6 + seed) * 0.45 - 0.10, 0.0, 1.0);

      // Craze: irregular cells, their boundaries opened into fine dark lines.
      vec2 cp = uv * 4.2 + vec2(seed);
      cp += vec2(fbm(uv * 3.0 + seed), fbm(uv * 3.0 + seed + 11.0)) * 0.6; // wander the cells
      vec3 c = cells(cp);
      float wall = c.y - c.x;
      float craze = 1.0 - smoothstep(0.010, 0.075, wall);

      // A second, coarser generation of cracks — real craze happens in passes.
      vec3 c2 = cells(cp * 0.47 + 5.0);
      float craze2 = 1.0 - smoothstep(0.012, 0.090, c2.y - c2.x);

      vec3 thin = mix(baseColor, vec3(1.0), 0.30) * 1.04;
      vec3 thick = baseColor * 0.66;
      vec3 color = mix(thin, thick, pool);

      // Per-cell tint variation, then the cracks themselves, stained darker.
      color *= 0.94 + c.z * 0.12;
      color = mix(color, baseColor * 0.34, craze * 0.75);
      color = mix(color, baseColor * 0.42, craze2 * 0.40);

      // Wet gloss — bright and tight, the way fired glaze reads.
      vec3 nrm = normalize(vNormal);
      vec3 viewDir = normalize(vViewPosition);
      vec3 refl = reflect(-viewDir, nrm);
      float spec = pow(max(dot(refl, normalize(vec3(0.35, 0.75, 0.56))), 0.0), 48.0);
      float sheen = pow(max(dot(refl, normalize(vec3(-0.5, 0.4, 0.75))), 0.0), 8.0);
      color += vec3(spec * 0.50 + sheen * 0.07) * (1.0 - craze * 0.7);

      gl_FragColor = vec4(color, 1.0);
    }
  `,

  // ── Cloisonné ───────────────────────────────────────────────────────────────
  // Enamel poured into compartments fenced off by soldered metal wire. The wire
  // catches light along a bevel; each cell of enamel sets slightly differently.
  cloisonne: `
    uniform vec3 baseColor;
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    varying vec3 vTileCenter;

    ${shaderUtils}
    ${cellUtils}

    void main() {
      vec2 uv = vUv;
      float seed = hash(floor(vTileCenter.xy * 8.0) + vTileCenter.z * 5.1) * 25.0;

      vec2 cp = uv * 2.1 + vec2(seed);
      cp += vec2(fbm(uv * 2.2 + seed), fbm(uv * 2.2 + seed + 7.0)) * 0.40;
      vec3 c = cells(cp);
      float wall = c.y - c.x;

      // Wire: a flat band with a narrow bevel shoulder either side. The bevel
      // has to stay tight — widen it and it pools into flat gold wedges wherever
      // two cell sites sit nearly equidistant.
      float wire = 1.0 - smoothstep(0.045, 0.085, wall);
      float bevel = smoothstep(0.045, 0.085, wall) * (1.0 - smoothstep(0.085, 0.125, wall));

      // Enamel: base colour, each cell fired a touch lighter or deeper, and
      // lensed brighter at the middle of the cell where it sits thinnest.
      float lens = 1.0 - smoothstep(0.0, 0.55, c.x);
      vec3 enamel = baseColor * (0.80 + c.z * 0.34) + vec3(lens * 0.13);
      // Faint suspended cloudiness in the glass.
      enamel *= 0.96 + noise(uv * 18.0 + seed) * 0.08;

      // Wire is warm gold, brightest along the bevel shoulder.
      vec3 gold = vec3(0.86, 0.70, 0.34);
      vec3 color = mix(enamel, gold * 0.78, wire);
      color += gold * bevel * 0.22;

      // Enamel is glassy; the metal is duller and broader.
      vec3 nrm = normalize(vNormal);
      vec3 viewDir = normalize(vViewPosition);
      vec3 refl = reflect(-viewDir, nrm);
      float glass = pow(max(dot(refl, normalize(vec3(0.4, 0.7, 0.58))), 0.0), 60.0);
      float metal = pow(max(dot(refl, normalize(vec3(0.4, 0.7, 0.58))), 0.0), 12.0);
      color += vec3(glass * 0.55 * (1.0 - wire) + metal * 0.22 * wire);

      gl_FragColor = vec4(color, 1.0);
    }
  `,

  // ── Nacre ───────────────────────────────────────────────────────────────────
  // Mother-of-pearl. Growth bands laid down around an off-centre nucleus, with
  // thin-film interference riding on top — the hue depends on viewing angle, so
  // the colour crawls as the cube turns rather than as a clock ticks.
  nacre: `
    uniform vec3 baseColor;
    uniform float time;
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    varying vec3 vTileCenter;

    ${shaderUtils}

    // Cheap spectral ramp for film interference.
    vec3 spectrum(float t) {
      return 0.5 + 0.5 * cos(6.28318 * (t + vec3(0.0, 0.33, 0.67)));
    }

    void main() {
      vec2 uv = vUv;
      float seed = hash(floor(vTileCenter.xy * 8.0) + vTileCenter.z * 4.3);

      // Nucleus sits off the tile so the bands sweep across rather than ring it.
      vec2 nucleus = vec2(-0.35 + seed * 0.5, -0.25 + fract(seed * 7.3) * 0.5);
      vec2 d = uv - nucleus;
      float r = length(d);

      // Growth bands: broad, concentric, warped so they undulate like real shell
      // rather than reading as a Newton's-ring test pattern.
      float warp = fbm(uv * 4.0 + seed * 20.0) * 0.9;
      float bands = sin(r * 15.0 + warp * 7.0);
      float ridge = 0.5 + 0.5 * bands;

      // Film thickness varies with band position and viewing angle.
      vec3 nrm = normalize(vNormal);
      vec3 viewDir = normalize(vViewPosition);
      float fres = 1.0 - abs(dot(nrm, viewDir));
      float thickness = r * 1.6 + ridge * 0.30 + fres * 1.2 + time * 0.03;
      // Pulled well back toward white: at full strength the spectrum swamps the
      // face colour, and telling the faces apart matters more than the rainbow.
      vec3 iridescence = mix(vec3(1.0), spectrum(thickness), 0.50);

      // Pearl body: base colour only slightly lifted, banded.
      vec3 body = mix(baseColor, vec3(1.0), 0.22) * (0.86 + ridge * 0.18);

      // Interference tints the body instead of replacing it, and is strongest at
      // grazing angles — so the shimmer answers to how you turn the cube.
      float filmAmt = 0.10 + fres * 0.26;
      vec3 color = mix(body, body * iridescence * 1.25, filmAmt);

      // Real nacre flashes colour in narrow arcs along the crest of each growth
      // band rather than washing the whole surface — that localisation is what
      // reads as pearl instead of as marbled paper.
      float crest = pow(ridge, 6.0);
      color += (spectrum(thickness) - 0.35) * crest * (0.18 + fres * 0.35);

      // Fine platelet chatter, then a soft broad sheen.
      color *= 0.97 + noise(uv * 60.0 + seed * 30.0) * 0.06;
      float sheen = pow(max(dot(reflect(-viewDir, nrm), normalize(vec3(0.3, 0.75, 0.6))), 0.0), 18.0);
      color += vec3(sheen * 0.30);

      gl_FragColor = vec4(color, 1.0);
    }
  `,

  // ── Amber ───────────────────────────────────────────────────────────────────
  // Fossil resin with something curled up inside it. The inclusion sits at depth
  // and is parallaxed against the surface, so tilting the cube shifts it behind
  // the tile face the way a real inclusion moves under resin.
  amber: `
    uniform vec3 baseColor;
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    varying vec3 vTileCenter;

    ${shaderUtils}

    // Curled grub: a tapered arc with body segments, plus a fatter head end.
    float grub(vec2 p, float seedRot) {
      // Work in a rotated frame so each tile's specimen lies differently.
      float s = sin(seedRot), c = cos(seedRot);
      p = mat2(c, -s, s, c) * p;

      float r = length(p);
      float a = atan(p.y, p.x);

      // The body follows a circle of radius 0.20 over about 240 degrees.
      float A0 = -2.1;
      float A1 = 2.1;
      float t = clamp((a - A0) / (A1 - A0), 0.0, 1.0);
      float radius = 0.20 - t * 0.02;

      // Thickness tapers from head to tail and ripples into visible segments.
      float seg = 0.052 * (1.0 - t * 0.55) * (1.0 + 0.30 * sin(t * 16.0));
      float bodyD = abs(r - radius) + max(0.0, (A0 - a)) * 0.35 + max(0.0, (a - A1)) * 0.35;
      float body = 1.0 - smoothstep(seg, seg + 0.028, bodyD);

      // Head: a slightly larger blob parked at the arc's start.
      vec2 head = vec2(cos(A0), sin(A0)) * radius;
      float headD = length(p - head);
      float headB = 1.0 - smoothstep(0.058, 0.076, headD);

      return max(body, headB);
    }

    void main() {
      vec2 uv = vUv;
      float seed = hash(floor(vTileCenter.xy * 8.0) + vTileCenter.z * 6.7);

      // View direction in tile space drives the parallax offset per depth layer.
      vec3 nrm = normalize(vNormal);
      vec3 viewDir = normalize(vViewPosition);
      vec2 par = (viewDir.xy - nrm.xy) * 0.10;

      // Resin body: warm, deeper toward the tile edges where the slab is thicker.
      vec2 d2 = min(uv, 1.0 - uv);
      float thick = 1.0 - smoothstep(0.0, 0.46, min(d2.x, d2.y));
      float flow = fbm(uv * 3.2 + seed * 18.0);
      vec3 resin = mix(baseColor * 1.12, baseColor * 0.42, thick * 0.60 + flow * 0.18);

      // Suspended debris, two depths, each parallaxed by a different amount.
      float motes = smoothstep(0.86, 0.99, noise((uv + par * 0.6) * 30.0 + seed * 9.0));
      float dust  = smoothstep(0.90, 1.00, noise((uv + par * 1.5) * 58.0 + seed * 4.0));
      resin += baseColor * motes * 0.35 + vec3(dust * 0.18);

      // Bubbles: bright rim, dark centre, sitting shallower than the grub. Cell
      // centres are jittered — on the raw lattice they read as a printed dot
      // grid rather than as something suspended.
      vec2 bcell = floor((uv + par * 0.9) * 4.0);
      float bid = hash(bcell);
      vec2 jit = vec2(bid, hash(bcell + 13.7)) - 0.5;
      vec2 bp = fract((uv + par * 0.9) * 4.0) - 0.5 - jit * 0.55;
      float br = 0.06 + bid * 0.10;
      float bd = length(bp);
      float bubble = (1.0 - smoothstep(br, br + 0.025, bd)) * step(0.72, bid);
      resin = mix(resin, resin * 0.55, bubble * 0.7);
      resin += vec3(1.0 - smoothstep(br - 0.045, br, bd)) * bubble * 0.26;

      // The specimen — deepest layer, so it parallaxes most.
      float g = grub(uv - 0.5 + par * 2.4, seed * 6.283);
      vec3 grubCol = baseColor * 0.20 + vec3(0.06, 0.03, 0.01);
      vec3 color = mix(resin, grubCol, g * 0.88);
      // Light scattering caught around the inclusion's edge.
      color += baseColor * g * 0.10;

      // Polished cabochon highlight.
      float spec = pow(max(dot(reflect(-viewDir, nrm), normalize(vec3(0.35, 0.72, 0.6))), 0.0), 40.0);
      color += vec3(spec * 0.42);

      gl_FragColor = vec4(color, 1.0);
    }
  `,

  // ── Terrarium ───────────────────────────────────────────────────────────────
  // A worm working its way around under a frosted lid. It stays blurred and pale
  // while it's deep in the substrate, and sharpens as it comes up to press
  // against the glass — then sinks again. It leaves loosened soil behind it.
  terrarium: `
    uniform vec3 baseColor;
    uniform float time;
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    varying vec3 vTileCenter;

    ${shaderUtils}

    // Wandering closed path, kept well inside the tile.
    vec2 burrowPath(float t, float seed) {
      return vec2(0.5, 0.5) + vec2(
        0.26 * sin(t * 0.61 + seed * 6.0),
        0.21 * sin(t * 0.83 + seed * 4.0 + 1.3)
      );
    }

    void main() {
      vec2 uv = vUv;
      float seed = hash(floor(vTileCenter.xy * 8.0) + vTileCenter.z * 8.9);
      float t = time * 0.55 + seed * 40.0;

      // Substrate: dark crumb, coarse and fine.
      float soil = fbm(uv * 7.0 + seed * 12.0) * 0.7 + noise(uv * 34.0 + seed) * 0.3;
      vec3 color = baseColor * (0.34 + soil * 0.42);

      // How deep the worm is running right now: 0 = at the glass, 1 = buried.
      float depth = 0.5 + 0.5 * sin(time * 0.31 + seed * 5.0);

      // Body: sample points back along the path, tapering to the tail. The
      // sampling window has to be long relative to the path's period or every
      // sample lands on top of the last and the worm reads as a pill.
      float body = 0.0;
      float trail = 0.0;
      for (int i = 0; i < 13; i++) {
        float f = float(i) / 12.0;
        vec2 p = burrowPath(t - f * 3.6, seed);
        float d = length(uv - p);
        float rad = 0.055 * (1.0 - f * 0.55);
        // Blur scales with depth — buried worm is a smudge, surfaced worm is sharp.
        float blur = 0.014 + depth * 0.070;
        body = max(body, 1.0 - smoothstep(rad, rad + blur, d));
      }
      // Older track behind it: soil the worm already turned over.
      for (int i = 0; i < 10; i++) {
        float f = float(i) / 9.0;
        vec2 p = burrowPath(t - 4.0 - f * 7.0, seed);
        float d = length(uv - p);
        trail = max(trail, (1.0 - smoothstep(0.034, 0.090, d)) * (1.0 - f * 0.8));
      }

      // Turned soil is lighter and looser than packed substrate.
      color = mix(color, baseColor * (0.58 + soil * 0.34), trail * 0.75);

      // The worm itself: pale and translucent, ringed, dimmed by how deep it is.
      float rings = 0.5 + 0.5 * sin((uv.x + uv.y) * 90.0 + t * 4.0);
      vec3 wormCol = mix(baseColor, vec3(1.0, 0.94, 0.86), 0.60) * (0.80 + rings * 0.20);
      float visible = body * mix(1.0, 0.34, depth);
      color = mix(color, wormCol, visible);
      // Light bleeding around it through the substrate.
      color += wormCol * body * (1.0 - depth) * 0.12;

      // Frosted lid: a soft broad sheen plus a fine bloom of condensation.
      vec3 nrm = normalize(vNormal);
      vec3 viewDir = normalize(vViewPosition);
      float glass = pow(max(dot(reflect(-viewDir, nrm), normalize(vec3(0.3, 0.7, 0.65))), 0.0), 10.0);
      color += vec3(glass * 0.16);
      color *= 0.97 + noise(uv * 70.0) * 0.06;

      gl_FragColor = vec4(color, 1.0);
    }
  `,
};
