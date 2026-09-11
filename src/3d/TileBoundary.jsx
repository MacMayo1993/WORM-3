import React from 'react';
import * as THREE from 'three';

// Shared, static geometry: only the perimeter is drawn, leaving the sticker,
// portal aperture and theme artwork unobstructed. No per-frame animation.
function perimeter(outer, inner) {
    const shape = new THREE.Shape();
    shape.moveTo(-outer, -outer);
    shape.lineTo(outer, -outer);
    shape.lineTo(outer, outer);
    shape.lineTo(-outer, outer);
    shape.closePath();
    const hole = new THREE.Path();
    hole.moveTo(-inner, -inner);
    hole.lineTo(-inner, inner);
    hole.lineTo(inner, inner);
    hole.lineTo(inner, -inner);
    hole.closePath();
    shape.holes.push(hole);
    return new THREE.ShapeGeometry(shape);
}

const ordinaryGeometry = perimeter(0.443, 0.425);
const flippedGeometry = perimeter(0.465, 0.397);
const vertexShader = `
varying vec2 tilePosition;
void main() {
    tilePosition = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const ordinaryMaterial = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader: `
varying vec2 tilePosition;
void main() {
    // A thin light inner lip against a dark seam reads on both dark and pale themes.
    float edge = max(abs(tilePosition.x), abs(tilePosition.y));
    float lip = 1.0 - smoothstep(0.429, 0.432, edge);
    gl_FragColor = vec4(mix(vec3(0.055), vec3(0.52), lip), 1.0);
}`,
    side: THREE.DoubleSide,
    toneMapped: false,
});
const flippedMaterial = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader: `
varying vec2 tilePosition;
void main() {
    float edge = max(abs(tilePosition.x), abs(tilePosition.y));
    float phase = (tilePosition.x + tilePosition.y) * 9.0;
    float wave = sin(phase * 6.2831853);
    float aa = max(fwidth(wave), 0.01);
    float stripe = smoothstep(-aa, aa, wave);
    vec3 color = mix(vec3(0.025), vec3(1.0, 0.76, 0.055), stripe);
    // Dark keylines retain the boundary against yellow tiles and bright effects.
    float band = smoothstep(0.398, 0.405, edge) * (1.0 - smoothstep(0.455, 0.464, edge));
    gl_FragColor = vec4(mix(vec3(0.025), color, band), 1.0);
}`,
    side: THREE.DoubleSide,
    toneMapped: false,
});

export default function TileBoundary({ flipped }) {
    return <mesh
        position={[0, 0, 0.012]}
        geometry={flipped ? flippedGeometry : ordinaryGeometry}
        material={flipped ? flippedMaterial : ordinaryMaterial}
        dispose={null}
    />;
}
