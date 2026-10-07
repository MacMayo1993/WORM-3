// Surreal tile shaders — the Magritte side of the same argument the impossible
// figures make. Nothing here is drawn wrong. Every one of these tiles is a
// perfectly ordinary scene in which exactly one rule of the world has been
// quietly withdrawn, and the picture goes on behaving as though it hadn't.
//
//   bowlerRain      figures hanging in the sky in a lattice, weather-like
//   dayOverNight    a daylit sky over a street keeping its own separate night
//   skyCurtain      curtains cut from the sky they are drawn across
//   paintedWindow   a canvas continuing the view it stands in front of
//   falseReflection a mirror that copies where it ought to reverse
//   skyBird         a bird with the sky on the inside and none on the outside
//   floatingRock    a boulder with a castle on it, hanging over a moving sea
//   moonInFront     a crescent moon crossing in front of a tree at dusk
//   giantApple      a plain room with one apple in it, and no room left over
//   sunwardShadow   a man and a tree on a plain, their shadows reaching sunward
//   meltingClock    a pocket watch draped soft over a ledge, still going
//   indoorCloud     a small rain cloud standing in an empty gallery
//
// The single rule each one breaks:
//   bowlerRain      things fall; these hang, evenly, at every distance
//   dayOverNight    one sky, one hour — here the ground keeps a different one
//   skyCurtain      a curtain hides what is behind it; these are made of it
//   paintedWindow   a picture of a place is not the place; this one keeps up
//                   with it, but from six seconds ago, and the frame is the
//                   only thing that ever tells you
//   falseReflection a mirror reverses; this one only reverses the book
//   skyBird         a silhouette is an absence of light; this is an absence of
//                   wall, and the sky is only ever visible through the bird
//   floatingRock    heavy things fall; this one stays exactly where it is, and
//                   its shadow lies on the water directly underneath
//   moonInFront     the sky is behind everything; here it was laid on last
//   giantApple      things fit the rooms they are in; this one fits exactly
//   sunwardShadow   shadows fall away from the light; these lean into it, at
//                   the right length for the hour
//   meltingClock    rigid things stay rigid; this one has gone soft and goes
//                   on keeping time
//   indoorCloud     weather stays outdoors; this came in, and rains, and the
//                   floor stays dry
//
// Every shader takes `baseColor` (the face colour) and, when animated, `time`.
// The shared weather is joined in with + rather than interpolated, so the
// build's shader compaction still strips every template's comments.
// The sky is always the face colour lightened, never a literal blue: a tile has
// to say which face it belongs to before it says anything else.

// Shared weather. The cumulus threshold is deliberately high and narrow — soft
// noise turns to grey mush at forty pixels across, and these tiles are often
// smaller than that.
const SKY = `
  float srHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  float srNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(srHash(i), srHash(i + vec2(1.0, 0.0)), f.x),
               mix(srHash(i + vec2(0.0, 1.0)), srHash(i + vec2(1.0, 1.0)), f.x), f.y);
  }

  float srFbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * srNoise(p); p *= 2.03; a *= 0.5; }
    return v;
  }

  float srClouds(vec2 p) {
    float f = srFbm(p * 2.7) + 0.16 * srFbm(p * 7.0);
    return smoothstep(0.44, 0.72, f);
  }

  // Face colour, lightened into daylight and kept identifiable.
  vec3 srSky(vec3 base, vec2 p, float height) {
    float c = srClouds(p);
    vec3 air = mix(base * 0.62, base * 0.95, height);
    return mix(air, mix(base, vec3(1.0), 0.80), c);
  }

  vec2 srRot(vec2 p, float a) {
    float c = cos(a), s = sin(a);
    return vec2(c * p.x - s * p.y, s * p.x + c * p.y);
  }

  float srEllipse(vec2 p, vec2 c, vec2 r, float a) {
    return length(srRot(p - c, a) / r);
  }
`;

