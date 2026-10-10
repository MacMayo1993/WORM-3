// The Möbius band's living charge: two opposite forces that pull toward each
// other through the cube and are drawn back out to the flipped tiles.
//
// Each half of the band carries its own tile's colour and behaves like a pole of
// opposite charge. On every heartbeat:
//   1. inbound   — a comet of charge leaves each mouth and accelerates toward the
//                  core, the two arriving together (attraction quickens near it,
//                  and the core end glows as they close in);
//   2. contact   — where they meet the band flashes with both colours, and each
//                  half bleeds a little of its partner's colour at the core docks;
//   3. outbound  — a rebound wave carries the PARTNER's colour back out, speeding
//                  up as it is drawn to the flipped tile, and flares at its mouth.
// Between beats, fine chevrons keep streaming inward along both halves.
//
// Everything is in the fragment stage, from uniforms the band already has
// (time, colours, the core crossing) plus four cheap ones, so it adds no draw,
// no geometry and no per-frame CPU. The clock is the band's own uTime, which
// stops on pause and for reduced motion, freezing the field in place.

import { Vector2 } from 'three';

export const TUNNEL_ENERGY_BEAT = 2.6; // seconds per heartbeat

/** Stable 0..1 phase offset per tunnel, so the cube's bands do not beat in lockstep. */
export function tunnelEnergySeed(id = '') {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
}

export const makeTunnelEnergyUniforms = () => ({
  uEnergySeed: { value: 0 },
  // Overall strength: dimmed with the band, eased while the lens rides inside it.
  uEnergyGain: { value: 1 },
  uTunnelLength: { value: 1 },
  // Which mouths sit on a flipped tile (x = tile A, y = tile B). The rebound is
  // drawn to those; a pair with neither flipped draws to both.
  uEnergyDrawn: { value: new Vector2(1, 1) },
});

export const tunnelEnergyGLSL = `
  uniform float uEnergySeed, uEnergyGain, uTunnelLength;
  uniform vec2 uEnergyDrawn;

  float energyLine(float phase, float width) {
    float aa = max(fwidth(phase), 0.002);
    float d = abs(fract(phase) - 0.5);
    // Fades out where the pattern is too fine to resolve rather than shimmering.
    return (1.0 - smoothstep(width, width + aa, d)) * (1.0 - smoothstep(0.15, 0.45, aa));
  }

  // trip: 0 at tile A, 1 at tile B. core: where the halves meet. across: 0..1 over
  // the band. distance: arc length from tile A. Returns light to add, in the
  // band's own colours; 'bleed' is how far the base colour leans to the partner.
  vec3 tunnelEnergy(float trip, float core, float across, float distance, float time,
                    vec3 colorA, vec3 colorB, out float bleed) {
    bool sideA = trip < core;
    vec3 own = sideA ? colorA : colorB;
    vec3 partner = sideA ? colorB : colorA;
    float drawn = sideA ? uEnergyDrawn.x : uEnergyDrawn.y;
    // x: 0 at this half's mouth, 1 at the core. Measured in world units too.
    float x = clamp(sideA ? trip / max(core, 0.0001) : (1.0 - trip) / max(1.0 - core, 0.0001), 0.0, 1.0);
    float fromMouth = sideA ? distance : uTunnelLength - distance;

    float beat = fract(time / ${TUNNEL_ENERGY_BEAT.toFixed(2)} + uEnergySeed);

    // 1. Inbound comet, accelerating into the core over the first half beat.
    float pin = clamp(beat / 0.5, 0.0, 1.0);
    float headIn = pin * pin;
    float behind = max(headIn - x, 0.0), ahead = max(x - headIn, 0.0);
    float inbound = exp(-ahead / 0.02) * exp(-behind / 0.16)
                  * smoothstep(0.0, 0.08, beat) * (1.0 - step(0.5, beat));
    float head = exp(-abs(x - headIn) / 0.025) * step(beat, 0.5);
    // The core end glows as the comets close in: the pull before they touch.
    float pull = headIn * headIn * headIn * exp(-(1.0 - x) / 0.12) * (1.0 - step(0.5, beat));

    // 2. Contact: a quick flash at the core end as both comets arrive.
    float flashT = beat - 0.5;
    float flash = flashT < 0.0 ? 0.0 : exp(-flashT / 0.09) * (1.0 - exp(-flashT / 0.012));
    float contact = flash * exp(-(1.0 - x) / 0.14);

    // 3. Outbound rebound in the partner's colour, drawn ever faster to the tile.
    float pout = clamp((beat - 0.52) / 0.48, 0.0, 1.0);
    float headOut = 1.0 - pout * pout;
    float dOut = (x - headOut) / 0.09;
    float outbound = exp(-dOut * dOut) * step(0.52, beat)
                   * (1.0 - smoothstep(0.92, 1.0, pout)) * drawn;
    float arrive = smoothstep(0.72, 0.96, pout) * (1.0 - smoothstep(0.96, 1.0, pout));
    float mouth = exp(-x / 0.08) * arrive * drawn;

    // Between beats: chevrons streaming inward, their tips leading to the core.
    float chevron = fromMouth * 3.2 + abs(across - 0.5) * 0.9 - time * 1.35;
    float stream = energyLine(chevron, 0.1) * (0.45 + 0.55 * smoothstep(0.0, 0.5, 1.0 - abs(beat - 0.3) * 2.0));
    stream *= smoothstep(0.0, 0.06, x) * (1.0 - smoothstep(0.93, 1.0, x));

    vec3 hotOwn = mix(own, vec3(1.0), 0.55);
    vec3 hotPartner = mix(partner, vec3(1.0), 0.5);
    vec3 meet = mix(hotOwn, hotPartner, 0.5) * 1.25;

    bleed = exp(-(1.0 - x) / 0.1) * (0.22 + 0.5 * flash);
    vec3 light = own * (stream * 0.3 + inbound * 0.7 + pull * 0.5)
               + vec3(1.0) * head * 0.45
               + meet * contact * 1.1
               + hotPartner * outbound * 0.75
               + mix(hotOwn, hotPartner, 0.4) * mouth * 1.0;
    return light * uEnergyGain;
  }
`;
