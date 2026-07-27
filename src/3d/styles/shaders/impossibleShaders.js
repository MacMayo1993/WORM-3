// Impossible-object tile shaders — figures that a flat drawing accepts and a
// solid world refuses. The sibling of nonEuclideanShaders.js: where those bend
// the metric, these keep the metric flat and bend the *reading* of it.
//
//   impossibleTriangle  the tribar, rendered as the real solid that casts it
//   endlessStairs       a staircase that climbs forever, likewise real
//   impossibleFork      the two-or-three-pronged blivet, in line only
//   neckerFlip          the bistable cube, committing to each reading in turn
//   mobiusBand          one surface, one edge, and a walker who returns mirrored
//   interlockingWings   a regular division of the plane with no gaps and no overlaps
//
// Two of these are not illusions at all. The tribar and the endless staircase
// are drawn here by ray-casting an honest solid object under an orthographic
// camera on the body diagonal — the same trick the physical sculptures use.
// Orthographic projection along (1,1,1) cannot distinguish two points that
// differ by a multiple of (1,1,1), so a chain of beams whose two free ends are
// separated by exactly such a vector reads as closed. The object is real; only
// the closure is a lie, and it is the camera that tells it. Turn the cube and
// the figure would fall apart — which it does not, because these tiles are
// screen-space, and that impossibility is the point.
//
// Every shader takes `baseColor` (the face colour) and, when animated, `time`.

// Shared isometric rig. The camera sits on the +(1,1,1) diagonal looking back
// down it, so the three world axes land on screen 120° apart and the world's z
// axis stands upright.
const ISO_RIG = `
  const vec3 ISO_F = vec3(-0.5773503, -0.5773503, -0.5773503);  // view direction
  const vec3 ISO_R = vec3(-0.7071068,  0.7071068,  0.0);        // screen +x
  const vec3 ISO_U = vec3(-0.4082483, -0.4082483,  0.8164966);  // screen +y

  // Slab intersection against an axis-aligned box. Keeps the nearest hit so far
  // in 'best', its face normal in 'nrm' and which box it was in 'id'. The ray
  // direction is the body diagonal, so no component is zero and the reciprocal
  // needs no guard.
  bool isoBox(vec3 ro, vec3 rd, vec3 bmin, vec3 bmax, inout float best, inout vec3 nrm, inout float id, float thisId) {
    vec3 inv = 1.0 / rd;
    vec3 t0 = (bmin - ro) * inv;
    vec3 t1 = (bmax - ro) * inv;
    vec3 tn = min(t0, t1);
    vec3 tf = max(t0, t1);
    float tin = max(max(tn.x, tn.y), tn.z);
    float tout = min(min(tf.x, tf.y), tf.z);
    if (tout < tin || tout < 0.0 || tin > best) return false;
    best = tin;
    vec3 axis = step(tn.yzx, tn) * step(tn.zxy, tn);   // 1 on the entry axis
    vec3 nn = -sign(rd) * axis;
    nrm = nn / max(length(nn), 1e-4);
    id = thisId;
    return true;
  }

  // Only three faces can ever point at this camera, so three tones are the whole
  // palette: the +z face is the lit top, +x the near side, +y the far side.
  float isoTone(vec3 n) {
    return n.z > 0.5 ? 1.04 : (n.x > 0.5 ? 0.66 : 0.40);
  }
`;

// 2D primitives shared by the line-art figures.
const FLAT_SDF = `
  float ipSeg(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
    return length(pa - ba * h);
  }
  float ipBox(vec2 p, vec2 half_) {
    vec2 d = abs(p) - half_;
    return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
  }
`;

