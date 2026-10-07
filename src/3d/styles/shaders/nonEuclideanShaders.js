// Non-Euclidean tile shaders — tiles drawn in geometries that are not the flat
// plane. Each one renders an honest model of its geometry rather than a stylised
// impression of it:
//
//   poincareDisk        hyperbolic {7,3} tiling, folded by inversion in its mirror circles
//   hyperbolicWeave     hyperbolic {5,4} tiling flowing under a Möbius translation
//   apollonian          inversive geometry — the limit set of four tangent circles
//   circleInversion     the whole lattice folded inside a mirror circle
//   rp2Geodesics        elliptic geometry on RP², geodesics wrapping antipodally
//   solFlow             Thurston's Sol — one axis expands while the other contracts
//   nilTwist            Thurston's Nil — the Heisenberg fibre coordinate is swept area
//   lightCone           Minkowski signature (+,−); boosts slide events along hyperbolae
//   metricBalls         unit balls of the L^p metrics, p sweeping 0.45 → 7
//   gyroidSlice         a moving plane section of the gyroid minimal surface
//   hopfFibers          stereographic Hopf fibration — a bipolar pencil of circles
//   drosteSpiral        the conformal log-spiral tiling (Escher's Droste map)
//   modularTiling       the modular group PSL(2,ℤ) folding the upper half-plane (Dedekind)
//   horocycleFlow       horocycles and their geodesics streaming under a parabolic flow
//   sphericalTiling     the octahedral reflection group's 48 triangles on a turning sphere
//   hyperbolicParallels Playfair's axiom failing — a whole fan of parallels through P
//
// Every shader takes `baseColor` (the face colour) and, when animated, `time`.
//
// The two hyperbolic tilings share a construction. A regular p-gon with interior
// angle 2π/q, centred at the origin of the Poincaré disk, has sides lying on
// circles orthogonal to the unit circle — so a side circle at distance d has
// radius r = √(d² − 1). Writing A = cos(π/p), B = sin(π/q) and v for the
// Euclidean distance to a polygon vertex, the two conditions (vertex on the side
// circle; arcs meeting at angle 2π/q) reduce to
//
//   v² − K v + 1 = 0  with  K = (2A² + 2B² − 4A²B²) / (A² − B²),   d = (1 + v²) / (2vA)
//
// which is where the constants below come from. K → ∞ exactly when 1/p + 1/q =
// 1/2, i.e. when the tiling stops being hyperbolic and goes flat.

