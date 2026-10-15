// src/worm/healerWorm/fusionSigils.js
//
// A fusion's SIGIL: the one motif that is that recipe's alone. The reaction coat
// (fusionLooks.js) gives a fusion its family (mist, crust, flame, plasma, bloom,
// storm, flow) and its palette; the sigil is drawn into the same coat on top of the
// family so two recipes of one family never read as the same reaction: Steam's
// bubbles rising through every tile, Quench's obsidian shards glinting, Conductor's
// forks jumping across the stickers, Grounded's leaves tumbling over them.
//
// Each recipe names its sigil, colour and four numbers in FUSION_LOOKS. The sigil is
// a uniform int in the reaction program (a uniform branch, so every fragment takes the
// same path and there is no new program per recipe). The motifs are laid out in each
// sticker's own frame and kept faint over the sticker's centre, so the tile's colour
// and marks stay readable; the bright part lives toward the seams.
//
// The same sigil is the recipe's glyph in the HUD (FUSION banner, recipe guide), as an
// SVG path in a 24×24 box, so the player learns one picture per fusion.
//
// Pure: no React, no Three.

/** Sigil ids, as the reaction shader reads them (`uSigil`). */
export const SIGILS = Object.freeze({
  bubbles: 0,    // rings rising up through every tile
  shards: 1,     // obsidian triangles that glint as light sweeps over them
  snowflake: 2,  // a six-armed crystal turning on each tile
  hexfrost: 3,   // a hex lattice of frost creeping out of the seams
  forks: 4,      // a jagged discharge jumping across the tile, a new path each beat
  vortex: 5,     // spiral arms wheeling round each tile's centre
  leaves: 6,     // leaves tumbling across the faces
  veins: 7,      // molten veins pulsing through a cracked network
  runes: 8,      // circuit traces with a pulse running along them
  ripples: 9,    // rings spreading from each tile's centre
  chevrons: 10,  // arrows marching across the faces
  sunburst: 11,  // rays fanning out from the claim, a pulse running down them
  flowers: 12,   // five-petal flowers opening in the corners where tiles meet
  pulse: 13,     // sonar rings spreading out from the worm
  embers: 14,    // sparks rising up the faces, flickering
  droplets: 15,  // drips running down the faces
  wisps: 16,     // long curling streamers of wind
  stars: 17,     // four-pointed stars twinkling on and off
});

/**
 * The HUD glyph for each sigil: SVG path data in a 24×24 box, stroked (round caps).
 * Kept simple enough to read at 14 px.
 */
export const SIGIL_ICONS = Object.freeze({
  bubbles: 'M8 17a3 3 0 1 0 0.01 0M15 11a2.2 2.2 0 1 0 0.01 0M11 5.5a1.5 1.5 0 1 0 0.01 0',
  shards: 'M4 19 9 5l4 9zM13 14l3-9 4 13zM9 5l4 9',
  snowflake: 'M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9M12 7l-2-2M12 7l2-2M12 17l-2 2M12 17l2 2',
  hexfrost: 'M12 3l7 4v8l-7 4-7-4V7zM12 3v4M19 7l-3.5 2M19 15l-3.5-2M12 19v-4M5 15l3.5-2M5 7l3.5 2',
  forks: 'M13 2 7 12h5l-3 10 8-12h-5l3-8z',
  vortex: 'M12 12m-1.5 0a1.5 1.5 0 1 0 3 0a3.5 3.5 0 1 0-7 0a5.5 5.5 0 1 0 11 0a7.5 7.5 0 1 0-15 0',
  leaves: 'M5 19C5 10 11 5 19 5c0 8-5 14-14 14zM5 19l9-9',
  veins: 'M3 12h4l3-5 3 10 3-6h5M10 7l-2-3M13 17l2 3',
  runes: 'M4 6h6v6h6v6M10 6V3M16 12h4M4 18h4M8 18v-3',
  ripples: 'M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0M12 12m-5.5 0a5.5 5.5 0 1 0 11 0a5.5 5.5 0 1 0-11 0M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0',
  chevrons: 'M4 6l6 6-6 6M12 6l6 6-6 6',
  sunburst: 'M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M19 5l-3 3M8 16l-3 3',
  flowers: 'M12 12m-1.6 0a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0M12 10.4C9 4 15 4 12 10.4M13.5 11.5c6-3 8 2 1.4 2M13 13.6c3 6-2.6 7-2 1M11 13.6c-3 6 2.6 7 2 1M10.5 11.5c-6-3-8 2-1.4 2',
  pulse: 'M12 12m-1.5 0a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0M7 7a7 7 0 0 0 0 10M17 7a7 7 0 0 1 0 10M4 4a11 11 0 0 0 0 16M20 4a11 11 0 0 1 0 16',
  embers: 'M8 20c-2-3 0-5 0-8 2 2 3 4 2 8M15 15c-1-2 0-3 0-5 1.5 1 2 3 1 5M12 7v.01M17 4v.01M6 8v.01',
  droplets: 'M7 4c-2 4-3 6-3 7.5a3 3 0 0 0 6 0C10 10 9 8 7 4zM17 9c-2 4-3 6-3 7.5a3 3 0 0 0 6 0C20 15 19 13 17 9z',
  wisps: 'M3 8c4-3 8 3 12 0s5-2 6 0M3 14c5-3 9 3 13 0M5 20c3-2 6 1 9-1',
  stars: 'M9 3v8M5 7h8M17 12v8M13 16h8M5 17v.01M19 5v.01',
});