export const surrealShaders = {
  // Bowler Rain — a lattice of coated figures standing in the air. They are
  // spaced like a screen door and lit like a crowd, three depths of them, the
  // far ones smaller and paler exactly as distance would have them. Everything
  // about the picture is obedient except the one thing holding them up. They
  // drift down at the speed of nothing in particular; the weather behind them
  // moves faster.
  bowlerRain: `
    uniform vec3 baseColor;
    uniform float time;
    varying vec2 vUv;
    ` + SKY + `

    // A figure in its own cell: bowler, brim, head, shoulders, coat.
    float brFigure(vec2 q) {
      float hat  = smoothstep(1.06, 0.94, length((q - vec2(0.0, 0.26)) / vec2(0.30, 0.27))) * step(0.24, q.y);
      float brim = smoothstep(1.06, 0.94, length((q - vec2(0.0, 0.24)) / vec2(0.54, 0.055)));
      float head = smoothstep(1.06, 0.94, length((q - vec2(0.0, 0.06)) / vec2(0.23, 0.21)));
      float coat = smoothstep(1.04, 0.96, length((q - vec2(0.0, -0.44)) / vec2(0.46, 0.42))) * step(q.y, -0.02);
      return clamp(max(max(hat, brim), max(head, coat)), 0.0, 1.0);
    }

    void main() {
      vec2 uv = vUv;
      vec3 col = srSky(baseColor, vec2(uv.x * 1.5 + time * 0.014, uv.y * 1.5), uv.y);

      // Far ranks first, so the near ones stand in front of them.
      for (int i = 0; i < 3; i++) {
        float fl = 2.0 - float(i);
        float scale = 3.4 + fl * 2.1;
        float drift = time * (0.030 + 0.014 * fl);
        float row = floor(uv.y * scale + drift);
        vec2 g = vec2(uv.x * scale + fl * 0.41 + 0.5 * mod(row, 2.0), uv.y * scale + drift);
        float fig = brFigure((fract(g) - 0.5) * 2.3);
        // Distance drains contrast before it drains size.
        vec3 coat = mix(baseColor * 0.10, baseColor * 0.52, fl * 0.42);
        col = mix(col, coat, fig * (0.96 - 0.12 * fl));
      }

      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,

  // Day Over Night — one canvas, two hours. Above the roofline it is early
  // afternoon, with the clouds still moving; below it the street has been dark
  // long enough for the lamps to be lit and the windows to matter. There is no
  // horizon between them and no edge where one becomes the other: the sky just
  // stops being the reason you can see.
  dayOverNight: `
    uniform vec3 baseColor;
    uniform float time;
    varying vec2 vUv;
    ` + SKY + `

    void main() {
      vec2 uv = vUv;
      vec3 night = baseColor * 0.085;

      vec3 col = srSky(baseColor, vec2(uv.x * 1.7 + time * 0.016, uv.y * 1.7), uv.y);
      col *= mix(1.08, 0.86, uv.y);              // the light is still low

      // ── the street, keeping its own time ────────────────────────────────
      float ground = smoothstep(0.315, 0.300, uv.y);
      // House: a block with a gable, its ridge on the centre line.
      float house = step(0.30, uv.x) * step(uv.x, 0.72) * step(0.30, uv.y) * step(uv.y, 0.60);
      float roof  = step(abs(uv.x - 0.51) * 1.55 + 0.60, uv.y + 0.115) * step(uv.y, 0.715)
                  * step(0.27, uv.x) * step(uv.x, 0.75);
      // A tree, three blobs and a trunk.
      float tree = smoothstep(1.05, 0.95, length((uv - vec2(0.145, 0.60)) / vec2(0.085, 0.115)))
                 + smoothstep(1.05, 0.95, length((uv - vec2(0.085, 0.53)) / vec2(0.058, 0.070)))
                 + smoothstep(1.05, 0.95, length((uv - vec2(0.205, 0.53)) / vec2(0.055, 0.065)))
                 + step(abs(uv.x - 0.145), 0.014) * step(0.30, uv.y) * step(uv.y, 0.58);
      float solid = clamp(ground + house + roof + tree, 0.0, 1.0);
      col = mix(col, night, solid);

      // ── the lamp, and the two windows that are still awake ──────────────
      float flick = 0.94 + 0.06 * srNoise(vec2(time * 1.7, 0.0));
      vec2 lampPos = vec2(0.855, 0.585);
      float pole = step(abs(uv.x - 0.855), 0.010) * step(0.30, uv.y) * step(uv.y, 0.575);
      col = mix(col, night, pole);
      float bulb = smoothstep(0.030, 0.006, length(uv - lampPos));
      float halo = exp(-length((uv - lampPos) * vec2(1.0, 0.85)) * 11.0);
      vec3 warm = mix(baseColor, vec3(1.0), 0.88);
      col = mix(col, warm, clamp(bulb + halo * 0.55, 0.0, 1.0) * flick);

      float win = step(abs(uv.x - 0.395), 0.038) * step(abs(uv.y - 0.435), 0.048)
                + step(abs(uv.x - 0.615), 0.038) * step(abs(uv.y - 0.435), 0.048);
      col = mix(col, mix(baseColor, vec3(1.0), 0.70), clamp(win, 0.0, 1.0) * 0.92);

      // ── the puddle at the kerb ──────────────────────────────────────────
      float water = smoothstep(0.155, 0.140, uv.y);
      vec2 mir = vec2(uv.x + 0.010 * sin(uv.y * 90.0 + time * 1.6), 0.310 - (uv.y - 0.140) * 2.4);
      float rHalo = exp(-length((mir - lampPos) * vec2(1.0, 0.55)) * 9.0);
      col = mix(col, night * 1.3, water);
      col += warm * rHalo * water * 0.45 * flick;

      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,

  // Sky Curtain — heavy stage curtains hung in front of a wall, and the wall is
  // the only thing in the picture that is not weather. The folds are real: they
  // shade and they cast, and they hang the way cloth hangs. It is only the cloth
  // that is wrong. The clouds inside them move; the folds do not move with them,
  // because the folds belong to the curtain and the sky does not.
  skyCurtain: `
    uniform vec3 baseColor;
    uniform float time;
    varying vec2 vUv;
    ` + SKY + `

    void main() {
      vec2 uv = vUv;

      // The room: a flat wall and a floor, lit by nothing in particular.
      vec3 col = mix(baseColor * 0.13, baseColor * 0.22, uv.y);
      float floorY = 0.16;
      col = mix(col, baseColor * 0.28 * (0.7 + 0.3 * uv.y / floorY), smoothstep(floorY + 0.005, floorY - 0.005, uv.y));

      for (int i = 0; i < 3; i++) {
        float fi = float(i);
        float cx = 0.19 + fi * 0.305;
        float half_ = 0.115 - fi * 0.006;

        // The hem sways, so the panel is not a rectangle.
        float xw = uv.x + 0.012 * sin(uv.y * 13.0 - fi * 2.1);
        float dx = (xw - cx) / half_;
        float hem = 0.115 + 0.022 * sin(xw * 26.0 + fi);
        float inside = step(abs(dx), 1.0) * step(hem, uv.y) * step(uv.y, 0.985);

        // Sky through the cloth, drifting.
        vec3 sky = srSky(baseColor, vec2(xw * 2.3 + time * 0.022 + fi * 3.0, uv.y * 2.3), uv.y);
        // Folds: the cloth's own geometry, indifferent to the weather in it.
        float fold = 0.5 + 0.5 * sin((xw - cx) * 62.0 + fi * 1.3);
        float turn = 1.0 - 0.42 * dx * dx;                 // the panel's roundness
        sky *= (0.72 + 0.34 * fold) * turn;
        sky *= mix(0.72, 1.06, smoothstep(hem, hem + 0.30, uv.y));   // shadow in the hem

        col = mix(col, sky, inside);
        // A shadow on the floor, since the cloth is genuinely there.
        float shade = step(abs(dx), 1.25) * smoothstep(floorY, floorY - 0.09, uv.y);
        col = mix(col, col * 0.62, shade * step(uv.y, hem));
      }

      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,

  // Painted Window — a landscape, and standing in it a canvas on an easel that
  // shows the same landscape, painted from exactly where it stands. It agrees
  // with the view behind it in every particular but one: it was painted a few
  // seconds ago, and the sun has moved since. The frame is the only evidence
  // that the picture is a picture, which is precisely as much evidence as a
  // window gives you.
  paintedWindow: `
    uniform vec3 baseColor;
    uniform float time;
    varying vec2 vUv;
    ` + SKY + `

    vec3 pwScene(vec2 uv, float t) {
      float h = 0.46;
      vec3 sky = srSky(baseColor, vec2(uv.x * 1.6 + t * 0.020, uv.y * 1.6), uv.y);
      // The sun, which is the whole tell.
      vec2 sun = vec2(0.5 + 0.34 * sin(t * 0.085), 0.74);
      float disc = smoothstep(0.062, 0.048, length(uv - sun));
      float glow = exp(-length(uv - sun) * 8.5);
      sky = mix(sky, mix(baseColor, vec3(1.0), 0.55), glow * 0.45);
      sky = mix(sky, mix(baseColor, vec3(1.0), 0.92), disc);

      // Ground: furrows running to the horizon.
      float d = max(h - uv.y, 0.0);
      float rows = 0.5 + 0.5 * sin((uv.x - 0.5) / max(d + 0.045, 0.02) * 5.0);
      vec3 land = mix(baseColor * 0.20, baseColor * 0.46, smoothstep(0.0, 0.34, d));
      land *= 0.88 + 0.16 * rows;
      return uv.y > h ? sky : land;
    }

    void main() {
      vec2 uv = vUv;
      vec3 col = pwScene(uv, time);

      const vec2 lo = vec2(0.265, 0.275);
      const vec2 hi = vec2(0.735, 0.740);
      vec2 c = (lo + hi) * 0.5;
      vec2 h = (hi - lo) * 0.5;
      vec2 d = abs(uv - c) - h;
      float box = max(d.x, d.y);

      // The easel: two legs and a crossbar, standing on the field.
      float legs = smoothstep(0.009, 0.004, abs((uv.x - 0.5) * 1.0 + (uv.y - 0.28) * 0.62) - 0.196)
                 * step(0.055, uv.y) * step(uv.y, 0.30);
      col = mix(col, baseColor * 0.13, legs);

      // A canvas is a thing, so it has a shadow and a thickness.
      float shadow = smoothstep(0.035, 0.0, max(abs(uv - c - vec2(0.016, -0.016)).x - h.x,
                                                abs(uv - c - vec2(0.016, -0.016)).y - h.y));
      col = mix(col, col * 0.55, shadow * step(0.0, box) * 0.85);

      // What is painted on it: the same place, six seconds ago.
      float inside = step(box, 0.0);
      col = mix(col, pwScene(uv, time - 6.0), inside);
      // Frame.
      col = mix(col, baseColor * 0.16, step(box, 0.0) * step(-0.022, box));
      col = mix(col, baseColor * 0.55, smoothstep(0.006, 0.0, abs(box + 0.022)));

      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,

  // False Reflection — a man stands at the mirror and the mirror declines. It
  // is not showing him the back of his head out of malice or bad optics; it is
  // showing him a faithful copy, translated rather than reflected, which is a
  // perfectly good transformation and the wrong one. The book on the ledge below
  // reverses correctly, which is the detail that makes the rest unarguable.
  falseReflection: `
    uniform vec3 baseColor;
    uniform float time;
    varying vec2 vUv;
    ` + SKY + `

    // Back of a head, shoulders, and a parting on one side — the chirality that
    // the mirror is supposed to do something about.
    float frFigure(vec2 uv, vec2 c) {
      vec2 q = uv - c;
      float head = smoothstep(1.04, 0.96, length(q / vec2(0.105, 0.120)));
      float neck = step(abs(q.x), 0.045) * step(abs(q.y + 0.125), 0.040);
      float body = smoothstep(1.02, 0.97, length((q - vec2(0.0, -0.31)) / vec2(0.205, 0.215))) * step(q.y, -0.13);
      return clamp(max(max(head, neck), body), 0.0, 1.0);
    }

    float frParting(vec2 uv, vec2 c) {
      vec2 q = uv - c;
      return smoothstep(0.016, 0.006, abs(q.x - 0.052) ) * step(abs(q.y - 0.03), 0.075);
    }

    // The book: a slab with its spine on one side. Passed s = +1 it is drawn
    // as it sits, s = -1 as a mirror would actually return it.
    float frBook(vec2 uv, vec2 c, float s, out float spine) {
      vec2 q = (uv - c) * vec2(s, 1.0);
      float slab = step(abs(q.x), 0.062) * step(abs(q.y), 0.030);
      spine = step(abs(q.x - 0.048), 0.014) * step(abs(q.y), 0.030);
      return slab;
    }

    void main() {
      vec2 uv = vUv;
      float bob = 0.012 * sin(time * 0.62);

      // Room and ledge.
      vec3 col = mix(baseColor * 0.20, baseColor * 0.32, uv.y);
      float ledge = step(0.150, uv.y) * step(uv.y, 0.205);
      col = mix(col, baseColor * 0.46, ledge);
      col = mix(col, baseColor * 0.14, smoothstep(0.006, 0.0, abs(uv.y - 0.150)));

      // The mirror: frame, then glass with a raking sheen.
      vec2 mc = vec2(0.635, 0.585);
      vec2 mh = vec2(0.300, 0.335);
      vec2 md = abs(uv - mc) - mh;
      float mbox = max(md.x, md.y);
      col = mix(col, baseColor * 0.60, step(mbox, 0.0) * step(-0.034, mbox));
      float glass = step(mbox, -0.034);
      col = mix(col, baseColor * 0.38, glass);
      col = mix(col, baseColor * 0.46, glass * smoothstep(0.10, 0.0, abs((uv.x - mc.x) * 0.9 + (uv.y - mc.y) * 0.5 + 0.13)));

      // The man, and the same man again where his reflection should be. Same
      // hand, same parting, same side.
      vec2 manC = vec2(0.215, 0.560 + bob);
      vec2 refC = vec2(0.640, 0.560 + bob);
      vec3 dark = baseColor * 0.10;
      col = mix(col, dark, frFigure(uv, manC));
      col = mix(col, baseColor * 0.30, frParting(uv, manC));
      col = mix(col, dark * 1.5, frFigure(uv, refC) * glass);
      col = mix(col, baseColor * 0.34, frParting(uv, refC) * glass);

      // The book obeys.
      float spineA, spineB;
      float bookA = frBook(uv, vec2(0.215, 0.183), 1.0, spineA);
      float bookB = frBook(uv, vec2(0.640, 0.183), -1.0, spineB);
      col = mix(col, baseColor * 0.16, bookA);
      col = mix(col, baseColor * 0.72, spineA);
      col = mix(col, baseColor * 0.22, bookB * glass);
      col = mix(col, baseColor * 0.66, spineB * glass);

      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,

  // Sky Bird — the sky is not behind the bird, it is inside it. Outside the
  // silhouette the world is a flat wall of face colour with a sea along the
  // bottom; the only daylight anywhere is the daylight the bird is made of, and
  // it keeps moving while the wall does not. Wherever the bird goes the weather
  // goes with it, which is either how birds work or the exact opposite.
  skyBird: `
    uniform vec3 baseColor;
    uniform float time;
    varying vec2 vUv;
    ` + SKY + `

    float sbBird(vec2 uv, float flap) {
      float body = smoothstep(1.03, 0.97, srEllipse(uv, vec2(0.475, 0.485), vec2(0.235, 0.088), -0.12));
      float head = smoothstep(1.05, 0.95, srEllipse(uv, vec2(0.700, 0.556), vec2(0.072, 0.062), 0.0));
      float beak = smoothstep(0.028, 0.008, abs(uv.y - 0.548) + max(uv.x - 0.845, 0.0) * 3.0)
                 * step(0.745, uv.x) * step(uv.x, 0.855);
      float up   = smoothstep(1.03, 0.96, srEllipse(uv, vec2(0.430, 0.640 + flap * 0.030), vec2(0.175, 0.062), 0.52 + flap * 0.10));
      float dn   = smoothstep(1.03, 0.96, srEllipse(uv, vec2(0.395, 0.335 - flap * 0.030), vec2(0.165, 0.058), -0.46 - flap * 0.10));
      float tail = smoothstep(1.04, 0.95, srEllipse(uv, vec2(0.235, 0.430), vec2(0.115, 0.052), 0.22));
      return clamp(max(max(max(body, head), max(beak, up)), max(dn, tail)), 0.0, 1.0);
    }

    void main() {
      vec2 uv = vUv;

      // The wall, and the sea it stands in. Neither of them is weather.
      vec3 col = mix(baseColor * 0.42, baseColor * 0.30, uv.y);
      float sea = smoothstep(0.245, 0.235, uv.y);
      col = mix(col, baseColor * 0.17 * (0.85 + 0.30 * sin(uv.y * 120.0 + time * 0.7)), sea);
      col = mix(col, baseColor * 0.52, smoothstep(0.005, 0.0, abs(uv.y - 0.240)));

      float flap = sin(time * 0.9);
      float bird = sbBird(uv, flap);

      // Inside: an entire afternoon, moving.
      vec3 sky = srSky(baseColor, vec2(uv.x * 2.1 + time * 0.035, uv.y * 2.1 + 0.4), uv.y);
      sky *= 0.92 + 0.14 * smoothstep(0.25, 0.75, uv.y);
      col = mix(col, sky, bird);

      // Two more of them, far off and made of nothing.
      float far = smoothstep(0.020, 0.008, abs(length((uv - vec2(0.175, 0.790)) * vec2(1.0, 2.6)) - 0.032))
                + smoothstep(0.016, 0.006, abs(length((uv - vec2(0.265, 0.845)) * vec2(1.0, 2.6)) - 0.024));
      col = mix(col, baseColor * 0.22, clamp(far, 0.0, 1.0) * 0.8);

      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,

  // Floating Rock — a boulder the size of a hill, broken off underneath the way
  // a piece of mountain breaks, with a little castle keeping watch on its crown.
  // It hangs over the sea at the height of a cloud and is lit like any rock in
  // the afternoon. The sea moves, the clouds go by, and the rock does not so
  // much as sway: it is not floating, it is simply where it is. Its shadow lies
  // on the water directly beneath, which is exactly where a shadow should be.
  floatingRock: `
    uniform vec3 baseColor;
    uniform float time;
    varying vec2 vUv;
    ` + SKY + `

    // The boulder in its own frame: an egg of stone narrowing to where it
    // was broken off underneath, its outline knocked about.
    float rkShape(vec2 uv, out vec2 p) {
      p = (uv - vec2(0.485, 0.545)) / vec2(0.270, 0.205);
      p.x *= 1.0 + 0.40 * max(-p.y, 0.0);
      return length(p) + 0.12 * (srNoise(p * 3.2 + 2.0) - 0.5) + 0.05 * (srNoise(p * 8.5) - 0.5);
    }

    void main() {
      vec2 uv = vUv;
      float hz = 0.300;

      // Sky, lit from the left.
      vec3 col = srSky(baseColor, vec2(uv.x * 1.5 + time * 0.015, uv.y * 1.5 + 0.2), uv.y);
      col *= 1.06 - 0.12 * uv.x;

      // ── the sea, keeping perfectly ordinary time ──────────────────────────
      if (uv.y < hz) {
        float d = hz - uv.y;
        float Z = 0.10 / (d + 0.012);
        float X = (uv.x - 0.5) * Z * 6.0;
        float swell = srNoise(vec2(X * 0.9 + time * 0.22, Z * 2.6 - time * 0.40));
        float glint = smoothstep(0.70, 0.84, swell) * smoothstep(0.004, 0.05, d) * mix(1.0, 0.45, smoothstep(0.10, 0.28, d));
        vec3 sea = mix(mix(baseColor, vec3(1.0), 0.30) * 0.78, baseColor * 0.20, smoothstep(0.0, 0.24, d));
        sea *= 0.90 + 0.14 * swell;
        sea = mix(sea, mix(baseColor, vec3(1.0), 0.82), glint * 0.80);
        // Directly beneath, where it belongs.
        float sh = smoothstep(1.0, 0.30, length((uv - vec2(0.525, 0.160)) / vec2(0.210, 0.040)));
        sea *= 1.0 - 0.50 * sh;
        col = sea;
      }
      col = mix(col, mix(baseColor, vec3(1.0), 0.55), smoothstep(0.004, 0.0, abs(uv.y - hz)) * 0.6);

      // ── the castle, standing back on the crown ────────────────────────────
      float x = uv.x, y = uv.y;
      float wall = step(0.405, x) * step(x, 0.640) * step(y, 0.780 + 0.016 * step(0.5, fract((x - 0.405) / 0.026)));
      float keep = step(0.530, x) * step(x, 0.592) * step(y, 0.853 + 0.016 * step(0.5, fract((x - 0.530) / 0.0207)));
      float turret = step(abs(x - 0.438), 0.020) * step(y, 0.817);
      float spire = step(abs(x - 0.438), 0.026 * (0.890 - y) / 0.073) * step(0.817, y) * step(y, 0.890);
      float castle = clamp(wall + keep + turret + spire, 0.0, 1.0) * step(0.660, y);
      // Lit from the left like the rock: west faces bright, the rest in shade.
      float westFace = step(x, 0.548) * keep + step(x, 0.434) * (turret + spire);
      vec3 masonry = mix(baseColor * 0.30, mix(baseColor, vec3(1.0), 0.35) * 0.80, westFace);
      masonry = mix(masonry, mix(baseColor * 0.30, baseColor * 0.46, smoothstep(0.64, 0.40, x)), wall * (1.0 - keep) * (1.0 - turret));
      col = mix(col, masonry, castle);
      float slit = step(abs(x - 0.570), 0.005) * step(abs(y - 0.815), 0.012);
      col = mix(col, mix(baseColor, vec3(1.0), 0.75), slit * keep);

      // ── the rock, in front of its castle's footings ───────────────────────
      vec2 p;
      float rr = rkShape(uv, p);
      float rock = smoothstep(1.0, 0.975, rr);
      // A boulder's volume, broken into facets and lit from the left.
      vec3 n = vec3(p, sqrt(max(1.0 - dot(p, p), 0.05)));
      vec2 fq = floor(p * 2.4 + vec2(srNoise(p * 1.7), srNoise(p * 1.7 + 5.0)) * 1.4);
      n.xy += 0.38 * (vec2(srHash(fq), srHash(fq + 9.1)) - 0.5);
      n = normalize(n);
      float lit = max(dot(n, normalize(vec3(-0.80, 0.50, 0.38))), 0.0);
      // Sky and sea fill the shadow side just enough to keep its facets.
      float fill = 0.16 * max(dot(n, normalize(vec3(0.70, 0.25, 0.60))), 0.0) + 0.10 * max(n.y, 0.0);
      lit = lit * lit * (3.0 - 2.0 * lit) + fill;
      vec3 stone = mix(baseColor * 0.08, mix(baseColor, vec3(1.0), 0.25) * 0.78, clamp(lit, 0.0, 1.0));
      stone *= 0.84 + 0.16 * srNoise(uv * 46.0);
      stone *= mix(0.55, 1.0, smoothstep(-1.0, 0.1, p.y));
      col = mix(col, stone, rock);

      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,

  // Moon in Front — a tree at dusk, a crescent moon, and the order they come
  // in. The foliage is a dark, rounded, ordinary crown; the moon is a thin,
  // ordinary moon. It drifts across the evening as moons do, and wherever it
  // meets the leaves it goes in front of them, as if the sky had been laid on
  // last.
  moonInFront: `
    uniform vec3 baseColor;
    uniform float time;
    varying vec2 vUv;
    ` + SKY + `

    // The crown: overlapping lobes, its edge stirred by a little wind.
    float mnCrown(vec2 uv) {
      float d = min(min(length((uv - vec2(0.500, 0.665)) / vec2(0.255, 0.200)),
                        length((uv - vec2(0.320, 0.565)) / vec2(0.155, 0.135))),
                    min(length((uv - vec2(0.680, 0.575)) / vec2(0.150, 0.130)),
                        length((uv - vec2(0.500, 0.530)) / vec2(0.190, 0.120))));
      d += 0.10 * (srNoise(uv * 19.0 + vec2(time * 0.30, -time * 0.12)) - 0.5);
      return smoothstep(1.03, 0.97, d);
    }

    void main() {
      vec2 uv = vUv;

      // Dusk: the face colour paling toward the horizon, deepening overhead.
      vec3 col = mix(mix(baseColor, vec3(1.0), 0.62), baseColor * 0.30, smoothstep(0.10, 1.0, uv.y));
      float strata = srClouds(vec2(uv.x * 1.1 + time * 0.010, uv.y * 3.8));
      col = mix(col, mix(baseColor, vec3(1.0), 0.45) * 0.85, strata * 0.35 * smoothstep(0.20, 0.60, uv.y));

      // A couple of early stars.
      float tw = 0.65 + 0.35 * sin(time * 2.3);
      float stars = smoothstep(0.009, 0.002, length(uv - vec2(0.135, 0.900))) * tw
                  + smoothstep(0.007, 0.002, length(uv - vec2(0.870, 0.860))) * (1.6 - tw);
      col = mix(col, mix(baseColor, vec3(1.0), 0.90), clamp(stars, 0.0, 1.0));

      // Ground, a long low rise.
      float ground = smoothstep(0.004, -0.004, uv.y - 0.130 - 0.030 * sin(uv.x * 3.1 + 0.4));
      vec3 dark = baseColor * 0.08;
      col = mix(col, dark, ground);

      // Trunk and a fork, then the crown.
      float trunk = step(abs(uv.x - 0.500 - 0.010 * sin(uv.y * 9.0)), 0.024 - 0.020 * uv.y) * step(uv.y, 0.52);
      float forkL = step(abs(uv.x - 0.500 + (uv.y - 0.40) * 0.55), 0.010) * step(0.40, uv.y) * step(uv.y, 0.55);
      float forkR = step(abs(uv.x - 0.500 - (uv.y - 0.36) * 0.75), 0.010) * step(0.36, uv.y) * step(uv.y, 0.53);
      col = mix(col, dark, clamp(trunk + forkL + forkR, 0.0, 1.0));

      float crown = mnCrown(uv);
      float dapple = srNoise(uv * 26.0 + vec2(0.0, time * 0.20));
      vec3 leaves = mix(baseColor * 0.07, baseColor * 0.20, dapple * smoothstep(0.35, 0.85, uv.y + 0.25 * (0.5 - uv.x)));
      col = mix(col, leaves, crown);

      // The moon, laid on top. It eases across: slow over the tree, quick
      // where there is nothing to be in front of.
      float s = fract(time / 90.0 + 0.40) * 2.0 - 1.0;
      vec2 mc = vec2(0.500 + 0.20 * s + 0.55 * s * s * s, 0.640 + 0.080 * (1.0 - s * s));
      float r = 0.088;
      float disc = smoothstep(r + 0.004, r - 0.004, length(uv - mc));
      float bite = smoothstep(r * 0.84 + 0.004, r * 0.84 - 0.004, length(uv - mc - vec2(0.040, 0.030)));
      float crescent = disc * (1.0 - bite);
      float glow = exp(-length(uv - mc) * 16.0) * (1.0 - disc);
      col = mix(col, mix(baseColor, vec3(1.0), 0.55), glow * 0.30);
      col = mix(col, mix(baseColor, vec3(1.0), 0.92), crescent);

      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,

  // Giant Apple — a small plain room, boards on the floor, a skirting along the
  // wall, a window giving onto the weather, and in it one apple. It is a
  // perfectly good apple, with a stalk and a leaf and the window shining in
  // its skin. It touches the ceiling and both walls. Nothing about it is
  // strained; there is simply no room left in the room.
  giantApple: `
    uniform vec3 baseColor;
    uniform float time;
    varying vec2 vUv;
    ` + SKY + `

    // What is through the window, in the window's own coordinates.
    vec3 gaWindowSky(vec2 w) {
      return srSky(baseColor, vec2(w.x * 0.55 - time * 0.030, w.y * 0.45 + 0.3), 0.55 + 0.4 * w.y);
    }

    void main() {
      vec2 uv = vUv;
      vec2 d = uv - vec2(0.5, 0.5);
      float ax = abs(d.x), ay = abs(d.y);
      float back = 0.27;
      float onBack = step(max(ax, ay), back);
      float isFloor = step(ax, ay) * step(d.y, 0.0) * (1.0 - onBack);
      float isCeil = step(ax, ay) * step(0.0, d.y) * (1.0 - onBack);
      float isWall = step(ay, ax) * (1.0 - onBack);

      // Walls: the left one takes the window's light, the right one holds it.
      vec3 plaster = mix(baseColor, vec3(1.0), 0.40);
      vec3 col = plaster * 0.60;
      col = mix(col, plaster * mix(0.70, 0.52, step(0.0, d.x)), isWall);
      col = mix(col, plaster * 0.78, isCeil);

      // Skirting on the walls and along the back.
      float wallT = d.y / max(ax, 0.001);
      float skirt = isWall * step(wallT, -0.86) + onBack * step(d.y, -back + 0.030);
      col = mix(col, baseColor * 0.22, skirt);

      // Floorboards running away to the back wall.
      float lane = d.x / max(ay, 0.001) * 3.2;
      float seam = smoothstep(0.08, 0.0, abs(fract(lane) - 0.5) - 0.42);
      float joint = smoothstep(0.10, 0.0, abs(fract(0.16 / max(ay, 0.001) + floor(lane) * 0.37) - 0.5) - 0.44);
      vec3 boards = baseColor * (0.30 + 0.06 * srNoise(vec2(floor(lane) * 3.1, 0.5)));
      boards = mix(boards, baseColor * 0.12, clamp(seam + joint, 0.0, 1.0));
      col = mix(col, boards, isFloor);

      // The window, in the right-hand wall: depth w along the wall, height t.
      vec2 win = vec2((d.x - 0.395) / 0.085, (d.y / max(d.x, 0.001) - 0.30) / 0.40);
      float inWin = isWall * step(0.0, d.x) * step(abs(win.x), 1.0) * step(abs(win.y), 1.0);
      float pane = step(abs(win.x), 0.84) * step(abs(win.y), 0.86) * step(0.10, abs(win.x)) * step(0.10, abs(win.y));
      vec3 frame = mix(baseColor, vec3(1.0), 0.55) * 0.85;
      col = mix(col, mix(frame, gaWindowSky(win), pane), inWin);

      // The weather in the window decides how bright the room is.
      float cover = srClouds(vec2(-time * 0.030, 0.3));
      float light = 1.0 - 0.22 * cover;

      // ── the apple ─────────────────────────────────────────────────────────
      vec2 C = vec2(0.500, 0.478);
      float R = 0.408;
      vec2 p = (uv - C) / R;
      p.x *= 1.0 - 0.10 * p.y;                              // narrower at the base
      p.y += 0.17 * exp(-p.x * p.x * 16.0) * smoothstep(0.10, 0.90, p.y);   // the dimple
      float rr = length(p);
      float apple = smoothstep(1.0, 0.985, rr);

      // It presses into the room: shade the corners it is wedged against.
      col *= mix(0.55, 1.0, smoothstep(1.0, 1.22, rr));
      // And its shadow on the boards, away from the window.
      float fs = smoothstep(1.0, 0.4, length((uv - vec2(0.34, 0.075)) / vec2(0.32, 0.055)));
      col *= 1.0 - 0.45 * fs * isFloor;

      vec3 n = vec3(p, sqrt(max(1.0 - rr * rr, 0.0)));
      vec3 L = normalize(vec3(0.78, 0.40, 0.50));
      float diff = max(dot(n, L), 0.0);
      float phi = atan(p.x, n.z + 0.001);
      float streak = srNoise(vec2(phi * 7.0, p.y * 1.2 + 4.0));
      vec3 skin = baseColor * (0.16 + 0.95 * diff * light);
      skin *= 0.84 + 0.20 * streak;
      skin += baseColor * 0.12 * smoothstep(-0.2, -0.95, p.y) * smoothstep(0.6, 0.0, n.z);   // bounce from the floor
      // The window, shining in it.
      vec3 rf = 2.0 * n.z * n - vec3(0.0, 0.0, 1.0);
      float spec = pow(max(dot(rf, normalize(vec3(0.82, 0.42, 0.40))), 0.0), 70.0);
      float sheen = pow(max(dot(rf, normalize(vec3(0.82, 0.42, 0.40))), 0.0), 8.0);
      skin = mix(skin, mix(baseColor, vec3(1.0), 0.90), clamp(spec * 1.4 * light + sheen * 0.10, 0.0, 1.0));
      col = mix(col, skin, apple);

      // Stalk and leaf, against the ceiling.
      float sy = (uv.y - 0.800) / 0.105;
      float stalk = smoothstep(0.011, 0.006, abs(uv.x - 0.500 - 0.030 * sy * sy)) * step(0.0, sy) * step(sy, 1.0);
      col = mix(col, baseColor * 0.14, stalk);
      vec2 lq = srRot(uv - vec2(0.585, 0.872), -0.42);
      float leaf = step(length(lq - vec2(0.0, -0.062)), 0.090) * step(length(lq - vec2(0.0, 0.062)), 0.090);
      float rib = smoothstep(0.005, 0.002, abs(lq.y)) * step(abs(lq.x), 0.055);
      vec3 leafCol = mix(baseColor * 0.26, baseColor * 0.48, smoothstep(-0.03, 0.03, lq.y));
      col = mix(col, mix(leafCol, baseColor * 0.15, rib), leaf);

      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,

  // Sunward Shadow — a plain, a man standing in it, a post off to one side,
  // and the sun going over. Their shadows are true in every particular: the
  // right shape, the right length for the hour, long in the morning and short
  // at noon. They simply point at the sun. As it crosses the sky they swing
  // round to follow it, the way a face follows a light.
  sunwardShadow: `
    uniform vec3 baseColor;
    uniform float time;
    varying vec2 vUv;
    ` + SKY + `

    // A man in a coat and bowler, feet at the origin, one unit tall.
    float swMan(vec2 q) {
      float hat  = smoothstep(1.08, 0.92, length((q - vec2(0.0, 0.925)) / vec2(0.080, 0.075))) * step(0.90, q.y);
      float brim = smoothstep(1.08, 0.92, length((q - vec2(0.0, 0.900)) / vec2(0.135, 0.020)));
      float head = smoothstep(1.08, 0.92, length((q - vec2(0.0, 0.830)) / vec2(0.062, 0.072)));
      float coat = smoothstep(1.04, 0.96, length((q - vec2(0.0, 0.690)) / vec2(0.150, 0.070)))
                 + step(abs(q.x), 0.148 - 0.035 * (0.69 - q.y)) * step(0.22, q.y) * step(q.y, 0.69);
      float legs = step(abs(abs(q.x) - 0.050), 0.030) * step(0.0, q.y) * step(q.y, 0.24);
      return clamp(hat + brim + head + coat + legs, 0.0, 1.0);
    }

    // A tree of the kind that stands alone in fields: a trunk and a ball.
    float swTree(vec2 q) {
      float trunk = step(abs(q.x), 0.055 - 0.015 * q.y) * step(0.0, q.y) * step(q.y, 1.00);
      float ball = smoothstep(1.04, 0.96, length((q - vec2(0.0, 1.30)) / vec2(0.40, 0.36)));
      return clamp(trunk + ball, 0.0, 1.0);
    }

    void main() {
      vec2 uv = vUv;
      float hz = 0.640;
      float f = 0.48;        // focal length: wide, so the sun can swing far round
      float eye = 2.00;      // eye height, in men: a little above the plain
      vec2 manAt = vec2(-0.65, 1.90);
      vec2 treeAt = vec2(1.10, 2.80);

      // The sun's day: across from left to right, up and down again.
      float ph = fract(time / 52.0 + 0.60);
      float az = mix(-0.88, 0.88, ph);
      float el = -0.06 + 0.50 * sin(3.14159 * ph);
      float day = smoothstep(-0.04, 0.20, el);
      vec2 sun = vec2(0.5 + f * tan(az), hz + f * tan(el) / cos(az));

      // The sky is kept a shade down so the sun reads on every face — further
      // down the paler the face, or a white face's sun is white on white.
      float lum = dot(baseColor, vec3(0.299, 0.587, 0.114));
      vec3 col = srSky(baseColor, vec2(uv.x * 1.4 + time * 0.012, uv.y * 1.4), uv.y) * mix(0.80, 0.56, smoothstep(0.5, 0.95, lum));
      col *= mix(0.62, 1.0, day);
      float sd = length(uv - sun);
      col = mix(col, mix(baseColor, vec3(1.0), 0.60), exp(-sd * 7.0) * 0.55 * step(hz, uv.y));
      col = mix(col, mix(baseColor, vec3(1.0), 0.97), smoothstep(0.054, 0.044, sd) * step(hz, uv.y));

      // ── the plain ─────────────────────────────────────────────────────────
      if (uv.y < hz) {
        float Z = f * eye / max(hz - uv.y, 0.001);
        float X = (uv.x - 0.5) * Z / f;
        vec3 land = mix(baseColor * 0.40, mix(baseColor, vec3(1.0), 0.25) * 0.70, smoothstep(0.0, hz, uv.y));
        land *= 0.92 + 0.10 * srNoise(vec2(X * 3.0, Z * 1.2));
        land *= mix(0.60, 1.0, day);

        // Each shadow is its caster laid flat on the ground — toward the sun.
        // Everything else about it is right: shape, and length for the hour.
        vec2 dir = vec2(sin(az), cos(az));
        vec2 across = vec2(dir.y, -dir.x);
        float hgt = tan(max(el, 0.02));             // height cast per unit of ground
        vec2 rm = vec2(X, Z) - manAt;
        vec2 rt = vec2(X, Z) - treeAt;
        float sm = swMan(vec2(dot(rm, across), dot(rm, dir) * hgt));
        float st = swTree(vec2(dot(rt, across), dot(rt, dir) * hgt));
        land = mix(land, land * 0.40, clamp(sm + st, 0.0, 1.0) * day);
        col = land;
      }

      // The man and the tree, against the light.
      float ms = f / manAt.y;
      float man = swMan(vec2(uv.x - (0.5 + manAt.x * ms), uv.y - (hz - eye * ms)) / ms);
      float ts = f / treeAt.y;
      float tree = swTree(vec2(uv.x - (0.5 + treeAt.x * ts), uv.y - (hz - eye * ts)) / ts);
      col = mix(col, baseColor * 0.10, clamp(man + tree, 0.0, 1.0));

      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,

  // Melting Clock — a pocket watch laid on a ledge in the sun, gone soft. It
  // lies over the edge like a cloth over a table, and the part that has run
  // past the end of the ledge hangs lower still. The dial bends with it, the
  // numerals bend, and the hands go round on the bent face keeping exactly
  // the right time, because nothing told them the watch was not a watch.
  meltingClock: `
    uniform vec3 baseColor;
    uniform float time;
    varying vec2 vUv;
    ` + SKY + `

    const float MT_E = 0.360;        // the ledge's front edge
    const float MT_END = 0.600;      // its right-hand end
    const float MT_BACK = 0.640;     // the far edge of its top
    const float MT_CX = 0.445;
    const float MT_R = 0.250;
    const float MT_FOLD = -0.38;     // where, across the dial, it goes over the edge

    // Past the end of the ledge nothing holds it up, and it sags.
    float mtSag(float x) {
      float e = max(x - MT_END + 0.030, 0.0);
      return 15.0 * e * e;
    }

    // Screen to dial. Above the edge the watch lies on the ledge, seen from a
    // little above; below it, it hangs, and the middle hangs longest.
    vec2 mtFace(vec2 uv) {
      float y = uv.y + mtSag(uv.x);
      float u = (uv.x - MT_CX) / MT_R;
      float v = y >= MT_E ? MT_FOLD + (y - MT_E) / (MT_R * 0.56)
                          : MT_FOLD + (y - MT_E) / (MT_R * (1.05 + 0.40 * max(1.0 - u * u, 0.0)));
      return vec2(u, v);
    }

    float mtSeg(vec2 p, vec2 a) {
      float h = clamp(dot(p, a) / dot(a, a), 0.0, 1.0);
      return length(p - a * h);
    }

    void main() {
      vec2 uv = vUv;

      // Sky, and a long flat shore under it.
      vec3 col = srSky(baseColor, vec2(uv.x * 1.5 + time * 0.012, uv.y * 1.5), uv.y);
      float hz = 0.700;
      vec3 sea = mix(mix(baseColor, vec3(1.0), 0.20) * 0.55, mix(baseColor, vec3(1.0), 0.45) * 0.85, smoothstep(0.54, hz, uv.y));
      sea *= 0.95 + 0.06 * sin(uv.y * 220.0 + time * 0.8 + 3.0 * srNoise(vec2(uv.x * 6.0, uv.y * 30.0)));
      // A flat beach in front of it, and the sea washing up and back.
      float wash = 0.545 + 0.010 * sin(uv.x * 9.0 + time * 0.45) + 0.006 * sin(time * 0.31);
      vec3 sand = mix(baseColor * 0.34, mix(baseColor, vec3(1.0), 0.22) * 0.66, smoothstep(0.0, 0.54, uv.y));
      vec3 ground = mix(sand, sea, smoothstep(wash - 0.004, wash + 0.004, uv.y));
      ground = mix(ground, mix(baseColor, vec3(1.0), 0.60), smoothstep(0.006, 0.0, abs(uv.y - wash)) * 0.55);
      col = mix(col, ground, step(uv.y, hz));
      // Cliffs along the far shore.
      float cliffTop = hz + 0.042 * smoothstep(0.66, 0.82, uv.x) - 0.014 * smoothstep(0.88, 0.98, uv.x)
                     + 0.010 * srNoise(vec2(uv.x * 24.0, 1.0));
      float cliff = step(0.66, uv.x) * step(uv.y, cliffTop) * step(hz - 0.030, uv.y);
      col = mix(col, mix(baseColor * 0.24, baseColor * 0.50, smoothstep(0.70, 0.80, uv.x) * 0.6), cliff);

      // The ledge: its top seen from above, its front face, its cut end.
      float topf = step(MT_E, uv.y) * step(uv.y, MT_BACK) * step(uv.x, MT_END);
      float front = step(uv.y, MT_E) * step(uv.x, MT_END);
      col = mix(col, baseColor * 0.42 * (0.92 + 0.10 * (uv.y - MT_E) / (MT_BACK - MT_E)), topf);
      col = mix(col, baseColor * 0.20, front);
      col = mix(col, baseColor * 0.58, smoothstep(0.005, 0.0, abs(uv.y - MT_E)) * step(uv.x, MT_END));

      // The drape's shadow, thrown down and to the right.
      vec2 sq = mtFace(uv - vec2(0.026, -0.018));
      col *= 1.0 - 0.50 * smoothstep(1.05, 0.95, length(sq)) * clamp(front + topf, 0.0, 1.0);

      // ── the watch ────────────────────────────────────────────────────────
      vec2 q = mtFace(uv);
      float r = length(q);
      float body = smoothstep(1.025, 0.985, r);
      float bezel = smoothstep(0.83, 0.87, r);
      // The winding crown at twelve.
      float knob = smoothstep(1.06, 0.94, length((q - vec2(0.0, 1.12)) / vec2(0.14, 0.13)))
                 + step(abs(q.x), 0.05) * step(0.95, q.y) * step(q.y, 1.08);

      vec3 dial = mix(baseColor, vec3(1.0), 0.86);
      vec3 metal = mix(baseColor * 0.40, mix(baseColor, vec3(1.0), 0.50), smoothstep(-0.8, 0.9, q.y - 0.4 * q.x));
      vec3 face = mix(dial, metal, bezel);

      // Hour marks: twelve short bars, four of them longer.
      float a = atan(q.y, q.x);
      float m = mod(a + 0.2618, 0.5236) - 0.2618;
      float k = floor((a + 0.2618) / 0.5236);
      float big = step(abs(mod(k, 3.0)), 0.5);
      float tick = step(abs(m) * r, 0.040 + 0.022 * big) * step(0.79 - 0.14 * big, r) * step(r, 0.83);
      face = mix(face, baseColor * 0.12, tick);

      // Hands, keeping time on the bent face.
      float mA = 1.5708 - time * 6.2832 / 60.0;
      float hA = 1.5708 - time * 6.2832 / 720.0 - 2.1;
      float hands = max(smoothstep(0.050, 0.030, mtSeg(q, 0.70 * vec2(cos(mA), sin(mA)))),
                        smoothstep(0.078, 0.058, mtSeg(q, 0.45 * vec2(cos(hA), sin(hA)))));
      hands = max(hands, smoothstep(0.11, 0.08, r));
      face = mix(face, baseColor * 0.10, hands);

      // Light: the lying part faces the sky, the fold catches a highlight,
      // the hanging part turns away, and the unsupported end turns further.
      float y = uv.y + mtSag(uv.x);
      float hang = step(y, MT_E);
      float shade = mix(1.0, 0.80 - 0.12 * smoothstep(MT_FOLD, -1.0, q.y), hang);
      shade -= 0.30 * smoothstep(0.0, 0.20, mtSag(uv.x));
      face *= shade;
      face = mix(face, vec3(1.0), smoothstep(0.014, 0.0, abs(y - MT_E)) * 0.30 * (1.0 - bezel * 0.5));

      col = mix(col, metal * 0.85, clamp(knob, 0.0, 1.0) * (1.0 - body));
      col = mix(col, face, body);

      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,

  // Indoor Cloud — an empty gallery, a skylight, two pictures on the wall and,
  // in the middle of the room, about where a visitor would stand, a small rain
  // cloud. It turns over slowly the way clouds do and rains a little. The rain
  // never arrives: the floor is dry, the light from the skylight lies on it in
  // a pool, and the cloud's shadow sits in the middle of the pool, which is the
  // only part of any of this the room has agreed to.
  indoorCloud: `
    uniform vec3 baseColor;
    uniform float time;
    varying vec2 vUv;
    ` + SKY + `

    // The cloud's outline, centred on its own middle: four puffs on a flat,
    // rainy base.
    float icCloud(vec2 p) {
      float d = min(min(length(p - vec2(-0.100, 0.000)) - 0.080, length(p - vec2(0.015, 0.045)) - 0.105),
                    min(length(p - vec2(0.125, 0.005)) - 0.075, length(p - vec2(0.000, -0.010)) - 0.095));
      return max(d, -0.055 - p.y);
    }

    void main() {
      vec2 uv = vUv;
      vec2 vp = vec2(0.5, 0.56);
      vec2 d = uv - vp;
      vec2 hb = vec2(0.33, 0.29);                     // half-size of the back wall
      vec2 nd = d / hb;
      float onBack = step(max(abs(nd.x), abs(nd.y)), 1.0);
      float isFloor = step(abs(nd.x), -nd.y) * (1.0 - onBack);
      float isCeil = step(abs(nd.x), nd.y) * (1.0 - onBack);
      float isWall = (1.0 - onBack) * (1.0 - isFloor) * (1.0 - isCeil);

      vec3 plaster = mix(baseColor, vec3(1.0), 0.30);
      vec3 col = plaster * 0.50;
      col = mix(col, plaster * 0.36, isWall);
      col = mix(col, baseColor * 0.30, isCeil);
      // Skirting.
      col = mix(col, baseColor * 0.20, onBack * step(nd.y, -0.93));

      // The skylight, a bright slot in the ceiling.
      float sky = isCeil * step(abs(nd.x / nd.y), 0.42) * step(1.10, nd.y) * step(nd.y, 1.55);
      col = mix(col, mix(baseColor, vec3(1.0), 0.88), sky);

      // Floor: pale boards toward the back.
      float lane = nd.x / max(-nd.y, 0.001) * 4.0;
      float seam = smoothstep(0.10, 0.0, abs(fract(lane) - 0.5) - 0.42);
      vec3 floorCol = mix(baseColor * 0.26, baseColor * 0.38, smoothstep(-1.7, -1.0, nd.y));
      floorCol = mix(floorCol, baseColor * 0.16, seam * 0.7);
      col = mix(col, floorCol, isFloor);

      // Two pictures, hung at eye height.
      for (int i = 0; i < 2; i++) {
        float sx = float(i) * 2.0 - 1.0;
        vec2 pc = vec2(0.5 + sx * 0.215, 0.620);
        vec2 pd = abs(uv - pc) - vec2(0.062, 0.078);
        float pb = max(pd.x, pd.y);
        float inner = step(pb, -0.012);
        vec3 pic = mix(baseColor * 0.22, mix(baseColor, vec3(1.0), 0.30) * 0.78, step(pc.y - 0.012 + 0.35 * sx * (uv.x - pc.x), uv.y));
        col = mix(col, baseColor * 0.14, step(pb, 0.0) * onBack);
        col = mix(col, pic, inner * onBack);
      }

      // The skylight's pool on the floor, and the cloud's shadow in it.
      vec2 pool = (uv - vec2(0.5, 0.150)) / vec2(0.300, 0.075);
      col = mix(col, mix(baseColor, vec3(1.0), 0.45) * 0.72, smoothstep(1.0, 0.2, length(pool)) * isFloor * 0.75);
      // The shadow is the cloud's own shape, laid flat under it.
      float cs = icCloud(vec2((uv.x - 0.5) * 1.05, (uv.y - 0.150) * 3.6 + 0.020));
      col *= 1.0 - 0.42 * smoothstep(0.035, -0.030, cs) * isFloor;

      // The shaft of light between them, which the cloud stands in.
      float shaftHalf = mix(0.30, 0.105, smoothstep(0.15, 1.0, uv.y));
      float shaft = smoothstep(shaftHalf, shaftHalf - 0.06, abs(uv.x - 0.5)) * smoothstep(0.12, 0.30, uv.y);
      col += mix(baseColor, vec3(1.0), 0.6) * shaft * 0.07;

      // ── the cloud ────────────────────────────────────────────────────────
      vec2 p = uv - vec2(0.5, 0.560);
      float churn = srFbm(p * 7.0 + vec2(time * 0.22, -time * 0.15));
      float cd = icCloud(p) + 0.030 * (churn - 0.5);
      float cloud = smoothstep(0.004, -0.004, cd);
      // Lit from the skylight: white crowns, a grey belly where it rains.
      float lit = smoothstep(-0.060, 0.030, p.y + 0.12 * (churn - 0.5));
      vec3 cloudCol = mix(mix(baseColor * 0.30, baseColor * 0.50, churn), mix(baseColor, vec3(1.0), 0.90), lit);
      cloudCol *= 1.0 - 0.18 * smoothstep(-0.020, 0.0, cd);

      // Rain, from the base down to just above a floor it never reaches.
      float rain = 0.0;
      for (int i = 0; i < 7; i++) {
        float fi = float(i);
        float rx = 0.5 + (fi - 3.0) * 0.034 + 0.008 * sin(fi * 3.7);
        float ph = fract(time * 0.85 + fi * 0.37);
        float ry = 0.505 - ph * 0.320;
        float streak = smoothstep(0.0045, 0.0015, abs(uv.x - rx)) * step(ry, uv.y) * step(uv.y, ry + 0.055);
        rain += streak * smoothstep(0.190, 0.270, ry) * smoothstep(ry, ry + 0.055, uv.y);
      }
      col = mix(col, mix(baseColor, vec3(1.0), 0.70), clamp(rain, 0.0, 1.0) * 0.9 * (1.0 - cloud));
      col = mix(col, cloudCol, cloud);

      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,
};
