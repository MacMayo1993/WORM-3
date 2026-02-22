/**
 * Life Journey Background Environments - Realistic 3D Scenes
 * Daycare → Elementary → Middle → High → College → Job → NASA → Rocket → Moon
 * Actual 3D environments you can look around in!
 */

import React, { useRef, useMemo, useLayoutEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ContactShadows, Text } from '@react-three/drei';

export function DaycareEnvironment({ flipTrigger = 0 }) {
  const tileCount = 36; // 6x6 grid for cube-net floor
  const dustCount = 30;
  const tileRef = useRef();
  const dustRef = useRef();
  const mobileRef = useRef();
  const mobileSpinRef = useRef(0);
  const prevFlipRef = useRef(flipTrigger);

  // Cube face colors: Red, Green, White, Orange, Blue, Yellow (matching actual puzzle)
  const cubeFaceColors = useMemo(() => [
    new THREE.Color('#ef4444'), // Front - Red
    new THREE.Color('#22c55e'), // Left - Green
    new THREE.Color('#ffffff'), // Top - White
    new THREE.Color('#f97316'), // Back - Orange
    new THREE.Color('#3b82f6'), // Right - Blue
    new THREE.Color('#eab308'), // Bottom - Yellow
  ], []);

  // Stable crayon positions (6 crayons, one per cube face color, clustered near center)
  const crayonData = useMemo(() => {
    const positions = [];
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 + 0.3;
      const r = 3 + (i % 3) * 1.5;
      positions.push({
        x: Math.cos(angle) * r,
        z: Math.sin(angle) * r + 2,
        rotY: angle + 0.5,
        tiltX: (i * 0.12) - 0.2,
        tiltZ: (i * 0.08) - 0.15,
      });
    }
    return positions;
  }, []);

  // Stable dust mote positions
  const dustData = useMemo(() => {
    const data = [];
    for (let i = 0; i < dustCount; i++) {
      data.push({
        x: (Math.sin(i * 7.3) * 0.5 + 0.5 - 0.5) * 40,
        y: (Math.sin(i * 3.1) * 0.5 + 0.5) * 20 + 2,
        z: (Math.cos(i * 5.7) * 0.5 + 0.5 - 0.5) * 40,
        speed: 0.15 + (i % 5) * 0.05,
        phase: i * 1.7,
      });
    }
    return data;
  }, []);

  // Floor tiles arranged as cube-net: 6 clusters of 6 tiles each
  // Layout: cross-shaped net (Top, Left, Front, Right, Back on middle row, Bottom below Front)
  useLayoutEffect(() => {
    if (!tileRef.current) return;
    const tempObject = new THREE.Object3D();
    const tileSize = 4.5;
    const gap = 0.3;
    const step = tileSize + gap;

    // 6 face clusters, each a 2x3 block arranged as unfolded cube net
    // Net layout (in grid units):
    //         [Top]
    // [Left] [Front] [Right] [Back]
    //         [Bottom]
    const faceOffsets = [
      { fx: 0, fz: -2 },   // Front (face 0 - Red) - center
      { fx: -2, fz: -2 },  // Left (face 1 - Green)
      { fx: 0, fz: -4 },   // Top (face 2 - White)
      { fx: 2, fz: -2 },   // Back (face 3 - Orange)
      { fx: 4, fz: -2 },   // Right (face 4 - Blue)
      { fx: 0, fz: 0 },    // Bottom (face 5 - Yellow)
    ];

    let idx = 0;
    for (let face = 0; face < 6; face++) {
      const { fx, fz } = faceOffsets[face];
      for (let sub = 0; sub < 6; sub++) {
        const lx = sub % 2;
        const lz = Math.floor(sub / 2);
        const x = (fx + lx) * step - 4;
        const z = (fz + lz) * step + 8;
        tempObject.position.set(x, -7.95, z);
        tempObject.rotation.set(-Math.PI / 2, 0, 0);
        tempObject.scale.set(1, 1, 1);
        tempObject.updateMatrix();
        tileRef.current.setMatrixAt(idx, tempObject.matrix);

        // Each cluster uses its cube face color with subtle variation
        const baseColor = cubeFaceColors[face].clone();
        const variation = 0.03 * ((sub % 3) - 1);
        baseColor.offsetHSL(0, variation, variation * 0.5);
        tileRef.current.setColorAt(idx, baseColor);
        idx++;
      }
    }
    tileRef.current.instanceMatrix.needsUpdate = true;
    if (tileRef.current.instanceColor) tileRef.current.instanceColor.needsUpdate = true;
  }, [cubeFaceColors]);

  // Dust mote instances
  useLayoutEffect(() => {
    if (!dustRef.current) return;
    const tempObject = new THREE.Object3D();
    for (let i = 0; i < dustCount; i++) {
      const d = dustData[i];
      tempObject.position.set(d.x, d.y, d.z);
      tempObject.scale.setScalar(0.06 + (i % 3) * 0.02);
      tempObject.updateMatrix();
      dustRef.current.setMatrixAt(i, tempObject.matrix);
      dustRef.current.setColorAt(i, new THREE.Color('#FFF8DC'));
    }
    dustRef.current.instanceMatrix.needsUpdate = true;
  }, [dustData]);

  // Animation loop
  useFrame((state) => {
    const time = state.clock.elapsedTime;

    // Mobile responds to flipTrigger (spins faster on player action)
    if (flipTrigger !== prevFlipRef.current) {
      mobileSpinRef.current = 3.0; // burst of spin speed
      prevFlipRef.current = flipTrigger;
    }
    // Decay spin boost
    mobileSpinRef.current *= 0.97;
    const spinSpeed = 0.2 + mobileSpinRef.current;

    if (mobileRef.current) {
      mobileRef.current.rotation.z = Math.sin(time * 0.5) * 0.06;
      mobileRef.current.rotation.y += spinSpeed * 0.016; // frame-rate independent
      mobileRef.current.children.forEach((arm, i) => {
        if (arm.rotation) {
          arm.rotation.y = Math.sin(time * 0.8 + i * 2.1) * 0.15;
        }
      });
    }

    // Animate dust motes: gentle drift and bobbing in sunlight
    if (dustRef.current) {
      const dummy = new THREE.Object3D();
      for (let i = 0; i < dustCount; i++) {
        const d = dustData[i];
        const driftX = d.x + Math.sin(time * d.speed + d.phase) * 2;
        const driftY = d.y + Math.sin(time * d.speed * 0.7 + d.phase * 2) * 1.5;
        const driftZ = d.z + Math.cos(time * d.speed * 0.5 + d.phase) * 2;
        dummy.position.set(driftX, driftY, driftZ);
        dummy.scale.setScalar(0.06 + Math.sin(time * 2 + d.phase) * 0.02);
        dummy.updateMatrix();
        dustRef.current.setMatrixAt(i, dummy.matrix);
      }
      dustRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  // Rotation-axis arrow colors (X=Red, Y=Green, Z=Blue — standard 3D convention)
  const axisColors = ['#ef4444', '#22c55e', '#3b82f6'];

  return (
    <group>
      {/* Atmosphere: Warm afternoon — fog pushed back for color clarity */}
      <color attach="background" args={['#FFF5E6']} />
      <fog attach="fog" args={['#FFF5E6', 45, 150]} />

      {/* Lighting: Window spotlight aimed at cube center + warm ambient */}
      <directionalLight
        position={[20, 25, 10]}
        intensity={1.8}
        color="#FFF8DC"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        target-position={[0, 0, 0]}
      />
      <ambientLight intensity={0.4} color="#FFF0DB" />
      {/* Warm fill from window side */}
      <pointLight position={[40, 12, 0]} intensity={0.6} color="#FFE4B5" distance={60} decay={2} />

      {/* ===== ROOM GEOMETRY ===== */}

      {/* Floor — warm wood-tone with subtle sheen */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -8, 0]} receiveShadow>
        <planeGeometry args={[120, 120]} />
        <meshStandardMaterial color="#D4B896" roughness={0.7} metalness={0.05} />
      </mesh>

      {/* Back wall */}
      <group position={[0, 12, -45]}>
        <mesh>
          <planeGeometry args={[100, 50]} />
          <meshStandardMaterial color="#FFF5E6" roughness={0.95} />
        </mesh>
        {/* Wood baseboard */}
        <mesh position={[0, -24.5, 0.5]}>
          <boxGeometry args={[100, 1.5, 0.4]} />
          <meshStandardMaterial color="#C4956A" roughness={0.6} metalness={0.05} />
        </mesh>
      </group>

      {/* Left wall */}
      <mesh position={[-50, 12, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[100, 50]} />
        <meshStandardMaterial color="#FFF0DB" roughness={0.95} />
      </mesh>

      {/* Right wall (with window) */}
      <mesh position={[50, 12, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[100, 50]} />
        <meshStandardMaterial color="#FFF0DB" roughness={0.95} />
      </mesh>

      {/* Ceiling */}
      <mesh position={[0, 37, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#FFFEFA" roughness={1} />
      </mesh>

      {/* ===== CUBE-NET FLOOR TILES ===== */}
      {/* 6 clusters of tiles in cube face colors, laid out as an unfolded cube net */}
      <instancedMesh ref={tileRef} args={[null, null, tileCount]}>
        <planeGeometry args={[4.3, 4.3]} />
        <meshStandardMaterial transparent opacity={0.6} roughness={0.85} />
      </instancedMesh>

      {/* ===== COLOR REFERENCE POSTER ON WALL ===== */}
      {/* Shows the 6 cube face colors as a visual guide */}
      <group position={[-10, 8, -44.5]}>
        {/* Poster background — off-white paper */}
        <mesh>
          <planeGeometry args={[22, 6]} />
          <meshStandardMaterial color="#FFFEF5" roughness={0.9} />
        </mesh>
        {/* Border frame */}
        <mesh position={[0, 0, -0.05]}>
          <planeGeometry args={[23, 7]} />
          <meshStandardMaterial color="#C4956A" roughness={0.5} />
        </mesh>
        {/* 6 colored squares in a row */}
        {cubeFaceColors.map((color, i) => (
          <mesh key={i} position={[-8.5 + i * 3.5, 0, 0.05]}>
            <planeGeometry args={[2.8, 3.5]} />
            <meshStandardMaterial color={color} roughness={0.7} />
          </mesh>
        ))}
      </group>

      {/* ===== SHAPE-SORTER TOY ===== */}
      {/* Replaces floating blocks — teaches "shapes go into specific places" */}
      <group position={[10, -6.5, 8]}>
        {/* Main box body — wooden cube with cutout holes */}
        <mesh castShadow>
          <boxGeometry args={[4, 3, 4]} />
          <meshStandardMaterial color="#DEB887" roughness={0.5} metalness={0.02} />
        </mesh>
        {/* Lid */}
        <mesh position={[0, 1.6, 0]} castShadow>
          <boxGeometry args={[4.2, 0.2, 4.2]} />
          <meshStandardMaterial color="#C4956A" roughness={0.5} />
        </mesh>
        {/* Cutout indicators on lid (circle, square, triangle) */}
        <mesh position={[-1.1, 1.72, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.35, 0.55, 32]} />
          <meshStandardMaterial color="#ef4444" roughness={0.6} />
        </mesh>
        <mesh position={[0, 1.72, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.9, 0.9]} />
          <meshStandardMaterial color="#3b82f6" roughness={0.6} />
        </mesh>
        <mesh position={[1.1, 1.72, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.3, 0.55, 3]} />
          <meshStandardMaterial color="#22c55e" roughness={0.6} />
        </mesh>
        {/* Loose shapes sitting beside the sorter */}
        <mesh position={[-2.5, -1.1, 1]} castShadow>
          <sphereGeometry args={[0.5, 16, 16]} />
          <meshStandardMaterial color="#ef4444" roughness={0.4} />
        </mesh>
        <mesh position={[3, -1.0, -0.5]} rotation={[0.2, 0.5, 0.1]} castShadow>
          <boxGeometry args={[0.85, 0.85, 0.85]} />
          <meshStandardMaterial color="#3b82f6" roughness={0.4} />
        </mesh>
        <mesh position={[2.8, -0.7, 2]} rotation={[0.3, 0.8, 0]} castShadow>
          <tetrahedronGeometry args={[0.6]} />
          <meshStandardMaterial color="#22c55e" roughness={0.4} />
        </mesh>
      </group>

      {/* ===== ROTATION-AXIS MOBILE ===== */}
      {/* Three curved arrows in X/Y/Z colors teaching rotation axes */}
      <group position={[0, 28, 0]} ref={mobileRef}>
        {/* Hanging string */}
        <mesh position={[0, 5, 0]}>
          <cylinderGeometry args={[0.02, 0.02, 10]} />
          <meshStandardMaterial color="#888" />
        </mesh>
        {/* Wooden cross-bar */}
        <mesh position={[0, 0, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 12, 8]} />
          <meshStandardMaterial color="#DEB887" roughness={0.5} />
        </mesh>
        {[0, 1, 2].map((i) => (
          <group key={i} rotation={[0, (i * Math.PI * 2) / 3, 0]}>
            {/* Arm */}
            <mesh position={[3, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.04, 0.04, 6, 8]} />
              <meshStandardMaterial color="#DEB887" roughness={0.5} />
            </mesh>
            {/* String down to arrow */}
            <mesh position={[5.5, -1.5, 0]}>
              <cylinderGeometry args={[0.015, 0.015, 3]} />
              <meshStandardMaterial color="#AAA" />
            </mesh>
            {/* Curved rotation arrow: torus arc + cone arrowhead */}
            <group position={[5.5, -3.5, 0]}>
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[0.8, 0.08, 8, 24, Math.PI * 1.5]} />
                <meshStandardMaterial color={axisColors[i]} roughness={0.3} metalness={0.1} />
              </mesh>
              {/* Arrowhead */}
              <mesh position={[0.8, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
                <coneGeometry args={[0.2, 0.4, 8]} />
                <meshStandardMaterial color={axisColors[i]} roughness={0.3} metalness={0.1} />
              </mesh>
              {/* Axis letter label (small flat disc with color) */}
              <mesh position={[0, 0.6, 0]} rotation={[0, 0, 0]}>
                <sphereGeometry args={[0.25, 12, 12]} />
                <meshStandardMaterial color={axisColors[i]} roughness={0.5} />
              </mesh>
            </group>
          </group>
        ))}
      </group>

      {/* ===== WINDOW WITH VOLUMETRIC LIGHT ===== */}
      {/* Angled to spotlight the cube at center */}
      <group position={[48, 15, 0]}>
        {/* Window frame */}
        <mesh>
          <boxGeometry args={[0.6, 18, 22]} />
          <meshStandardMaterial color="#FFFEFA" roughness={0.8} />
        </mesh>
        {/* Window panes (glass) */}
        <mesh position={[-0.1, 0, 0]}>
          <planeGeometry args={[0.1, 16, 20]} />
          <meshStandardMaterial color="#E8F4FD" transparent opacity={0.3} roughness={0.1} metalness={0.2} />
        </mesh>
        {/* Window muntins (cross bars) */}
        <mesh position={[-0.2, 0, 0]}>
          <boxGeometry args={[0.15, 18, 0.3]} />
          <meshStandardMaterial color="#FFFEFA" roughness={0.8} />
        </mesh>
        <mesh position={[-0.2, 0, 0]}>
          <boxGeometry args={[0.15, 0.3, 22]} />
          <meshStandardMaterial color="#FFFEFA" roughness={0.8} />
        </mesh>
        {/* Volumetric light cone aimed at cube center */}
        <mesh position={[-24, -10, 0]} rotation={[0, 0, Math.PI / 5]}>
          <boxGeometry args={[40, 0.05, 22]} />
          <meshBasicMaterial
            color="#FFF8DC"
            transparent
            opacity={0.06}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
        <mesh position={[-22, -8, 0]} rotation={[0, 0, Math.PI / 6]}>
          <boxGeometry args={[38, 0.05, 18]} />
          <meshBasicMaterial
            color="#FFF8DC"
            transparent
            opacity={0.04}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
        {/* Outdoor backdrop: blue sky gradient + tree silhouettes */}
        <mesh position={[1, 0, 0]}>
          <planeGeometry args={[0.1, 16, 20]} />
          <meshBasicMaterial color="#87CEEB" />
        </mesh>
      </group>

      {/* ===== CRAYONS — 6 near cube, stable positions ===== */}
      {crayonData.map((c, i) => (
        <group key={`crayon-${i}`}>
          <mesh
            position={[c.x, -7.92, c.z]}
            rotation={[Math.PI / 2 + c.tiltX, c.rotY, c.tiltZ]}
            castShadow
          >
            <cylinderGeometry args={[0.1, 0.1, 1.4, 8]} />
            <meshStandardMaterial color={cubeFaceColors[i]} roughness={0.5} />
          </mesh>
          {/* Crayon tip */}
          <mesh
            position={[
              c.x + Math.cos(c.rotY) * 0.7,
              -7.88,
              c.z + Math.sin(c.rotY) * 0.7,
            ]}
            rotation={[Math.PI / 2 + c.tiltX, c.rotY, c.tiltZ]}
          >
            <coneGeometry args={[0.1, 0.25, 8]} />
            <meshStandardMaterial
              color={cubeFaceColors[i]}
              roughness={0.4}
              metalness={0.05}
            />
          </mesh>
        </group>
      ))}

      {/* ===== RUG — anchored flat under cube as activity zone ===== */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -7.9, 2]} receiveShadow>
        <circleGeometry args={[14, 64]} />
        <meshStandardMaterial color="#F5C6D0" roughness={1} />
      </mesh>
      {/* Rug border ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -7.89, 2]}>
        <ringGeometry args={[13.2, 14, 64]} />
        <meshStandardMaterial color="#E8A0B0" roughness={1} />
      </mesh>

      {/* ===== WALL DECORATIONS — Progress echo frames ===== */}
      {/* 6 small picture frames on back wall — start as gray, could light up when face solved */}
      {cubeFaceColors.map((color, i) => (
        <group key={`frame-${i}`} position={[20 + i * 4.5, 18, -44.5]}>
          {/* Wooden frame */}
          <mesh>
            <boxGeometry args={[3.5, 3.5, 0.3]} />
            <meshStandardMaterial color="#C4956A" roughness={0.5} />
          </mesh>
          {/* Inner canvas — shows cube face color (subtly desaturated as "hint") */}
          <mesh position={[0, 0, 0.2]}>
            <planeGeometry args={[2.8, 2.8]} />
            <meshStandardMaterial
              color={color}
              roughness={0.8}
              transparent
              opacity={0.35}
            />
          </mesh>
        </group>
      ))}

      {/* ===== ADDITIONAL REALISM DETAILS ===== */}

      {/* Bookshelf on left wall */}
      <group position={[-48, -2, -20]}>
        {/* Shelf unit */}
        <mesh castShadow>
          <boxGeometry args={[2, 14, 8]} />
          <meshStandardMaterial color="#C4956A" roughness={0.5} />
        </mesh>
        {/* Shelf boards */}
        {[-3, 0, 3].map((sy, si) => (
          <mesh key={si} position={[0.2, sy, 0]}>
            <boxGeometry args={[0.3, 0.2, 8.2]} />
            <meshStandardMaterial color="#B8865A" roughness={0.5} />
          </mesh>
        ))}
        {/* Colorful children's books */}
        {[
          { y: -1.5, z: -2.5, color: '#ef4444', h: 2.5, w: 0.3 },
          { y: -1.5, z: -1.8, color: '#3b82f6', h: 2.3, w: 0.4 },
          { y: -1.5, z: -1.0, color: '#22c55e', h: 2.6, w: 0.3 },
          { y: -1.5, z: -0.3, color: '#f97316', h: 2.2, w: 0.35 },
          { y: -1.5, z: 0.5, color: '#eab308', h: 2.4, w: 0.3 },
          { y: 1.5, z: -2.2, color: '#8B5CF6', h: 2.3, w: 0.35 },
          { y: 1.5, z: -1.4, color: '#ef4444', h: 2.5, w: 0.3 },
          { y: 1.5, z: -0.5, color: '#3b82f6', h: 2.1, w: 0.4 },
        ].map((book, bi) => (
          <mesh key={bi} position={[0.6, book.y, book.z]} castShadow>
            <boxGeometry args={[book.w, book.h, 1.2]} />
            <meshStandardMaterial color={book.color} roughness={0.7} />
          </mesh>
        ))}
      </group>

      {/* Small wooden table near shape sorter */}
      <group position={[10, -7, 8]}>
        {/* Tabletop */}
        <mesh position={[0, 1.5, 0]} castShadow>
          <cylinderGeometry args={[3.5, 3.5, 0.3, 16]} />
          <meshStandardMaterial color="#DEB887" roughness={0.5} />
        </mesh>
        {/* Legs */}
        {[[1.5, 0, 1.5], [-1.5, 0, 1.5], [1.5, 0, -1.5], [-1.5, 0, -1.5]].map((pos, li) => (
          <mesh key={li} position={pos} castShadow>
            <cylinderGeometry args={[0.15, 0.15, 3, 8]} />
            <meshStandardMaterial color="#C4956A" roughness={0.5} />
          </mesh>
        ))}
      </group>

      {/* ===== FLOATING DUST MOTES IN SUNLIGHT ===== */}
      <instancedMesh ref={dustRef} args={[null, null, dustCount]}>
        <sphereGeometry args={[1, 6, 6]} />
        <meshBasicMaterial
          color="#FFF8DC"
          transparent
          opacity={0.35}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </instancedMesh>

      {/* ===== SHADOWS ===== */}
      <ContactShadows
        position={[0, -7.99, 0]}
        opacity={0.5}
        scale={80}
        blur={1.5}
        far={20}
      />
    </group>
  );
}

// ───────────────────────────────────────────
// ELEMENTARY - Classroom
// ───────────────────────────────────────────

export function ElementaryEnvironment({ flipTrigger: _flipTrigger = 0 }) {
  const starsRef = useRef();
  const textRef = useRef();

  useFrame((state) => {
    const time = state.clock.elapsedTime;

    // Animate the gold stars
    if (starsRef.current) {
      starsRef.current.children.forEach((star, i) => {
        star.rotation.z = time * 0.5 + i;
        const scale = 1 + Math.sin(time * 2 + i) * 0.1;
        star.scale.setScalar(scale);
      });
    }

    // Unique touch: Make the chalkboard text "float" slightly
    if (textRef.current) {
      textRef.current.position.y = 12 + Math.sin(time * 0.5) * 0.2;
    }
  });

  return (
    <group>
      {/* Floor - classroom tile */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -8, 0]}>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color="#C4A484" />
      </mesh>

      {/* Chalkboard wall */}
      <mesh position={[0, 10, -38]}>
        <planeGeometry args={[80, 36]} />
        <meshStandardMaterial color="#F5F5DC" />
      </mesh>

      {/* Chalkboard Setup */}
      <group position={[0, 12, -37]}>
        {/* The Board */}
        <mesh>
          <boxGeometry args={[35, 15, 0.5]} />
          <meshStandardMaterial color="#2D5A27" />
        </mesh>
        
        {/* Chalkboard frame */}
        <mesh position={[0, 0, 0.3]}>
          <boxGeometry args={[36, 16, 0.3]} />
          <meshStandardMaterial color="#8B4513" />
        </mesh>

        {/* Chalk text on blackboard */}
        <group ref={textRef}>
          <Text
            position={[0, 0, 0.6]}
            fontSize={2.2}
            color="#e8e8d0"
            maxWidth={30}
            textAlign="center"
            anchorX="center"
            anchorY="middle"
          >
            Welcome to{"\n"}Miss Cole's Class
          </Text>
        </group>
      </group>

      {/* Chalk tray */}
      <mesh position={[0, 4, -36]}>
        <boxGeometry args={[30, 0.5, 1]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>

      {/* Side walls */}
      <mesh position={[-40, 10, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[80, 36]} />
        <meshStandardMaterial color="#FAFAD2" />
      </mesh>
      <mesh position={[40, 10, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[80, 36]} />
        <meshStandardMaterial color="#FAFAD2" />
      </mesh>

      {/* Ceiling */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 28, 0]}>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color="#FFFFF0" />
      </mesh>

      {/* Student desks in rows */}
      {Array.from({ length: 4 }).map((_, row) =>
        Array.from({ length: 5 }).map((_, col) => (
          <group key={`desk-${row}-${col}`} position={[-16 + col * 8, -5, 5 + row * 8]}>
            <mesh position={[0, 2, 0]}>
              <boxGeometry args={[5, 0.3, 4]} />
              <meshStandardMaterial color="#DEB887" />
            </mesh>
            {[[-2, -1.5], [2, -1.5], [-2, 1.5], [2, 1.5]].map(([x, z], i) => (
              <mesh key={i} position={[x, 0, z]}>
                <boxGeometry args={[0.3, 4, 0.3]} />
                <meshStandardMaterial color="#4A4A4A" />
              </mesh>
            ))}
            <mesh position={[0, 0, 3.5]}>
              <boxGeometry args={[2.5, 0.3, 2.5]} />
              <meshStandardMaterial color="#FF6347" />
            </mesh>
            <mesh position={[0, 2, 4.5]}>
              <boxGeometry args={[2.5, 4, 0.3]} />
              <meshStandardMaterial color="#FF6347" />
            </mesh>
          </group>
        ))
      )}

      {/* Teacher's desk */}
      <group position={[0, -5, -25]}>
        <mesh position={[0, 2, 0]}>
          <boxGeometry args={[12, 0.5, 5]} />
          <meshStandardMaterial color="#8B4513" />
        </mesh>
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[11, 4, 4]} />
          <meshStandardMaterial color="#8B4513" />
        </mesh>
      </group>

      {/* Gold stars floating around */}
      <group ref={starsRef}>
        {Array.from({ length: 15 }).map((_, i) => (
          <mesh
            key={i}
            position={[
              (Math.random() - 0.5) * 60,
              10 + Math.random() * 15,
              (Math.random() - 0.5) * 60
            ]}
          >
            <cylinderGeometry args={[0.8, 0.8, 0.1, 5]} />
            <meshStandardMaterial color="#FFD700" emissive="#FFD700" emissiveIntensity={0.5} />
          </mesh>
        ))}
      </group>

      {/* Alphabet banner on wall */}
      <mesh position={[0, 22, -37]}>
        <boxGeometry args={[40, 3, 0.1]} />
        <meshStandardMaterial color="#FFB6C1" />
      </mesh>

      {/* Windows on side wall */}
      {[-20, 0, 20].map((z, i) => (
        <group key={i} position={[39, 12, z]}>
          <mesh>
            <boxGeometry args={[0.5, 10, 8]} />
            <meshStandardMaterial color="#87CEEB" emissive="#87CEEB" emissiveIntensity={0.2} />
          </mesh>
          <pointLight position={[3, 0, 0]} color="#FFFACD" intensity={0.5} distance={20} />
        </group>
      ))}

      {/* Fluorescent lights */}
      {[-15, 15].map((x, i) => (
        <group key={i}>
          <mesh position={[x, 27, 0]}>
            <boxGeometry args={[4, 0.3, 30]} />
            <meshBasicMaterial color="#FFFFFF" />
          </mesh>
          <pointLight position={[x, 25, 0]} color="#FFFFFF" intensity={0.6} distance={30} />
        </group>
      ))}

      <ambientLight intensity={0.5} />
    </group>
  );
        }
// ============================================
// 3. MIDDLE SCHOOL - Hallway with lockers
// ============================================
export function MiddleSchoolEnvironment({ flipTrigger: _flipTrigger = 0 }) {
  const papersRef = useRef();

  useFrame((state) => {
    if (papersRef.current) {
      papersRef.current.children.forEach((paper, i) => {
        paper.rotation.x = Math.sin(state.clock.elapsedTime + i) * 0.2;
        paper.rotation.z = Math.cos(state.clock.elapsedTime * 0.5 + i) * 0.1;
        paper.position.y = paper.userData.baseY + Math.sin(state.clock.elapsedTime * 0.5 + i) * 0.5;
      });
    }
  });

  const lockerColors = ['#4169E1', '#4682B4', '#5F9EA0', '#6495ED'];

  return (
    <group>
      {/* Floor - linoleum tiles */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -8, 0]}>
        <planeGeometry args={[30, 100]} />
        <meshStandardMaterial color="#D3D3D3" />
      </mesh>

      {/* Tile pattern */}
      {Array.from({ length: 50 }).map((_, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[(i % 2) * 2 - 1, -7.9, -45 + Math.floor(i / 2) * 4]}>
          <planeGeometry args={[1.9, 3.9]} />
          <meshStandardMaterial color={i % 3 === 0 ? '#C0C0C0' : '#E8E8E8'} />
        </mesh>
      ))}

      {/* Left wall with lockers */}
      <mesh position={[-14, 8, 0]}>
        <boxGeometry args={[1, 32, 100]} />
        <meshStandardMaterial color="#F5F5DC" />
      </mesh>

      {/* Left side lockers */}
      {Array.from({ length: 25 }).map((_, i) => (
        <group key={`locker-l-${i}`} position={[-13, 2, -46 + i * 4]}>
          {/* Locker body */}
          <mesh>
            <boxGeometry args={[1, 18, 3.5]} />
            <meshStandardMaterial color={lockerColors[i % lockerColors.length]} metalness={0.6} roughness={0.3} />
          </mesh>
          {/* Locker vent */}
          <mesh position={[0.6, 6, 0]}>
            <boxGeometry args={[0.1, 3, 2]} />
            <meshStandardMaterial color="#2F4F4F" />
          </mesh>
          {/* Locker handle */}
          <mesh position={[0.6, 0, 1]}>
            <boxGeometry args={[0.2, 0.5, 0.3]} />
            <meshStandardMaterial color="#C0C0C0" metalness={0.8} />
          </mesh>
        </group>
      ))}

      {/* Right wall with lockers */}
      <mesh position={[14, 8, 0]}>
        <boxGeometry args={[1, 32, 100]} />
        <meshStandardMaterial color="#F5F5DC" />
      </mesh>

      {/* Right side lockers */}
      {Array.from({ length: 25 }).map((_, i) => (
        <group key={`locker-r-${i}`} position={[13, 2, -46 + i * 4]}>
          <mesh>
            <boxGeometry args={[1, 18, 3.5]} />
            <meshStandardMaterial color={lockerColors[(i + 2) % lockerColors.length]} metalness={0.6} roughness={0.3} />
          </mesh>
          <mesh position={[-0.6, 6, 0]}>
            <boxGeometry args={[0.1, 3, 2]} />
            <meshStandardMaterial color="#2F4F4F" />
          </mesh>
          <mesh position={[-0.6, 0, -1]}>
            <boxGeometry args={[0.2, 0.5, 0.3]} />
            <meshStandardMaterial color="#C0C0C0" metalness={0.8} />
          </mesh>
        </group>
      ))}

      {/* Ceiling */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 24, 0]}>
        <planeGeometry args={[30, 100]} />
        <meshStandardMaterial color="#F0F0F0" />
      </mesh>

      {/* Ceiling tiles */}
      {Array.from({ length: 25 }).map((_, i) => (
        <mesh key={i} rotation={[Math.PI / 2, 0, 0]} position={[0, 23.9, -46 + i * 4]}>
          <planeGeometry args={[28, 3.8]} />
          <meshStandardMaterial color="#E8E8E8" />
        </mesh>
      ))}

      {/* Fluorescent lights */}
      {Array.from({ length: 12 }).map((_, i) => (
        <group key={i} position={[0, 22, -44 + i * 8]}>
          <mesh>
            <boxGeometry args={[3, 0.3, 1.5]} />
            <meshBasicMaterial color="#FFFFFF" />
          </mesh>
          <pointLight color="#F0F8FF" intensity={0.8} distance={15} />
        </group>
      ))}

      {/* Floating notebook papers */}
      <group ref={papersRef}>
        {Array.from({ length: 12 }).map((_, i) => {
          const baseY = 5 + Math.random() * 10;
          return (
            <mesh
              key={i}
              position={[
                (Math.random() - 0.5) * 20,
                baseY,
                (Math.random() - 0.5) * 80
              ]}
              userData={{ baseY }}
            >
              <planeGeometry args={[1.5, 2]} />
              <meshStandardMaterial color="#FFFEF0" side={THREE.DoubleSide} />
            </mesh>
          );
        })}
      </group>

      {/* Exit sign */}
      <mesh position={[0, 20, -48]}>
        <boxGeometry args={[4, 1.5, 0.3]} />
        <meshBasicMaterial color="#FF0000" />
      </mesh>

      {/* Water fountain */}
      <group position={[12, -2, 20]}>
        <mesh>
          <boxGeometry args={[1.5, 6, 2]} />
          <meshStandardMaterial color="#C0C0C0" metalness={0.5} />
        </mesh>
        <mesh position={[0, 3.5, 0]}>
          <boxGeometry args={[1.2, 0.5, 1.8]} />
          <meshStandardMaterial color="#87CEEB" />
        </mesh>
      </group>

      <ambientLight intensity={0.4} />
    </group>
  );
}

// ============================================
// 4. HIGH SCHOOL - Chaotic cafeteria
// ============================================
export function HighSchoolEnvironment({ flipTrigger: _flipTrigger = 0 }) {
  const traysRef = useRef();

  useFrame((state) => {
    if (traysRef.current) {
      traysRef.current.children.forEach((tray, i) => {
        tray.rotation.y = state.clock.elapsedTime * 0.3 + i;
        tray.position.y = tray.userData.baseY + Math.sin(state.clock.elapsedTime * 2 + i) * 0.3;
      });
    }
  });

  return (
    <group>
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -8, 0]}>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color="#8B8682" />
      </mesh>

      {/* Walls - darker, moodier */}
      <mesh position={[0, 12, -40]}>
        <planeGeometry args={[80, 40]} />
        <meshStandardMaterial color="#2F2F2F" />
      </mesh>
      <mesh position={[-40, 12, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[80, 40]} />
        <meshStandardMaterial color="#363636" />
      </mesh>
      <mesh position={[40, 12, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[80, 40]} />
        <meshStandardMaterial color="#363636" />
      </mesh>

      {/* Ceiling */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 32, 0]}>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color="#1A1A2E" />
      </mesh>

      {/* Cafeteria tables */}
      {Array.from({ length: 4 }).map((_, row) =>
        Array.from({ length: 3 }).map((_, col) => (
          <group key={`table-${row}-${col}`} position={[-20 + col * 20, -6, -15 + row * 12]}>
            {/* Table top */}
            <mesh position={[0, 2, 0]}>
              <boxGeometry args={[14, 0.5, 4]} />
              <meshStandardMaterial color="#8B4513" />
            </mesh>
            {/* Bench seats */}
            <mesh position={[0, 0.5, 3]}>
              <boxGeometry args={[14, 0.5, 1.5]} />
              <meshStandardMaterial color="#FF6B6B" />
            </mesh>
            <mesh position={[0, 0.5, -3]}>
              <boxGeometry args={[14, 0.5, 1.5]} />
              <meshStandardMaterial color="#4ECDC4" />
            </mesh>
          </group>
        ))
      )}

      {/* Floating food trays - chaos! */}
      <group ref={traysRef}>
        {Array.from({ length: 15 }).map((_, i) => {
          const baseY = 8 + Math.random() * 12;
          return (
            <group
              key={i}
              position={[
                (Math.random() - 0.5) * 50,
                baseY,
                (Math.random() - 0.5) * 50
              ]}
              userData={{ baseY }}
            >
              <mesh>
                <boxGeometry args={[2, 0.2, 1.5]} />
                <meshStandardMaterial color="#CD853F" />
              </mesh>
              {/* Food on tray */}
              <mesh position={[-0.5, 0.3, 0]}>
                <sphereGeometry args={[0.3, 8, 8]} />
                <meshStandardMaterial color="#FF6347" />
              </mesh>
              <mesh position={[0.5, 0.3, 0]}>
                <boxGeometry args={[0.4, 0.3, 0.4]} />
                <meshStandardMaterial color="#FFD700" />
              </mesh>
            </group>
          );
        })}
      </group>

      {/* Vending machines */}
      {[-30, 30].map((x, i) => (
        <group key={i} position={[x, 0, -35]}>
          <mesh position={[0, 4, 0]}>
            <boxGeometry args={[5, 10, 3]} />
            <meshStandardMaterial color={i === 0 ? '#FF0000' : '#0000FF'} />
          </mesh>
          {/* Display window */}
          <mesh position={[0, 5, 1.6]}>
            <boxGeometry args={[4, 6, 0.1]} />
            <meshStandardMaterial color="#333333" emissive="#222222" />
          </mesh>
        </group>
      ))}

      {/* Chaotic lighting - some flickering */}
      {[[-20, -10], [0, -10], [20, -10], [-20, 15], [0, 15], [20, 15]].map(([x, z], i) => (
        <pointLight
          key={i}
          position={[x, 28, z]}
          color={['#FF6B6B', '#4ECDC4', '#FFE66D'][i % 3]}
          intensity={0.6}
          distance={25}
        />
      ))}

      {/* Warning/exit lights */}
      <pointLight position={[0, 30, 0]} color="#FF4444" intensity={0.5} distance={40} />

      <ambientLight intensity={0.3} />
    </group>
  );
}

// ============================================
// 5. COLLEGE - Dorm room / study space
// ============================================
export function CollegeEnvironment({ flipTrigger: _flipTrigger = 0 }) {
  const booksRef = useRef();
  const steamRef = useRef();

  useFrame((state) => {
    if (booksRef.current) {
      booksRef.current.children.forEach((book, i) => {
        book.position.y = book.userData.baseY + Math.sin(state.clock.elapsedTime * 0.5 + i) * 0.2;
        book.rotation.y = Math.sin(state.clock.elapsedTime * 0.3 + i) * 0.1;
      });
    }
    if (steamRef.current) {
      steamRef.current.children.forEach((particle, i) => {
        particle.position.y = ((state.clock.elapsedTime * 2 + i) % 5) - 2;
        particle.position.x = Math.sin(state.clock.elapsedTime + i) * 0.3;
        particle.material.opacity = 0.3 - (particle.position.y + 2) / 5 * 0.3;
      });
    }
  });

  return (
    <group>
      {/* Floor - carpet */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -8, 0]}>
        <planeGeometry args={[50, 50]} />
        <meshStandardMaterial color="#2F4F4F" />
      </mesh>

      {/* Walls - dark for late night */}
      <mesh position={[0, 8, -25]}>
        <planeGeometry args={[50, 32]} />
        <meshStandardMaterial color="#1A1A2E" />
      </mesh>
      <mesh position={[-25, 8, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[50, 32]} />
        <meshStandardMaterial color="#16213E" />
      </mesh>
      <mesh position={[25, 8, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[50, 32]} />
        <meshStandardMaterial color="#16213E" />
      </mesh>

      {/* Ceiling */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 24, 0]}>
        <planeGeometry args={[50, 50]} />
        <meshStandardMaterial color="#0F0F1A" />
      </mesh>

      {/* Desk with lamp */}
      <group position={[10, -6, -18]}>
        {/* Desk */}
        <mesh position={[0, 2, 0]}>
          <boxGeometry args={[12, 0.5, 6]} />
          <meshStandardMaterial color="#4A3728" />
        </mesh>
        {/* Desk drawers */}
        <mesh position={[4, 0, 0]}>
          <boxGeometry args={[3, 4, 5]} />
          <meshStandardMaterial color="#3D2914" />
        </mesh>

        {/* Desk lamp */}
        <group position={[-4, 2.5, -1]}>
          <mesh position={[0, 0, 0]}>
            <cylinderGeometry args={[0.5, 0.8, 0.3, 16]} />
            <meshStandardMaterial color="#333333" />
          </mesh>
          <mesh position={[0, 2, 0]} rotation={[0.3, 0, 0]}>
            <cylinderGeometry args={[0.1, 0.1, 4, 8]} />
            <meshStandardMaterial color="#333333" />
          </mesh>
          <mesh position={[0, 4, 0.5]} rotation={[0.8, 0, 0]}>
            <coneGeometry args={[1.5, 2, 16, 1, true]} />
            <meshStandardMaterial color="#FFD700" side={THREE.DoubleSide} />
          </mesh>
          <pointLight position={[0, 3, 1]} color="#FFE4B5" intensity={2} distance={15} />
        </group>

        {/* Laptop */}
        <group position={[0, 2.5, 0]}>
          <mesh>
            <boxGeometry args={[3, 0.1, 2]} />
            <meshStandardMaterial color="#333333" />
          </mesh>
          <mesh position={[0, 1.2, -1]} rotation={[-0.3, 0, 0]}>
            <boxGeometry args={[3, 2, 0.1]} />
            <meshStandardMaterial color="#222222" emissive="#1a1a2e" emissiveIntensity={0.5} />
          </mesh>
        </group>
      </group>

      {/* Coffee mug with steam */}
      <group position={[15, -3, -16]}>
        <mesh>
          <cylinderGeometry args={[0.5, 0.4, 1.2, 16]} />
          <meshStandardMaterial color="#8B4513" />
        </mesh>
        <mesh position={[0, 0.6, 0]}>
          <cylinderGeometry args={[0.45, 0.45, 0.1, 16]} />
          <meshStandardMaterial color="#3D2914" />
        </mesh>
        {/* Steam particles */}
        <group ref={steamRef}>
          {Array.from({ length: 8 }).map((_, i) => (
            <mesh key={i} position={[0, 1 + i * 0.3, 0]}>
              <sphereGeometry args={[0.15, 8, 8]} />
              <meshBasicMaterial color="#FFFFFF" transparent opacity={0.2} />
            </mesh>
          ))}
        </group>
      </group>

      {/* Bookshelf */}
      <group position={[-20, 0, -20]}>
        <mesh position={[0, 6, 0]}>
          <boxGeometry args={[8, 16, 2]} />
          <meshStandardMaterial color="#4A3728" />
        </mesh>
        {/* Books on shelves */}
        {[2, 6, 10, 14].map((y, shelf) => (
          <group key={shelf}>
            {Array.from({ length: 6 }).map((_, i) => (
              <mesh key={i} position={[-2.5 + i * 0.9, y - 5, 0]}>
                <boxGeometry args={[0.7, 2 + Math.random(), 1.5]} />
                <meshStandardMaterial color={['#8B0000', '#00008B', '#006400', '#4B0082', '#8B4513', '#2F4F4F'][i]} />
              </mesh>
            ))}
          </group>
        ))}
      </group>

      {/* Floating books/papers - studying */}
      <group ref={booksRef}>
        {Array.from({ length: 10 }).map((_, i) => {
          const baseY = 5 + Math.random() * 10;
          return (
            <mesh
              key={i}
              position={[
                (Math.random() - 0.5) * 30,
                baseY,
                (Math.random() - 0.5) * 30
              ]}
              userData={{ baseY }}
            >
              <boxGeometry args={[1.5, 0.2, 2]} />
              <meshStandardMaterial color={['#8B0000', '#00008B', '#006400'][i % 3]} />
            </mesh>
          );
        })}
      </group>

      {/* Window with moonlight */}
      <group position={[24, 8, 0]}>
        <mesh>
          <boxGeometry args={[0.5, 12, 10]} />
          <meshStandardMaterial color="#1a1a3a" emissive="#1a1a3a" emissiveIntensity={0.3} />
        </mesh>
        <pointLight position={[3, 0, 0]} color="#B0C4DE" intensity={0.3} distance={20} />
      </group>

      {/* Bed */}
      <group position={[-10, -6, 10]}>
        <mesh position={[0, 1, 0]}>
          <boxGeometry args={[8, 2, 12]} />
          <meshStandardMaterial color="#4169E1" />
        </mesh>
        <mesh position={[0, 2.5, -5]}>
          <boxGeometry args={[7, 2, 2]} />
          <meshStandardMaterial color="#F0F8FF" />
        </mesh>
      </group>

      <ambientLight intensity={0.15} />
    </group>
  );
}

// ============================================
// 6. FIRST JOB - Office cubicles
// ============================================
export function JobEnvironment({ flipTrigger: _flipTrigger = 0 }) {
  const chartsRef = useRef();

  useFrame((state) => {
    if (chartsRef.current) {
      chartsRef.current.children.forEach((chart, i) => {
        chart.rotation.y = Math.sin(state.clock.elapsedTime * 0.2 + i) * 0.1;
      });
    }
  });

  return (
    <group>
      {/* Floor - office carpet */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -8, 0]}>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color="#4A5568" />
      </mesh>

      {/* Ceiling */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 20, 0]}>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color="#E2E8F0" />
      </mesh>

      {/* Walls */}
      <mesh position={[0, 6, -40]}>
        <planeGeometry args={[80, 28]} />
        <meshStandardMaterial color="#CBD5E0" />
      </mesh>

      {/* Cubicle farm */}
      {Array.from({ length: 3 }).map((_, row) =>
        Array.from({ length: 4 }).map((_, col) => (
          <group key={`cubicle-${row}-${col}`} position={[-24 + col * 16, -6, -20 + row * 16]}>
            {/* Cubicle walls */}
            <mesh position={[0, 3, -4]}>
              <boxGeometry args={[10, 8, 0.3]} />
              <meshStandardMaterial color="#A0AEC0" />
            </mesh>
            <mesh position={[-5, 3, 0]} rotation={[0, Math.PI / 2, 0]}>
              <boxGeometry args={[8, 8, 0.3]} />
              <meshStandardMaterial color="#A0AEC0" />
            </mesh>
            <mesh position={[5, 3, 0]} rotation={[0, Math.PI / 2, 0]}>
              <boxGeometry args={[8, 8, 0.3]} />
              <meshStandardMaterial color="#A0AEC0" />
            </mesh>

            {/* Desk */}
            <mesh position={[0, 1, -2]}>
              <boxGeometry args={[9, 0.3, 5]} />
              <meshStandardMaterial color="#718096" />
            </mesh>

            {/* Monitor */}
            <mesh position={[0, 4, -3]}>
              <boxGeometry args={[4, 3, 0.2]} />
              <meshStandardMaterial color="#1A202C" emissive="#2D3748" emissiveIntensity={0.3} />
            </mesh>
            <mesh position={[0, 2, -3]}>
              <boxGeometry args={[0.5, 2, 0.5]} />
              <meshStandardMaterial color="#2D3748" />
            </mesh>

            {/* Office chair */}
            <mesh position={[0, 0, 2]}>
              <boxGeometry args={[3, 0.5, 3]} />
              <meshStandardMaterial color="#2B6CB0" />
            </mesh>
            <mesh position={[0, 2, 3]}>
              <boxGeometry args={[3, 4, 0.5]} />
              <meshStandardMaterial color="#2B6CB0" />
            </mesh>
          </group>
        ))
      )}

      {/* Floating charts/graphs */}
      <group ref={chartsRef}>
        {Array.from({ length: 8 }).map((_, i) => (
          <group
            key={i}
            position={[
              (Math.random() - 0.5) * 50,
              10 + Math.random() * 8,
              (Math.random() - 0.5) * 50
            ]}
          >
            <mesh>
              <planeGeometry args={[4, 3]} />
              <meshStandardMaterial color="#FFFFFF" side={THREE.DoubleSide} />
            </mesh>
            {/* Bar chart */}
            {Array.from({ length: 5 }).map((_, j) => (
              <mesh key={j} position={[-1.2 + j * 0.6, -1 + Math.random() * 1.5, 0.1]}>
                <boxGeometry args={[0.4, 0.5 + Math.random() * 1.5, 0.1]} />
                <meshStandardMaterial color={['#3182CE', '#38A169', '#E53E3E', '#DD6B20', '#805AD5'][j]} />
              </mesh>
            ))}
          </group>
        ))}
      </group>

      {/* Water cooler */}
      <group position={[35, -4, 0]}>
        <mesh position={[0, 3, 0]}>
          <cylinderGeometry args={[1.5, 1.5, 8, 16]} />
          <meshStandardMaterial color="#E2E8F0" />
        </mesh>
        <mesh position={[0, 8, 0]}>
          <cylinderGeometry args={[1.2, 1.2, 3, 16]} />
          <meshStandardMaterial color="#63B3ED" transparent opacity={0.5} />
        </mesh>
      </group>

      {/* Fluorescent lights */}
      {Array.from({ length: 4 }).map((_, row) =>
        Array.from({ length: 4 }).map((_, col) => (
          <group key={`light-${row}-${col}`} position={[-24 + col * 16, 19, -24 + row * 16]}>
            <mesh>
              <boxGeometry args={[6, 0.3, 2]} />
              <meshBasicMaterial color="#FFFFFF" />
            </mesh>
            <pointLight color="#FFFFFF" intensity={0.5} distance={20} />
          </group>
        ))
      )}

      <ambientLight intensity={0.4} />
    </group>
  );
}

