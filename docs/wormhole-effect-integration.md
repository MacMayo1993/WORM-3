# Wormhole Effect Integration Notes

I could not directly fetch `https://github.com/bobbyroe/wormhole-effect/blob/master/index.js` from this container because outbound GitHub requests return HTTP 403.

To keep momentum, this repo now includes a compatible *star-streak wormhole* layer that matches the usual structure of `index.js`-style wormhole demos:

1. **Particle field in a cylindrical volume** around the travel axis.
2. **Continuous z-axis wrap** to simulate forward movement.
3. **Intensity + point-size ramping** during active tunnel phases.
4. **Additive blending** for a glow-heavy sci-fi look.

## Where it is wired in WORM-3

- `src/3d/WormholeWarpFX.jsx`
  - New component that renders animated points centered on the cube core.
  - Boosts speed/opacity when worm phase is `entering`, `tunnel`, or `exiting`.
- `src/3d/GameScene.jsx`
  - Mounted globally in the 3D scene.
  - Enabled when tunnel visualization is on (`showTunnels`) or worm healer mode is active.

## Tuning knobs

`WormholeWarpFX` props:

- `count` (default `850`) → more points = denser tunnel
- `radius` (default `2.0`) → tunnel width
- `depth` (default `8.0`) → how long the streak volume feels

Phase mapping is in `PHASE_BOOST` inside the component.

## If you want a 1:1 port from bobbyroe/wormhole-effect

When GitHub access is available, compare these pieces from that `index.js` and map them directly:

- random point/spawn distribution
- per-frame motion update and wrap logic
- color ramp / alpha curve
- camera coupling logic (if any)

Then replace the internals of `WormholeWarpFX` while keeping the `GameScene` integration points.
