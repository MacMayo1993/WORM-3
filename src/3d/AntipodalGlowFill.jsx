// src/3d/AntipodalGlowFill.jsx
// Antipodal glow fill effect — glows from the outside and fills inward
// when a sticker crosses the manifold. Uses persistent meshes with shared
// geometries so no per-sticker geometry allocations occur.
import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const _sharedOuterRingGeometry = new THREE.RingGeometry(0.4, 0.5, 16);
const _sharedMainRingGeometry = new THREE.RingGeometry(0.2, 0.45, 16);
const _sharedInnerCircleGeometry = new THREE.CircleGeometry(0.48, 16);

const AntipodalGlowFill = ({ active, color }) => {
    const ringRef = useRef();
    const innerGlowRef = useRef();
    const outerRingRef = useRef();
    const progressRef = useRef(0);
    const isActiveRef = useRef(false);

    // Materials initialised immediately (not in useEffect) so meshes always
    // have a valid material on the very first render.
    const outerMatRef = useRef(new THREE.MeshBasicMaterial({
        color: '#ffffff', transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    }));
    const ringMatRef = useRef(new THREE.MeshBasicMaterial({
        color: '#ffffff', transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    }));
    const innerMatRef = useRef(new THREE.MeshBasicMaterial({
        color: '#ffffff', transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false,
    }));

    useEffect(() => {
        return () => {
            outerMatRef.current?.dispose();
            ringMatRef.current?.dispose();
            innerMatRef.current?.dispose();
        };
    }, []);

    useEffect(() => {
        if (active && !isActiveRef.current) {
            isActiveRef.current = true;
            progressRef.current = 0;
            if (outerMatRef.current) outerMatRef.current.color.set(color);
            if (ringMatRef.current) ringMatRef.current.color.set(color);
            if (innerMatRef.current) innerMatRef.current.color.set(color);
        } else if (!active) {
            isActiveRef.current = false;
            if (outerMatRef.current) outerMatRef.current.opacity = 0;
            if (ringMatRef.current) ringMatRef.current.opacity = 0;
            if (innerMatRef.current) innerMatRef.current.opacity = 0;
        }
    }, [active, color]);

    useFrame((_, delta) => {
        if (!isActiveRef.current) return;

        progressRef.current = Math.min(1, progressRef.current + delta * 5);
        const progress = progressRef.current;
        const snappyProgress = 1 - Math.pow(1 - progress, 3);

        if (ringRef.current) {
            const ringScale = Math.max(0.01, 1 - snappyProgress);
            ringRef.current.scale.set(ringScale, ringScale, 1);
            const glowPulse = Math.sin(progress * Math.PI * 4) * 0.3 + 0.7;
            ringMatRef.current.opacity = (1 - snappyProgress * 0.3) * glowPulse * 0.9;
        }

        if (outerRingRef.current) {
            const edgeScale = Math.max(0.01, 1.1 - snappyProgress * 0.8);
            outerRingRef.current.scale.set(edgeScale, edgeScale, 1);
            outerMatRef.current.opacity = (1 - snappyProgress) * 0.6;
        }

        if (innerGlowRef.current) {
            const fillScale = snappyProgress * 0.95;
            innerGlowRef.current.scale.set(fillScale, fillScale, 1);
            const fillOpacity = Math.sin(progress * Math.PI) * 0.7;
            innerMatRef.current.opacity = fillOpacity;
        }
    });

    return (
        <group position={[0, 0, 0.025]}>
            <mesh ref={outerRingRef} geometry={_sharedOuterRingGeometry} material={outerMatRef.current} scale={[0, 0, 0]} />
            <mesh ref={ringRef} geometry={_sharedMainRingGeometry} material={ringMatRef.current} scale={[0, 0, 0]} />
            <mesh ref={innerGlowRef} position={[0, 0, -0.005]} geometry={_sharedInnerCircleGeometry} material={innerMatRef.current} scale={[0, 0, 0]} />
        </group>
    );
};

export default AntipodalGlowFill;
