// Eye — a real eye looking out of the cube through an eyehole cut in the sticker.
//
// The sticker stays flat and keeps the face's colour as a mask; everything
// behind the eyehole is ray-traced in sticker space, so it holds its depth from
// any angle and on any surface that wears the style (play tiles, previews, the
// antipodal core, orb bands, tunnel walls):
//   • a spherical globe with a cornea that bulges past it and refracts the iris
//     plane behind it, so the iris sits inside the eye rather than on it;
//   • upper and lower lids draped over the globe, with a crease, a rounded wet
//     margin, lashes, and the caruncle in the inner corner;
//   • light from the cube's own key and fill (CUBE_LIGHT_RIG), shadowed by the
//     mask and the lids, with a window-shaped catchlight that every eye on the
//     cube shares, and a caustic on the far side of the iris;
//   • an iris in the face's colour, built like a real one: pupil ruff,
//     collarette, crypts, radial stroma, contraction furrows, limbal ring.
// The eyes look at the camera, break off for a glance now and then, blink on
// their own clocks, and wince while their layer is turning. Each tile is a left
// or a right eye, and each face has its own skin tone.
//
// Units: the sticker spans [-0.5, 0.5]² in uv, its surface at z = 0 and +z
// toward the viewer. A standalone template, so the build compacts it.
export const eyeTileFragmentShader = `
  uniform vec3 baseColor;
  uniform float time;
  uniform float spin;
  uniform float spinAxis;
  uniform float spinSlice;
  uniform vec3 tileHome;
  uniform float tileFace;
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;
  varying vec3 vTileCenter;

  // Clearcoat for the sticker finish: on for the mask, off for skin and eye,
  // which carry their own oily and wet highlights.
  float tileCoat;
  // One pixel in sticker units, measured where derivatives are defined (the
  // top of main) for antialiasing inside the branches below.
  float eyePx;

  const float PI = 3.14159265;
  const float EYE_R = 0.285;
  const vec3 EYE_C = vec3(0.0, -0.005, -0.345);
  const float IRIS_SIN = 0.49;
  const float IRIS_COS = 0.8717;
  // The cornea is a smaller sphere (0.62 of the globe) that meets it at the
  // limbus and stands about a tenth of the radius proud of it.
  const float CORNEA_R = 0.177;
  const float CORNEA_K = 0.1397;
  const float LID_R = 0.33;
  const float FISSURE_W = 0.305;
  const float MASK_T = 0.018;
  // The eyehole: an almond (the intersection of two circles) wider than the
  // eye, so the lids, lashes and corners show inside it.
  const float HOLE_R = 0.4413;
  const float HOLE_C = 0.1863;
  // CUBE_LIGHT_RIG key and fill directions, normalised.
  const vec3 KEY = vec3(0.3714, 0.5571, 0.7428);
  const vec3 FILL = vec3(-0.7715, 0.1543, 0.6172);

  float eyeHash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float eyeNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(eyeHash(i), eyeHash(i + vec2(1.0, 0.0)), f.x),
               mix(eyeHash(i + vec2(0.0, 1.0)), eyeHash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float eyeFbm(vec2 p) {
    return eyeNoise(p) * 0.5 + eyeNoise(p * 2.03 + 7.1) * 0.3 + eyeNoise(p * 4.1 + 3.3) * 0.2;
  }
  float smax(float a, float b, float k) {
    float h = clamp(0.5 + 0.5 * (a - b) / k, 0.0, 1.0);
    return mix(b, a, h) + k * h * (1.0 - h);
  }

  float holeSdf(vec2 p) {
    p.y -= EYE_C.y;
    return max(length(p - vec2(0.0, -HOLE_C)), length(p - vec2(0.0, HOLE_C))) - HOLE_R;
  }

  // Lid margins across the fissure, s from -1 (inner corner) to 1 (outer). The
  // upper lid peaks inward of centre and covers the top of the iris; the lower
  // dips outward of centre and meets its bottom; the outer corner sits higher.
  float lidS(vec2 p) { return (p.x - EYE_C.x) / FISSURE_W; }
  float lowerLid(float s) {
    float b = max(1.0 - s * s, 0.0);
    return EYE_C.y + 0.016 * s - 0.098 * b * (1.0 + 0.12 * s);
  }
  float upperLid(float s, float open) {
    float b = max(1.0 - s * s, 0.0);
    float up = EYE_C.y + 0.016 * s + 0.118 * pow(b, 0.85) * (1.0 - 0.16 * s);
    // Closed, the upper margin passes just below the lower one: no sliver of eye.
    return mix(lowerLid(s) - 0.003, up, open);
  }
  // Signed distance-ish to the open fissure (negative inside).
  float fissureSdf(vec2 p, float open) {
    float s = lidS(p);
    float dy = max(p.y - upperLid(s, open), lowerLid(s) - p.y);
    return max(dy, (abs(s) - 1.0) * FISSURE_W);
  }

  // Skin height: the lids drape over the globe and fall into the socket; the
  // upper lid folds at its crease; the margins round off into the fissure.
  // fd is fissureSdf(p, open), which the caller already has.
  float skinZ(vec2 p, float open, float fd) {
    vec2 d = p - EYE_C.xy;
    float rr = dot(d, d);
    float shell = rr < LID_R * LID_R ? EYE_C.z + sqrt(LID_R * LID_R - rr) : -0.6;
    float socket = -0.11 + 0.085 * smoothstep(0.17, 0.45, length(d / vec2(1.0, 1.25)));
    float z = smax(shell, socket, 0.035);
    float s = lidS(p);
    float inX = 1.0 - smoothstep(0.8, 1.2, abs(s));
    float crease = upperLid(s, 1.0) + 0.062;
    z -= 0.011 * open * exp(-pow((p.y - crease) / 0.017, 2.0)) * inX;
    z += 0.006 * exp(-pow((p.y - lowerLid(s) + 0.035) / 0.022, 2.0)) * inX;
    z -= 0.024 * (1.0 - smoothstep(0.0, 0.03, fd));
    return z;
  }

  vec2 sphereHit(vec3 ro, vec3 rd, vec3 c, float r) {
    vec3 oc = ro - c;
    float b = dot(oc, rd);
    float h = b * b - dot(oc, oc) + r * r;
    if (h < 0.0) return vec2(-1.0);
    h = sqrt(h);
    return vec2(-b - h, -b + h);
  }

  // Where the sticker plane blocks the light from p: the mask's shadow.
  float maskLight(vec3 p, vec3 l) {
    vec2 q = p.xy + l.xy * (-p.z / max(l.z, 0.05));
    return 1.0 - smoothstep(-0.012, 0.02, holeSdf(q));
  }
  // Where the lids block it, for points on the globe.
  float lidLight(vec3 p, vec3 l, float open) {
    float lidZ = EYE_C.z + LID_R - 0.02;
    vec2 q = p.xy + l.xy * (max(lidZ - p.z, 0.0) / max(l.z, 0.05));
    return 1.0 - smoothstep(-0.012, 0.012, fissureSdf(q, open));
  }

  // Studio surroundings seen in a wet surface: a soft sky, and a paned window
  // where the key light is, so every eye catches the same light.
  vec3 envReflect(vec3 r) {
    vec3 col = vec3(0.05, 0.05, 0.06) + vec3(0.16, 0.17, 0.2) * smoothstep(-0.3, 0.9, r.y);
    float k = dot(r, KEY);
    vec3 wx = normalize(cross(KEY, vec3(0.0, 1.0, 0.0)));
    vec3 wy = cross(wx, KEY);
    vec2 w = vec2(dot(r, wx), dot(r, wy)) / max(k, 0.2);
    float pane = (1.0 - smoothstep(0.15, 0.19, abs(w.x))) * (1.0 - smoothstep(0.11, 0.15, abs(w.y))) * step(0.0, k);
    float bars = max(1.0 - smoothstep(0.006, 0.014, abs(w.x)), 1.0 - smoothstep(0.006, 0.014, abs(w.y - 0.015)));
    col += vec3(1.0, 0.97, 0.92) * pane * (1.0 - 0.85 * bars) * 14.0;
    float f = dot(r, FILL);
    col += vec3(0.6, 0.7, 0.85) * smoothstep(0.95, 0.99, f) * 3.0;
    return col;
  }

  vec3 irisAt(vec2 ip, float pupil, float seed, vec3 tint) {
    float r = length(ip);
    float a = atan(ip.y, ip.x);
    vec2 cs = vec2(cos(a), sin(a));
    // Noise sampled on a circle that widens with r: features run radially and
    // there is no seam where the angle wraps.
    float wob = eyeNoise(cs * 3.0 + seed * 9.0);
    float collar = pupil + 0.19 + (wob - 0.5) * 0.08;
    float aw = a + 0.06 * sin(r * 11.0 + seed * 5.0);
    vec2 cw = vec2(cos(aw), sin(aw));
    float sector = eyeNoise(cs * (4.0 + r * 1.5) + seed * 4.0);
    float coarse = eyeNoise(cw * (26.0 + r * 5.0) + seed * 2.0);
    float fine = eyeNoise(cw * (70.0 + r * 9.0) + seed);
    float hair = eyeNoise(cw * (150.0 + r * 14.0) - seed);
    float stroma = coarse * 0.45 + fine * 0.35 + hair * 0.2;
    // Crypts: dark lenses in the stroma just outside the collarette.
    float crypt = smoothstep(0.64, 0.82, eyeNoise(cs * (9.0 + r * 9.0) + seed * 2.0))
                * smoothstep(collar - 0.01, collar + 0.07, r) * (1.0 - smoothstep(0.6, 0.82, r));
    vec3 deep = tint * 0.42;
    vec3 light = mix(tint, vec3(0.86, 0.86, 0.84), 0.28);
    vec3 col = mix(deep, light, smoothstep(0.3, 0.75, stroma));
    col *= 0.85 + 0.3 * sector;
    // A warmer pupillary zone inside the collarette, and the collarette ridge.
    vec3 amber = mix(tint, vec3(0.6, 0.42, 0.22), 0.4);
    col = mix(col, amber * (0.75 + 0.4 * stroma), (1.0 - smoothstep(collar - 0.04, collar + 0.02, r)) * 0.55);
    col += mix(tint, vec3(0.9), 0.5) * 0.12 * exp(-pow((r - collar) / 0.025, 2.0)) * (0.6 + 0.8 * fine);
    col *= 1.0 - crypt * 0.55;
    col *= 1.0 - 0.07 * smoothstep(0.2, 1.0, sin(r * 52.0 + wob * 4.0)) * smoothstep(0.62, 0.8, r);
    // Limbal ring, and the dark ruff at the pupil's edge.
    col *= mix(1.0, 0.28, smoothstep(0.78, 1.0, r));
    col = mix(col, vec3(0.12, 0.08, 0.06), exp(-pow((r - pupil - 0.02) / 0.018, 2.0)) * 0.55);
    float aa = max(eyePx * 1.5 / (EYE_R * IRIS_SIN), 0.004);
    col = mix(col, vec3(0.01, 0.009, 0.009), 1.0 - smoothstep(pupil - aa, pupil + aa, r));
    return col;
  }

  vec3 scleraAt(vec3 n, vec3 g, vec3 gu, vec3 gv, float seed) {
    float c = dot(n, g);
    float th = 1.0 - c;
    float az = atan(dot(n, gv), dot(n, gu));
    vec3 col = vec3(0.86, 0.83, 0.79);
    col = mix(col, vec3(0.86, 0.72, 0.68), smoothstep(0.2, 0.55, th) * 0.7);
    col = mix(col, vec3(0.78, 0.8, 0.84), exp(-pow((c - IRIS_COS) / 0.03, 2.0)) * 0.35);
    // Vessels run in from the corners and fade before the limbus.
    float vein = 0.0;
    for (int i = 0; i < 2; i++) {
      float fi = float(i);
      float k = 9.0 + fi * 7.0;
      float u = az * k / 6.28318 + eyeFbm(vec2(th * 9.0, az * 3.0 + fi * 5.0)) * 1.6 + seed * 3.0;
      float id = floor(u);
      float lit = step(0.45 + fi * 0.15, eyeHash(vec2(id, fi + seed)));
      float w = mix(0.06, 0.02, fi) * smoothstep(0.12, 0.5, th);
      float aa = eyePx * k / (3.2 * EYE_R);
      vein += lit * (1.0 - smoothstep(w - aa, w + aa, abs(fract(u) - 0.5))) * smoothstep(0.16, 0.45, th);
    }
    col = mix(col, vec3(0.7, 0.24, 0.22), clamp(vein, 0.0, 1.0) * 0.5);
    col *= 0.94 + 0.08 * eyeFbm(vec2(az * 4.0, th * 12.0) + seed);
    return col;
  }

  // Lashes: strands rooted along a margin, leaning toward the outer corner and
  // tapering, in two staggered rows. Below a pixel they average into the dark
  // lash line, which is how they read from across the room.
  float lashes(vec2 q, float open, float isUpper, float seed) {
    float s = lidS(q);
    float margin = isUpper > 0.5 ? upperLid(s, open) : lowerLid(s);
    float h = (q.y - margin) * (isUpper > 0.5 ? 1.0 : -1.0);
    float along = clamp((s + 1.0) * 0.5, 0.0, 1.0);
    float len = isUpper > 0.5
      ? 0.062 * (0.25 + 0.75 * sin(PI * clamp(along * 0.9 + 0.1, 0.0, 1.0))) * (0.8 + 0.3 * along)
      : 0.022 * sin(PI * clamp(along * 0.85 + 0.15, 0.0, 1.0));
    float cover = 0.0;
    for (int row = 0; row < 3; row++) {
      float fr = float(row);
      float count = isUpper > 0.5 ? 34.0 + fr * 11.0 : 22.0 + fr * 6.0;
      float t = clamp(h / len, 0.0, 1.5);
      // Lashes fan toward the outer corner, more so as they grow out.
      float lean = (0.1 + 0.08 * along + 0.03 * fr) * (isUpper > 0.5 ? 1.0 : 0.5);
      float root = s - lean * t * t;
      float cell = (root + 1.0) * 0.5 * count + fr * 0.37;
      float id = floor(cell);
      float rnd = eyeHash(vec2(id, fr + seed + isUpper * 3.0));
      float rnd2 = eyeHash(vec2(id + 7.0, fr - seed));
      float li = len * (0.55 + 0.6 * rnd);
      float tt = h / li;
      // Each strand bends on its own and thins to a fine tip.
      float f = fract(cell) - 0.5 + (rnd2 - 0.5) * 0.5 + (rnd - 0.5) * 0.9 * tt * tt;
      float w = 0.13 * pow(max(1.0 - tt, 0.0), 0.7) + 0.015;
      float aa = eyePx * count / (2.0 * FISSURE_W) * 0.75;
      float strand = 1.0 - smoothstep(w - aa, w + aa, abs(f));
      float keep = isUpper > 0.5 ? step(0.12, rnd2) : step(0.45, rnd2);
      cover = max(cover, strand * step(-0.003, h) * (1.0 - smoothstep(0.7, 1.0, tt)) * keep * (1.0 - 0.15 * fr));
    }
    return cover * smoothstep(-1.02, -0.82, s) * (1.0 - smoothstep(0.98, 1.1, s));
  }

  void main() {
    // ─── Sticker frame, from screen derivatives (uniform control flow) ───────
    vec3 dpdx = dFdx(vWorldPos), dpdy = dFdy(vWorldPos);
    vec2 duvx = dFdx(vUv), duvy = dFdy(vUv);
    // The normal facing the viewer. cross(dP/dx, dP/dy) is the facet's own,
    // on the side being seen, whatever the mesh's vertex normals say (the back
    // of a DoubleSide wall, or two-sided geometry whose normals cancel). The
    // smooth vertex normal is used only where it agrees, oriented the same way,
    // so curved carriers keep a continuous frame; this also keeps the frame's
    // determinant positive, which the unnormalised T and B below rely on.
    vec3 Ng = cross(dpdx, dpdy);
    Ng /= max(length(Ng), 1e-20);
    float agree = dot(vWorldNormal, Ng);
    vec3 N = agree > 0.5 ? normalize(vWorldNormal) : agree < -0.5 ? -normalize(vWorldNormal) : Ng;
    vec3 p2 = cross(dpdy, N), p1 = cross(N, dpdx);
    vec3 T = p2 * duvx.x + p1 * duvy.x;
    vec3 B = p2 * duvx.y + p1 * duvy.y;
    // T and B share one scale, so their lengths compare uv per unit of world
    // length along each axis: a cell stretched on its carrier (orb bands) is
    // traced as the same stretched eye from every angle. Equal on stickers.
    float su = length(T), sv = length(B);
    T /= max(su, 1e-10);
    B /= max(sv, 1e-10);
    eyePx = max(length(duvx), length(duvy));

    // Carriers that repeat the tile (orb bands) get an eye per cell.
    vec2 cell = floor(vUv);
    float seed = eyeHash(tileHome.xy * 1.37 + vec2(tileHome.z * 2.1, tileFace * 0.73) + cell * 3.1);
    // Left and right eyes: mirror the whole scene, light and gaze included.
    float mirror = seed > 0.5 ? -1.0 : 1.0;
    T *= mirror;
    vec2 p = (fract(vUv) - 0.5) * vec2(mirror, 1.0);

    vec3 V = normalize(cameraPosition - vWorldPos);
    vec3 rd = -vec3(dot(V, T) * su, dot(V, B) * sv, dot(V, N) * sqrt(su * sv));
    rd.z = min(rd.z, -0.12);
    rd = normalize(rd);
    vec3 ro = vec3(p, 0.0);
    vec3 L = normalize(vec3(dot(KEY, T), dot(KEY, B), dot(KEY, N)));
    vec3 LF = normalize(vec3(dot(FILL, T), dot(FILL, B), dot(FILL, N)));
    float keyOn = smoothstep(-0.05, 0.25, L.z);

    // ─── Life: blinks, a wince while this layer turns, and where it looks ────
    float phase = time + seed * 97.0;
    float bp = mod(phase + seed * 5.0, 3.6 + seed * 3.4);
    float open = 1.0 - smoothstep(0.0, 0.07, bp) * (1.0 - smoothstep(0.1, 0.27, bp));
    float axisCoord = spinAxis < 0.5 ? vTileCenter.x : spinAxis < 1.5 ? vTileCenter.y : vTileCenter.z;
    float turning = spin * (1.0 - smoothstep(0.55, 0.78, abs(axisCoord - spinSlice)));
    open *= 1.0 - 0.72 * clamp(turning, 0.0, 1.0);

    vec3 toCam = normalize(cameraPosition - vTileCenter);
    vec3 look = vec3(dot(toCam, T), dot(toCam, B), dot(toCam, N));
    look = normalize(vec3(look.xy, max(look.z, 0.2)));
    // Hold a fixation for a few seconds, then saccade: mostly to the viewer,
    // sometimes to somewhere else.
    float fix = phase / (2.4 + 2.2 * seed);
    float epoch = floor(fix);
    vec3 gA = vec3(0.0), gB = vec3(0.0);
    for (int k = 0; k < 2; k++) {
      float e = epoch - 1.0 + float(k);
      vec2 jit = vec2(eyeHash(vec2(e, seed)), eyeHash(vec2(seed, e + 3.0))) - 0.5;
      float away = step(0.78, eyeHash(vec2(e + 9.0, seed)));
      vec3 target = normalize(look + vec3(jit * mix(0.05, 0.42, away), 0.0));
      if (k == 0) gA = target; else gB = target;
    }
    vec3 g = normalize(mix(gA, gB, smoothstep(0.0, 0.035, fract(fix))));
    float limit = 0.56;
    if (length(g.xy) > limit) g = normalize(vec3(normalize(g.xy) * limit, sqrt(1.0 - limit * limit)));
    vec3 gu = normalize(cross(vec3(0.0, 1.0, 0.0), g));
    vec3 gv = cross(g, gu);

    // ─── The mask: the sticker in the face's colour, rounding into the hole ──
    float hd = holeSdf(p);
    float haa = max(fwidth(hd), 0.002);
    float bevel = 1.0 - smoothstep(0.0, 0.03, hd);
    vec2 hg = normalize(vec2(holeSdf(p + vec2(0.002, 0.0)) - hd, holeSdf(p + vec2(0.0, 0.002)) - hd) + 1e-6);
    vec3 mn = normalize(vec3(hg * bevel * 1.4, 1.0));
    vec3 maskCol = baseColor * (0.8 + 0.2 * max(dot(mn, L), 0.0) / max(L.z, 0.3));
    maskCol *= 1.0 - 0.35 * pow(bevel, 3.0);
    vec3 col = maskCol;
    float inside = 1.0 - smoothstep(-haa, haa, hd);

    if (inside > 0.0) {
      // ─── Eye surfaces: the cornea first, then the globe ───────────────────
      vec3 cc = EYE_C + g * CORNEA_K;
      float tEye = -1.0;
      float onCornea = 0.0;
      float tc = sphereHit(ro, rd, cc, CORNEA_R).x;
      if (tc > 0.0 && dot(ro + rd * tc - EYE_C, g) > EYE_R * IRIS_COS) { tEye = tc; onCornea = 1.0; }
      float tg = sphereHit(ro, rd, EYE_C, EYE_R).x;
      if (tg > 0.0 && (tEye < 0.0 || tg < tEye)) { tEye = tg; onCornea = 0.0; }

      // ─── March the skin and the hole's wall down to the eye ───────────────
      float tMax = tEye > 0.0 ? tEye : (-0.2 - ro.z) / rd.z;
      float dt = tMax / 28.0;
      float tHit = -1.0;
      float wall = 0.0;
      float t = 0.0;
      for (int i = 0; i < 28; i++) {
        t += dt;
        vec3 q = ro + rd * t;
        if (q.z > -MASK_T && holeSdf(q.xy) > 0.0) { tHit = t; wall = 1.0; break; }
        float fd = fissureSdf(q.xy, open);
        if (fd > 0.0 && q.z < skinZ(q.xy, open, fd)) { tHit = t; break; }
      }
      if (tHit > 0.0 && wall < 0.5) {
        float lo = tHit - dt, hi = tHit;
        for (int i = 0; i < 5; i++) {
          float mid = 0.5 * (lo + hi);
          vec3 q = ro + rd * mid;
          float fd = fissureSdf(q.xy, open);
          if (fd > 0.0 && q.z < skinZ(q.xy, open, fd)) hi = mid; else lo = mid;
        }
        tHit = hi;
      }

      vec3 inner;
      vec3 sky = vec3(0.32, 0.33, 0.37);
      if (wall > 0.5) {
        inner = baseColor * 0.3;
      } else if (tHit > 0.0) {
        // ─── Skin ───────────────────────────────────────────────────────────
        vec3 P = ro + rd * tHit;
        vec2 e = vec2(0.003, 0.0);
        vec2 xa = P.xy - e.xy, xb = P.xy + e.xy, ya = P.xy - e.yx, yb = P.xy + e.yx;
        vec3 n = normalize(vec3(
          (skinZ(xa, open, fissureSdf(xa, open)) - skinZ(xb, open, fissureSdf(xb, open))) / (2.0 * e.x),
          (skinZ(ya, open, fissureSdf(ya, open)) - skinZ(yb, open, fissureSdf(yb, open))) / (2.0 * e.x), 1.0));
        vec2 pg = vec2(eyeNoise(P.xy * 210.0), eyeNoise(P.xy * 210.0 + 5.0)) - 0.5;
        n = normalize(n + vec3(pg * 0.18, 0.0));
        float tone = eyeHash(vec2(tileFace + 3.0, 11.0));
        vec3 skin = tone < 0.25 ? mix(vec3(0.91, 0.74, 0.65), vec3(0.83, 0.63, 0.52), tone * 4.0)
                  : tone < 0.5 ? mix(vec3(0.83, 0.63, 0.52), vec3(0.67, 0.47, 0.35), tone * 4.0 - 1.0)
                  : tone < 0.75 ? mix(vec3(0.67, 0.47, 0.35), vec3(0.47, 0.32, 0.23), tone * 4.0 - 2.0)
                  : mix(vec3(0.47, 0.32, 0.23), vec3(0.32, 0.21, 0.15), tone * 4.0 - 3.0);
        float s = lidS(P.xy);
        float fd = fissureSdf(P.xy, open);
        skin *= 0.93 + 0.12 * eyeFbm(P.xy * 60.0 + seed * 4.0);
        skin = mix(skin, skin * vec3(0.84, 0.74, 0.7), smoothstep(0.55, 0.85, eyeFbm(P.xy * 14.0 + seed * 7.0)) * 0.35);
        skin = mix(skin, skin * vec3(1.06, 0.9, 0.88), exp(-pow((s + 1.0) / 0.35, 2.0)) * 0.5);
        skin = mix(skin, skin * vec3(0.86, 0.8, 0.84), exp(-pow((P.y - lowerLid(s) + 0.045) / 0.03, 2.0)) * 0.5);
        skin *= 1.0 - 0.14 * smoothstep(0.66, 0.86, eyeNoise(P.xy * 240.0));
        // Redder thin skin at the lids, darker at the upper lash line, the
        // moist pink waterline on the margin itself.
        skin = mix(skin, skin * vec3(1.02, 0.86, 0.84), (1.0 - smoothstep(0.0, 0.06, fd)) * 0.6);
        float upperSide = step(EYE_C.y + 0.02 * s, P.y);
        skin *= 1.0 - 0.45 * (1.0 - smoothstep(0.003, 0.012, fd)) * upperSide;
        // Fine lines under the eye and fanning from the outer corner.
        float lowerLines = sin((P.y - lowerLid(s)) * 260.0 + eyeNoise(P.xy * 30.0) * 4.0) * (1.0 - upperSide);
        float fan = sin(atan(P.y - EYE_C.y, P.x - FISSURE_W) * 34.0 + eyeNoise(P.xy * 25.0) * 3.0) * smoothstep(0.85, 1.15, s);
        skin *= 1.0 - 0.035 * smoothstep(0.6, 1.0, max(lowerLines * smoothstep(0.08, 0.02, fd), fan));
        float margin = 1.0 - smoothstep(0.0, 0.006, fd);
        skin = mix(skin, skin * vec3(1.0, 0.72, 0.7) + vec3(0.06, 0.0, 0.0), margin * 0.45);
        float diff = clamp((dot(n, L) + 0.3) / 1.3, 0.0, 1.0) * maskLight(P, L) * keyOn;
        float fillD = clamp(dot(n, LF), 0.0, 1.0);
        float ao = mix(0.5, 1.0, smoothstep(0.0, 0.07, -holeSdf(P.xy))) * mix(1.0, 0.6, clamp(-P.z / 0.13, 0.0, 1.0));
        vec3 lit = skin * (sky * ao * 1.05 + vec3(1.0, 0.95, 0.88) * diff * 0.72 + vec3(0.55, 0.62, 0.75) * fillD * 0.2);
        lit += skin * vec3(0.18, 0.04, 0.02) * (1.0 - diff) * ao;
        vec3 h = normalize(L - rd);
        float oil = smoothstep(0.45, 0.8, eyeNoise(P.xy * 45.0 + seed)) * upperSide + margin;
        float sheen = pow(max(dot(n, h), 0.0), 22.0) * 0.06 + pow(max(dot(n, h), 0.0), 90.0) * 0.22 * oil;
        inner = lit + vec3(sheen) * diff;
      } else if (tEye > 0.0) {
        // ─── The eye ────────────────────────────────────────────────────────
        vec3 P = ro + rd * tEye;
        vec3 ng = normalize(P - EYE_C);
        vec3 n = onCornea > 0.5 ? normalize(P - cc) : ng;
        float shadow = maskLight(P, L) * lidLight(P, L, open) * keyOn;
        float fd = fissureSdf(P.xy, open);
        float s = lidS(P.xy);
        // Lids and lashes hold the upper globe in shade; the lower lid less.
        float upperSide = step(EYE_C.y + 0.02 * s, P.y);
        float ao = mix(mix(0.6, 0.22, upperSide), 1.0, smoothstep(0.0, mix(0.035, 0.085, upperSide), -fd));
        ao *= mix(0.6, 1.0, smoothstep(0.0, 0.08, -holeSdf(P.xy)));
        vec3 albedo;
        vec3 caustic = vec3(0.0);
        if (onCornea > 0.5) {
          vec3 rr = refract(rd, n, 1.0 / 1.376);
          vec3 ci = EYE_C + g * (EYE_R * IRIS_COS - 0.012);
          vec3 pi = P + rr * (dot(ci - P, g) / min(dot(rr, g), -0.05));
          vec3 vi = pi - ci;
          vec2 ip = vec2(dot(vi, gu), dot(vi, gv)) / (EYE_R * IRIS_SIN);
          float lum = dot(baseColor, vec3(0.299, 0.587, 0.114));
          vec3 tint = baseColor * min(1.0, 0.55 / max(lum, 0.05));
          float sat = max(max(tint.r, tint.g), tint.b) - min(min(tint.r, tint.g), tint.b);
          tint = mix(vec3(0.46, 0.53, 0.6), tint, smoothstep(0.06, 0.22, sat));
          float pupil = 0.3 + 0.03 * sin(time * 0.7 + seed * 6.0) + 0.12 * (1.0 - keyOn);
          albedo = length(ip) < 1.0 ? irisAt(ip, pupil, seed, tint) : scleraAt(normalize(pi - EYE_C), g, gu, gv, seed);
          // Light gathered by the cornea brightens the iris across from it.
          vec2 lp = vec2(dot(L, gu), dot(L, gv));
          float across = dot(normalize(ip + 1e-5), -normalize(lp + 1e-5));
          caustic = albedo * smoothstep(0.1, 0.9, across) * smoothstep(0.35, 0.95, length(ip)) * (1.0 - smoothstep(0.95, 1.0, length(ip))) * 0.9;
        } else {
          albedo = scleraAt(ng, g, gu, gv, seed);
        }
        // The caruncle and the fold beside it fill the inner corner.
        float car = smoothstep(-0.7, -0.93, s);
        albedo = mix(albedo, vec3(0.8, 0.46, 0.44) * (0.85 + 0.25 * eyeNoise(P.xy * 160.0)), car);
        albedo = mix(albedo, vec3(0.86, 0.6, 0.58), exp(-pow((s + 0.66) / 0.045, 2.0)) * 0.45 * (1.0 - car));
        float diff = clamp((dot(ng, L) + 0.25) / 1.25, 0.0, 1.0) * shadow;
        float fillD = clamp(dot(ng, LF), 0.0, 1.0);
        vec3 lit = albedo * (sky * ao * 0.95 + vec3(1.0, 0.96, 0.9) * diff * ao * 0.62 + vec3(0.55, 0.62, 0.75) * fillD * ao * 0.14);
        lit += caustic * shadow * 0.6;
        // Wet: the whole visible eye reflects the room; the cornea most.
        vec3 r = reflect(rd, n);
        vec3 rw = normalize(T * r.x + B * r.y + N * r.z);
        float fres = 0.02 + 0.98 * pow(1.0 - clamp(dot(-rd, n), 0.0, 1.0), 5.0);
        vec3 env = envReflect(rw) * mix(0.5, 1.0, ao);
        // The conjunctiva is wet but rougher than the cornea: a dimmer, smaller share.
        float wet = mix(0.22, 1.0, onCornea);
        lit += env * (fres * 0.9 + 0.045) * wet * mix(0.35, 1.0, maskLight(P, normalize(r)));
        // Tear meniscus along the lower lid.
        lit += vec3(0.25, 0.25, 0.27) * exp(-pow((P.y - lowerLid(s) - 0.007) / 0.004, 2.0)) * (1.0 - car) * step(abs(s), 1.0);
        inner = lit;
      } else {
        float s = lidS((ro + rd * tMax).xy);
        inner = mix(vec3(0.3, 0.1, 0.09), vec3(0.62, 0.3, 0.29), smoothstep(-0.6, -1.0, s)) * 0.55;
      }

      // ─── Lashes, standing out of the margins toward the viewer ────────────
      if (wall < 0.5) {
        float tHitAny = tHit > 0.0 ? tHit : tEye;
        float tl = -0.03 / rd.z;
        if (tHitAny < 0.0 || tl < tHitAny) {
          float lu = lashes((ro + rd * tl).xy, open, 1.0, seed);
          float tl2 = -0.04 / rd.z;
          float ll = lashes((ro + rd * tl2).xy, open, 0.0, seed);
          float lash = max(lu, ll * 0.85);
          vec3 lashCol = vec3(0.035, 0.026, 0.022) + vec3(0.06) * pow(max(L.z, 0.0), 2.0) * 0.5;
          inner = mix(inner, lashCol, lash * 0.95);
        }
      }
      col = mix(col, inner, inside);
    }

    tileCoat = 1.0 - inside;
    gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
  }
`;
