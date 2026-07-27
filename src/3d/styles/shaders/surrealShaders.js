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
//
// Every shader takes `baseColor` (the face colour) and, when animated, `time`.
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
    ${SKY}

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
    ${SKY}

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
    ${SKY}

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
    ${SKY}

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
    ${SKY}

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
    ${SKY}

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
};