// ============================================
// 7. NASA - Mission Control
// ============================================
export function NasaEnvironment({ flipTrigger: _flipTrigger = 0 }) {
  const screensRef = useRef();
  const dataRef = useRef();

  useFrame((state) => {
    if (screensRef.current) {
      screensRef.current.children.forEach((screen, i) => {
        if (screen.material && screen.material.emissiveIntensity !== undefined) {
          screen.material.emissiveIntensity = 0.3 + Math.sin(state.clock.elapsedTime * 3 + i) * 0.1;
        }
      });
    }
    if (dataRef.current) {
      dataRef.current.children.forEach((particle, i) => {
        particle.position.y = 20 - ((state.clock.elapsedTime * 5 + i * 2) % 30);
      });
    }
  });

  return (
    <group>
      {/* Floor - dark tech */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -8, 0]}>
        <planeGeometry args={[80, 60]} />
        <meshStandardMaterial color="#0A0A1A" />
      </mesh>

      {/* Walls */}
      <mesh position={[0, 12, -30]}>
        <planeGeometry args={[80, 40]} />
        <meshStandardMaterial color="#0D0D1A" />
      </mesh>

      {/* Main display wall - huge screens */}
      <group position={[0, 10, -28]}>
        {/* Giant center screen */}
        <mesh position={[0, 5, 0]}>
          <boxGeometry args={[30, 15, 0.5]} />
          <meshStandardMaterial color="#001122" emissive="#003366" emissiveIntensity={0.3} />
        </mesh>
        {/* Side screens */}
        <mesh position={[-22, 5, 2]}>
          <boxGeometry args={[12, 12, 0.5]} />
          <meshStandardMaterial color="#001122" emissive="#006633" emissiveIntensity={0.3} />
        </mesh>
        <mesh position={[22, 5, 2]}>
          <boxGeometry args={[12, 12, 0.5]} />
          <meshStandardMaterial color="#001122" emissive="#660033" emissiveIntensity={0.3} />
        </mesh>
      </group>

      {/* Control consoles - tiered */}
      {[0, 8, 16].map((z, tier) => (
        <group key={tier} position={[0, -6 + tier * 0.5, z]}>
          {Array.from({ length: 6 - tier }).map((_, i) => (
            <group key={i} position={[-20 + tier * 5 + i * (10 - tier), 0, 0]}>
              {/* Console desk */}
              <mesh position={[0, 1.5, 0]}>
                <boxGeometry args={[8, 3, 4]} />
                <meshStandardMaterial color="#1A1A2E" />
              </mesh>
              {/* Screens on console */}
              <group ref={tier === 0 && i === 2 ? screensRef : null}>
                <mesh position={[-2, 4, -1]}>
                  <boxGeometry args={[3, 2.5, 0.2]} />
                  <meshStandardMaterial color="#000510" emissive="#00BFFF" emissiveIntensity={0.3} />
                </mesh>
                <mesh position={[2, 4, -1]}>
                  <boxGeometry args={[3, 2.5, 0.2]} />
                  <meshStandardMaterial color="#000510" emissive="#00FF88" emissiveIntensity={0.3} />
                </mesh>
              </group>
              {/* Chair */}
              <mesh position={[0, 0, 4]}>
                <boxGeometry args={[3, 0.5, 3]} />
                <meshStandardMaterial color="#2D2D44" />
              </mesh>
            </group>
          ))}
        </group>
      ))}

      {/* Data stream particles */}
      <group ref={dataRef}>
        {Array.from({ length: 50 }).map((_, i) => (
          <mesh
            key={i}
            position={[
              (Math.random() - 0.5) * 60,
              Math.random() * 30,
              (Math.random() - 0.5) * 40
            ]}
          >
            <boxGeometry args={[0.1, 0.5 + Math.random() * 0.5, 0.1]} />
            <meshBasicMaterial color="#00FF88" transparent opacity={0.6} />
          </mesh>
        ))}
      </group>

      {/* NASA logo area */}
      <mesh position={[0, 22, -29]}>
        <circleGeometry args={[4, 32]} />
        <meshStandardMaterial color="#0B3D91" />
      </mesh>

      {/* Ceiling - dark with tech panels */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 28, 0]}>
        <planeGeometry args={[80, 60]} />
        <meshStandardMaterial color="#050510" />
      </mesh>

      {/* Blue ambient tech lighting */}
      <pointLight position={[0, 20, -20]} color="#00BFFF" intensity={1} distance={40} />
      <pointLight position={[-30, 10, 0]} color="#00FF88" intensity={0.5} distance={30} />
      <pointLight position={[30, 10, 0]} color="#FF6B00" intensity={0.5} distance={30} />

      <ambientLight intensity={0.15} />
    </group>
  );
}