export const impossibleShaders = {
  // Impossible Triangle — three square beams meeting at right angles: one along
  // x, one along y, one along z, joined into an open chain. The chain's free
  // ends are separated by (L+w, L+w, L+w), a pure multiple of the view
  // direction, so the last beam's end cap lands exactly on the first beam's,
  // covering it. Nothing here is bent or faked: it is a real, buildable object
  // photographed from the one place it lies from.
  impossibleTriangle: `
    uniform vec3 baseColor;
    varying vec2 vUv;
    ${ISO_RIG}

    void main() {
      vec2 sc = (vUv - 0.5) * 5.9 + vec2(-1.25, -1.35);
      vec3 ro = ISO_R * sc.x + ISO_U * sc.y - ISO_F * 24.0;

      const float W = 0.5;    // half thickness of a beam
      const float L = 3.5;    // centre-line length of a beam

      float t = 1e9;
      vec3 n = vec3(0.0);
      float id = 0.0;
      isoBox(ro, ISO_F, vec3(0.0, -W, -W),      vec3(L + W, W, W),         t, n, id, 1.0);
      isoBox(ro, ISO_F, vec3(L - W, -W, -W),    vec3(L + W, L + W, W),     t, n, id, 2.0);
      isoBox(ro, ISO_F, vec3(L - W, L - W, -W), vec3(L + W, L + W, L + W), t, n, id, 3.0);

      vec3 col = baseColor * (0.13 - 0.05 * length(vUv - 0.5));
      if (t < 1.0e8) {
        vec3 hit = ro + ISO_F * t;
        // A slow gradient along each beam keeps the big flat faces from reading
        // as paint rather than surface.
        float grad = 0.94 + 0.10 * fract((hit.x + hit.y + hit.z) * 0.09);
        col = baseColor * isoTone(n) * grad;

        // Ink the creases: a jump in the normal is an edge between two faces, a
        // jump in depth is the silhouette against whatever lies behind.
        float crease = clamp(length(fwidth(n)) * 2.2, 0.0, 1.0);
        float step_ = smoothstep(0.03, 0.30, fwidth(t));
        col = mix(col, baseColor * 0.05, max(crease, step_) * 0.85);
      }
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,

  // Endless Stairs — sixteen treads in four flights round a rectangle, each one
  // a step higher than the last. Going out, the flights run four units; coming
  // back they run short by exactly the height climbed, so the loop's closing
  // vector is (16h, 16h, 16h) — parallel to the view direction and therefore
  // invisible. The last tread is nearer the camera than the first and lands on
  // top of it, and the climb has nowhere left to go but round again. The light
  // walking the flight never gains a millimetre and never stops.
  endlessStairs: `
    uniform vec3 baseColor;
    uniform float time;
    varying vec2 vUv;
    ${ISO_RIG}

    void main() {
      vec2 sc = (vUv - 0.5) * 6.6 + vec2(-0.85, -1.15);
      vec3 ro = ISO_R * sc.x + ISO_U * sc.y - ISO_F * 24.0;

      const float H = 0.18;          // rise per tread
      const float OUT = 1.0;         // run of an outbound tread
      const float BACK = 0.28;       // run of a return tread: OUT - 4H, so that
                                     // sixteen treads close the loop on (1,1,1)

      float t = 1e9;
      vec3 n = vec3(0.0);
      float id = -1.0;
      vec2 c = vec2(0.0);
      float z = 0.0;

      for (int i = 0; i < 16; i++) {
        float fi = float(i);
        float f = floor(fi * 0.25);
        vec2 dir = f < 0.5 ? vec2(1.0, 0.0)
                 : f < 1.5 ? vec2(0.0, 1.0)
                 : f < 2.5 ? vec2(-1.0, 0.0)
                           : vec2(0.0, -1.0);
        float run = f < 1.5 ? OUT : BACK;
        vec2 mid = c + dir * (run * 0.5);
        vec2 hf = abs(dir) * (run * 0.5) + abs(vec2(dir.y, dir.x)) * 0.5;
        // Treads are thicker than the rise, so consecutive ones overlap and the
        // flight reads as one solid stair rather than sixteen floating slabs.
        isoBox(ro, ISO_F, vec3(mid - hf, z + H - 0.34), vec3(mid + hf, z + H), t, n, id, fi);
        c += dir * run;
        z += H;
      }

      vec3 col = baseColor * (0.12 - 0.04 * length(vUv - 0.5));
      if (t < 1.0e8) {
        col = baseColor * isoTone(n);

        // The walker: a glow centred on one tread, its distance measured round
        // the cycle so it crosses the seam without noticing there is one.
        float walker = mod(time * 1.7, 16.0);
        float d = abs(mod(id - walker + 8.0, 16.0) - 8.0);
        col += baseColor * exp(-d * 1.1) * 0.55 * (n.z > 0.5 ? 1.0 : 0.35);

        float crease = clamp(length(fwidth(n)) * 2.2, 0.0, 1.0);
        float step_ = smoothstep(0.03, 0.30, fwidth(t));
        col = mix(col, baseColor * 0.05, max(crease, step_) * 0.8);
      }
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,

  // Impossible Fork — the blivet. Its trick is that it exists only as outline:
  // the two long inner lines are the inside edges of a two-pronged slab on the
  // left and the sides of a third round prong on the right, and nothing in the
  // drawing ever has to decide which. So this shader draws lines and almost
  // nothing else, and cross-fades the shading — round on the right, flat on the
  // left — through the middle, where the count changes and no line marks it.
  impossibleFork: `
    uniform vec3 baseColor;
    varying vec2 vUv;
    ${FLAT_SDF}

    const float IF_YA = 0.60;    // outer silhouette
    const float IF_YB = 0.30;    // inner edges of the outer prongs (right half only)
    const float IF_YC = 0.14;    // the two lines that change meaning
    const float IF_XL = -0.95;   // flat end
    const float IF_XR = 0.80;    // round end
    const float IF_XC = -0.08;   // where the reading changes, marked by nothing

    // The round cap of a prong: an arc, and only past the right end — a cap that
    // kept being evaluated to its left would lay a line down the whole tile.
    float ifCap(vec2 p, float yc, float ry) {
      if (p.x < IF_XR) return 1e9;
      vec2 q = vec2((p.x - IF_XR) / 0.11, (p.y - yc) / ry);
      return abs(length(q) - 1.0) * 0.11;
    }

    void main() {
      vec2 p = (vUv - 0.5) * 2.4;

      // ── the ink ──────────────────────────────────────────────────────────
      float d = 1e9;
      d = min(d, ipSeg(p, vec2(IF_XL,  IF_YA), vec2(IF_XR,  IF_YA)));
      d = min(d, ipSeg(p, vec2(IF_XL, -IF_YA), vec2(IF_XR, -IF_YA)));
      d = min(d, ipSeg(p, vec2(IF_XL,  IF_YC), vec2(IF_XR,  IF_YC)));
      d = min(d, ipSeg(p, vec2(IF_XL, -IF_YC), vec2(IF_XR, -IF_YC)));
      d = min(d, ipSeg(p, vec2(IF_XL,  IF_YC), vec2(IF_XL,  IF_YA)));
      d = min(d, ipSeg(p, vec2(IF_XL, -IF_YA), vec2(IF_XL, -IF_YC)));
      d = min(d, ifCap(p,  0.45, 0.15));
      d = min(d, ifCap(p,  0.00, IF_YC));
      d = min(d, ifCap(p, -0.45, 0.15));

      // The two lines that only exist on the right. They are not cut off — they
      // are lifted, like a pen easing off the paper, so no mark says where the
      // third prong stopped being there.
      float dInner = min(ipSeg(p, vec2(IF_XC,  IF_YB), vec2(IF_XR,  IF_YB)),
                         ipSeg(p, vec2(IF_XC, -IF_YB), vec2(IF_XR, -IF_YB)));
      float lift = smoothstep(IF_XC - 0.02, IF_XC + 0.34, p.x);

      float ink = max(smoothstep(0.030, 0.014, d),
                      smoothstep(0.030, 0.014, dInner) * lift);

      // ── the paper ────────────────────────────────────────────────────────
      // The figure is the same tone as the ground it lies on — a blivet exists
      // only as line — so the modelling can be cross-faded straight through the
      // middle and nothing marks where three prongs became two. Right: three
      // cylinders with a highlight down each axis. Left: one flat slab.
      float rod = 0.0;
      float u0 = (p.y - 0.45) / 0.15;  rod = max(rod, sqrt(max(1.0 - u0 * u0, 0.0)));
      float u1 = p.y / IF_YC;          rod = max(rod, sqrt(max(1.0 - u1 * u1, 0.0)));
      float u2 = (p.y + 0.45) / 0.15;  rod = max(rod, sqrt(max(1.0 - u2 * u2, 0.0)));

      float slab = step(IF_YC, abs(p.y)) * step(abs(p.y), IF_YA) * (0.34 + 0.30 * step(0.0, p.y));

      float side = smoothstep(IF_XC - 0.34, IF_XC + 0.34, p.x);
      float within = step(abs(p.y), IF_YA + 0.02) * step(IF_XL, p.x) * step(p.x, IF_XR + 0.12);
      float model = mix(slab, rod, side) * within;

      vec3 col = baseColor * (0.78 + 0.34 * model);      // paper, lightly modelled
      col = mix(col, baseColor * 0.06, ink);             // ink
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,

  // Necker Flip — the wireframe cube that will not hold still. Nothing in the
  // twelve lines says which square is nearer, so the eye picks one, holds it,
  // and eventually gives it up. The shader does the same on a timer: it fills
  // one square as the near face and lets it hide what is behind, sits with that
  // reading, then snaps to the other. The lines never move.
  neckerFlip: `
    uniform vec3 baseColor;
    uniform float time;
    varying vec2 vUv;
    ${FLAT_SDF}

    const float NK_H = 0.50;    // half-side of each square
    const float NK_D = 0.28;    // how far the back square is offset

    // One reading of the cube: cf in front, cb behind.
    vec3 nkRead(vec2 p, vec2 cf, vec2 cb, vec3 base) {
      vec2 k = vec2(NK_H, NK_H);
      float dF = 1e9, dB = 1e9, dC = 1e9;
      for (int i = 0; i < 4; i++) {
        float a = float(i) * 1.5707963 + 0.7853982;
        float b = a + 1.5707963;
        vec2 ca = vec2(cos(a), sin(a)) * NK_H * 1.4142136;
        vec2 cb2 = vec2(cos(b), sin(b)) * NK_H * 1.4142136;
        dF = min(dF, ipSeg(p, cf + ca, cf + cb2));
        dB = min(dB, ipSeg(p, cb + ca, cb + cb2));
        dC = min(dC, ipSeg(p, cf + ca, cb + ca));       // the connecting edge
      }

      float inFront = step(ipBox(p - cf, k), 0.0);
      vec3 col = base * 0.20;
      // Behind: the far square and the four struts, dimmed by the air in front.
      col = mix(col, base * 0.52, smoothstep(0.026, 0.012, min(dB, dC)));
      // The near face is opaque, so everything above stops at its border.
      col = mix(col, base * 0.86, inFront);
      col = mix(col, base * 1.10, smoothstep(0.030, 0.014, dF));
      return col;
    }

    void main() {
      vec2 p = (vUv - 0.5) * 2.2;
      vec2 lo = vec2(-NK_D, -NK_D);
      vec2 hi = vec2( NK_D,  NK_D);

      // Bistable perception does not dissolve, it switches: long holds, quick
      // changeovers.
      float ph = fract(time * 0.115);
      float tri = ph < 0.5 ? ph * 2.0 : (1.0 - ph) * 2.0;
      float k = smoothstep(0.42, 0.58, tri);

      vec3 a = nkRead(p, lo, hi, baseColor);
      vec3 b = nkRead(p, hi, lo, baseColor);
      gl_FragColor = vec4(clamp(mix(a, b, k), 0.0, 1.0), 1.0);
    }
  `,

  // Möbius Band — the band is defined exactly: take the ring of radius R, and at
  // angle θ turn its cross-section by θ/2. After one lap the cross-section has
  // turned by π, which maps the rectangle onto itself with its faces exchanged,
  // so the surface closes up with one side and one edge. The walker follows the
  // centre line at a fixed offset and needs two laps — 4π — to come home, which
  // is the shortest honest proof that the band has no other side to be on.
  mobiusBand: `
    uniform vec3 baseColor;
    uniform float time;
    varying vec2 vUv;

    const float MB_R = 1.0;      // ring radius
    const float MB_W = 0.42;     // half width of the band
    const float MB_T = 0.045;    // half thickness

    float mbMap(vec3 p) {
      float th = atan(p.y, p.x);
      float r = length(p.xy) - MB_R;
      float c = cos(th * 0.5), s = sin(th * 0.5);
      vec2 q = vec2(c * r + s * p.z, -s * r + c * p.z);   // untwist by θ/2
      vec2 d = abs(q) - vec2(MB_W, MB_T);
      return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
    }

    vec3 mbNormal(vec3 p) {
      vec2 e = vec2(0.0025, 0.0);
      return normalize(vec3(
        mbMap(p + e.xyy) - mbMap(p - e.xyy),
        mbMap(p + e.yxy) - mbMap(p - e.yxy),
        mbMap(p + e.yyx) - mbMap(p - e.yyx)));
    }

    void main() {
      vec2 uv = (vUv - 0.5) * 3.4;

      // Looking down on the ring from in front and above.
      vec3 fwd = normalize(vec3(0.0, 0.80, -0.60));
      vec3 rgt = vec3(1.0, 0.0, 0.0);
      vec3 up  = cross(rgt, fwd);
      vec3 ro = vec3(0.0, 0.0, 0.0) + rgt * uv.x + up * uv.y - fwd * 4.0;

      float t = 0.0;
      float hit = 0.0;
      for (int i = 0; i < 56; i++) {
        vec3 pos = ro + fwd * t;
        float d = mbMap(pos);
        if (d < 0.004) { hit = 1.0; break; }
        if (t > 8.0) break;
        t += max(d * 0.45, 0.006);     // the twist makes mbMap an over-estimate
      }

      vec3 col = baseColor * (0.11 - 0.04 * length(vUv - 0.5));

      if (hit > 0.5) {
        vec3 pos = ro + fwd * t;
        vec3 n = mbNormal(pos);
        float lam = 0.35 + 0.65 * max(dot(n, normalize(vec3(0.4, -0.5, 0.75))), 0.0);
        // Ribs across the band: a single family of lines that returns to itself
        // only after twice round.
        float th = atan(pos.y, pos.x);
        float rib = 0.5 + 0.5 * sin(th * 24.0);
        col = baseColor * (0.30 + 0.85 * lam) * (0.86 + 0.20 * rib);
        col *= 1.0 - 0.25 * smoothstep(3.0, 6.0, t);
      }

      // The walker, on the double cover: A runs to 4π before it repeats.
      float A = time * 0.55;
      vec3 rad = vec3(cos(A), sin(A), 0.0);
      vec3 M = rad * (MB_R + MB_W * 0.62 * cos(A * 0.5)) + vec3(0.0, 0.0, MB_W * 0.62 * sin(A * 0.5));
      vec2 ms = vec2(dot(M - ro, rgt), dot(M - ro, up));
      float mt = dot(M - ro, fwd);
      float ring = length(uv - ms);
      // Drawn only where it is in front of whatever the ray already found.
      float vis = (hit < 0.5 || mt < t + 0.06) ? 1.0 : 0.0;
      col += mix(baseColor, vec3(1.0), 0.75) * smoothstep(0.13, 0.02, ring) * 0.9 * vis;

      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,

  // Interlocking Wings — a regular division of the plane: one motif, repeated,
  // covering everything with no gap and no overlap. The tile is a square whose
  // left edge has been pushed into its right edge and whose top has been pushed
  // into its bottom by the same displacement, which is what guarantees the fit —
  // whatever bulges out of one cell is exactly the bite taken out of its
  // neighbour. Odd rows are flipped, so the birds face both ways and each one
  // roosts in the hollow of the row above.
  interlockingWings: `
    uniform vec3 baseColor;
    varying vec2 vUv;

    // The edge displacement, used identically on both axes so every bulge has a
    // matching bite. Two harmonics: the first makes the head and tail, the
    // second the notch a wing folds into.
    float iwEdge(float v) {
      return 0.135 * sin(6.2831853 * v) + 0.058 * sin(12.566371 * v + 1.9);
    }

    void main() {
      vec2 p = (vUv - 0.5) * 3.05;

      vec2 w = vec2(p.x + iwEdge(p.y), p.y + iwEdge(p.x));
      vec2 cell = floor(w);
      vec2 f = fract(w);

      // Glide reflection down the rows: alternate rows face the other way.
      float flip = mod(cell.y, 2.0);
      vec2 g = vec2(flip > 0.5 ? 1.0 - f.x : f.x, f.y);

      // Two colours, so each bird is bounded by birds of the other colour — the
      // minimum a plane division needs for the figures to stay separable.
      float parity = mod(cell.x + cell.y, 2.0);
      vec3 col = mix(baseColor * 0.30, baseColor * 0.92, parity);

      // Body shading: a light that rakes across each motif the same way.
      float lift = 0.80 + 0.34 * (1.0 - length(g - vec2(0.5, 0.45)) * 1.4);
      col *= lift;

      // An eye, and the leading edge of the near wing.
      float eye = smoothstep(0.055, 0.030, length((g - vec2(0.70, 0.62)) * vec2(1.0, 1.15)));
      float wing = smoothstep(0.055, 0.020, abs(length(g - vec2(0.28, 0.18)) - 0.34));
      col = mix(col, mix(baseColor, vec3(1.0), parity > 0.5 ? 0.0 : 0.85), eye);
      col = mix(col, mix(baseColor, vec3(parity), 0.35), wing * 0.35);

      // The seam between cells, thinned by the local stretch of the deformation
      // so it stays one width everywhere.
      vec2 e = min(f, 1.0 - f);
      float seam = 1.0 - smoothstep(0.008, 0.030, min(e.x, e.y));
      col = mix(col, baseColor * 0.10, seam * 0.8);

      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,
};
