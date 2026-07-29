// src/worm/healerWorm/SliceWarningLights.jsx
// The "these layers are about to turn" warning in healer worm mode.
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
// A wave can threaten up to three parallel layers at once, so one highlight is
// drawn per plane. They share an axis — that is what makes them one wave — and
// the shared axis is legible from the geometry alone, since every rim encircles
// the cube the same way. What is NOT legible from geometry is which streamer
// belongs to which layer when two of them turn opposite ways, so each plane gets
// its own tint from a fixed, order-stable palette.
import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import LayerHighlight from '../../teach/LayerHighlight.jsx';

// Warm gold (the established "this layer, this way" colour) first, so a normal
// single-plane warning looks exactly as it always has. The second and third are
// pulled far enough apart in hue to be told apart at a glance while still
// reading as warning light rather than decoration.
const PLANE_TINTS = [
  { deep: '#ff9c1c', core: '#ffe7ae' }, // gold
  { deep: '#1ca8ff', core: '#c2e9ff' }, // cyan
  { deep: '#ff4fd8', core: '#ffd0f4' }, // magenta
];

export function SliceWarningLights({ pendingWaveRef, size }) {
    // The warning lives in a ref (written from the mode's own frame loop), but
    // LayerHighlight is declarative — mirror the ref into state, and only when the
    // threatened wave actually changes so we re-render once per warning, not per frame.
    const [pending, setPending] = useState(null);
    const lastKeyRef = useRef(null);

    useFrame(() => {
        const w = pendingWaveRef.current;
        const key = w
            ? `${w.axis}|${w.rotations.map(r => `${r.sliceIndex}:${r.dir}:${r.numTurns ?? 1}`).join(',')}`
            : null;
        if (key === lastKeyRef.current) return;
        lastKeyRef.current = key;
        setPending(w ? { axis: w.axis, rotations: w.rotations.map(r => ({ ...r })) } : null);
    });

    if (!pending) return null;

    return (
        <>
            {pending.rotations.map((r, i) => (
                <LayerHighlight
                    key={`${pending.axis}-${r.sliceIndex}`}
                    axis={pending.axis}
                    sliceIndex={r.sliceIndex}
                    dir={r.dir}
                    size={size}
                    deep={PLANE_TINTS[i % PLANE_TINTS.length].deep}
                    core={PLANE_TINTS[i % PLANE_TINTS.length].core}
                />
            ))}
        </>
    );
}
