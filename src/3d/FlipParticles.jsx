// src/3d/FlipParticles.jsx
// Particle burst effect during the manifold-crossing flip animation.
// Uses forwardRef + useImperativeHandle so the parent calls ref.trigger(color)
// imperatively instead of toggling useState (which would re-render the full
// StickerPlane subtree on every flip).
import React, { useRef, useEffect, useImperativeHandle } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Shared geometry — one PlaneGeometry quad per instance (created once).
const _sharedParticleGeometry = new THREE.PlaneGeometry(1, 1);
// Scratch Object3D for matrix updates — never added to a scene.
const _particleDummy = new THREE.Object3D();

const PARTICLE_COUNT = 12;

const FlipParticles = React.forwardRef((_props, ref) => {
    const meshRef = useRef();
    const progressRef = useRef(0);
    const velocitiesRef = useRef([]);
    const isActiveRef = useRef(false);

    // Expose .trigger(color) — called imperatively from the parent StickerPlane.
    useImperativeHandle(ref, () => ({
        trigger(color) {
            if (isActiveRef.current) return; // already animating — ignore re-entrant call
            isActiveRef.current = true;
            progressRef.current = 0;
            velocitiesRef.current = Array.from({ length: PARTICLE_COUNT }, (_, i) => {
                const angle = (i / PARTICLE_COUNT) * Math.PI * 2 + Math.random() * 0.4;
                const speed = 2.5 + Math.random() * 2.0;
                return {
                    x: Math.cos(angle) * speed,
                    y: Math.sin(angle) * speed,
                    z: (Math.random() - 0.5) * 1.5,
                    rotSpeed: (Math.random() - 0.5) * 15,
                    size: 0.06 + Math.random() * 0.06
                };
            });
            if (meshRef.current?.material) {
                meshRef.current.material.color.set(color);
                meshRef.current.material.opacity = 1;
            }
        }
    }), []);

    // Zero-scale all instances on mount so they're invisible before first activation.
    useEffect(() => {
        const mesh = meshRef.current;
        if (!mesh) return;
        _particleDummy.scale.set(0, 0, 0);
        _particleDummy.updateMatrix();
        for (let i = 0; i < PARTICLE_COUNT; i++) mesh.setMatrixAt(i, _particleDummy.matrix);
        mesh.instanceMatrix.needsUpdate = true;
    }, []);

    useFrame((_, delta) => {
        const mesh = meshRef.current;
        if (!mesh || !isActiveRef.current) return;

        progressRef.current += delta * 1.8;
        const p = progressRef.current;

        if (p >= 1) {
            isActiveRef.current = false;
            _particleDummy.scale.set(0, 0, 0);
            _particleDummy.updateMatrix();
            for (let i = 0; i < PARTICLE_COUNT; i++) mesh.setMatrixAt(i, _particleDummy.matrix);
            mesh.instanceMatrix.needsUpdate = true;
            if (mesh.material) mesh.material.opacity = 0;
            return;
        }

        const easeOut = 1 - Math.pow(1 - p, 4);
        const opacity = Math.pow(1 - p, 0.5);
        if (mesh.material) mesh.material.opacity = opacity;

        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const vel = velocitiesRef.current[i];
            if (!vel) continue;
            _particleDummy.position.set(vel.x * easeOut * 0.8, vel.y * easeOut * 0.8, vel.z * easeOut * 0.4);
            _particleDummy.rotation.set(0, 0, vel.rotSpeed * p);
            const baseScale = vel.size * (1 - easeOut * 0.5);
            _particleDummy.scale.set(baseScale, baseScale, baseScale * 0.5);
            _particleDummy.updateMatrix();
            mesh.setMatrixAt(i, _particleDummy.matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
    });

    return (
        <instancedMesh
            ref={meshRef}
            args={[_sharedParticleGeometry, null, PARTICLE_COUNT]}
            position={[0, 0, 0.05]}
        >
            <meshBasicMaterial
                transparent
                opacity={0}
                blending={THREE.AdditiveBlending}
                side={THREE.DoubleSide}
                depthWrite={false}
            />
        </instancedMesh>
    );
});

FlipParticles.displayName = 'FlipParticles';
export default FlipParticles;
