// livingShaders.js — Living tile styles, batch 2.
//
// compass, spiritLevel, snowGlobe, lichtenberg, rainGlass, pond, sundial,
// crystalGrowth, cymatics, turing
//
// Three of these (compass, spiritLevel, snowGlobe) are *reactive* rather than
// merely animated: they read the tile's live world orientation out of the vertex
// stage (vWorldNormal / vWorldPos) and the rotation-energy uniforms, so the thing
// that moves them is the player turning a layer, not a clock. That is the axis
// orbChamber and dice already use and the rest of the catalogue does not.
//
// Every shader here is self-contained — the fragment sources are merged by key in
// TileStyleMaterials and nothing is prepended, so each declares whatever hash or
// noise it needs. Keep them cheap: one of these runs per sticker per frame, and a
// 7×7 board is 294 stickers.

// Shared source fragments, inlined per shader (not prepended at build time).
const HASH = `
  float lHash(float n) { return fract(sin(n * 127.1) * 43758.5453); }
  float lHash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
`;

const NOISE = `
  float lNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = lHash2(i), b = lHash2(i + vec2(1.0, 0.0));
    float c = lHash2(i + vec2(0.0, 1.0)), d = lHash2(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }
  float lFbm(vec2 p) {
    float v = 0.0;
    v += 0.5000 * lNoise(p); p *= 2.01;
    v += 0.2500 * lNoise(p); p *= 2.02;
    v += 0.1250 * lNoise(p); p *= 2.03;
    v += 0.0625 * lNoise(p);
    return v;
  }
`;

// The tile's world-space +U and +V directions, recovered from screen derivatives.
// Same trick orbChamber uses for its tangent frame; with these, a style can ask
// "which way is world-up, in MY uv space?" and stay correct on all six faces and
// right through a layer turn.
const TANGENT_FRAME = `
  void lFrame(out vec3 T, out vec3 B) {
    vec3 dpx = dFdx(vWorldPos), dpy = dFdy(vWorldPos);
    vec2 dux = dFdx(vUv), duy = dFdy(vUv);
    float det = dux.x * duy.y - duy.x * dux.y;
    if (abs(det) < 1e-9) { T = vec3(1.0, 0.0, 0.0); B = vec3(0.0, 1.0, 0.0); return; }
    T = normalize(( dpx * duy.y - dpy * dux.y) / det);
    B = normalize((-dpx * duy.x + dpy * dux.x) / det);
  }
  // World +Y projected into the tile plane, expressed in uv axes. Length is the
  // tilt: 1 on a side face, ~0 on the top and bottom where "up" leaves the plane.
  vec2 lUpInPlane(vec3 N) {
    vec3 T, B; lFrame(T, B);
    vec3 up = vec3(0.0, 1.0, 0.0);
    vec3 flat_ = up - N * dot(up, N);
    return vec2(dot(flat_, T), dot(flat_, B));
  }
`;

// How hard THIS tile's layer is being turned right now — 0 for tiles off the
// moving slice, decaying after the turn commits.
const SLICE_ENERGY = `
  float lSpin() {
    float axisCoord = spinAxis < 0.5 ? vTileCenter.x
                    : spinAxis < 1.5 ? vTileCenter.y
                    : vTileCenter.z;
    float member = 1.0 - smoothstep(0.55, 0.78, abs(axisCoord - spinSlice));
    return clamp(spin * member, 0.0, 1.0);
  }
`;

