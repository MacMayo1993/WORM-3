// Non-Euclidean tile shaders — tiles drawn in geometries that are not the flat
// plane. Each one renders an honest model of its geometry rather than a stylised
// impression of it:
//
//   poincareDisk    hyperbolic {7,3} tiling, folded by inversion in its mirror circles
//   hyperbolicWeave hyperbolic {5,4} tiling flowing under a Möbius translation
//   apollonian      inversive geometry — the limit set of four tangent circles
//   circleInversion the whole lattice folded inside a mirror circle
//   rp2Geodesics    elliptic geometry on RP², geodesics wrapping antipodally
//   solFlow         Thurston's Sol — one axis expands while the other contracts
//   nilTwist        Thurston's Nil — the Heisenberg fibre coordinate is swept area
//   lightCone       Minkowski signature (+,−); boosts slide events along hyperbolae
//   metricBalls     unit balls of the L^p metrics, p sweeping 0.45 → 7
//   gyroidSlice     a moving plane section of the gyroid minimal surface
//   hopfFibers      stereographic Hopf fibration — a bipolar pencil of circles
//   drosteSpiral    the conformal log-spiral tiling (Escher's Droste map)
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
};