// ============================================
// 8. ROCKET - Launch pad
// ============================================
export function RocketEnvironment({ flipTrigger: _flipTrigger = 0 }) {
  const flameRef = useRef();
  const smokeRef = useRef();

  useFrame((state) => {
    if (flameRef.current) {
      flameRef.current.children.forEach((flame, i) => {
        flame.scale.y = 1 + Math.sin(state.clock.elapsedTime * 10 + i) * 0.3;
        flame.position.y = -12 + Math.sin(state.clock.elapsedTime * 8 + i) * 0.5;
      });
    }
    if (smokeRef.current) {
      smokeRef.current.children.forEach((cloud, i) => {
        const t = (state.clock.elapsedTime * 0.5 + i * 0.2) % 4;
        cloud.position.y = -10 + t * 10;
        cloud.position.x = cloud.userData.startX + Math.sin(t * 2 + i) * 5;
        cloud.scale.setScalar(1 + t * 0.5);
        cloud.material.opacity = Math.max(0, 0.5 - t * 0.12);
      });
    }
  });

  return (
    <group>
      {/* Ground - launch pad concrete */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -15, 0]}>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#3A3A3A" />
      </mesh>

      {/* Launch pad platform */}
      <mesh position={[0, -14, 0]}>
        <cylinderGeometry args={[15, 15, 2, 32]} />
        <meshStandardMaterial color="#4A4A4A" />
      </mesh>

      {/* Night sky dome */}
      <mesh>
        <sphereGeometry args={[80, 32, 32]} />
        <meshBasicMaterial color="#0A0A1A" side={THREE.BackSide} />
      </mesh>

      {/* Stars */}
      {Array.from({ length: 200 }).map((_, i) => {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI * 0.5;
        const r = 75;
        return (
          <mesh
            key={i}
            position={[
              r * Math.sin(phi) * Math.cos(theta),
              r * Math.cos(phi) + 10,
              r * Math.sin(phi) * Math.sin(theta)
            ]}
          >
            <sphereGeometry args={[0.1 + Math.random() * 0.2, 4, 4]} />
            <meshBasicMaterial color="#FFFFFF" />
          </mesh>
        );
      })}

      {/* Rocket */}
      <group position={[0, 10, 0]}>
        {/* Rocket body */}
        <mesh position={[0, 0, 0]}>
          <cylinderGeometry args={[3, 3, 25, 32]} />
          <meshStandardMaterial color="#E8E8E8" />
        </mesh>
        {/* Nose cone */}
        <mesh position={[0, 15, 0]}>
          <coneGeometry args={[3, 8, 32]} />
          <meshStandardMaterial color="#FF4500" />
        </mesh>
        {/* Fins */}
        {[0, 120, 240].map((angle, i) => (
          <mesh
            key={i}
            position={[
              Math.sin(angle * Math.PI / 180) * 3,
              -10,
              Math.cos(angle * Math.PI / 180) * 3
            ]}
            rotation={[0, -angle * Math.PI / 180, 0]}
          >
            <boxGeometry args={[0.5, 8, 4]} />
            <meshStandardMaterial color="#FF4500" />
          </mesh>
        ))}
        {/* Engine nozzles */}
        <mesh position={[0, -13, 0]}>
          <cylinderGeometry args={[2.5, 3.5, 3, 32]} />
          <meshStandardMaterial color="#333333" metalness={0.8} />
        </mesh>
      </group>

      {/* Launch tower/gantry */}
      <group position={[12, 0, 0]}>
        {/* Main tower */}
        <mesh position={[0, 15, 0]}>
          <boxGeometry args={[4, 50, 4]} />
          <meshStandardMaterial color="#8B0000" />
        </mesh>
        {/* Cross beams */}
        {Array.from({ length: 8 }).map((_, i) => (
          <mesh key={i} position={[-4, -10 + i * 6, 0]}>
            <boxGeometry args={[8, 0.5, 1]} />
            <meshStandardMaterial color="#8B0000" />
          </mesh>
        ))}
        {/* Arm to rocket */}
        <mesh position={[-6, 20, 0]}>
          <boxGeometry args={[10, 2, 3]} />
          <meshStandardMaterial color="#666666" />
        </mesh>
      </group>

      {/* Flames */}
      <group ref={flameRef}>
        {Array.from({ length: 20 }).map((_, i) => (
          <mesh
            key={i}
            position={[
              (Math.random() - 0.5) * 4,
              -12,
              (Math.random() - 0.5) * 4
            ]}
          >
            <coneGeometry args={[0.8 + Math.random() * 0.5, 5 + Math.random() * 3, 8]} />
            <meshBasicMaterial
              color={['#FFFF00', '#FF8C00', '#FF4500', '#FF0000'][i % 4]}
              transparent
              opacity={0.8}
            />
          </mesh>
        ))}
      </group>

      {/* Smoke clouds */}
      <group ref={smokeRef}>
        {Array.from({ length: 25 }).map((_, i) => {
          const startX = (Math.random() - 0.5) * 20;
          return (
            <mesh
              key={i}
              position={[startX, -10, (Math.random() - 0.5) * 10]}
              userData={{ startX }}
            >
              <sphereGeometry args={[2 + Math.random() * 2, 8, 8]} />
              <meshBasicMaterial color="#888888" transparent opacity={0.4} />
            </mesh>
          );
        })}
      </group>

      {/* Fire lighting */}
      <pointLight position={[0, -10, 0]} color="#FF4500" intensity={3} distance={50} />
      <pointLight position={[0, -15, 0]} color="#FFD700" intensity={2} distance={40} />

      <ambientLight intensity={0.2} />
    </group>
  );
}

