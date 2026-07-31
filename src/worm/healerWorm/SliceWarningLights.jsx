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
import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import LayerHighlight from '../../teach/LayerHighlight.jsx';
import { useGameStore } from '../../hooks/useGameStore.js';

export function SliceWarningLights({ pendingRotRef, size }) {
    // Tint the turn warning with the player's chosen worm colour instead of the
    // solver's gold, and run it a touch softer (10% less opaque) so it reads as an
    // ambient hazard cue rather than an instructor's hint.
    const wormColor = useGameStore((s) => s.wormColor ?? '#33ff66');
    // The warning lives in a ref (written from the mode's own frame loop), but
    // LayerHighlight is declarative — mirror the ref into state, and only when the
    // threatened slice actually changes so we re-render once per warning, not per frame.
    const [pending, setPending] = useState(null);
    const lastKeyRef = useRef(null);

    useFrame(() => {
        const p = pendingRotRef.current;
        const key = p ? `${p.axis}-${(p.sliceIndices ?? [p.sliceIndex]).join(',')}-${(p.sliceDirs ?? [p.dir]).join(',')}` : null;
        if (key === lastKeyRef.current) return;
        lastKeyRef.current = key;
        setPending(p ? { axis: p.axis, sliceIndex: p.sliceIndex, sliceIndices: p.sliceIndices, sliceDirs: p.sliceDirs, dir: p.dir } : null);
    });

    if (!pending) return null;

    // One gold rim per threatened plane, each streaming in the direction that plane
    // will turn (the two hazard planes turn opposite ways).
    const indices = pending.sliceIndices?.length ? pending.sliceIndices : [pending.sliceIndex];
    const dirs = pending.sliceDirs?.length ? pending.sliceDirs : indices.map(() => pending.dir);
    return (
        <>
            {indices.map((sliceIndex, i) => (
                <LayerHighlight
                    key={sliceIndex}
                    axis={pending.axis}
                    sliceIndex={sliceIndex}
                    dir={dirs[i]}
                    size={size}
                    color={wormColor}
                    opacity={0.9}
                />
            ))}
        </>
    );
}
