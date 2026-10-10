import React from 'react';
import { TileSurfaceInstance } from './TileSurfaceInstances.jsx';
import { ordinaryGeometry, flippedGeometry, ordinaryMaterial, flippedMaterial } from './tileBoundaryMaterials.js';

export default function TileBoundary({ flipped }) {
    return <TileSurfaceInstance
        name={flipped ? 'flipped-tile-border' : 'tile-border'}
        position={[0, 0, 0.012]}
        geometry={flipped ? flippedGeometry : ordinaryGeometry}
        material={flipped ? flippedMaterial : ordinaryMaterial}
    />;
}