export const livingShaders = {
  // ── Compass ────────────────────────────────────────────────────────────────
  // The needle holds a fixed WORLD heading, so it is the cube that turns under it:
  // every layer rotation swings every needle on that layer, and tiles carried onto
  // a new face re-point on arrival. The tile remembers which way is north through
  // the topology.
  compass: `
    uniform vec3 baseColor;
    uniform vec3 antipodalColor;
    uniform float time;
    uniform float spin;
    uniform float spinAxis;
    uniform float spinSlice;
    varying vec2 vUv;
    varying vec3 vWorldPos;
    varying vec3 vWorldNormal;
    varying vec3 vTileCenter;
    ${HASH}
    ${TANGENT_FRAME}
    ${SLICE_ENERGY}

    void main() {
      vec2 p = vUv - 0.5;
      float r = length(p);
      vec3 N = normalize(vWorldNormal);
      vec3 T, B; lFrame(T, B);

      // Heading: world +Y in-plane, falling back to world +Z on the two faces
      // where +Y is the normal and the projection collapses.
      vec3 up = vec3(0.0, 1.0, 0.0);
      vec3 h = up - N * dot(up, N);
      if (length(h) < 0.2) { vec3 z = vec3(0.0, 0.0, 1.0); h = z - N * dot(z, N); }
      vec2 dir = normalize(vec2(dot(h, T), dot(h, B)) + 1e-6);
      float ang = atan(dir.y, dir.x);

      // A needle is a suspended mass: it overshoots while the layer swings and
      // rings down after it stops. sqrt fattens the tail so the settle is visible.
      float sp = lSpin();
      ang += sqrt(sp) * sin(time * 16.0) * 0.55;

      float ca = cos(ang), sa = sin(ang);
      vec2 q = vec2(ca * p.x + sa * p.y, -sa * p.x + ca * p.y);

      // Dial: dark face, bright rim, eight ticks.
      vec3 col = baseColor * 0.16;
      col = mix(col, baseColor * 0.30, smoothstep(0.40, 0.36, r));
      col = mix(col, baseColor * 1.25, smoothstep(0.005, 0.0, abs(r - 0.405)));
      float tickAng = atan(p.y, p.x);
      float tick = smoothstep(0.05, 0.0, abs(fract(tickAng / 0.7853981 + 0.5) - 0.5))
                 * smoothstep(0.32, 0.36, r) * (1.0 - smoothstep(0.385, 0.40, r));
      col += baseColor * tick * 0.7;

      // Needle: two tapered lobes, north bright, south dark.
      float halfLen = 0.33;
      float taper = 1.0 - abs(q.x) / halfLen;
      float w = max(taper, 0.0) * 0.055 + 0.004;
      float body = smoothstep(w, w * 0.45, abs(q.y)) * step(abs(q.x), halfLen);
      float north = step(0.0, q.x);
      col = mix(col, antipodalColor * 1.35, body * north);
      col = mix(col, vec3(0.92, 0.93, 0.95), body * (1.0 - north) * 0.85);

      // Hub
      col = mix(col, vec3(0.85), smoothstep(0.045, 0.028, r));
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,

  // ── Spirit level ───────────────────────────────────────────────────────────
  // A bullseye vial: the bubble rides to whichever way is up, so it sits dead
  // centre on the top and bottom faces and hard against the rim on the sides.
  // Every turn re-levels a whole layer at once.
  spiritLevel: `
    uniform vec3 baseColor;
    uniform float time;
    uniform float spin;
    uniform float spinAxis;
    uniform float spinSlice;
    varying vec2 vUv;
    varying vec3 vWorldPos;
    varying vec3 vWorldNormal;
    varying vec3 vTileCenter;
    ${HASH}
    ${TANGENT_FRAME}
    ${SLICE_ENERGY}

    void main() {
      vec2 p = vUv - 0.5;
      float r = length(p);
      vec3 N = normalize(vWorldNormal);
      vec2 upv = lUpInPlane(N);
      float tilt = clamp(length(upv), 0.0, 1.0);
      vec2 dir = tilt > 1e-4 ? upv / tilt : vec2(0.0);

      float sp = lSpin();
      // Idle tremor plus a real slosh while the layer is moving.
      vec2 bub = dir * (tilt * 0.27)
               + vec2(sin(time * 2.3), cos(time * 1.9)) * 0.010
               + vec2(sin(time * 21.0), cos(time * 18.0)) * sqrt(sp) * 0.06;

      // Vial body — tinted fluid, darker toward the rim.
      vec3 col = mix(baseColor * 0.55, baseColor * 0.22, smoothstep(0.10, 0.46, r));
      // Two centring rings.
      col += baseColor * 0.9 * smoothstep(0.006, 0.0, abs(r - 0.17));
      col += baseColor * 0.7 * smoothstep(0.006, 0.0, abs(r - 0.26));
      // Glass rim.
      col = mix(col, baseColor * 1.3, smoothstep(0.006, 0.0, abs(r - 0.44)));

      float bd = length(p - bub);
      float bubble = smoothstep(0.105, 0.088, bd);
      col = mix(col, vec3(0.94, 0.97, 0.96), bubble * 0.85);
      // Meniscus + a highlight so it reads as air, not a hole.
      col += vec3(0.9) * smoothstep(0.006, 0.0, abs(bd - 0.098)) * 0.5;
      col += vec3(1.0) * smoothstep(0.035, 0.0, length(p - bub - vec2(0.03, 0.035))) * 0.35;

      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,

  // ── Snow globe ─────────────────────────────────────────────────────────────
  // Glitter lies settled along the downhill edge until the layer turns, which
  // throws it into suspension; it drifts back down as the rotation energy decays.
  snowGlobe: `
    uniform vec3 baseColor;
    uniform float time;
    uniform float spin;
    uniform float spinAxis;
    uniform float spinSlice;
    varying vec2 vUv;
    varying vec3 vWorldPos;
    varying vec3 vWorldNormal;
    varying vec3 vTileCenter;
    ${HASH}
    ${TANGENT_FRAME}
    ${SLICE_ENERGY}

    void main() {
      vec2 p = vUv - 0.5;
      vec3 N = normalize(vWorldNormal);
      vec2 upv = lUpInPlane(N);
      float tilt = clamp(length(upv), 0.0, 1.0);
      vec2 dir = tilt > 1e-4 ? upv / tilt : vec2(0.0, 1.0);
      vec2 down = -dir;
      vec2 side = vec2(-down.y, down.x);

      // sqrt keeps the flurry alive well after the layer stops.
      float agit = sqrt(lSpin());

      vec3 col = mix(baseColor * 0.44, baseColor * 0.16, length(p) * 1.5);
      float glit = 0.0;
      for (int i = 0; i < 22; i++) {
        float fi = float(i);
        float h1 = lHash(fi + 1.0), h2 = lHash(fi + 41.0), h3 = lHash(fi + 91.0);
        // Settled: a drift along the low edge. Suspended: anywhere, swirling.
        vec2 settled = side * (h1 - 0.5) * 0.82 + down * (0.24 + h2 * 0.17);
        vec2 susp = vec2(h1 - 0.5, h2 - 0.5) * 0.82
                  + 0.07 * vec2(sin(time * (1.4 + h3) + h1 * 6.28), cos(time * (1.1 + h1) + h2 * 6.28));
        vec2 pp = mix(settled, susp, agit);
        float sz = 0.014 + h3 * 0.012;
        glit += smoothstep(sz, sz * 0.2, length(p - pp));
      }
      col += vec3(0.93, 0.96, 1.0) * clamp(glit, 0.0, 1.4) * (0.55 + agit * 0.45);
      // Globe glass.
      col = mix(col, baseColor * 1.15, smoothstep(0.008, 0.0, abs(length(p) - 0.45)));
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,

  // ── Lichtenberg ────────────────────────────────────────────────────────────
  // Dielectric breakdown: a branch strikes across the tile every few seconds,
  // flashes white-hot, and leaves a burn scar that fades before the next one.
  lichtenberg: `
    uniform vec3 baseColor;
    uniform float time;
    varying vec2 vUv;
    ${HASH}
    ${NOISE}

    // Distance to a wandering path from a to b, wobbled by two octaves of noise
    // so it forks and kinks like a real discharge instead of bowing smoothly.
    float lArc(vec2 p, vec2 a, vec2 b, float seed, float wob) {
      vec2 ab = b - a;
      float t = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-5), 0.0, 1.0);
      vec2 perp = normalize(vec2(-ab.y, ab.x));
      float k = (lNoise(vec2(t * 6.0, seed * 13.0)) - 0.5) * wob
              + (lNoise(vec2(t * 19.0, seed * 7.0)) - 0.5) * wob * 0.35;
      // Pinned at both ends, free in the middle.
      k *= sin(t * 3.14159265);
      return length(p - (a + ab * t + perp * k));
    }

    void main() {
      vec2 p = vUv - 0.5;
      float period = 3.1;
      float idx = floor(time / period);
      float ph = fract(time / period);

      float a0 = lHash(idx * 1.7 + 0.5) * 6.2831853;
      vec2 a = vec2(cos(a0), sin(a0)) * 0.52;
      float a1 = a0 + 3.14159265 + (lHash(idx * 2.3 + 9.0) - 0.5) * 1.4;
      vec2 b = vec2(cos(a1), sin(a1)) * 0.52;

      float d = lArc(p, a, b, idx, 0.30);
      // One fork off the middle, shorter and thinner.
      vec2 mid = mix(a, b, 0.45);
      float f0 = a1 + (lHash(idx * 3.1 + 4.0) - 0.5) * 2.6;
      vec2 c = mid + vec2(cos(f0), sin(f0)) * 0.34;
      d = min(d, lArc(p, mid, c, idx + 5.0, 0.16));

      // Strike: instant, then a fast decay; the scar outlives it.
      float flash = exp(-ph * 6.0);
      float scar = exp(-ph * 1.2);
      float core = smoothstep(0.026, 0.004, d);
      float halo = smoothstep(0.17, 0.0, d);

      vec3 col = baseColor * 0.10;
      // The whole plate lights for an instant as the channel breaks down.
      col += baseColor * 0.30 * exp(-ph * 20.0);
      col += baseColor * halo * (0.80 * flash + 0.22 * scar);
      col += mix(baseColor, vec3(1.0), 0.85) * core * (1.45 * flash + 0.45 * scar);
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,

  // ── Rain on glass ──────────────────────────────────────────────────────────
  // Droplets bead on a fogged pane and, once heavy, streak downhill leaving a
  // clear trail. Downhill is real: the run is aligned to world gravity, so the
  // top face only ever beads and the sides run.
  rainGlass: `
    uniform vec3 baseColor;
    uniform float time;
    varying vec2 vUv;
    varying vec3 vWorldPos;
    varying vec3 vWorldNormal;
    ${HASH}
    ${NOISE}
    ${TANGENT_FRAME}

    void main() {
      vec2 p = vUv - 0.5;
      vec3 N = normalize(vWorldNormal);
      vec2 upv = lUpInPlane(N);
      float tilt = clamp(length(upv), 0.0, 1.0);
      vec2 e1 = tilt > 1e-4 ? upv / tilt : vec2(0.0, 1.0);
      // Gravity frame: y up the pane, x across it.
      vec2 g = vec2(dot(p, vec2(e1.y, -e1.x)), dot(p, e1));

      // Fogged pane.
      float fog = lFbm(vUv * 7.0) * 0.35 + 0.5;
      vec3 col = baseColor * (0.30 + fog * 0.22);

      float clear = 0.0, bead = 0.0;
      // Six columns of running drops.
      for (int i = 0; i < 6; i++) {
        float fi = float(i);
        float cx = (lHash(fi + 3.0) - 0.5) * 0.86;
        float speed = (0.22 + lHash(fi + 17.0) * 0.4) * (0.15 + tilt);
        float phase = fract(time * speed + lHash(fi + 29.0));
        float dy = 0.55 - phase * 1.1;
        float dx = cx + sin(phase * 9.0 + fi) * 0.02;
        float dist = length((g - vec2(dx, dy)) * vec2(1.0, 0.85));
        float rad = 0.030 + lHash(fi + 53.0) * 0.020;
        bead += smoothstep(rad, rad * 0.35, dist);
        // Trail: only above the drop, thinning and fading with distance.
        float above = clamp((g.y - dy) / 0.5, 0.0, 1.0);
        float lane = smoothstep(rad * 0.75, 0.0, abs(g.x - dx));
        clear += lane * (1.0 - above) * step(dy, g.y) * 0.7;
      }
      // Stationary beads that just sit and glisten.
      for (int j = 0; j < 10; j++) {
        float fj = float(j);
        vec2 bp = vec2(lHash(fj + 71.0) - 0.5, lHash(fj + 97.0) - 0.5) * 0.9;
        float br = 0.012 + lHash(fj + 131.0) * 0.012;
        bead += smoothstep(br, br * 0.3, length(g - bp)) * 0.8;
      }

      clear = clamp(clear, 0.0, 1.0);
      bead = clamp(bead, 0.0, 1.0);
      // Clear glass is darker and more saturated than the fog over it.
      col = mix(col, baseColor * 0.62, clear);
      col = mix(col, baseColor * 0.78, bead);
      // Lens highlight on every drop.
      col += vec3(0.95) * bead * 0.30;
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,

  // ── Pond ───────────────────────────────────────────────────────────────────
  // Drops land at random, rings expand and thin out, and two or three overlap at
  // any moment — interference without a fixed pattern.
  pond: `
    uniform vec3 baseColor;
    uniform float time;
    varying vec2 vUv;
    ${HASH}
    ${NOISE}

    void main() {
      vec2 p = vUv - 0.5;
      float h = 0.0;
      for (int i = 0; i < 3; i++) {
        float fi = float(i);
        float tt = time / 2.6 + fi * 0.41;
        float idx = floor(tt);
        float age = fract(tt) * 2.6;
        vec2 c = (vec2(lHash(idx * 3.7 + fi * 11.0), lHash(idx * 5.3 + fi * 23.0)) - 0.5) * 0.74;
        float r = age * 0.40;
        float d = length(p - c);
        // Two trailing crests behind the leading edge, all fading with age.
        float w = sin((d - r) * 46.0) * smoothstep(0.30, 0.0, abs(d - r));
        h += w * exp(-age * 1.35) * step(d, r + 0.10);
      }
      // Fake a lit surface from the height field's slope.
      float lit = clamp(0.5 + h * 0.9, 0.0, 1.4);
      vec3 col = baseColor * (0.28 + lit * 0.55);
      col += vec3(1.0) * smoothstep(0.55, 1.05, lit) * 0.30;
      // Still-water shimmer so an empty moment is not a flat square.
      col += baseColor * 0.05 * lNoise(vUv * 9.0 + time * 0.15);
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,

  // ── Sundial ────────────────────────────────────────────────────────────────
  // A gnomon shadow sweeping the dial over a minute, the light warming from dawn
  // through noon to dusk. Nearly still — the style you notice has changed when you
  // come back to that face.
  sundial: `
    uniform vec3 baseColor;
    uniform float time;
    varying vec2 vUv;
    ${HASH}

    void main() {
      vec2 p = vUv - 0.5;
      float r = length(p);
      float day = fract(time / 60.0);
      // Sun rides an arc: low and warm at the ends, high and white at noon.
      float sunAng = mix(-2.3, 2.3, day);
      float elev = sin(day * 3.14159265);
      vec2 sunDir = vec2(sin(sunAng), cos(sunAng));

      // Dial face, warmed by the light of the hour.
      vec3 warm = mix(vec3(1.0, 0.52, 0.20), vec3(1.0, 0.97, 0.88), smoothstep(0.15, 0.75, elev));
      vec3 col = baseColor * (0.30 + elev * 0.45) * mix(vec3(1.0), warm, 0.45);
      // Hour ticks.
      float ta = atan(p.y, p.x);
      col += baseColor * 0.5 * smoothstep(0.06, 0.0, abs(fract(ta / 0.5235987 + 0.5) - 0.5))
           * smoothstep(0.33, 0.37, r) * (1.0 - smoothstep(0.42, 0.45, r));

      // Shadow: a tapered wedge thrown opposite the sun, longer at low elevation.
      vec2 sd = -sunDir;
      float along = dot(p, sd);
      float across = abs(dot(p, vec2(-sd.y, sd.x)));
      float len = mix(0.52, 0.20, elev);
      float width = mix(0.055, 0.030, elev) * (1.0 - clamp(along / len, 0.0, 1.0) * 0.55);
      float shadow = step(0.0, along) * step(along, len) * smoothstep(width, width * 0.5, across);
      col = mix(col, col * mix(0.30, 0.55, elev), shadow);

      // Gnomon: a small upright triangle at the centre, always lit.
      float gn = step(abs(p.x), 0.035 * (1.0 - clamp(p.y / 0.16, 0.0, 1.0))) * step(0.0, p.y) * step(p.y, 0.16);
      col = mix(col, baseColor * 1.5, gn);
      col = mix(col, baseColor * 1.25, smoothstep(0.030, 0.018, r));
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,

  // ── Crystal growth ─────────────────────────────────────────────────────────
  // Freezing spreads from one corner as branching dendrites, holds, then thaws
  // back. `ice` is static frost; this is the act of freezing.
  crystalGrowth: `
    uniform vec3 baseColor;
    uniform float time;
    varying vec2 vUv;
    ${HASH}
    ${NOISE}

    void main() {
      float cyc = fract(time / 16.0);
      // grow → hold → thaw
      float front = cyc < 0.45 ? smoothstep(0.0, 0.45, cyc)
                  : cyc < 0.70 ? 1.0
                  : 1.0 - smoothstep(0.70, 1.0, cyc);

      vec2 seed = vec2(0.06, 0.06);
      vec2 d = vUv - seed;
      float dist = length(d);
      float ang = atan(d.y, d.x);

      // Hexagonal habit: the front runs further along six preferred directions,
      // which is what makes frost look grown rather than merely spilled. The
      // reach is what advances — perturbing a fixed radius just scalloped it.
      float arms = 0.5 + 0.5 * cos(ang * 6.0 - 0.5);
      float wob = (lNoise(vec2(ang * 3.0, 2.0)) - 0.5) * 0.16;
      float reach = front * (0.74 + arms * 0.58) + wob * front;
      float ice = smoothstep(reach + 0.05, reach - 0.03, dist);

      // Feathering across the arms, fine enough to read as crystal not stripes.
      float feather = lNoise(vec2(ang * 24.0, dist * 22.0));
      vec3 frost = mix(baseColor * 0.80, vec3(0.90, 0.96, 1.0), 0.40 + feather * 0.38);
      vec3 col = mix(baseColor * 0.28, frost, ice);
      // The growing edge is the busy part; it quiets down once the front holds.
      col += vec3(0.85, 0.95, 1.0)
           * smoothstep(0.05, 0.0, abs(dist - reach))
           * (0.20 + 0.40 * step(cyc, 0.70));
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,

  // ── Cymatics ───────────────────────────────────────────────────────────────
  // Sand migrating to the nodal lines of a vibrating square plate. The tile IS the
  // plate. The drive frequency steps every few seconds, the old figure shakes
  // apart and the sand re-forms into the next one.
  cymatics: `
    uniform vec3 baseColor;
    uniform float time;
    varying vec2 vUv;
    ${HASH}
    ${NOISE}

    // Chladni figure for a square plate with free edges. Sand collects where this
    // is ~0 — the places the plate is not moving.
    float lChladni(vec2 uv, vec2 mn) {
      float PI = 3.14159265;
      return cos(mn.x * PI * uv.x) * cos(mn.y * PI * uv.y)
           - cos(mn.y * PI * uv.x) * cos(mn.x * PI * uv.y);
    }
    vec2 lMode(float k) {
      return vec2(2.0 + floor(lHash(k * 1.7 + 3.0) * 5.0),
                  1.0 + floor(lHash(k * 2.9 + 11.0) * 4.0));
    }

    void main() {
      float hold = 4.6;
      float tt = time / hold;
      float k = floor(tt), f = fract(tt);

      vec2 mn0 = lMode(k), mn1 = lMode(k + 1.0);
      // The plate re-tunes over the last fifth of each hold.
      float blend = smoothstep(0.80, 1.0, f);
      float ch = mix(lChladni(vUv, mn0), lChladni(vUv, mn1), blend);

      // Sand piles on the nodes; the width breathes with the drive.
      float drive = 0.16 + 0.05 * sin(time * 5.0) + blend * 0.10;
      float sand = smoothstep(drive, 0.0, abs(ch));
      // Grain, so the ridges read as powder and not as ink.
      float grain = lNoise(vUv * 90.0) * 0.35 + lNoise(vUv * 190.0) * 0.25;
      sand *= 0.65 + grain;

      // Plate: dark, with the standing wave faintly visible in the metal.
      vec3 col = baseColor * (0.14 + 0.10 * abs(ch));
      col = mix(col, mix(baseColor * 0.7, vec3(0.96, 0.93, 0.85), 0.8), clamp(sand, 0.0, 1.0));
      // Everything blurs slightly while the plate is between modes.
      col += baseColor * blend * 0.10 * lNoise(vUv * 40.0 + time * 20.0);
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,

  // ── Turing ─────────────────────────────────────────────────────────────────
  // Reaction–diffusion spots that grow, split and drift. True Gray-Scott needs a
  // ping-pong buffer this renderer does not keep, so this is a domain-warped
  // approximation: the warp field drifts, which migrates and merges the cells.
  turing: `
    uniform vec3 baseColor;
    uniform vec3 antipodalColor;
    uniform float time;
    varying vec2 vUv;
    ${HASH}
    ${NOISE}

    void main() {
      vec2 q = vUv * 4.2;
      // Two warp fields moving against each other — this is what makes the cells
      // creep and divide rather than just scroll.
      vec2 w = vec2(lFbm(q + vec2(0.0, time * 0.055)),
                    lFbm(q + vec2(5.2, 1.3) - vec2(time * 0.043, 0.0)));
      float n = lFbm(q + w * 1.7 + vec2(time * 0.021, -time * 0.017));

      float spots = smoothstep(0.47, 0.545, n);
      // The reactant ring around each cell — the part that actually looks alive.
      float membrane = smoothstep(0.435, 0.475, n) - smoothstep(0.545, 0.60, n);

      vec3 col = mix(baseColor * 0.24, baseColor * 1.25 + vec3(0.05), spots);
      col = mix(col, antipodalColor * 1.30, membrane * 0.90);
      col += baseColor * 0.16 * smoothstep(0.60, 0.75, n);
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,
};
