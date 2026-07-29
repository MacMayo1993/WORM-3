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

export function SliceWarningLights({ pendingRotRef, size }) {
    // The warning lives in a ref (written from the mode's own frame loop), but
    // LayerHighlight is declarative — mirror the ref into state, and only when the
    // threatened slice actually changes so we re-render once per warning, not per frame.
    const [pending, setPending] = useState(null);
    const lastKeyRef = useRef(null);

    useFrame(() => {
        const p = pendingRotRef.current;
        const key = p ? `${p.axis}-${p.sliceIndex}-${p.dir}` : null;
        if (key === lastKeyRef.current) return;
        lastKeyRef.current = key;
        setPending(p ? { axis: p.axis, sliceIndex: p.sliceIndex, sliceIndices: p.sliceIndices, dir: p.dir } : null);
    });

    if (!pending) return null;

    return (
        <>
            {(pending.sliceIndices?.length ? pending.sliceIndices : [pending.sliceIndex]).map(sliceIndex => (
                <LayerHighlight key={sliceIndex} axis={pending.axis} sliceIndex={sliceIndex} dir={pending.dir} size={size} />
            ))}
        </>
    );
}
