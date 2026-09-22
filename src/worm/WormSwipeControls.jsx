import React, { useRef, useCallback, useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../hooks/useGameStore.js';
import { FACE_NORMALS, DIR_FORWARD } from './healerWorm/constants.js';

const _mapCamForward = new THREE.Vector3();
const _mapCamUp = new THREE.Vector3();
const _mapCamRight = new THREE.Vector3();
const _mapDesired = new THREE.Vector3();
const _mapCandVec = new THREE.Vector3();

export default function WormSwipeControls({ onTurn, worm }) {
    const { camera } = useThree();
    const wormControlMode = useGameStore(s => s.wormControlMode ?? 'non-oriented');
    const touchStart = useRef(null);

    const mapOrientedDirection = useCallback((inputDir) => {
        const dirKey = worm.pos.current?.dirKey;
        if (!dirKey) return inputDir;

        const faceNormal = FACE_NORMALS[dirKey] ?? new THREE.Vector3(0, 0, 1);
        camera.getWorldDirection(_mapCamForward);
        _mapCamUp.copy(camera.up).normalize();
        _mapCamRight.crossVectors(_mapCamForward, _mapCamUp).normalize();

        if (inputDir === 'up') _mapDesired.copy(_mapCamUp);
        else if (inputDir === 'down') _mapDesired.copy(_mapCamUp).multiplyScalar(-1);
        else if (inputDir === 'left') _mapDesired.copy(_mapCamRight).multiplyScalar(-1);
        else if (inputDir === 'right') _mapDesired.copy(_mapCamRight);
        else return inputDir;

        // Project onto face plane (remove normal component)
        _mapDesired.addScaledVector(faceNormal, -_mapDesired.dot(faceNormal));
        if (_mapDesired.lengthSq() < 1e-6) return inputDir;
        _mapDesired.normalize();

        const candidates = ['up', 'down', 'left', 'right'];
        let bestDir = 'up';
        let bestDot = -Infinity;
        for (const dir of candidates) {
            const arr = DIR_FORWARD[dirKey]?.[dir] ?? [0, 0, -1];
            _mapCandVec.set(arr[0], arr[1], arr[2]).normalize();
            const d = _mapCandVec.dot(_mapDesired);
            if (d > bestDot) {
                bestDot = d;
                bestDir = dir;
            }
        }

        return bestDir;
    }, [camera, worm]);

    const emitDirection = useCallback((dir) => {
        if (wormControlMode === 'oriented') {
            onTurn(mapOrientedDirection(dir));
            return;
        }
        onTurn(dir);
    }, [wormControlMode, onTurn, mapOrientedDirection]);

    useEffect(() => {
        let fireTimer = null;
        let firing = false;
        const cancelFire = () => { clearTimeout(fireTimer); fireTimer = null; };
        const onTouchStart = (e) => {
            cancelFire();
            if (e.touches.length !== 1) { touchStart.current = null; firing = false; onTurn('fire-stop'); return; }
            const t = e.touches[0];
            touchStart.current = { x: t.clientX, y: t.clientY };
            if (useGameStore.getState().captureMode) fireTimer = setTimeout(() => {
                firing = true; onTurn('fire-start');
            }, 350);
        };
        const onTouchEnd = (e) => {
            cancelFire();
            if (firing) { firing = false; touchStart.current = null; onTurn('fire-stop'); return; }
            if (!touchStart.current) return;
            const t = e.changedTouches[0];
            const dx = t.clientX - touchStart.current.x;
            const dy = t.clientY - touchStart.current.y;
            touchStart.current = null;

            const adx = Math.abs(dx), ady = Math.abs(dy);
            if (adx < 12 && ady < 12) {
                if (useGameStore.getState().captureMode) onTurn('jump');
                return;
            }

            if (adx > ady) {
                emitDirection(dx > 0 ? 'right' : 'left');
            } else if (wormControlMode === 'oriented') {
                emitDirection(dy > 0 ? 'down' : 'up');
            } else if (dy > 0) {
                // non-oriented mode supports 180° turn via downward swipe
                emitDirection('down');
            } else if (useGameStore.getState().captureMode) {
                onTurn('boost');
            }
        };
        const onKey = (e) => {
            if (e.repeat && e.key !== ' ') return;
            if (e.target?.closest?.('input, textarea, select, [contenteditable=true]')) return;
            if (e.key.toLowerCase() === 'f' && useGameStore.getState().wormHealerMode && !useGameStore.getState().demoMode) { e.preventDefault(); e.stopPropagation(); onTurn('fire-start'); return; }
            if (e.key.toLowerCase() === 'q') { e.preventDefault(); e.stopPropagation(); onTurn('signature'); return; }
            if (e.key === 'ArrowLeft') { e.preventDefault(); emitDirection('left'); }
            if (e.key === 'ArrowRight') { e.preventDefault(); emitDirection('right'); }
            if (e.key === 'ArrowDown') { e.preventDefault(); emitDirection('down'); }
            if (e.key === 'ArrowUp' && wormControlMode === 'oriented') { e.preventDefault(); emitDirection('up'); }
            if (e.key === ' ') {
                e.preventDefault();
                e.stopImmediatePropagation();
                onTurn('jump');
            }
        };
        const stopFire = () => { cancelFire(); firing = false; onTurn('fire-stop'); };
        const onTouchMove = e => {
            const t = e.touches[0], origin = touchStart.current;
            if (e.touches.length !== 1 || (origin && t && Math.hypot(t.clientX - origin.x, t.clientY - origin.y) > 12)) cancelFire();
        };
        const cancelTouch = () => { touchStart.current = null; stopFire(); };
        const onKeyUp = e => { if (e.key.toLowerCase() === 'f') stopFire(); };
        const unsubscribeCapture = useGameStore.subscribe(s => s.captureMode, cancelTouch);
        window.addEventListener('keyup', onKeyUp);
        window.addEventListener('blur', stopFire);
        window.addEventListener('touchmove', onTouchMove, { passive: true });
        window.addEventListener('touchcancel', cancelTouch);
        window.addEventListener('touchstart', onTouchStart, { passive: true });
        window.addEventListener('touchend', onTouchEnd, { passive: true });
        window.addEventListener('keydown', onKey, { capture: true });
        return () => {
            unsubscribeCapture();
            stopFire();
            window.removeEventListener('keyup', onKeyUp);
            window.removeEventListener('blur', stopFire);
            window.removeEventListener('touchmove', onTouchMove);
            window.removeEventListener('touchcancel', cancelTouch);
            window.removeEventListener('touchstart', onTouchStart);
            window.removeEventListener('touchend', onTouchEnd);
            window.removeEventListener('keydown', onKey, { capture: true });
        };
    }, [onTurn, emitDirection, wormControlMode]);

    return null;
}