/** A recipe's sigil id for the shader, or -1 when it has none. */
export const sigilIdOf = name => SIGILS[name] ?? -1;

/**
 * The sigil block of the reaction coat's fragment shader. Expects GLSL_NOISE and the
 * surface's `worleyCell` above it. `p` is the point in its sticker's frame (−0.5..0.5),
 * `cellC` the sticker's centre on the face lattice (stable per tile), `seamD` the
 * distance to the nearest seam, `world` the world point, `faceN` the face normal and
 * `wormD` the distance to the worm's body. Returns the motif's brightness, ≥ 0.
 */
export const GLSL_SIGILS = /* glsl */ `
  uniform int uSigil;
  uniform vec3 uSigilColor;
  // (scale, speed, density, strength)
  uniform vec4 uSigilParams;

  float sgSeg(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
    return length(pa - ba * h);
  }
  // smoothstep is undefined in GLSL ES when edge0 >= edge1, and strict mobile drivers
  // really do return garbage for it: write a falling edge as 1.0 - smoothstep(lo, hi, x).
  float sgLine(float d, float w) { return 1.0 - smoothstep(w * 0.45, w, d); }
  mat2 sgRot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

  float sigilAt(vec2 p, vec2 cellC, float seamD, vec3 world, vec3 faceN, float wormD, float T) {
    float sc = uSigilParams.x;
    float sp = uSigilParams.y;
    float den = uSigilParams.z;
    vec2 cid = cellC * 1.37 + faceN.xy * 17.0 + faceN.z * 31.0;
    float ch = hash12(cid);
    float s = 0.0;
    if (uSigil == 0) {
      // BUBBLES — rings rising up through the tile, each on its own clock.
      for (int i = 0; i < 4; i++) {
        float fi = float(i);
        float h = hash12(cid + fi * 7.13);
        if (h > den) continue;
        float y = fract(h * 13.7 + T * sp * 0.22 + fi * 0.27);
        vec2 c = vec2((hash12(cid + fi * 3.1) - 0.5) * 0.7 + sin(T * 2.0 + h * 9.0) * 0.04, y * 1.2 - 0.6);
        float r = (0.04 + 0.06 * fract(h * 31.0)) * sc;
        float ring = sgLine(abs(length(p - c) - r), 0.03);
        float hi = exp(-dot(p - c + vec2(r * 0.4, -r * 0.4), p - c + vec2(r * 0.4, -r * 0.4)) / (r * r * 0.08));
        s = max(s, (ring + hi * 0.6) * (1.0 - smoothstep(0.75, 1.0, y)) * smoothstep(0.0, 0.1, y));
      }
    } else if (uSigil == 1) {
      // SHARDS — obsidian triangles, each catching the light as a sweep crosses it.
      vec2 q = p * sc * 3.0;
      vec2 qi = floor(q);
      float h = hash12(qi + cid * 3.0);
      vec2 qf = sgRot(h * 6.2832) * (fract(q) - 0.5);
      float tri = max(abs(qf.x) * 0.866 + qf.y * 0.5, -qf.y) - 0.24;
      float glint = pow(0.5 + 0.5 * sin(dot(world, vec3(1.3, 0.7, 1.1)) * 2.5 - T * sp * 2.0 + h * 6.0), 10.0);
      float on = step(1.0 - den, h);
      s = on * ((1.0 - smoothstep(-0.03, 0.0, tri)) * (0.12 + glint * 1.4) + sgLine(abs(tri), 0.035) * 0.5);
    } else if (uSigil == 2) {
      // SNOWFLAKE — a six-armed crystal turning on the tile, twinkling.
      vec2 c = (hash22(cid) - 0.5) * 0.25;
      vec2 q = sgRot(T * sp * 0.4 + ch * 6.2832) * (p - c);
      float r = length(q);
      float ang = mod(atan(q.y, q.x), 1.0472) - 0.5236;
      vec2 f = vec2(cos(ang), abs(sin(ang))) * r;
      float R = 0.26 * sc;
      float d = min(sgSeg(f, vec2(0.0), vec2(R, 0.0)), sgSeg(f, vec2(R * 0.5, 0.0), vec2(R * 0.72, R * 0.18)));
      d = min(d, sgSeg(f, vec2(R * 0.25, 0.0), vec2(R * 0.38, R * 0.11)));
      float tw = 0.6 + 0.4 * sin(T * sp * 3.0 + ch * 20.0);
      s = sgLine(d, 0.022) * tw * step(1.0 - den, fract(ch * 7.0) + 0.001);
    } else if (uSigil == 3) {
      // HEXFROST — a hex lattice of frost creeping in from the seams and back.
      vec2 q = (p + cellC) * sc * 4.0;
      const vec2 hs = vec2(1.0, 1.7320508);
      vec4 hc = floor(vec4(q, q - vec2(0.5, 1.0)) / hs.xyxy) + 0.5;
      vec4 hq = vec4(q - hc.xy * hs, q - (hc.zw + 0.5) * hs);
      vec2 hl = dot(hq.xy, hq.xy) < dot(hq.zw, hq.zw) ? hq.xy : hq.zw;
      float edge = 0.5 - max(dot(abs(hl), vec2(0.5, 0.8660254)), abs(hl.x));
      float reach = 0.16 + 0.3 * (0.5 + 0.5 * sin(T * sp * 0.8 + ch * 6.0)) * den * 1.6;
      s = (sgLine(edge, 0.07) * 1.2 + (1.0 - smoothstep(0.0, 0.06, edge)) * 0.2) * (1.0 - smoothstep(reach * 0.55, reach, seamD));
    } else if (uSigil == 4) {
      // FORKS — a discharge jumps across the tile on a fresh path every beat.
      float beat = floor(T * sp * 2.5 + ch * 11.0);
      float flash = 1.0 - fract(T * sp * 2.5 + ch * 11.0);
      vec2 q = sgRot(floor(hash12(cid + beat) * 4.0) * 1.5708) * p;
      float d = 9.0;
      vec2 prev = vec2(-0.55, (hash12(vec2(beat, 1.0) + cid) - 0.5) * 0.4);
      for (int i = 1; i <= 6; i++) {
        float fi = float(i);
        vec2 next = vec2(-0.55 + fi * 0.183, (hash12(vec2(beat, fi + 1.0) + cid) - 0.5) * 0.5 * sc);
        d = min(d, sgSeg(q, prev, next));
        if (i == 3) d = min(d, sgSeg(q, next, next + vec2(0.16, (hash12(cid + beat * 3.0) - 0.5) * 0.5)) * 1.4);
        prev = next;
      }
      s = (sgLine(d, 0.03) * 1.8 + exp(-d * 24.0) * 0.6) * (0.25 + flash * 1.2) * step(1.0 - den, hash12(cid + beat * 0.7));
    } else if (uSigil == 5) {
      // VORTEX — spiral arms wheeling round the tile's centre.
      float r = length(p);
      float ang = atan(p.y, p.x);
      float arms = sin(ang * 3.0 + r * 20.0 * sc - T * sp * 3.0 + ch * 6.0);
      s = pow(0.5 + 0.5 * arms, 8.0) * (1.0 - smoothstep(0.12, 0.55, r)) * (0.4 + den);
    } else if (uSigil == 6) {
      // LEAVES — leaves tumbling across the faces on the breeze.
      vec2 q = (p + cellC) * sc * 1.6 + vec2(T * sp * 0.35, sin(T * sp * 0.6) * 0.3);
      vec2 qi = floor(q);
      float h = hash12(qi + faceN.xy * 5.0 + faceN.z * 9.0);
      vec2 qf = sgRot(h * 6.2832 + T * sp * (h - 0.5) * 2.0) * ((fract(q) - 0.5) - (hash22(qi) - 0.5) * 0.3);
      float leaf = length(vec2(abs(qf.x) + 0.16, qf.y)) - 0.3;
      float rib = sgLine(abs(qf.x), 0.025) * step(abs(qf.y), 0.18);
      s = step(1.0 - den, h) * ((1.0 - smoothstep(-0.02, 0.0, leaf)) * 0.55 + rib * 0.6 + sgLine(abs(leaf), 0.03) * 0.5);
    } else if (uSigil == 7) {
      // VEINS — molten seams in a cracked network, a pulse travelling along them.
      vec3 wc = worleyCell(world * sc * 2.4);
      float vein = 1.0 - smoothstep(0.0, 0.05, wc.y - wc.x);
      float flow = 0.35 + 0.65 * pow(0.5 + 0.5 * sin(wc.x * 18.0 - T * sp * 4.0 + wc.z * 6.0), 3.0);
      s = vein * flow * (0.5 + den);
    } else if (uSigil == 8) {
      // RUNES — circuit traces with pads, a charge running along them.
      vec2 q = (p + cellC) * sc * 4.0;
      vec2 qi = floor(q);
      vec2 qf = fract(q) - 0.5;
      float h = hash12(qi + faceN.xy * 3.0 + faceN.z * 7.0);
      float d = h < 0.5 ? abs(qf.y) : abs(qf.x);
      float along = h < 0.5 ? q.x : q.y;
      float trace = sgLine(d, 0.07) * step(1.0 - den, fract(h * 9.0));
      float pad = sgLine(abs(length(qf) - 0.16), 0.06) * step(0.82, fract(h * 23.0));
      float run = pow(0.5 + 0.5 * sin(along * 3.0 - T * sp * 5.0 + h * 6.0), 12.0);
      s = trace * (0.3 + run * 1.6) + pad * (0.6 + run);
    } else if (uSigil == 9) {
      // RIPPLES — rings spreading out from the tile's centre.
      float r = length(p);
      float ring = sin(r * 30.0 * sc - T * sp * 4.0 + ch * 6.0);
      s = pow(max(ring, 0.0), 10.0) * (1.0 - smoothstep(0.12, 0.58, r)) * (0.5 + den);
    } else if (uSigil == 10) {
      // CHEVRONS — arrows marching across the face.
      vec2 q = (p + cellC) * sc * 3.0;
      float x = q.x - T * sp * 1.8 + abs(fract(q.y) - 0.5) * 1.2;
      float d = abs(fract(x) - 0.5);
      s = sgLine(d, 0.09) * step(1.0 - den, hash12(vec2(floor(x), floor(q.y)) + cid * 0.1) + 0.2);
    } else if (uSigil == 11) {
      // SUNBURST — rays fanning out from where the fusion was claimed.
      vec3 d3 = world - uClaimOrigin.xyz;
      vec3 t1 = normalize(cross(faceN, abs(faceN.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
      vec3 t2 = cross(faceN, t1);
      float ang = atan(dot(d3, t2), dot(d3, t1));
      float len = length(d3);
      float rays = pow(0.5 + 0.5 * sin(ang * 12.0 * sc + T * sp * 0.5), 14.0);
      float run = 0.3 + 0.7 * pow(0.5 + 0.5 * sin(len * 5.0 - T * sp * 3.0), 4.0);
      s = rays * run * (0.5 + den);
    } else if (uSigil == 12) {
      // FLOWERS — five-petal flowers opening in the corners where tiles meet.
      vec2 corner = sign(p) * 0.5;
      vec2 q = p - corner;
      float h = hash12(cellC + corner + faceN.xy * 3.0 + faceN.z * 7.0);
      q = sgRot(h * 6.2832 + T * sp * 0.3) * q;
      float r = length(q);
      float ang = atan(q.y, q.x);
      float open = 0.75 + 0.25 * sin(T * sp * 1.5 + h * 9.0);
      float petal = 1.0 - smoothstep(0.0, 0.025, r - 0.26 * sc * open * (0.5 + 0.5 * cos(ang * 5.0)));
      float heart = 1.0 - smoothstep(0.045, 0.065, r);
      s = (petal * 0.85 + sgLine(abs(r - 0.26 * sc * open * (0.5 + 0.5 * cos(ang * 5.0))), 0.03) * 0.5 + heart * 1.1) * step(1.0 - den, h);
    } else if (uSigil == 13) {
      // PULSE — sonar rings spreading out from the worm.
      float ring = sin(wormD * 12.0 * sc - T * sp * 5.0);
      s = pow(max(ring, 0.0), 14.0) * exp(-wormD * 0.55) * (0.6 + den);
    } else if (uSigil == 14) {
      // EMBERS — sparks rising up the faces, flickering out.
      vec2 q = (p + cellC) * sc * 4.0 + vec2(0.0, -T * sp * 1.2);
      vec2 qi = floor(q);
      float h = hash12(qi + faceN.xy * 5.0 + faceN.z * 11.0);
      vec2 c = (hash22(qi + 3.0) - 0.5) * 0.6;
      vec2 qf = fract(q) - 0.5 - c;
      float flick = 0.5 + 0.5 * sin(T * 9.0 * sp + h * 30.0);
      s = exp(-dot(qf * vec2(1.6, 0.8), qf * vec2(1.6, 0.8)) * 90.0) * step(1.0 - den, h) * (0.5 + flick);
    } else if (uSigil == 15) {
      // DROPLETS — drips running down the faces, each trailing a wet streak.
      vec2 q = (p + cellC) * sc * vec2(4.0, 1.2);
      float col = floor(q.x);
      float h = hash12(vec2(col, 3.7) + faceN.xy * 5.0 + faceN.z * 9.0);
      float y = fract(q.y + T * sp * (0.4 + h * 0.5) + h * 7.0);
      float x = abs(fract(q.x) - 0.5);
      float head = exp(-(x * x * 120.0 + (y - 0.06) * (y - 0.06) * 260.0));
      float trail = sgLine(x, 0.07) * (1.0 - smoothstep(0.06, 0.7, y)) * step(0.06, y) * 0.7;
      s = (head * 1.8 + trail) * step(1.0 - den, h);
    } else if (uSigil == 16) {
      // WISPS — long curling streamers of wind sweeping over the cube.
      float curl = sin(dot(world, vec3(-0.8, 1.5, 0.6)) * 1.6 + T * sp * 0.9) * 1.6;
      float band = dot(world, vec3(1.2, 0.5, -0.9)) * 3.0 * sc - T * sp * 2.2 + curl;
      s = pow(0.5 + 0.5 * sin(band), 26.0) * (0.5 + den) + pow(0.5 + 0.5 * sin(band * 2.0 + 1.3), 40.0) * 0.4;
    } else if (uSigil == 17) {
      // STARS — four-pointed stars twinkling on and off.
      vec2 q = (p + cellC) * sc * 3.0;
      vec2 qi = floor(q);
      float h = hash12(qi + faceN.xy * 7.0 + faceN.z * 13.0);
      vec2 qf = fract(q) - 0.5 - (hash22(qi + 5.0) - 0.5) * 0.5;
      float tw = 0.3 + 0.7 * pow(max(sin(T * sp * 2.5 + h * 40.0), 0.0), 3.0);
      float star = exp(-abs(qf.x) * 40.0) * exp(-abs(qf.y) * 6.0) + exp(-abs(qf.y) * 40.0) * exp(-abs(qf.x) * 6.0);
      s = (star + exp(-dot(qf, qf) * 200.0)) * tw * step(1.0 - den, h) * 1.8;
    }
    // Faint over the sticker's own centre, where its colour and marks live.
    float rim = max(abs(p.x), abs(p.y));
    return s * mix(0.35, 1.0, smoothstep(0.12, 0.34, rim));
  }
`;