export const nonEuclideanShaders = {
  // Poincaré Disk — the hyperbolic {7,3} tiling: seven-sided cells, three to a
  // vertex, shrinking forever toward the circle at infinity without ever
  // reaching it. Every fragment is folded back into the central heptagon by
  // repeated inversion in its mirror circle, so the small motif drawn at the end
  // is drawn once but lands in every cell, correctly distorted.
  poincareDisk: `
    uniform vec3 baseColor;
    varying vec2 vUv;

    const float PD_WEDGE = 0.897597901;  // 2π/7
    const float PD_D     = 2.012192;
    const float PD_R     = 1.746115;

    void main() {
      vec2 p = (vUv - 0.5) * 2.14;
      float rad = length(p);
      if (rad > 1.0) {
        // Past the circle at infinity there is no hyperbolic plane to draw.
        float halo = smoothstep(1.16, 1.0, rad);
        gl_FragColor = vec4(baseColor * (0.03 + 0.1 * halo), 1.0);
        return;
      }

      vec2 c = vec2(PD_D, 0.0);
      float depth = 0.0;
      float edge = 1e9;
      for (int i = 0; i < 20; i++) {
        // Fold into one wedge of the 7-fold rotation, then across the x-axis.
        float a = atan(p.y, p.x);
        a = mod(a + PD_WEDGE * 0.5, PD_WEDGE) - PD_WEDGE * 0.5;
        p = vec2(cos(a), abs(sin(a))) * length(p);

        vec2 q = p - c;
        float q2 = dot(q, q);
        edge = min(edge, abs(sqrt(q2) - PD_R));
        if (q2 > PD_R * PD_R) break;         // outside the mirror = fundamental cell
        p = c + q * (PD_R * PD_R / q2);      // invert and go around again
        depth += 1.0;
      }

      float line = smoothstep(0.045, 0.012, edge);
      float motif = smoothstep(0.085, 0.055, abs(length(p) - 0.115));
      float band = mod(depth, 2.0);
      vec3 cell = mix(baseColor * 0.24, baseColor * 0.78, band);
      cell = mix(cell, baseColor * 1.05, motif * 0.7);
      cell *= 1.0 - 0.35 * rad * rad;

      float fade = 1.0 - smoothstep(0.9, 1.0, rad);
      vec3 col = mix(cell, mix(baseColor, vec3(1.0), 0.45), line * fade);
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,

  // Hyperbolic Weave — the {5,4} tiling carried by a Möbius translation, so cells
  // pour out of one ideal point and drain into the other. Nothing changes size in
  // the hyperbolic metric; the apparent stretching is the disk model lying about
  // distance, which is the whole reason the model is worth looking at.
  hyperbolicWeave: `
    uniform vec3 baseColor;
    uniform float time;
    varying vec2 vUv;

    const float HW_WEDGE = 1.256637061; // 2π/5
    const float HW_D     = 1.798907;
    const float HW_R     = 1.495349;

    vec2 cmul(vec2 a, vec2 b) { return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x); }
    vec2 cdiv(vec2 a, vec2 b) { float d = max(dot(b, b), 1e-6); return vec2(dot(a, b), a.y * b.x - a.x * b.y) / d; }

    void main() {
      vec2 p = (vUv - 0.5) * 2.14;
      float rad = length(p);
      if (rad > 1.0) {
        float halo = smoothstep(1.16, 1.0, rad);
        gl_FragColor = vec4(baseColor * (0.03 + 0.1 * halo), 1.0);
        return;
      }

      // Möbius translation z → (z + t)/(1 + t̄z): an isometry of the disk, even
      // though on screen it looks like the tiling is being poured across it.
      float ang = time * 0.11;
      vec2 t = 0.5 * sin(time * 0.19) * vec2(cos(ang), sin(ang));
      p = cdiv(p + t, vec2(1.0, 0.0) + cmul(vec2(t.x, -t.y), p));

      vec2 c = vec2(HW_D, 0.0);
      float depth = 0.0;
      float edge = 1e9;
      for (int i = 0; i < 18; i++) {
        float a = atan(p.y, p.x);
        a = mod(a + HW_WEDGE * 0.5, HW_WEDGE) - HW_WEDGE * 0.5;
        p = vec2(cos(a), abs(sin(a))) * length(p);

        vec2 q = p - c;
        float q2 = dot(q, q);
        edge = min(edge, abs(sqrt(q2) - HW_R));
        if (q2 > HW_R * HW_R) break;
        p = c + q * (HW_R * HW_R / q2);
        depth += 1.0;
      }

      float line = smoothstep(0.05, 0.013, edge);
      float pulse = 0.5 + 0.5 * sin(depth * 1.5 - time * 1.4);
      vec3 cell = mix(baseColor * 0.18, baseColor * 0.95, pulse);
      cell *= 1.0 - 0.32 * rad * rad;

      float fade = 1.0 - smoothstep(0.9, 1.0, rad);
      vec3 col = mix(cell, mix(baseColor, vec3(1.0), 0.6), line * fade);
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,

  // Apollonian Gasket — pure inversive geometry. Three mutually tangent circles
  // plus the circle enclosing them generate a group under inversion; its limit
  // set is the classical packing, where every gap is filled by a circle tangent
  // to three others, forever. Folding a fragment back through the group and
  // tracking the accumulated derivative recovers crisp edges at every depth.
  apollonian: `
    uniform vec3 baseColor;
    varying vec2 vUv;

    const float AP_RHO  = 0.8660254;   // radius of the three tangent circles
    const float AP_OUT  = 1.8660254;   // the circle enclosing all three

    void main() {
      vec2 start = (vUv - 0.5) * 4.15;
      vec2 p = start;
      vec2 c0 = vec2(0.0, 1.0);
      vec2 c1 = vec2(-0.8660254, -0.5);
      vec2 c2 = vec2(0.8660254, -0.5);

      float scale = 1.0;
      float trap = 1e9;
      float depth = 0.0;

      for (int i = 0; i < 14; i++) {
        float d0 = length(p - c0), d1 = length(p - c1), d2 = length(p - c2);
        float dOut = length(p);
        float near = min(min(abs(d0 - AP_RHO), abs(d1 - AP_RHO)), abs(d2 - AP_RHO));
        trap = min(trap, min(near, abs(dOut - AP_OUT)) / scale);

        vec2 c;
        float rr;
        if (d0 < AP_RHO)        { c = c0; rr = AP_RHO; }
        else if (d1 < AP_RHO)   { c = c1; rr = AP_RHO; }
        else if (d2 < AP_RHO)   { c = c2; rr = AP_RHO; }
        else if (dOut > AP_OUT) { c = vec2(0.0); rr = AP_OUT; }
        else break;                                  // in the fundamental gap

        vec2 q = p - c;
        float k = rr * rr / max(dot(q, q), 1e-6);
        p = c + q * k;
        scale *= k;
        depth += 1.0;
      }

      float ring = smoothstep(0.06, 0.005, trap);
      float shade = clamp(depth / 7.0, 0.0, 1.0);
      float band = mod(depth, 2.0) * 0.12;
      float outside = smoothstep(AP_OUT - 0.02, AP_OUT + 0.02, length(start));
      vec3 bg = mix(baseColor * 0.14, baseColor * 0.58, shade) + baseColor * band;
      vec3 col = mix(bg, mix(baseColor, vec3(1.0), 0.5), ring);
      col = mix(col, baseColor * 0.04, outside * 0.85);
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,

  // Circle Inversion — outside the mirror circle you see the plain lattice;
  // inside it you see the *entire rest of the plane*, folded in by z → R²z/|z|².
  // The pattern is continuous across the rim and infinitely dense at the centre,
  // so the line width is scaled by the map's Jacobian and the middle dissolves to
  // an even grey rather than lying about how much detail is there.
  circleInversion: `
    uniform vec3 baseColor;
    uniform float time;
    varying vec2 vUv;

    float ciGrid(vec2 q, float w) {
      vec2 g = 0.5 - abs(fract(q) - 0.5);   // per-axis distance to the nearest line
      float d = min(g.x, g.y);
      return 1.0 - smoothstep(w * 0.35, w, d);
    }

    void main() {
      vec2 p = (vUv - 0.5) * 2.2;
      float R = 0.62 + 0.05 * sin(time * 0.5);
      float d2 = max(dot(p, p), 1e-5);
      float d = sqrt(d2);

      float lines;
      if (d > R) {
        lines = ciGrid(p * 2.5, 0.07);
      } else {
        vec2 inv = p * (R * R / d2);
        float w = clamp(0.07 * R * R / d2, 0.006, 0.45);
        lines = ciGrid(inv * 2.5, w);
      }

      float rim = smoothstep(0.03, 0.008, abs(d - R));
      vec3 col = mix(baseColor * 0.13, baseColor * 1.05, lines);
      col = mix(col, mix(baseColor, vec3(1.0), 0.65), rim);
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,

  // RP² Geodesics — the game's own geometry. The disk is a hemisphere seen from
  // above with opposite rim points glued together, so a great circle draws an
  // ellipse arc that leaves the rim at one point and returns at its antipode.
  // The travelling spark does exactly what a sticker does when it wraps: it
  // reaches the edge, and is already on the other side.
  rp2Geodesics: `
    uniform vec3 baseColor;
    uniform float time;
    varying vec2 vUv;

    float rgLine(float x, float w) {
      float m = 0.5 - abs(fract(x) - 0.5);
      return 1.0 - smoothstep(w * 0.4, w, m);
    }

    // Distance to the great circle with normal n, measured on the projected disk.
    float rgArc(vec2 p, vec3 n, float z) {
      float f = dot(n.xy, p) + n.z * z;
      vec2 grad = n.xy - n.z * p / max(z, 1e-3);
      return abs(f) / max(length(grad), 1e-3);
    }

    void main() {
      vec2 p = (vUv - 0.5) * 2.16;
      float d2 = dot(p, p);
      if (d2 > 1.0) {
        gl_FragColor = vec4(baseColor * 0.04, 1.0);
        return;
      }
      float z = sqrt(max(1.0 - d2, 1e-6));
      vec3 col = baseColor * (0.16 + 0.34 * z);

      // Graticule: lines of latitude project to concentric circles, meridians to
      // radii — the hemisphere we are looking straight down at.
      float lat = rgLine(z * 4.0, 0.06);
      float mer = rgLine(atan(p.y, p.x) * 1.9099, 0.05) * smoothstep(0.08, 0.35, sqrt(d2));
      col = mix(col, baseColor * 0.55, max(lat, mer) * 0.5);

      // A drifting pencil of geodesics — every one of them a closed loop.
      for (float i = 0.0; i < 4.0; i++) {
        float a = time * 0.09 + i * 0.7853982;
        float b = 0.5 + 0.4 * sin(time * 0.17 + i * 2.1);
        vec3 n = normalize(vec3(cos(a) * b, sin(a) * b, sqrt(max(1.0 - b * b, 0.04))));
        col = mix(col, mix(baseColor, vec3(1.0), 0.25), smoothstep(0.03, 0.008, rgArc(p, n, z)) * 0.85);
      }

      // The live geodesic and its traveller.
      float a0 = time * 0.17;
      vec3 n0 = normalize(vec3(cos(a0) * 0.78, sin(a0) * 0.78, 0.62));
      vec3 u = normalize(cross(n0, vec3(0.0, 0.0, 1.0)));
      vec3 v = cross(n0, u);
      col = mix(col, mix(baseColor, vec3(1.0), 0.35), smoothstep(0.03, 0.01, rgArc(p, n0, z)));

      float s = time * 0.8;
      vec3 P = u * cos(s) + v * sin(s);
      vec3 Q = -P;                       // the identified point on the far sheet
      if (P.z < 0.0) { vec3 sw = P; P = Q; Q = sw; }
      vec3 spark = mix(baseColor, vec3(1.0), 0.8);
      col += spark * smoothstep(0.1, 0.02, length(p - P.xy)) * (0.4 + 0.6 * P.z);
      col += spark * smoothstep(0.09, 0.02, length(p - Q.xy)) * 0.25 * (1.0 - P.z);

      // The rim is the line at infinity: opposite points on it are one point.
      col = mix(col, baseColor * 1.5, smoothstep(0.032, 0.012, abs(sqrt(d2) - 0.978)));
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,

  // Sol Geometry — Thurston's Sol has metric e^{2z}dx² + e^{−2z}dy² + dz², so
  // travelling along z stretches one axis by exactly the factor it squeezes the
  // other and area is preserved. Two cross-faded octaves make the flow loop with
  // no seam: after one unit of z the lattice has doubled and halved back onto
  // itself, which is the whole strangeness of the geometry in one gesture.
  solFlow: `
    uniform vec3 baseColor;
    uniform float time;
    varying vec2 vUv;

    float sfLine(float x, float w) {
      float g = abs(fract(x) - 0.5);
      return smoothstep(0.5 - w, 0.5 - w * 0.3, g);
    }

    void main() {
      vec2 p = (vUv - 0.5) * 2.0;
      float f = fract(time * 0.16);

      float s0 = exp2(f), s1 = exp2(f - 1.0);
      float lx = (1.0 - f) * sfLine(p.x * 3.0 * s0, 0.08) + f * sfLine(p.x * 3.0 * s1, 0.08);
      float ly = (1.0 - f) * sfLine(p.y * 3.0 / s0, 0.04) + f * sfLine(p.y * 3.0 / s1, 0.04);
      lx = clamp(lx, 0.0, 1.0);
      ly = clamp(ly, 0.0, 1.0);

      // The two leaves of the foliation, tinted apart so which one is being
      // stretched and which is being crushed stays readable.
      vec3 col = baseColor * 0.12;
      col = mix(col, baseColor * 0.85, ly);
      col = mix(col, mix(baseColor, vec3(1.0), 0.55), lx);
      col += baseColor * 0.18 * lx * ly;                       // lattice nodes
      col *= 0.8 + 0.3 * (1.0 - dot(p, p) * 0.4);
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,

  // Nil Twist — Thurston's Nil is the Heisenberg group, where the fibre
  // coordinate accumulates the area a path sweeps out. Its level sets are the
  // hyperbolae xy = const; translating the group rotates and shears them through
  // a flat lattice, so the twist you see is literally area turning into height.
  nilTwist: `
    uniform vec3 baseColor;
    uniform float time;
    varying vec2 vUv;

    float ntLine(float x, float w) {
      float g = abs(fract(x) - 0.5);
      return smoothstep(0.5 - w, 0.5 - w * 0.3, g);
    }

    void main() {
      vec2 p = (vUv - 0.5) * 2.0;

      float t = time * 0.22;
      float c = cos(t), s = sin(t);
      vec2 q = vec2(c * p.x - s * p.y, s * p.x + c * p.y);

      // Swept area = the Heisenberg fibre; its contours are hyperbolae.
      float fibre = 4.2 * q.x * q.y - time * 0.55;
      float band = 0.5 + 0.5 * sin(fibre * 3.14159265);
      float ridge = smoothstep(0.3, 0.85, band);
      float crest = smoothstep(0.9, 1.0, band);

      // The flat lattice the fibre twists over.
      float lat = max(ntLine(p.x * 3.0, 0.05), ntLine(p.y * 3.0, 0.05));

      vec3 col = mix(baseColor * 0.12, baseColor * 0.9, ridge);
      col = mix(col, mix(baseColor, vec3(1.0), 0.35), crest * 0.6);
      col = mix(col, mix(baseColor, vec3(1.0), 0.5), lat * 0.45);
      col *= 1.0 - 0.25 * dot(p, p);
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,

  // Light Cone — Minkowski's (+,−) signature, where "distance" is t² − x² and is
  // allowed to be negative. The nested hyperbolae are the circles of this metric
  // and the 45° nulls are the points at zero distance from the origin. A Lorentz
  // boost is a hyperbolic rotation: it slides the rapidity ticks along hyperbolae
  // that it leaves exactly where they were.
  lightCone: `
    uniform vec3 baseColor;
    uniform float time;
    varying vec2 vUv;

    float lcLine(float x, float w) {
      float g = abs(fract(x) - 0.5);
      return smoothstep(0.5 - w, 0.5 - w * 0.35, g);
    }

    void main() {
      vec2 p = (vUv - 0.5) * 2.0;
      float s = p.y * p.y - p.x * p.x;           // + timelike, − spacelike

      float ph = 0.9 * sin(time * 0.3);          // rapidity of the boost
      float ch = 0.5 * (exp(ph) + exp(-ph));
      float sh = 0.5 * (exp(ph) - exp(-ph));
      vec2 b = vec2(p.x * ch - p.y * sh, p.y * ch - p.x * sh);

      float rings = lcLine(sqrt(abs(s)) * 3.4, 0.055);
      float eta = 0.5 * log(max(abs(b.x + b.y), 1e-4) / max(abs(b.x - b.y), 1e-4));
      float ticks = lcLine(eta * 1.3, 0.08) * smoothstep(0.03, 0.25, abs(s));
      // The nulls pass through the origin, so without this the whole centre
      // blows out into one white blob instead of two crossing rays.
      float cone = smoothstep(0.05, 0.0, abs(s)) * smoothstep(0.06, 0.3, length(p));

      vec3 col = s > 0.0 ? baseColor * 0.42 : baseColor * 0.13;
      col = mix(col, baseColor * 1.05, rings);
      col += baseColor * ticks * 0.3;
      col = mix(col, mix(baseColor, vec3(1.0), 0.85), cone);
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,

  // Metric Balls — every ring here is a circle: the set of points at a fixed
  // distance from the centre, once you have chosen which metric to measure with.
  // p sweeps from 0.45 (a pinched astroid) through 1 (the taxicab diamond), 2
  // (the single Euclidean frame in the whole animation, flagged as it passes) and
  // on toward ∞, where the circle is a square.
  metricBalls: `
    uniform vec3 baseColor;
    uniform float time;
    varying vec2 vUv;

    void main() {
      vec2 p = abs((vUv - 0.5) * 2.0);
      float pw = exp(mix(-0.8, 2.0, 0.5 + 0.5 * sin(time * 0.25)));
      vec2 a = max(p, 1e-4);
      float d = pow(pow(a.x, pw) + pow(a.y, pw), 1.0 / pw);

      float k = d * 5.0;
      float g = abs(fract(k) - 0.5);
      float ring = smoothstep(0.42, 0.5, g);
      float shell = mod(floor(k), 2.0);
      float euclid = smoothstep(0.3, 0.0, abs(pw - 2.0));

      vec3 col = mix(baseColor * 0.14, baseColor * 0.55, shell);
      col = mix(col, mix(baseColor, vec3(1.0), 0.35 + 0.45 * euclid), ring);
      col *= 1.0 - 0.22 * d;
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,

  // Gyroid Slice — the gyroid is a triply-periodic minimal surface containing no
  // straight line and no plane of symmetry anywhere in it. This is a real plane
  // section of the implicit surface drifting along z, so the labyrinth pinches
  // and reconnects the way the surface actually does rather than by animation.
  gyroidSlice: `
    uniform vec3 baseColor;
    uniform float time;
    varying vec2 vUv;

    void main() {
      vec2 p = (vUv - 0.5) * 8.4;
      // A tilted section rather than an axis-aligned one: the axis-aligned slices
      // pass through phases of plain stripes, and the surface is more interesting
      // than that everywhere else.
      float z = 0.3 * p.x - 0.22 * p.y + time * 0.35;
      float g = sin(p.x) * cos(p.y) + sin(p.y) * cos(z) + sin(z) * cos(p.x);

      float surf = smoothstep(0.24, 0.03, abs(g));
      float inside = smoothstep(-0.06, 0.06, g);
      float sheen = 0.5 + 0.5 * sin(g * 6.0 + time * 0.8);

      vec3 col = mix(baseColor * 0.11, baseColor * 0.5, inside);
      col = mix(col, mix(baseColor, vec3(1.0), 0.35 + 0.3 * sheen), surf);
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,

  // Hopf Fibers — the stereographic image of the Hopf fibration of the 3-sphere.
  // Every fibre is a circle, every two fibres are linked, and in this section
  // they appear as the bipolar pencil through the two poles — the two fibres that
  // project to a point and to a line. Advancing the flow threads each circle
  // through the ones beside it without any of them ever meeting.
  hopfFibers: `
    uniform vec3 baseColor;
    uniform float time;
    varying vec2 vUv;

    float hfLine(float x, float w) {
      float g = abs(fract(x) - 0.5);
      return smoothstep(0.5 - w, 0.5 - w * 0.3, g);
    }

    void main() {
      vec2 p = (vUv - 0.5) * 2.1;
      float a = 0.5;
      vec2 f1 = p - vec2(a, 0.0);
      vec2 f2 = p + vec2(a, 0.0);
      float r1 = max(length(f1), 1e-3);
      float r2 = max(length(f2), 1e-3);

      float tau = log(r1 / r2);                              // the fibres
      float sig = atan(f1.y, f1.x) - atan(f2.y, f2.x);       // the base-sphere meridians

      float near = smoothstep(0.0, 0.12, min(r1, r2));
      float fib = hfLine(tau * 1.7 + time * 0.2, 0.06) * near;
      float mer = hfLine(sig * 0.955, 0.045) * near;

      float depth = 0.5 + 0.5 * sin(tau * 1.7 + time * 0.2 - 1.2);
      vec3 col = baseColor * (0.11 + 0.26 * depth);
      col = mix(col, baseColor * 0.8, mer * 0.55);
      col = mix(col, mix(baseColor, vec3(1.0), 0.6), fib);
      // The two degenerate fibres — the poles of the base sphere.
      col += mix(baseColor, vec3(1.0), 0.85) * smoothstep(0.055, 0.0, min(r1, r2));
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,

  // Droste Spiral — the conformal map z → log z turns scaling into translation,
  // so a lattice sheared in log-polar space closes up into a spiral that is its
  // own zoom. Going once around the tile scales the pattern by e^S and rotates it
  // by the twist, which is why the zoom can run forever and never show a seam.
  drosteSpiral: `
    uniform vec3 baseColor;
    uniform float time;
    varying vec2 vUv;

    void main() {
      vec2 p = (vUv - 0.5) * 2.0;
      float r = max(length(p), 1e-4);
      float ang = atan(p.y, p.x);

      const float S = 0.9555;                 // log of the scale factor per step
      const float BETA = 0.38;                // turns of twist per step
      float x1 = log(r) / S + time * 0.07;
      float y1 = ang * 0.15915494;            // /(2π) — already period 1
      vec2 cell = vec2(fract(x1), fract(y1 - BETA * x1));

      vec2 e = abs(cell - 0.5);
      float wall = 0.5 - max(e.x, e.y);                 // distance to the cell wall
      float border = 1.0 - smoothstep(0.012, 0.045, wall);
      float frame = smoothstep(0.155, 0.125, abs(wall - 0.14));   // one frame inside the next
      float shell = mod(floor(x1), 2.0);

      vec3 col = mix(baseColor * 0.16, baseColor * 0.52, shell);
      col = mix(col, baseColor * 0.9, frame * 0.55);
      col = mix(col, mix(baseColor, vec3(1.0), 0.6), border);
      col = mix(col, baseColor * 0.3, smoothstep(0.09, 0.0, r));  // the singular centre
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,

  // Modular Tiling — the upper half-plane cut up by the modular group PSL(2,ℤ),
  // generated by T: z → z + 1 and S: z → −1/z. Every point is folded into the
  // standard domain {|x| ≤ ½, |z| ≥ 1} by the reduction algorithm Gauss used for
  // quadratic forms: translate x back into [−½, ½], invert if |z| < 1, repeat.
  // The domain's two halves (either side of x = 0) are the black and white
  // triangles of Dedekind's picture, angles π/2, π/3, 0. Both generators keep
  // orientation, so the side of x = 0 a point folds to is a true colouring of
  // the triangles: every edge has black on one side and white on the other.
  // The bright arches are the images of x = 0 — the Farey tessellation, a
  // semicircle joining p/q and r/s exactly when ps − qr = ±1. Distances to the
  // edges are taken in the folded domain, where they are hyperbolic and so
  // survive the fold, then multiplied back by the metric's y to land on screen.
  modularTiling: `
    uniform vec3 baseColor;
    uniform float time;
    varying vec2 vUv;

    const float MT_SPAN = 1.15;  // the window: x in ±0.575, y from the real axis up to 1.15

    void main() {
      vec2 p = vec2(vUv.x - 0.5, vUv.y) * MT_SPAN;
      float px = max(fwidth(p.y), 1e-5);
      float y0 = max(p.y, 1e-5);

      // z → z + t is an isometry of the plane (not of the tiling until t is a
      // whole number), so the tiles slide along their horocycles and after one
      // unit the picture is exactly where it began.
      vec2 z = vec2(p.x + fract(time * 0.035), y0);
      float flips = 0.0;
      for (int i = 0; i < 24; i++) {
        z.x -= floor(z.x + 0.5);                 // T⁻ⁿ: back into the strip
        float r2 = dot(z, z);
        if (r2 >= 1.0) break;                    // in the fundamental domain
        z = vec2(-z.x, z.y) / r2;                // S: z → −1/z
        flips += 1.0;
      }

      // sinh of the hyperbolic distance to each edge of the folded triangle.
      float dFarey = abs(z.x) / z.y;                     // x = 0
      float dSide = (0.5 - abs(z.x)) / z.y;              // x = ±½
      float dArc = abs(dot(z, z) - 1.0) / (2.0 * z.y);   // |z| = 1
      float edge = min(dSide, dArc) * y0;                // back to screen units
      float farey = dFarey * y0;

      // A point that folds high up the strip sits deep in a cusp, where the
      // triangles are slivers only (½ / z.y)·y0 wide on screen. Once they are
      // finer than the pixels the cusps dissolve into their average instead of
      // aliasing into noise, and the edges, packed tighter still, go first.
      float grain = px * max(z.y, 1.0) / y0;
      float detail = 1.0 - smoothstep(0.15, 0.5, grain);
      float ink = 1.0 - smoothstep(0.05, 0.16, grain);

      float white = step(0.0, z.x);
      vec3 cell = mix(baseColor * 0.17, baseColor * 0.66, white);
      cell *= 1.0 - 0.045 * min(flips, 6.0);
      cell = mix(baseColor * 0.4, cell, detail);

      float lw = 0.004 + 0.3 * px;
      float fLine = (1.0 - smoothstep(lw * 1.3, lw * 1.3 + px, farey)) * ink;
      float eLine = (1.0 - smoothstep(lw, lw + px, edge)) * ink;
      vec3 col = mix(cell, baseColor * 0.95, eLine * 0.5);
      col = mix(col, mix(baseColor, vec3(1.0), 0.5), fLine);
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,

  // Horocycles — the circles of the Poincaré disk tangent to the rim at one
  // ideal point ζ, and the geodesics that all run into ζ, cutting them at right
  // angles. Sent to the upper half-plane by the Cayley map z = i(1 + w)/(1 − w)
  // (with ζ turned to w = 1, so ζ goes to ∞), the horocycles become the lines
  // y = const and the geodesics the lines x = const. Height is drawn in log y
  // because that is hyperbolic arc length, so the horocycles are evenly spaced
  // in the true metric however hard the disk crowds them. The parabolic isometry
  // x → x + t slides every horocycle along itself: cells stream out of ζ on one
  // side and pour back into it on the other, keeping their hyperbolic size the
  // whole way. Line widths use the exact gradients of both coordinates — for
  // log y that is the disk's own conformal factor 2/(1 − |w|²).
  horocycleFlow: `
    uniform vec3 baseColor;
    uniform float time;
    varying vec2 vUv;

    const float HC_H = 0.5;   // hyperbolic distance between neighbouring horocycles
    const float HC_S = 0.5;   // gap between geodesics, as arc length on the horocycle through the centre

    void main() {
      vec2 p = (vUv - 0.5) * 2.14;
      float px = max(fwidth(p.x), 1e-5);
      float rad = length(p);
      if (rad > 1.0) {
        float halo = smoothstep(1.16, 1.0, rad);
        gl_FragColor = vec4(baseColor * (0.03 + 0.1 * halo), 1.0);
        return;
      }

      vec2 zeta = vec2(0.5, 0.8660254);                         // the ideal point, e^{iπ/3}
      vec2 w = vec2(dot(p, zeta), p.y * zeta.x - p.x * zeta.y);  // w = p·ζ̄, so ζ sits at 1
      float q2 = max((1.0 - w.x) * (1.0 - w.x) + w.y * w.y, 1e-6); // |1 − w|²
      float e2 = max(1.0 - dot(w, w), 1e-6);
      float hx = -2.0 * w.y / q2;                               // Cayley map, real part
      float hy = e2 / q2;                                       // and height

      float u = log(hy) / HC_H;                                 // which horocycle
      float v = hx / HC_S + fract(time * 0.06) * 2.0;           // which geodesic, flowing
      float gu = 2.0 / (e2 * HC_H);                             // |∇u|
      float gv = 2.0 / (q2 * HC_S);                             // |∇v|

      // Where a family packs so tight its lines would touch, it fades to its
      // average rather than pretending to more resolution than the screen has.
      float lw = 0.006 + 0.35 * px;
      float fu = 1.0 - smoothstep(0.18, 0.5, (2.0 * lw + px) * gu);
      float fv = 1.0 - smoothstep(0.18, 0.5, (2.0 * lw + px) * gv);

      float du = (0.5 - abs(fract(u) - 0.5)) / gu;              // screen distance to a horocycle
      float dv = (0.5 - abs(fract(v) - 0.5)) / gv;              // and to a geodesic
      float hLine = (1.0 - smoothstep(lw, lw + px, du)) * fu;
      float gLine = (1.0 - smoothstep(lw, lw + px, dv)) * fv;

      float check = mod(floor(u) + floor(v), 2.0);
      vec3 cell = mix(baseColor * 0.2, baseColor * 0.56, check);
      cell = mix(baseColor * 0.38, cell, fu * fv);
      cell *= 1.0 - 0.3 * rad * rad;

      vec3 col = mix(cell, baseColor * 0.95, gLine * 0.8);
      col = mix(col, mix(baseColor, vec3(1.0), 0.5), hLine);
      // ζ itself, where every horocycle touches and every geodesic ends.
      col += mix(baseColor, vec3(1.0), 0.7) * smoothstep(0.2, 0.0, length(p - zeta)) * 0.55;
      col = mix(col, mix(baseColor, vec3(1.0), 0.3), smoothstep(0.035, 0.0, 1.0 - rad) * 0.6);
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,

  // Spherical Triangles — the sphere cut by the mirror planes of the cube's full
  // symmetry group: x = 0, y = 0, z = 0 and the six diagonals x = ±y, y = ±z,
  // z = ±x. The nine great circles split it into 48 congruent triangles with
  // angles π/2, π/3 and π/4, which sum to 13π/12 — more than π, the signature
  // of positive curvature, and the excess π/12 is each triangle's area, so 48 of
  // them cover exactly 4π. Neighbours differ in the sign of just one plane, so
  // the product of the nine signs two-colours the tiling: it is the orientation
  // of the group element that carries the base triangle there. Line widths are
  // each plane's value over its screen gradient, so the circles keep one width
  // on screen as they swing round the limb.
  sphericalTiling: `
    uniform vec3 baseColor;
    uniform float time;
    varying vec2 vUv;

    const float ST_H = 0.70710678;   // 1/√2 — the diagonal mirrors' normals

    vec3 stTurn(vec3 v, vec3 k, float c, float s) {
      return v * c + cross(k, v) * s + k * dot(k, v) * (1.0 - c);   // Rodrigues
    }

    // Screen distance to the great circle with normal b, and the side we are on.
    float stArc(vec2 p, vec3 n, vec3 b, inout float parity) {
      float g = dot(b, n);
      parity *= g < 0.0 ? -1.0 : 1.0;
      vec2 grad = b.xy - b.z * p / n.z;
      return abs(g) / max(length(grad), 1e-3);
    }

    void main() {
      vec2 p = (vUv - 0.5) * 2.24;
      float px = max(fwidth(p.x), 1e-5);
      float r2 = dot(p, p);
      float rad = sqrt(r2);
      vec3 n = vec3(p, sqrt(max(1.0 - r2, 1e-4)));

      // The body turns about a tilted axis; carrying the mirrors with it.
      vec3 k = normalize(vec3(0.35, 1.0, 0.22));
      float a = time * 0.21;
      float c = cos(a), s = sin(a);
      vec3 ex = stTurn(vec3(1.0, 0.0, 0.0), k, c, s);
      vec3 ey = stTurn(vec3(0.0, 1.0, 0.0), k, c, s);
      vec3 ez = stTurn(vec3(0.0, 0.0, 1.0), k, c, s);

      float parity = 1.0;
      float d = stArc(p, n, ex, parity);
      d = min(d, stArc(p, n, ey, parity));
      d = min(d, stArc(p, n, ez, parity));
      d = min(d, stArc(p, n, (ex - ey) * ST_H, parity));
      d = min(d, stArc(p, n, (ex + ey) * ST_H, parity));
      d = min(d, stArc(p, n, (ey - ez) * ST_H, parity));
      d = min(d, stArc(p, n, (ey + ez) * ST_H, parity));
      d = min(d, stArc(p, n, (ez - ex) * ST_H, parity));
      d = min(d, stArc(p, n, (ez + ex) * ST_H, parity));

      vec3 light = normalize(vec3(-0.5, 0.62, 0.6));
      float dif = max(dot(n, light), 0.0);
      float spec = pow(max(dot(reflect(-light, n), vec3(0.0, 0.0, 1.0)), 0.0), 26.0);

      vec3 tri = parity > 0.0 ? baseColor * 0.72 : baseColor * 0.19;
      vec3 col = tri * (0.32 + 0.8 * dif);
      float lw = 0.012 + 0.3 * px;
      float line = 1.0 - smoothstep(lw, lw + px, d);
      col = mix(col, mix(baseColor, vec3(1.0), 0.5) * (0.55 + 0.55 * dif), line);
      col += mix(baseColor, vec3(1.0), 0.8) * spec * 0.3;

      float body = 1.0 - smoothstep(1.0 - px, 1.0 + px * 0.5, rad);
      vec3 ground = baseColor * (0.03 + 0.1 * smoothstep(1.16, 1.0, rad));
      col = mix(ground, col, body);
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,

  // Hyperbolic Parallels — Euclid's fifth postulate failing in plain sight. L is
  // a geodesic of the Poincaré disk; through the point P off it run infinitely
  // many lines that never meet it. A geodesic through P is the circle through P
  // and its inverse P* = P/|P|² (any such circle meets the rim at right angles),
  // so with direction θ it is A(|w|² + 1) = 2B·w for the A, B below — a
  // diameter when A = 0, which is how the line through the centre is handled.
  // The two limiting parallels run from P to L's ideal endpoints; they split the
  // disk into the double wedge whose lines cross L and the double wedge whose
  // lines never do. As P drifts, its distance a from L changes and the angle
  // of parallelism, tan(Π/2) = e^{−a}, opens and closes the band of parallels.
  hyperbolicParallels: `
    uniform vec3 baseColor;
    uniform float time;
    varying vec2 vUv;

    const float HP_D = 1.25;           // centre of L's circle (5/4), straight below the centre
    const float HP_R = 0.75;           // its radius (3/4): D² = R² + 1, so L meets the rim at 90°
    const float HP_STEP = 0.261799388; // π/12 between the fan's geodesics

    // First-order screen distance to the circle A(|w|² + 1) = 2B·w.
    float hpDist(vec2 w, float A, vec2 B) {
      float f = A * (dot(w, w) + 1.0) - 2.0 * dot(B, w);
      return f / max(length(2.0 * A * w - 2.0 * B), 1e-5);
    }

    void main() {
      vec2 p = (vUv - 0.5) * 2.14;
      float px = max(fwidth(p.x), 1e-5);
      float rad = length(p);
      if (rad > 1.0) {
        float halo = smoothstep(1.16, 1.0, rad);
        gl_FragColor = vec4(baseColor * (0.03 + 0.1 * halo), 1.0);
        return;
      }

      // L, bowing up from the bottom of the disk to within D − R = 1/2 of the
      // centre, and its two ideal endpoints Q± = (e ± R e⊥)/D, which lie on the
      // rim because (1 + R²)/D² = 1.
      vec2 e = vec2(0.0, -1.0);
      vec2 eT = vec2(-e.y, e.x);
      float dL = abs(length(p - e * HP_D) - HP_R);
      vec2 q1 = (e + HP_R * eT) / HP_D;
      vec2 q2 = (e - HP_R * eT) / HP_D;

      // P wanders above the centre, far enough out that the lines through it
      // visibly bend, drifting nearer L and away again but never reaching it.
      float a = time * 0.19;
      vec2 P = vec2(0.34 * sin(a), 0.34 + 0.12 * cos(a * 1.3));
      float h = 0.5 * (dot(P, P) + 1.0);

      // The limiting parallels: the circles through P, P* and Q±.
      float a1 = q1.x * P.y - q1.y * P.x;
      vec2 b1 = vec2(P.y - q1.y * h, q1.x * h - P.x);
      float a2 = q2.x * P.y - q2.y * P.x;
      vec2 b2 = vec2(P.y - q2.y * h, q2.x * h - P.x);
      float d1 = hpDist(p, a1, b1);
      float d2 = hpDist(p, a2, b2);
      vec2 m = e * (HP_D - HP_R);                     // the point of L nearest the centre
      float side = hpDist(m, a1, b1) * hpDist(m, a2, b2);
      float parallel = step(d1 * d2 * side, 0.0);     // 1 in the double wedge that never meets L

      // The fan through P, turning slowly. Both circles are orthogonal to the
      // rim, so their radical axis (A·D e − B)·w = 0 runs through the centre and
      // the crossing is w = t·dir with t² − 2kt + 1 = 0, k = D e·dir. Real roots
      // (|k| > 1) mean the line meets L; the root inside the disk is where.
      float meetLine = 1e9;
      float paraLine = 1e9;
      float hit = 1e9;
      for (int i = 0; i < 12; i++) {
        float th = time * 0.07 + float(i) * HP_STEP;
        vec2 u = vec2(cos(th), sin(th));
        vec2 nrm = vec2(-u.y, u.x);
        float pu = dot(P, u);
        float pn = dot(P, nrm);
        vec2 B = pn * pu * u + (h - pu * pu) * nrm;
        float dist = abs(hpDist(p, pn, B));

        vec2 ax = pn * HP_D * e - B;
        vec2 dir = vec2(-ax.y, ax.x) / max(length(ax), 1e-6);
        float k = HP_D * dot(e, dir);
        float t = k - sign(k) * sqrt(max(k * k - 1.0, 0.0));
        bool meets = abs(k) > 1.0;
        meetLine = min(meetLine, meets ? dist : 1e9);
        paraLine = min(paraLine, meets ? 1e9 : dist);
        hit = min(hit, meets ? length(p - dir * t) : 1e9);
      }

      float toP = length(p - P);
      vec3 col = mix(baseColor * 0.14, baseColor * 0.52, parallel);
      col *= 1.0 - 0.3 * rad * rad;

      // Lines that reach L wear the face colour; the ones that never will are pale.
      float lw = 0.006 + 0.3 * px;
      float nearP = smoothstep(0.03, 0.12, toP);
      float mLine = (1.0 - smoothstep(lw, lw + px, meetLine)) * nearP;
      float pLine = (1.0 - smoothstep(lw, lw + px, paraLine)) * nearP;
      col = mix(col, baseColor * 0.9, mLine);
      col = mix(col, mix(baseColor, vec3(1.0), 0.55), pLine);

      float lim = min(abs(d1), abs(d2));
      col = mix(col, mix(baseColor, vec3(1.0), 0.75), 1.0 - smoothstep(lw * 1.5, lw * 1.5 + px, lim));

      col += baseColor * 0.3 * smoothstep(0.1, 0.0, dL);
      col = mix(col, mix(baseColor, vec3(1.0), 0.55), 1.0 - smoothstep(lw * 2.6, lw * 2.6 + px, dL));
      col = mix(col, mix(baseColor, vec3(1.0), 0.8), 1.0 - smoothstep(lw * 3.4, lw * 3.4 + px, hit));

      col = mix(col, mix(baseColor, vec3(1.0), 0.85), 1.0 - smoothstep(0.035, 0.035 + px, toP));
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,
};
