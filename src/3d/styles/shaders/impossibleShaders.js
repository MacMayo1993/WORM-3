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
//   impossibleCube      Escher's crate: an honest frame with one crossing put back wrong
//   cubeTriangle        Reutersvärd's nine cubes, closed by the camera like the tribar
//   perpetualFall       a level aqueduct whose water drops a storey and comes home
//   schroderStairs      a staircase that turns into an overhang without a line moving
//   amesRoom            a slanted room that photographs square, and the giants it makes
//   rubinVase           a vase cut from the space between two faces, or the reverse
//
// Several of these are not illusions at all. The tribar, the endless staircase,
// the cube triangle and the waterfall are drawn here by ray-casting an honest
// solid object under an orthographic camera on the body diagonal — the same
// trick the physical sculptures use.
// Orthographic projection along (1,1,1) cannot distinguish two points that
// differ by a multiple of (1,1,1), so a chain of beams whose two free ends are
// separated by exactly such a vector reads as closed. The object is real; only
// the closure is a lie, and it is the camera that tells it. Turn the cube and
// the figure would fall apart — which it does not, because these tiles are
// screen-space, and that impossibility is the point.
//
// Every shader takes `baseColor` (the face colour) and, when animated, `time`.
// The shared helpers are joined in with + rather than interpolated, so the
// build's shader compaction still strips every template's comments.

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
    ` + ISO_RIG + `

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
    ` + ISO_RIG + `

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
    ` + FLAT_SDF + `

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
    ` + FLAT_SDF + `

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
      // Project M to screen space against the camera basis directly. Going
      // through (M - ro) would fold this fragment's own uv into the result — ro
      // already carries it — and detach the glow from the band.
      vec2 ms = vec2(dot(M, rgt), dot(M, up));
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

  // Impossible Cube — Escher's crate. Twelve square beams make an honest cube
  // frame, ray-cast as a solid under an orthographic camera that looks down
  // from the front, right and above, off the body diagonal, so the back square
  // sits up and to the right of the front one. From there exactly two back
  // edges cross two front ones on screen: the back-left post crosses the front
  // top beam, and the back bottom beam crosses the front-right post. Each
  // crossing on its own is a vote for one Necker reading of which square is
  // nearer. The shader tells the truth at the low crossing and swaps the depth
  // order at the high one, so the two votes disagree and no cube can satisfy
  // both. Everything else — every joint, face and shadow tone — is the real
  // solid; the lie is one depth comparison, and only where it is visible.
  impossibleCube: `
    uniform vec3 baseColor;
    varying vec2 vUv;
    ` + ISO_RIG + `

    // Only front, right and top can face this camera.
    float icTone(vec3 n) {
      return n.z > 0.5 ? 1.04 : (n.y < -0.5 ? 0.70 : 0.42);
    }

    void main() {
      vec3 F = normalize(vec3(-0.55, 1.0, -0.70));   // looking back, left and down
      vec3 R = normalize(vec3(F.y, -F.x, 0.0));      // level screen +x
      vec3 U = cross(R, F);                          // screen +y, z leaning up

      vec2 sc = (vUv - 0.5) * 6.3 + vec2(2.04, 1.59);
      vec3 ro = R * sc.x + U * sc.y - F * 24.0;

      const float S = 3.0;    // centre-line side of the frame
      const float W = 0.32;   // half thickness of a beam

      float t = 1e9;
      vec3 n = vec3(0.0);
      float id = 0.0;
      // Along x: front bottom, front top, back bottom, back top.
      isoBox(ro, F, vec3(-W, -W, -W),         vec3(S + W, W, W),         t, n, id, 1.0);
      isoBox(ro, F, vec3(-W, -W, S - W),      vec3(S + W, W, S + W),     t, n, id, 2.0);
      isoBox(ro, F, vec3(-W, S - W, -W),      vec3(S + W, S + W, W),     t, n, id, 3.0);
      isoBox(ro, F, vec3(-W, S - W, S - W),   vec3(S + W, S + W, S + W), t, n, id, 4.0);
      // Along y: the four edges running front to back.
      isoBox(ro, F, vec3(-W, -W, -W),         vec3(W, S + W, W),         t, n, id, 5.0);
      isoBox(ro, F, vec3(-W, -W, S - W),      vec3(W, S + W, S + W),     t, n, id, 6.0);
      isoBox(ro, F, vec3(S - W, -W, -W),      vec3(S + W, S + W, W),     t, n, id, 7.0);
      isoBox(ro, F, vec3(S - W, -W, S - W),   vec3(S + W, S + W, S + W), t, n, id, 8.0);
      // Along z: three of the four posts.
      isoBox(ro, F, vec3(-W, -W, -W),         vec3(W, W, S + W),         t, n, id, 9.0);
      isoBox(ro, F, vec3(S - W, -W, -W),      vec3(S + W, W, S + W),     t, n, id, 10.0);
      isoBox(ro, F, vec3(S - W, S - W, -W),   vec3(S + W, S + W, S + W), t, n, id, 11.0);

      // The back-left post is tested on its own, so its one lie can be told.
      float tP = 1e9;
      vec3 nP = vec3(0.0);
      float idP = 0.0;
      isoBox(ro, F, vec3(-W, S - W, -W), vec3(W, S + W, S + W), tP, nP, idP, 12.0);

      // Wherever the post and the front top beam both lie under this pixel, the
      // post is put in front. The two share no point in space and overlap on
      // screen only at their crossing, so this one comparison is the whole lie.
      bool lie = abs(id - 2.0) < 0.5 && tP < 1.0e8;
      if (tP < t || lie) { t = tP; n = nP; id = idP; }

      // Creases and silhouettes, taken in uniform control flow: a jump in the
      // normal is an edge between faces, a jump in depth is an occluding edge —
      // which is what outlines the swapped crossing exactly as an honest one.
      float crease = clamp(length(fwidth(n)) * 2.2, 0.0, 1.0);
      float step_ = smoothstep(0.03, 0.30, fwidth(t));

      vec3 col = baseColor * (0.13 - 0.05 * length(vUv - 0.5));
      if (t < 1.0e8) {
        vec3 hit = ro + F * t;
        float grad = 0.90 + 0.12 * clamp(hit.z / S, 0.0, 1.0);
        col = baseColor * icTone(n) * grad;
        col = mix(col, baseColor * 0.05, max(crease, step_) * 0.85);
      }
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,

  // Cube Triangle — Reutersvärd's nine cubes, 1934, two decades before the
  // Penroses drew the tribar. Separate cubes, each a little apart from the next,
  // are laid along the tribar's chain: three steps along x, three along y, three
  // up z. The chain starts at the origin and ends at (3,3,3)·step — a multiple
  // of the view direction — so the last cube, the one nearest the camera,
  // lands exactly over where the first would be. Every cube is real and so is
  // every gap between them; the camera closes the triangle.
  cubeTriangle: `
    uniform vec3 baseColor;
    varying vec2 vUv;
    ` + ISO_RIG + `

    void main() {
      vec2 sc = (vUv - 0.5) * 4.4 + vec2(-1.06, -1.22);
      vec3 ro = ISO_R * sc.x + ISO_U * sc.y - ISO_F * 24.0;

      const float SP = 1.0;    // centre-to-centre step along the chain
      const float HC = 0.42;   // half side of a cube; the rest of a step is gap

      float t = 1e9;
      vec3 n = vec3(0.0);
      float id = -1.0;
      for (int i = 0; i < 9; i++) {
        float fi = float(i);
        vec3 c = fi < 2.5 ? vec3(SP * (fi + 1.0), 0.0, 0.0)
               : fi < 5.5 ? vec3(3.0 * SP, SP * (fi - 2.0), 0.0)
                          : vec3(3.0 * SP, 3.0 * SP, SP * (fi - 5.0));
        isoBox(ro, ISO_F, c - HC, c + HC, t, n, id, fi);
      }

      float crease = clamp(length(fwidth(n)) * 2.2, 0.0, 1.0);
      float step_ = smoothstep(0.03, 0.30, fwidth(t));

      vec3 col = baseColor * (0.13 - 0.05 * length(vUv - 0.5));
      if (t < 1.0e8) {
        vec3 hit = ro + ISO_F * t;
        col = baseColor * isoTone(n);
        // A soft bevel light along each cube's top edges, so separate blocks
        // read as blocks rather than as a cut-out band.
        vec3 c = hit - (floor(hit / SP + 0.5) * SP);
        float rim = smoothstep(HC - 0.08, HC, max(max(abs(c.x), abs(c.y)), abs(c.z)));
        col *= 1.0 - 0.10 * rim;
        col = mix(col, baseColor * 0.05, max(crease, step_) * 0.85);
      }
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,

  // Perpetual Waterfall — Escher's 1961 aqueduct as an honest solid. Four level
  // channels run +x OUT, +y OUT, -x BACK, -y BACK, and then the water falls H.
  // Because BACK = OUT + H, the chain's net displacement is (-H, -H, -H): a
  // multiple of the view direction, so the foot of the fall lands, on screen,
  // exactly on the head of the first channel — H nearer the camera and H higher
  // than where the water actually arrives. Every channel is level and the water
  // in each is truly flowing; the drop is real; only the return is the
  // camera's. The loop runs uphill by the one height the eye cannot measure.
  perpetualFall: `
    uniform vec3 baseColor;
    uniform float time;
    varying vec2 vUv;
    ` + ISO_RIG + `

    const float H = 1.8;       // the drop
    const float OUT = 2.0;     // run of the two outbound channels (+x, then +y)
    const float BACK = 3.8;    // run of the two return channels: BACK = OUT + H,
                               // so the loop closes on (-H, -H, -H), the view axis
    const float PF_W = 0.48;   // half width of a channel's masonry
    const float PF_WI = 0.32;  // half width of the water inside it
    const float PF_D = 0.42;   // depth of masonry under the water line

    float pfHash(float x) { return fract(sin(x * 91.7 + 3.1) * 43758.5453); }

    // Nearest point on one channel's centre line: x = distance to it, y = how
    // far downstream it lies, measured from the head of the first channel.
    vec2 pfSeg(vec2 p, vec2 a, vec2 b, float s0, vec2 best) {
      vec2 ba = b - a;
      float len = length(ba);
      float h = clamp(dot(p - a, ba) / (len * len), 0.0, 1.0);
      float d = length(p - a - ba * h);
      return d < best.x ? vec2(d, s0 + h * len) : best;
    }

    vec2 pfFlow(vec2 p) {
      vec2 a1 = vec2(OUT, 0.0);
      vec2 a2 = vec2(OUT, OUT);
      vec2 a3 = vec2(OUT - BACK, OUT);            // (-H, OUT)
      vec2 a4 = vec2(OUT - BACK, OUT - BACK);     // (-H, -H): the lip of the fall
      vec2 best = vec2(1e9, 0.0);
      best = pfSeg(p, vec2(0.0), a1, 0.0, best);
      best = pfSeg(p, a1, a2, OUT, best);
      best = pfSeg(p, a2, a3, 2.0 * OUT, best);
      best = pfSeg(p, a3, a4, 2.0 * OUT + BACK, best);
      return best;
    }

    void main() {
      vec2 sc = (vUv - 0.5) * 5.8 + vec2(0.64, -0.30);
      vec3 ro = ISO_R * sc.x + ISO_U * sc.y - ISO_F * 24.0;

      float t = 1e9;
      vec3 n = vec3(0.0);
      float id = -1.0;
      // The channels, all with their water at z = 0.
      isoBox(ro, ISO_F, vec3(-PF_W, -PF_W, -PF_D),
                        vec3(OUT + PF_W, PF_W, 0.0), t, n, id, 0.0);
      isoBox(ro, ISO_F, vec3(OUT - PF_W, -PF_W, -PF_D),
                        vec3(OUT + PF_W, OUT + PF_W, 0.0), t, n, id, 1.0);
      isoBox(ro, ISO_F, vec3(OUT - BACK - PF_W, OUT - PF_W, -PF_D),
                        vec3(OUT + PF_W, OUT + PF_W, 0.0), t, n, id, 2.0);
      // The last channel stops short so the water can pour off its end.
      isoBox(ro, ISO_F, vec3(-H - PF_W, -H + PF_WI, -PF_D),
                        vec3(-H + PF_W, OUT + PF_W, 0.0), t, n, id, 3.0);
      // The fall itself: a column of water, H tall, under the lip.
      isoBox(ro, ISO_F, vec3(-H - PF_WI, -H - PF_WI, -H),
                        vec3(-H + PF_WI, -H + PF_WI, -0.04), t, n, id, 4.0);
      // Piers under three corners, running down out of the picture.
      isoBox(ro, ISO_F, vec3(OUT - 0.28, -0.28, -12.0),
                        vec3(OUT + 0.28, 0.28, -PF_D), t, n, id, 5.0);
      isoBox(ro, ISO_F, vec3(OUT - 0.28, OUT - 0.28, -12.0),
                        vec3(OUT + 0.28, OUT + 0.28, -PF_D), t, n, id, 6.0);
      isoBox(ro, ISO_F, vec3(-H - 0.28, OUT - 0.28, -12.0),
                        vec3(-H + 0.28, OUT + 0.28, -PF_D), t, n, id, 7.0);

      float crease = clamp(length(fwidth(n)) * 2.2, 0.0, 1.0);
      float step_ = smoothstep(0.03, 0.30, fwidth(t));

      vec3 hit = ro + ISO_F * min(t, 60.0);
      vec2 fl = pfFlow(hit.xy);
      float aa = fwidth(fl.x) + 1e-4;

      vec3 col = baseColor * (0.12 - 0.04 * length(vUv - 0.5));
      if (t < 1.0e8) {
        vec3 stone = baseColor * isoTone(n) * 0.80;
        // Courses of stone on the piers and channel sides.
        stone *= 1.0 - 0.10 * smoothstep(0.80, 0.95, fract(hit.z * 2.4));
        col = stone;

        vec3 water = mix(baseColor, vec3(1.0), 0.30);
        vec3 foam = mix(baseColor, vec3(1.0), 0.80);

        if (id < 3.5 && n.z > 0.5) {
          // Running water: chevrons drifting downstream, bowed by the slower
          // water near the walls.
          float ph = fl.y * 2.6 + fl.x * 3.2 - time * 1.6;
          float rip = smoothstep(0.55, 0.95, sin(ph * 6.2831853) * 0.5 + 0.5);
          vec3 w = mix(water, foam, rip * 0.55);
          // Churn where the fall arrives — on screen, at the first channel's head.
          float land = 1.0 - smoothstep(0.05, 0.65, length(hit.xy));
          float fizz = pfHash(floor(hit.x * 14.0) + floor(hit.y * 14.0) * 31.0 + floor(time * 9.0));
          w = mix(w, foam, land * (0.55 + 0.45 * fizz));
          float wet = 1.0 - smoothstep(PF_WI - aa, PF_WI + aa, fl.x);
          col = mix(baseColor * 0.86, w, wet);
          // A dark waterline where water meets stone.
          col = mix(col, baseColor * 0.10, (1.0 - smoothstep(0.0, 0.035 + aa, abs(fl.x - PF_WI))) * 0.7);
        } else if (id > 3.5 && id < 4.5) {
          // The falling sheet: streaks dropping at the pace of the flow above.
          float across = n.x > 0.5 ? hit.y : hit.x;
          float lane = floor(across * 11.0);
          float st = fract(hit.z * 1.1 + time * 1.9 + pfHash(lane));
          float streak = smoothstep(0.0, 0.25, st) * (1.0 - smoothstep(0.35, 0.75, st));
          col = mix(water * (n.z > 0.5 ? 1.0 : (n.x > 0.5 ? 0.92 : 0.78)), foam, streak * 0.75);
        }
        col = mix(col, baseColor * 0.05, max(crease, step_) * 0.85);
      }
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,

  // Schröder Stairs — Schröder's 1858 staircase. A zigzag profile, the same
  // zigzag shifted along one oblique depth edge, and walls closing each end:
  // read with the zigzag nearer, it is a flight of stairs seen from above, its
  // side wall below and the wall it climbs behind; read with the shifted copy
  // nearer, the same parallelograms are the underside of a stepped ceiling seen
  // from below, with the wall it hangs from above. The drawing is the picture
  // of both solids, exactly — depth inverted through the paper — so nothing in
  // the lines can choose. Only the light does: on a timer, treads lit and
  // risers dark, then risers lit and the treads turned to soffits in shadow.
  schroderStairs: `
    uniform vec3 baseColor;
    uniform float time;
    varying vec2 vUv;
    ` + FLAT_SDF + `

    const float SS_S = 0.30;     // rise and run of one step
    const float SS_A = 0.46;     // the depth edge is (-SS_A, SS_A)
    const float SS_N = 4.0;      // steps

    void main() {
      vec2 p = (vUv - 0.5) * 2.0;
      vec2 P0 = vec2(-0.37, -0.83);          // foot of the first riser
      vec2 D = vec2(-SS_A, SS_A);
      float top = SS_N * SS_S;
      float px = fwidth(p.x);

      // The depth edge is square to the stair's diagonal, so u = x + y names
      // the point of the zigzag a pixel lies over and v = y - x how far it sits
      // along the depth edge from that point.
      vec2 q = p - P0;
      float u = q.x + q.y;
      float v = q.y - q.x;
      float m = mod(u, 2.0 * SS_S);
      float vz = SS_S - abs(m - SS_S);        // the zigzag, in (u, v)
      float w = (v - vz) / (2.0 * SS_A);      // 0 on the front zigzag, 1 on the back
      float riser = step(m, SS_S);

      float inFig = step(0.0, u) * step(u, 2.0 * top);
      float band = inFig * step(0.0, w) * step(w, 1.0);
      float low = inFig * step(w, 0.0) * step(0.0, q.y) * step(q.x, top);
      float upp = inFig * step(1.0, w) * step(-SS_A, q.x) * step(q.y, top + SS_A);

      // Bistable, so it switches rather than dissolves: long holds, quick turns.
      float ph = fract(time * 0.105 + 0.27);
      float tri = ph < 0.5 ? ph * 2.0 : (1.0 - ph) * 2.0;
      float k = smoothstep(0.42, 0.58, tri);

      // Stairs (k = 0): treads lit, risers half lit, the stair's side wall
      // below, the wall it climbs behind. Overhang (k = 1): risers lit, treads
      // become soffits in shadow, the overhang's side wall above, wall below.
      // Each reading darkens toward its own far edge.
      float wf = clamp(w, 0.0, 1.0);
      float tread = mix(1.04 - 0.16 * wf, 0.30 + 0.10 * wf, k);
      float rise = mix(0.62 - 0.10 * wf, 0.84 - 0.14 * (1.0 - wf), k);
      float face = mix(tread, rise, riser);
      float tone = 0.15;
      tone = mix(tone, face, band);
      tone = mix(tone, mix(0.48, 0.22, k), low);
      tone = mix(tone, mix(0.24, 0.50, k), upp);
      vec3 col = baseColor * tone;

      // ── the ink: never moves ──────────────────────────────────────────────
      float d = 1e9;
      for (int i = 0; i < 4; i++) {
        vec2 a = P0 + vec2(float(i) * SS_S);
        vec2 b = a + vec2(0.0, SS_S);
        vec2 c = b + vec2(SS_S, 0.0);
        d = min(d, ipSeg(p, a, b));
        d = min(d, ipSeg(p, b, c));
        d = min(d, ipSeg(p, a + D, b + D));
        d = min(d, ipSeg(p, b + D, c + D));
        d = min(d, ipSeg(p, a, a + D));
        d = min(d, ipSeg(p, b, b + D));
      }
      vec2 P8 = P0 + vec2(top);
      d = min(d, ipSeg(p, P8, P8 + D));
      d = min(d, ipSeg(p, P0, P0 + vec2(top, 0.0)));           // floor of the stair's side
      d = min(d, ipSeg(p, P0 + vec2(top, 0.0), P8));             // its far end
      d = min(d, ipSeg(p, P0 + D, P0 + D + vec2(0.0, top)));     // the other wall's end
      d = min(d, ipSeg(p, P0 + D + vec2(0.0, top), P8 + D));     // and its top
      float lw = max(0.010, px * 0.65);
      col = mix(col, baseColor * 0.05, 1.0 - smoothstep(lw - px * 0.5, lw + px * 0.5, d));

      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,

  // Ames Room — the room Adelbert Ames built in 1946, honestly. Look through
  // the peephole (the eye at the origin, looking down +z) at an ordinary
  // rectangular room whose back wall stands at depth Z0. Now slide every
  // surface point along its own eye ray, A -> t·A: the picture cannot change.
  // Choose t so the slid back wall is the slanted plane z + b·x = a. For the
  // apparent wall point A = (x, y, Z0) that means t·Z0 + b·t·x = a, so
  //     t = a / (Z0 + b·x),
  // and with a = Z0 the centre stays put, the left corner (x < 0) runs away
  // and the right corner comes in. The floor, ceiling and side walls are slid
  // the same way, so the checkerboard is the picture of square tiles even
  // though the real ones are not square. A person of true height h standing
  // at that wall point is at true depth t·Z0 and subtends h / (t·Z0) — exactly
  // what a person of height h/t would subtend at Z0. So in the square room the
  // eye believes in, the apparent scale is 1/t = 1 + (b/Z0)·x: the same person
  // is small in the far corner and a giant in the near one. Two identical
  // people stand against the back wall; one walks the length of it and back.
  amesRoom: `
    uniform vec3 baseColor;
    uniform float time;
    varying vec2 vUv;
    ` + FLAT_SDF + `

    const float AR_Z0 = 2.0;    // apparent depth of the back wall
    const float AR_XW = 1.15;   // half width of the room
    const float AR_YF = 0.78;   // floor, below the eye
    const float AR_YC = 0.88;   // ceiling, above the eye
    const float AR_B = 0.55;    // b·XW/Z0: how far the slant scales the corners
    const float AR_H = 0.92;    // apparent height of a person at the centre

    float arCapsule(vec2 p, vec2 a, vec2 b, float r) {
      return ipSeg(p, a, b) - r;
    }

    // A person, in units of their own height, feet at the origin. 'stride'
    // swings the legs apart and the arms against them.
    float arPerson(vec2 q, float stride) {
      float d = length(q - vec2(0.0, 0.885)) - 0.100;                   // head
      d = min(d, ipBox(q - vec2(0.0, 0.62), vec2(0.085, 0.14)) - 0.045); // body
      d = min(d, arCapsule(q, vec2(-0.035, 0.44), vec2(-0.035 - stride, 0.03), 0.040));
      d = min(d, arCapsule(q, vec2( 0.035, 0.44), vec2( 0.035 + stride, 0.03), 0.040));
      d = min(d, arCapsule(q, vec2(-0.115, 0.74), vec2(-0.13 + stride * 0.7, 0.46), 0.032));
      d = min(d, arCapsule(q, vec2( 0.115, 0.74), vec2( 0.13 - stride * 0.7, 0.46), 0.032));
      return d;
    }

    void main() {
      vec2 s = (vUv - 0.5) * 2.0;   // the picture plane at unit distance
      float px = fwidth(s.x);

      // First surface along the eye ray (s, 1) from inside the box.
      float tx = AR_XW / max(abs(s.x), 1e-4);
      float ty = s.y < 0.0 ? AR_YF / max(-s.y, 1e-4) : AR_YC / max(s.y, 1e-4);
      float t = min(min(tx, ty), AR_Z0);
      vec3 P = vec3(s, 1.0) * t;

      // Floor coordinates for every pixel, so their derivatives are taken in
      // uniform control flow; only floor pixels use them.
      float tf = AR_YF / max(-s.y, 0.02);
      vec2 fq = vec2(s.x * tf, tf) / (AR_XW / 3.0);
      vec2 fw = fwidth(fq);

      vec3 col;
      if (t >= AR_Z0 - 1e-4) {
        // Back wall: plaster lit from the window, a skirting along its foot.
        col = baseColor * (0.84 + 0.10 * P.y);
        vec2 wq = P.xy - vec2(0.0, 0.10);
        float win = ipBox(wq, vec2(0.30, 0.30));
        vec3 sky = mix(baseColor, vec3(1.0), 0.55 + 0.25 * wq.y);
        float bars = min(abs(wq.x), abs(wq.y)) - 0.018;
        sky = mix(sky, baseColor * 0.35, 1.0 - smoothstep(0.0, 0.012, bars));
        col = mix(col, sky, 1.0 - smoothstep(-0.006, 0.006, win));
        col = mix(col, baseColor * 0.30, 1.0 - smoothstep(0.0, 0.024, abs(win)));
        col = mix(col, baseColor * 0.55, step(P.y, -AR_YF + 0.07));
      } else if (ty <= tx) {
        if (s.y < 0.0) {
          // Floor: square tiles, filtered so the far rows grey out instead of
          // shimmering.
          vec2 g = fract(fq) - 0.5;
          vec2 e = smoothstep(vec2(-0.5) + fw, vec2(-0.5) + 2.0 * fw, -abs(g) + vec2(0.0));
          float chk = mod(floor(fq.x) + floor(fq.y), 2.0);
          float blur = clamp(max(fw.x, fw.y) * 1.6, 0.0, 1.0);
          chk = mix(chk, 0.5, blur);
          col = baseColor * mix(0.26, 1.0, chk);
          col *= 0.86 + 0.14 * smoothstep(0.6, AR_Z0, P.z);
          col = mix(col, col * 0.85, (1.0 - e.x * e.y) * (1.0 - blur));
        } else {
          col = baseColor * (0.40 + 0.10 * smoothstep(0.8, AR_Z0, P.z));   // ceiling
        }
      } else {
        // Side walls, a dado rail running to the vanishing point.
        col = baseColor * (s.x < 0.0 ? 0.72 : 0.58);
        col *= 0.84 + 0.16 * smoothstep(0.8, AR_Z0, P.z);
        col = mix(col, baseColor * 0.38, 1.0 - smoothstep(0.0, 0.02, abs(P.y + 0.30)));
      }

      // The room's edges: the back wall's frame and the four corner lines,
      // which run from its corners toward the vanishing point at the centre.
      vec2 bw = vec2(AR_XW, 0.5 * (AR_YC + AR_YF)) / AR_Z0;
      vec2 bc = vec2(0.0, 0.5 * (AR_YC - AR_YF)) / AR_Z0;
      float edge = abs(ipBox(s - bc, bw));
      vec2 c1 = vec2(AR_XW, -AR_YF), c2 = vec2(AR_XW, AR_YC);
      float outside = step(0.0, ipBox(s - bc, bw));
      vec2 sa = abs(s);
      vec2 cc = s.y < 0.0 ? c1 : c2;
      float diag = abs(sa.x * abs(cc.y) - abs(s.y) * cc.x) / length(cc);
      edge = min(edge, mix(1e9, diag, outside));
      col = mix(col, baseColor * 0.12, (1.0 - smoothstep(px * 0.4, px * 1.4, edge)) * 0.8);

      // Two identical people against the back wall. Scale 1/t = 1 + (b/Z0)·x.
      vec2 B = s * AR_Z0;                               // apparent back-wall coords
      float xs = AR_XW * 0.80;                          // the one who stays, near corner
      float ph = 0.5 - 0.5 * cos(time * 0.30);
      float xw = AR_XW * mix(-0.84, 0.40, ph);          // the one who walks
      float ms = 1.0 + AR_B * xs / AR_XW;
      float mw = 1.0 + AR_B * xw / AR_XW;
      float strideW = 0.07 * sin(xw * 10.0 / mw) * smoothstep(0.0, 0.10, sin(time * 0.30) * sin(time * 0.30));
      vec2 qs = (B - vec2(xs, -AR_YF)) / (AR_H * ms);
      vec2 qw = (B - vec2(xw, -AR_YF)) / (AR_H * mw);
      float dS = arPerson(qs, 0.0) * AR_H * ms;
      float dW = arPerson(qw, strideW) * AR_H * mw;
      // Contact shadows on the floor at their feet.
      float sh = exp(-qs.x * qs.x * 30.0 - qs.y * qs.y * 900.0) + exp(-qw.x * qw.x * 30.0 - qw.y * qw.y * 900.0);
      col *= 1.0 - 0.45 * clamp(sh, 0.0, 1.0);
      float pa = px * AR_Z0;
      float fig = 1.0 - smoothstep(-pa, pa, min(dS, dW));
      col = mix(col, baseColor * 0.08, fig);

      // The peephole: one eye, one point of view, and nothing else to check by.
      float r = length(s);
      col *= mix(0.30, 1.0, 1.0 - smoothstep(1.05, 1.36, r));

      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,

  // Rubin Vase — Edgar Rubin's figure and ground, 1915. One curve, mirrored:
  // read from inside, it is the side of a vase; read from outside, the profile
  // of a face — brow, nose, lips, chin — looking at its twin. A boundary can
  // only belong to one region at a time (the figure owns its edge, the ground
  // runs on behind it), so the eye picks a side, holds it, and then gives it up.
  // The shader does the same on a timer: it models the vase as a glazed pot and
  // lets the faces lie flat as shadow, then models the faces and lets the vase
  // become the gap between them. The line itself never moves.
  rubinVase: `
    uniform vec3 baseColor;
    uniform float time;
    varying vec2 vUv;

    float rvBump(float y, float c, float s) {
      float q = (y - c) / s;
      return exp(-q * q);
    }

    // The head's broad shape behind the profile: forehead sloping back above,
    // the jaw giving way to the throat below. The vase's half width, unbumped.
    float rvSkull(float y) {
      return 0.35 + 0.27 * smoothstep(0.45, 1.05, y) + 0.21 * smoothstep(-0.36, -0.62, y);
    }

    // Half width of the vase at height y: the facial profile, read sideways.
    float rvHalf(float y) {
      float w = rvSkull(y);
      w -= 0.035 * rvBump(y, 0.52, 0.06);                 // brow
      w += 0.025 * rvBump(y, 0.42, 0.035);                // the bridge's hollow
      float nose = (y - 0.20) / (y > 0.20 ? 0.16 : 0.05);
      w -= 0.21 * exp(-nose * nose);                      // nose: long bridge, short underside
      w -= 0.075 * rvBump(y, 0.02, 0.040);                // upper lip
      w -= 0.060 * rvBump(y, -0.11, 0.038);               // lower lip
      w -= 0.070 * rvBump(y, -0.34, 0.065);               // chin
      return w;
    }

    void main() {
      vec2 p = (vUv - 0.5) * 1.75 + vec2(0.0, 0.17);
      float px = fwidth(p.x);

      float w = rvHalf(p.y);
      float dw = (rvHalf(p.y + 0.004) - rvHalf(p.y - 0.004)) / 0.008;
      float e = (abs(p.x) - w) / sqrt(1.0 + dw * dw);   // > 0 in a face
      float vase = 1.0 - smoothstep(-px * 0.7, px * 0.7, e);

      float ph = fract(time * 0.095 + 0.62);
      float tri = ph < 0.5 ? ph * 2.0 : (1.0 - ph) * 2.0;
      float k = smoothstep(0.42, 0.58, tri);              // 0: vase, 1: faces

      vec3 ground = baseColor * 0.12;

      // The vase as a lathe-turned pot: a cylinder's light across it, a
      // highlight running down one side, a lip ring and a foot ring.
      float u = clamp(p.x / max(w, 0.05), -1.0, 1.0);
      float nz = sqrt(max(1.0 - u * u, 0.0));
      float lam = 0.40 + 0.66 * max(dot(vec3(u, 0.0, nz), normalize(vec3(-0.55, 0.0, 0.83))), 0.0);
      vec3 vaseLit = baseColor * lam;
      vaseLit = mix(vaseLit, vec3(1.0), 0.50 * rvBump(u, -0.50, 0.075));
      float rings = min(abs(p.y - 0.86), abs(p.y + 0.56));
      vaseLit = mix(vaseLit, baseColor * 0.42, (1.0 - smoothstep(0.0, 0.016 + px, rings)) * 0.7 * nz);

      // The faces: skin turning away at the profile, a lit cheek, a closed
      // eye under its brow — all laid out from the head's broad shape, so the
      // fine profile appears only at the edge.
      float hx = abs(p.x) - rvSkull(p.y);                 // depth into the head
      float rim = smoothstep(0.0, 0.10, max(e, 0.0));
      float skin = 0.62 + 0.30 * rim - 0.12 * smoothstep(0.20, 0.50, hx);
      skin += 0.14 * rvBump(hx, 0.17, 0.10) * rvBump(p.y, 0.06, 0.12);
      vec3 faceLit = baseColor * skin;
      vec2 eye = vec2(hx - 0.14, p.y - 0.37);
      float lid = abs(length(eye * vec2(1.0, 2.4)) - 0.05) - 0.003;
      float eyeMark = (1.0 - smoothstep(0.0, 0.008 + px, lid)) * step(eye.y, 0.0);
      vec2 bq = vec2(hx - 0.12, p.y - 0.43);
      float brow = abs(length(bq * vec2(1.0, 2.8)) - 0.075) - 0.003;
      eyeMark = max(eyeMark, (1.0 - smoothstep(0.0, 0.008 + px, brow)) * step(0.0, bq.y) * 0.55);
      faceLit = mix(faceLit, baseColor * 0.30, eyeMark);

      vec3 vaseCol = mix(vaseLit, ground, k);
      vec3 faceCol = mix(ground, faceLit, k);
      vec3 col = mix(faceCol, vaseCol, vase);

      // The one line both readings share.
      col = mix(col, baseColor * 0.06, (1.0 - smoothstep(0.0, px * 1.2, abs(e))) * 0.5);

      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,
};
