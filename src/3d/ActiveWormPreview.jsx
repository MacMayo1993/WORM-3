import { useLayoutEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { borrowPreviewCanvas, getDirectWormPreview } from './directWormPreview.js';
import { drawDirectWormPreview } from './WormPreviewRenderer.js';
import { prefersReducedMotion } from '../utils/device.js';

export default function ActiveWormPreview({ entry }) {
    const { gl, get } = useThree();
    const ensureSize = useRef(() => {});
    useLayoutEffect(() => {
        const restoreDOM = borrowPreviewCanvas(gl.domElement, entry.element);
        const ratio = gl.getPixelRatio();
        const dimensions = new THREE.Vector2();
        let width = -1, height = -1;
        const applySize = () => {
            if (width <= 0 || height <= 0) return;
            const dpr = Math.min(window.devicePixelRatio || 1, 2, 640 / Math.max(width, height));
            gl.getSize(dimensions);
            if (gl.getPixelRatio() !== dpr) gl.setPixelRatio(dpr);
            if (dimensions.x !== width || dimensions.y !== height) gl.setSize(width, height, false);
        };
        ensureSize.current = applySize;
        const resize = () => {
            const rect = entry.element.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) return;
            if (width === rect.width && height === rect.height) return;
            width = rect.width; height = rect.height;
            applySize();
        };
        resize();
        const observer = new ResizeObserver(resize);
        observer.observe(entry.element);
        let released = false;
        const release = () => {
            if (released) return;
            released = true;
            ensureSize.current = () => {};
            observer.disconnect();
            restoreDOM();
            gl.setPixelRatio(get().viewport.dpr || ratio);
            const size = get().size;
            gl.setSize(size.width, size.height, false);
            gl.getSize(dimensions);
            gl.setViewport(0, 0, dimensions.x, dimensions.y);
            get().invalidate();
        };
        entry.release = release;
        return () => { release(); if (entry.release === release) entry.release = null; };
    }, [entry, gl, get]);
    // Last pass owns the visible canvas while it is in the hero's DOM slot.
    // Unmounting this subscriber restores R3F's automatic main-scene rendering.
    useFrame((_, delta) => {
        if (getDirectWormPreview() !== entry) return;
        ensureSize.current();
        if (!prefersReducedMotion()) entry.age += Math.min(0.05, delta);
        drawDirectWormPreview(gl, entry.opts, entry.age);
    }, 100);
    return null;
}