// ============================================
// 9. MOON - Lunar surface
// ============================================
export function MoonEnvironment({ flipTrigger: _flipTrigger = 0 }) {
  const earthRef = useRef();
  const flagRef = useRef();

  useFrame((state) => {
    if (earthRef.current) {
      earthRef.current.rotation.y = state.clock.elapsedTime * 0.05;
    }
    if (flagRef.current) {
      flagRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 2) * 0.05;
    }
  });

  return (
    <group>
      {/* Lunar surface */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -8, 0]}>
        <planeGeometry args={[150, 150]} />
        <meshStandardMaterial color="#808080" roughness={1} />
      </mesh>

      {/* Space sky dome */}
      <mesh>
        <sphereGeometry args={[100, 32, 32]} />
        <meshBasicMaterial color="#000005" side={THREE.BackSide} />
      </mesh>

      {/* Dense starfield */}
      {Array.from({ length: 500 }).map((_, i) => {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;
        const r = 95;
        return (
          <mesh
            key={i}
            position={[
              r * Math.sin(phi) * Math.cos(theta),
              r * Math.cos(phi),
              r * Math.sin(phi) * Math.sin(theta)
            ]}
          >
            <sphereGeometry args={[0.05 + Math.random() * 0.1, 4, 4]} />
            <meshBasicMaterial color="#FFFFFF" />
          </mesh>
        );
      })}

      {/* Earth in the sky */}
      <group ref={earthRef} position={[40, 40, -50]}>
        <mesh>
          <sphereGeometry args={[12, 32, 32]} />
          <meshStandardMaterial color="#1E90FF" />
        </mesh>
        {/* Continents */}
        <mesh>
          <sphereGeometry args={[12.1, 32, 32]} />
          <meshStandardMaterial color="#228B22" transparent opacity={0.5} />
        </mesh>
        {/* Atmosphere */}
        <mesh>
          <sphereGeometry args={[13, 32, 32]} />
          <meshBasicMaterial color="#87CEEB" transparent opacity={0.15} />
        </mesh>
        <pointLight color="#87CEEB" intensity={0.5} distance={100} />
      </group>

      {/* Craters */}
      {Array.from({ length: 20 }).map((_, i) => {
        const x = (Math.random() - 0.5) * 100;
        const z = (Math.random() - 0.5) * 100;
        const size = 2 + Math.random() * 8;
        return (
          <group key={i} position={[x, -8, z]}>
            {/* Crater rim */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, 0]}>
              <ringGeometry args={[size * 0.7, size, 32]} />
              <meshStandardMaterial color="#909090" />
            </mesh>
            {/* Crater floor */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.3, 0]}>
              <circleGeometry args={[size * 0.7, 32]} />
              <meshStandardMaterial color="#606060" />
            </mesh>
          </group>
        );
      })}

      {/* Lunar module */}
      <group position={[15, -5, -20]}>
        {/* Body */}
        <mesh position={[0, 3, 0]}>
          <boxGeometry args={[5, 4, 5]} />
          <meshStandardMaterial color="#FFD700" metalness={0.8} roughness={0.3} />
        </mesh>
        {/* Legs */}
        {[[-2, -2], [2, -2], [-2, 2], [2, 2]].map(([x, z], i) => (
          <mesh key={i} position={[x, 0, z]} rotation={[0, 0, x > 0 ? 0.3 : -0.3]}>
            <cylinderGeometry args={[0.15, 0.15, 4, 8]} />
            <meshStandardMaterial color="#C0C0C0" />
          </mesh>
        ))}
        {/* Foot pads */}
        {[[-3, -3], [3, -3], [-3, 3], [3, 3]].map(([x, z], i) => (
          <mesh key={i} position={[x, -2, z]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[1, 16]} />
            <meshStandardMaterial color="#C0C0C0" />
          </mesh>
        ))}
      </group>

      {/* American flag */}
      <group position={[10, -6, -15]}>
        {/* Pole */}
        <mesh position={[0, 3, 0]}>
          <cylinderGeometry args={[0.1, 0.1, 8, 8]} />
          <meshStandardMaterial color="#C0C0C0" />
        </mesh>
        {/* Flag */}
        <group ref={flagRef} position={[1.5, 6, 0]}>
          <mesh>
            <planeGeometry args={[3, 2]} />
            <meshStandardMaterial color="#BF0A30" side={THREE.DoubleSide} />
          </mesh>
        </group>
      </group>

      {/* Astronaut footprints trail */}
      {Array.from({ length: 10 }).map((_, i) => (
        <mesh
          key={i}
          rotation={[-Math.PI / 2, 0, Math.random() * 0.3]}
          position={[5 + i * 2, -7.9, -10 + Math.sin(i) * 2]}
        >
          <planeGeometry args={[0.4, 0.8]} />
          <meshStandardMaterial color="#707070" />
        </mesh>
      ))}

      {/* Sun light from the side */}
      <directionalLight position={[50, 30, 30]} intensity={1.5} color="#FFFACD" />

      <ambientLight intensity={0.1} />
    </group>
  );
}

// ============================================
// Helper: Get background component by name
// ============================================
export function getLevelBackground(backgroundName, flipTrigger) {
  switch (backgroundName) {
    case 'daycare':
      return <DaycareEnvironment flipTrigger={flipTrigger} />;
    case 'elementary':
      return <ElementaryEnvironment flipTrigger={flipTrigger} />;
    case 'middleschool':
      return <MiddleSchoolEnvironment flipTrigger={flipTrigger} />;
    case 'highschool':
      return <HighSchoolEnvironment flipTrigger={flipTrigger} />;
    case 'college':
      return <CollegeEnvironment flipTrigger={flipTrigger} />;
    case 'job':
      return <JobEnvironment flipTrigger={flipTrigger} />;
    case 'nasa':
      return <NasaEnvironment flipTrigger={flipTrigger} />;
    case 'rocket':
      return <RocketEnvironment flipTrigger={flipTrigger} />;
    case 'moon':
      return <MoonEnvironment flipTrigger={flipTrigger} />;
    // 'blackhole' is handled separately by existing BlackHoleEnvironment
    default:
      return null;
  }
}