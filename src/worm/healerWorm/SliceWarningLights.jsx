// src/worm/healerWorm/SliceWarningLights.jsx
// The "this layer is about to turn" warning in healer worm mode.
//
// It used to be alarm-panel chrome: a spinning rainbow torus encircling the
// cube, a black rim around it, a red slab strobing and rattling over the layer,
// and six strobing point lights. That read as UI bolted onto the scene.
//
// It now uses the same in-world guidance the Kociemba solver draws — LayerHighlight's
// gold rim on the threatened slice's own tiles, with comet streamers orbiting it in
// the direction the layer will turn. Same visual language across the game: gold light
// on a layer means "this layer, this way".
//
// The layer is lit for the whole cycle, not just the last few seconds: the mode
// arms the next move the moment the previous one commits (see HealerWormMode), so
// the player can see which slice is coming while there is still time to leave it.
// What changes over the cycle is how hard it burns — a steady low glow while the
// turn is far off, then a ramp through the telegraph window ending in a pulse on
// the beat. That ramp is driven straight into the shader's alpha from a ref, so a
// warning that runs for ten seconds still costs the one render it always did.
import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import LayerHighlight from '../../teach/LayerHighlight.jsx';
import { useGameStore } from '../../hooks/useGameStore.js';
import { getSkin } from '../wormCosmeticsData.js';
import { fxBudget } from './fxBudget.js';
import { chooseSafeLane } from './safeLane.js';
import { SAFE_LANE_MAX_SIZE } from './constants.js';

// Which tier this board's warning runs at is the fx budget's call, not this
// file's — see fxBudget.js for why Mega gives the spectacle up.
// Alpha at each end of the cycle. The floor has to carry across a busy cube from
// the chase camera — a hint you cannot find is not a warning — and the ceiling
// goes past 1 deliberately: the shader multiplies its clamped glow by this, so
// over-driving it is what turns a rim into a hazard light.
const IDLE_ALPHA = 0.8;
const PEAK_ALPHA = 1.9;
// Rim thickness on the slice's own tiles. The solver's hint runs at 1; the hazard
// wants to be seen past the worm, the orbs and whatever the elemental skin is
// doing to the same tiles. A lite rim carries the whole warning on its own, so it
// burns a little harder still.
const RIM_GAIN = 2.1;
const RIM_GAIN_LITE = 2.6;

// ─── Safe lane ────────────────────────────────────────────────────────────────
// The gold rim answers "where is the danger". On a 2x2 or 3x3 that is not enough:
// a turn catches any given tile with probability 1/N, so half the 2x2 is about to
// move, and the player needs the other half pointed out while there is still time
// to run for it. The complement of a slice is an awkward shape, but any OTHER
// slice on the same axis is entirely safe and is itself a slice — so the same
// LayerHighlight draws it, with no new geometry. See safeLane.js.
//
// A fixed cool cyan, deliberately not the worm's colour: the hazard rim is already
// tinted with the equipped skin, and on a green skin a green safe lane would read
// as the same signal twice. Cyan is used nowhere else on the cube.
const SAFE_COLOR = '#3fe0d0';
// Dimmer than the hazard at both ends, and it brightens on the same ramp so the
// two rims read as one sentence — "not here, there" — getting more urgent together.
// It never pulses; the beat belongs to the threat.
const SAFE_IDLE_ALPHA = 0.22;
const SAFE_PEAK_ALPHA = 0.7;
// A thin rim, well under the hazard's. The safe lane is an invitation, not an alarm,
// and it must not compete with the gold for the player's eye.
const SAFE_RIM_GAIN = 1.0;

export function SliceWarningLights({ pendingRotRef, warningProgressRef, size }) {
    // Tint the turn warning with the worm the player is actually looking at — its body
    // colour comes from the equipped skin (getSkin(...).body), the same source WormBody
    // and the tile-press use. Reading the store's wormColor pinned it to a default green
    // that no longer tracked the skin.
    const wormColor = useGameStore((s) => getSkin(s.wormSkin ?? 'slime').body);
    // The warning lives in a ref (written from the mode's own frame loop), but
    // LayerHighlight is declarative — mirror the ref into state, and only when the
    // threatened slice actually changes so we re-render once per warning, not per frame.
    const [pending, setPending] = useState(null);
    const lastKeyRef = useRef(null);
    // Live alpha, handed to every LayerHighlight below and written once a frame.
    const alphaRef = useRef(IDLE_ALPHA);
    // The safe lane's own alpha — same ramp, lower range, no pulse.
    const safeAlphaRef = useRef(SAFE_IDLE_ALPHA);

    useFrame((state) => {
        const p = pendingRotRef.current;
        // The mode arms this ref with one stable move object per warning (and nulls
        // it on reset), so identity is an exact change test. It used to build a
        // composite key string — two array allocations, two joins and a template
        // literal — on every frame of every run just to find nothing had changed.
        if (p !== lastKeyRef.current) {
            lastKeyRef.current = p;
            setPending(p ? { axis: p.axis, sliceIndex: p.sliceIndex, sliceIndices: p.sliceIndices, sliceDirs: p.sliceDirs, dir: p.dir } : null);
        }

        // Ease into the telegraph rather than stepping into it, and beat once a
        // second through the last stretch so the layer reads as counting down.
        const w = warningProgressRef?.current ?? 0;
        const ramp = w * w;
        const pulse = w > 0 ? 0.18 * w * Math.sin(state.clock.elapsedTime * 9.0) : 0;
        alphaRef.current = IDLE_ALPHA + (PEAK_ALPHA - IDLE_ALPHA) * ramp + pulse;
        safeAlphaRef.current = SAFE_IDLE_ALPHA + (SAFE_PEAK_ALPHA - SAFE_IDLE_ALPHA) * ramp;
    });

    if (!pending) return null;

    // One gold rim per threatened plane, each streaming in the direction that plane
    // will turn (the two hazard planes turn opposite ways).
    const indices = pending.sliceIndices?.length ? pending.sliceIndices : [pending.sliceIndex];
    const dirs = pending.sliceDirs?.length ? pending.sliceDirs : indices.map(() => pending.dir);
    const lite = fxBudget(size).warning === 'lite';
    // Only the small boards get a lane drawn. Above SAFE_LANE_MAX_SIZE there is
    // room to simply step off the gold, and a second full-slice rim would cost a
    // draw over an already busy cube to say something the player can see anyway.
    const safeLane = size <= SAFE_LANE_MAX_SIZE
        ? chooseSafeLane(size, { axis: pending.axis, sliceIndex: pending.sliceIndex, sliceIndices: pending.sliceIndices })
        : null;
    return (
        <>
            {safeLane && (
                <LayerHighlight
                    key={`safe-${safeLane.sliceIndex}`}
                    axis={safeLane.axis}
                    sliceIndex={safeLane.sliceIndex}
                    dir={dirs[0]}
                    size={size}
                    color={SAFE_COLOR}
                    opacityRef={safeAlphaRef}
                    gain={SAFE_RIM_GAIN}
                    lite
                />
            )}
            {indices.map((sliceIndex, i) => (
                <LayerHighlight
                    key={sliceIndex}
                    axis={pending.axis}
                    sliceIndex={sliceIndex}
                    dir={dirs[i]}
                    size={size}
                    color={wormColor}
                    opacityRef={alphaRef}
                    gain={lite ? RIM_GAIN_LITE : RIM_GAIN}
                    lite={lite}
                />
            ))}
        </>
    );
}
