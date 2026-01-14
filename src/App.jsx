// src/App.jsx
import React, { useState, useMemo, useRef, useEffect, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { RoundedBox, Text, OrbitControls, Html, Environment, Line } from '@react-three/drei';
import * as THREE from 'three';
import './App.css';

/* ---------- Constants ---------- */
const COLORS={ red:'#ef4444', blue:'#3b82f6', yellow:'#eab308', white:'#ffffff', orange:'#f97316', green:'#22c55e', black:'#121212', wormhole:'#dda15e' };
const FACE_COLORS={1:COLORS.red,2:COLORS.green,3:COLORS.white,4:COLORS.orange,5:COLORS.blue,6:COLORS.yellow};
const ANTIPODAL_COLOR={1:4,4:1,2:5,5:2,3:6,6:3};
const DIR_TO_VEC={PX:[1,0,0],NX:[-1,0,0],PY:[0,1,0],NY:[0,-1,0],PZ:[0,0,1],NZ:[0,0,-1]};
const VEC_TO_DIR=(x,y,z)=>(x===1&&y===0&&z===0)?'PX':(x===-1&&y===0&&z===0)?'NX':(x===0&&y===1&&z===0)?'PY':(x===0&&y===-1&&z===0)?'NY':(x===0&&y===0&&z===1)?'PZ':'NZ';

/* ---------- Helpers: cube state ---------- */

// Get grid (r,c) position for a sticker based on its original position
// Ensures M*-001 is always top-left when viewing face head-on
const getGridRC = (origPos, origDir, size) => {
  const { x, y, z } = origPos;
  
  if (origDir === 'PZ') {
    // Red face (front) - viewed from front
    return { r: size - 1 - y, c: x };
  }
  if (origDir === 'NZ') {
    // Orange face (back) - viewed from back (flipped horizontally)
    return { r: size - 1 - y, c: size - 1 - x };
  }
  if (origDir === 'PX') {
    // Blue face (right) - viewed from right
    return { r: size - 1 - y, c: size - 1 - z };
  }
  if (origDir === 'NX') {
    // Green face (left) - viewed from left (flipped horizontally)
    return { r: size - 1 - y, c: z };
  }
  if (origDir === 'PY') {
    // White face (top) - viewed from top, looking down from +Y
    return { r: z, c: x };
  }
  // NY - Yellow face (bottom) - viewed from bottom, looking up from -Y
  return { r: size - 1 - z, c: x };
};

// Get manifold-grid ID like "M1-001"
const getManifoldGridId = (sticker, size) => {
  const { r, c } = getGridRC(sticker.origPos, sticker.origDir, size);
  const idx = r * size + c + 1;
  const idStr = String(idx).padStart(3, '0');
  return `M${sticker.orig}-${idStr}`;
};

const makeCubies=(size)=>
  Array.from({length:size},(_,x)=>
    Array.from({length:size},(_,y)=>
      Array.from({length:size},(_,z)=>{
        const stickers={};
        if(x===size-1) stickers.PX={curr:5,orig:5,flips:0,origPos:{x,y,z},origDir:'PX'};
        if(x===0)      stickers.NX={curr:2,orig:2,flips:0,origPos:{x,y,z},origDir:'NX'};
        if(y===size-1) stickers.PY={curr:3,orig:3,flips:0,origPos:{x,y,z},origDir:'PY'};
        if(y===0)      stickers.NY={curr:6,orig:6,flips:0,origPos:{x,y,z},origDir:'NY'};
        if(z===size-1) stickers.PZ={curr:1,orig:1,flips:0,origPos:{x,y,z},origDir:'PZ'};
        if(z===0)      stickers.NZ={curr:4,orig:4,flips:0,origPos:{x,y,z},origDir:'NZ'};
        return { x,y,z, stickers };
      })
    )
  );

const rotateVec90=(vx,vy,vz, axis, dir)=>{
  if (axis==='col'){ const ny=-dir*vz, nz= dir*vy; return [vx,ny,nz]; }
  if (axis==='row'){ const nx= dir*vz, nz=-dir*vx; return [nx,vy,nz]; }
  const nx=-dir*vy, ny= dir*vx; return [nx,ny,vz];
};
const rotateStickers=(stickers,axis,dir)=>{
  const next={};
  for (const [k,st] of Object.entries(stickers)){
    const [vx,vy,vz]=DIR_TO_VEC[k]; const [rx,ry,rz]=rotateVec90(vx,vy,vz,axis,dir);
    next[VEC_TO_DIR(rx,ry,rz)] = st;
  }
  return next;
};

const clone3D = (arr) => arr.map(L=>L.map(R=>R.slice()));
const rotateSliceCubies=(cubies,size,axis,sliceIndex,dir)=>{
  const k=(size-1)/2, next=clone3D(cubies), moves=[];
  for (let x=0;x<size;x++) for (let y=0;y<size;y++) for (let z=0;z<size;z++){
    const inSlice=(axis==='col'&&x===sliceIndex)||(axis==='row'&&y===sliceIndex)||(axis==='depth'&&z===sliceIndex);
    if(!inSlice) continue;
    let cx=x-k, cy=y-k, cz=z-k;
    if (axis==='col'){ const ny=-dir*cz, nz= dir*cy; cy=ny; cz=nz; }
    else if(axis==='row'){ const nx= dir*cz, nz=-dir*cx; cx=nx; cz=nz; }
    else { const nx=-dir*cy, ny= dir*cx; cx=nx; cy=ny; }
    const nxI=Math.round(cx+k), nyI=Math.round(cy+k), nzI=Math.round(cz+k);
    moves.push({from:[x,y,z],to:[nxI,nyI,nzI]});
  }
  const originals=new Map();
  for(const m of moves) originals.set(m.from.join(','), next[m.from[0]][m.from[1]][m.from[2]]);
  for(const m of moves){
    const src=originals.get(m.from.join(','));
    next[m.to[0]][m.to[1]][m.to[2]]={
      ...src,
      x:m.to[0], y:m.to[1], z:m.to[2],
      stickers: rotateStickers(src.stickers, axis, dir)
    };
  }
  return next;
};

// Build map from manifold-grid ID to current location
const buildManifoldGridMap = (cubies, size) => {
  const map = new Map();
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      for (let z = 0; z < size; z++) {
        const c = cubies[x][y][z];
        for (const [dKey, st] of Object.entries(c.stickers)) {
          const gridId = getManifoldGridId(st, size);
          map.set(gridId, { x, y, z, dirKey: dKey, sticker: st });
        }
      }
    }
  }
  return map;
};

// Find antipodal sticker using manifold-grid mapping
const findAntipodalStickerByGrid = (manifoldMap, sticker, size) => {
  const { r, c } = getGridRC(sticker.origPos, sticker.origDir, size);
  const idx = r * size + c + 1;
  const antipodalManifold = ANTIPODAL_COLOR[sticker.orig];
  const idStr = String(idx).padStart(3, '0');
  const antipodalGridId = `M${antipodalManifold}-${idStr}`;
  return manifoldMap.get(antipodalGridId) || null;
};

const flipStickerPair=(state, size, x, y, z, dirKey, manifoldMap)=>{
  const next=clone3D(state);
  const cubie = next[x]?.[y]?.[z];
  const sticker = cubie?.stickers?.[dirKey];
  if (!sticker) return next;
  
  const sticker1Loc = { x, y, z, dirKey, sticker };
  const sticker2Loc = findAntipodalStickerByGrid(manifoldMap, sticker, size);
  
  const applyFlip = (loc) => {
    if (!loc) return;
    const c = next[loc.x][loc.y][loc.z];
    const st = c.stickers[loc.dirKey]; 
    const stickers = {...c.stickers};
    stickers[loc.dirKey] = { 
      ...st,
      curr: ANTIPODAL_COLOR[st.curr], 
      flips: (st.flips||0) + 1 
    };
    next[loc.x][loc.y][loc.z] = { ...c, stickers };
  };
  
  applyFlip(sticker1Loc);
  applyFlip(sticker2Loc);
  
  return next;
};

const getStickerWorldPos = (x, y, z, dirKey, size, explosionFactor = 0) => {
  const k = (size - 1) / 2;
  const base = [x - k, y - k, z - k];
  
  const exploded = [
    base[0] * (1 + explosionFactor * 1.8),
    base[1] * (1 + explosionFactor * 1.8),
    base[2] * (1 + explosionFactor * 1.8)
  ];
  
  const offset = 0.52;
  switch(dirKey) {
    case 'PX': return [exploded[0] + offset, exploded[1], exploded[2]];
    case 'NX': return [exploded[0] - offset, exploded[1], exploded[2]];
    case 'PY': return [exploded[0], exploded[1] + offset, exploded[2]];
    case 'NY': return [exploded[0], exploded[1] - offset, exploded[2]];
    case 'PZ': return [exploded[0], exploded[1], exploded[2] + offset];
    case 'NZ': return [exploded[0], exploded[1], exploded[2] - offset];
    default: return exploded;
  }
};

const getStickerWorldPosFromMesh = (meshRef, dirKey) => {
  if (!meshRef) return null;
  
  const worldPos = new THREE.Vector3();
  meshRef.getWorldPosition(worldPos);
  
  const worldQuat = new THREE.Quaternion();
  meshRef.getWorldQuaternion(worldQuat);
  
  const localOffset = new THREE.Vector3();
  const offset = 0.52;
  switch(dirKey) {
    case 'PX': localOffset.set(offset, 0, 0); break;
    case 'NX': localOffset.set(-offset, 0, 0); break;
    case 'PY': localOffset.set(0, offset, 0); break;
    case 'NY': localOffset.set(0, -offset, 0); break;
    case 'PZ': localOffset.set(0, 0, offset); break;
    case 'NZ': localOffset.set(0, 0, -offset); break;
  }
  
  localOffset.applyQuaternion(worldQuat);
  worldPos.add(localOffset);
  
  return [worldPos.x, worldPos.y, worldPos.z];
};

const faceRCFor=(dirKey,x,y,z,size)=> {
  if (dirKey === 'PZ') {
    return { r: size - 1 - y, c: x };
  }
  if (dirKey === 'NZ') {
    return { r: size - 1 - y, c: size - 1 - x };
  }
  if (dirKey === 'PX') {
    return { r: size - 1 - y, c: size - 1 - z };
  }
  if (dirKey === 'NX') {
    return { r: size - 1 - y, c: z };
  }
  if (dirKey === 'PY') {
    return { r: z, c: x };
  }
  // NY
  return { r: size - 1 - z, c: x };
};
const faceValue=(dirKey,x,y,z,size)=>{ 
  const { r,c }=faceRCFor(dirKey,x,y,z,size); 
  // Latin square: value = (row + col) mod size + 1
  return ((r + c) % size) + 1;
};

const play = (src) => { try { const a = new Audio(src); a.currentTime = 0; a.volume = 0.5; a.play().catch(()=>{}); } catch(_){} };
const vibrate = (ms=18) => { if (typeof navigator !== 'undefined' && 'vibrate' in navigator) try{ navigator.vibrate(ms); }catch(_){} };

/* ---------- NEW: Smart tunnel routing that avoids blocks ---------- */
const calculateSmartControlPoint = (start, end, size) => {
  const vStart = new THREE.Vector3(...start);
  const vEnd = new THREE.Vector3(...end);
  const midPoint = new THREE.Vector3().addVectors(vStart, vEnd).multiplyScalar(0.5);
  
  // Calculate which axis the tunnel travels along
  const delta = new THREE.Vector3().subVectors(vEnd, vStart);
  const dx = Math.abs(delta.x);
  const dy = Math.abs(delta.y);
  const dz = Math.abs(delta.z);
  
  const cubeRadius = ((size - 1) / 2) * 1.4;
  
  // Push perpendicular to the tunnel's main axis
  // Choose the perpendicular axis with the larger midpoint component
  if (dx >= dy && dx >= dz) {
    // X-axis tunnel - push along Y or Z
    if (Math.abs(midPoint.y) >= Math.abs(midPoint.z)) {
      midPoint.y = midPoint.y >= 0 ? cubeRadius : -cubeRadius;
    } else {
      midPoint.z = midPoint.z >= 0 ? cubeRadius : -cubeRadius;
    }
  } else if (dy >= dx && dy >= dz) {
    // Y-axis tunnel - push along X or Z
    if (Math.abs(midPoint.x) >= Math.abs(midPoint.z)) {
      midPoint.x = midPoint.x >= 0 ? cubeRadius : -cubeRadius;
    } else {
      midPoint.z = midPoint.z >= 0 ? cubeRadius : -cubeRadius;
    }
  } else {
    // Z-axis tunnel - push along X or Y
    if (Math.abs(midPoint.x) >= Math.abs(midPoint.y)) {
      midPoint.x = midPoint.x >= 0 ? cubeRadius : -cubeRadius;
    } else {
      midPoint.y = midPoint.y >= 0 ? cubeRadius : -cubeRadius;
    }
  }
  
  return midPoint;
};

/* ---------- WELCOME SCREEN COMPONENTS (PRESERVED) ---------- */

const IntroTunnel = ({ start, end, color1, color2, opacity = 0.8, groupId }) => {
  const linesRef = useRef([]);
  const pulseT = useRef(Math.random() * Math.PI * 2);
  
  const strandConfig = useMemo(() => {
    const count = 20;
    return Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 4;
      const radiusFactor = Math.sqrt(i / count);
      return {
        id: i,
        angle,
        radius: 0.1 + radiusFactor * 0.25,
        baseOpacity: 0.3 + (1 - radiusFactor) * 0.5
      };
    });
  }, []);

  const colorArray = useMemo(() => {
    const c1 = new THREE.Color(color1);
    const c2 = new THREE.Color(color2);
    const colors = new Float32Array(30 * 3);
    
    for (let j = 0; j < 30; j++) {
      const t = j / 29;
      const color = new THREE.Color().lerpColors(c1, c2, t);
      colors[j * 3] = color.r;
      colors[j * 3 + 1] = color.g;
      colors[j * 3 + 2] = color.b;
    }
    return colors;
  }, [color1, color2]);

  useFrame((_, delta) => {
    pulseT.current += delta * 2;
    const pulse = Math.sin(pulseT.current) * 0.1 + 0.9;
    
    linesRef.current.forEach((line, i) => {
      if (!line) return;
      const config = strandConfig[i];
      if (line.material) {
        line.material.opacity = config.baseOpacity * pulse * opacity;
      }
      
      const vStart = new THREE.Vector3(...start);
      const vEnd = new THREE.Vector3(...end);
      const midPoint = new THREE.Vector3().addVectors(vStart, vEnd).multiplyScalar(0.5);
      
      const offsetX = Math.cos(config.angle) * config.radius;
      const offsetY = Math.sin(config.angle) * config.radius;
      
      const dir = new THREE.Vector3().subVectors(vEnd, vStart).normalize();
      const up = new THREE.Vector3(0, 1, 0);
      const right = new THREE.Vector3().crossVectors(dir, up).normalize();
      const trueUp = new THREE.Vector3().crossVectors(right, dir).normalize();
      
      const offsetVec = new THREE.Vector3()
        .addScaledVector(right, offsetX)
        .addScaledVector(trueUp, offsetY);
      
      const controlPoint = midPoint.clone().add(offsetVec);
      const curve = new THREE.QuadraticBezierCurve3(vStart, controlPoint, vEnd);
      const points = curve.getPoints(29);
      
      const positions = line.geometry.attributes.position.array;
      for (let j = 0; j < points.length; j++) {
        positions[j * 3] = points[j].x;
        positions[j * 3 + 1] = points[j].y;
        positions[j * 3 + 2] = points[j].z;
      }
      line.geometry.attributes.position.needsUpdate = true;
    });
  });

  return (
    <group>
      {strandConfig.map((strand, i) => (
        <line key={strand.id} ref={el => linesRef.current[i] = el}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={30}
              array={new Float32Array(30 * 3)}
              itemSize={3}
            />
            <bufferAttribute
              attach="attributes-color"
              count={30}
              array={colorArray}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial
            vertexColors
            transparent
            opacity={strand.baseOpacity * opacity}
            linewidth={1.5}
          />
        </line>
      ))}
    </group>
  );
};

const WormParticle = ({ start, end, color1, color2, startTime, currentTime, onComplete }) => {
  const particleRef = useRef();
  const trailRef = useRef();
  const glowRef = useRef();
  
  const duration = 1.5;
  const progress = useMemo(() => {
    if (currentTime < startTime) return 0;
    const elapsed = currentTime - startTime;
    if (elapsed >= duration) {
      if (onComplete && elapsed < duration + 0.1) onComplete();
      return 1;
    }
    const t = elapsed / duration;
    return t < 0.5 ? 4 * t ** 3 : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }, [currentTime, startTime, duration, onComplete]);
  
  const { position, color } = useMemo(() => {
    const vStart = new THREE.Vector3(...start);
    const vEnd = new THREE.Vector3(...end);
    const midPoint = new THREE.Vector3().addVectors(vStart, vEnd).multiplyScalar(0.5);
    
    const dir = new THREE.Vector3().subVectors(vEnd, vStart).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(dir, up).normalize();
    const offset = right.multiplyScalar(0.2);
    const controlPoint = midPoint.clone().add(offset);
    
    const curve = new THREE.QuadraticBezierCurve3(vStart, controlPoint, vEnd);
    const point = curve.getPoint(progress);
    
    const c1 = new THREE.Color(color1);
    const c2 = new THREE.Color(color2);
    const mixedColor = new THREE.Color().lerpColors(c1, c2, progress);
    
    return {
      position: [point.x, point.y, point.z],
      color: mixedColor
    };
  }, [start, end, color1, color2, progress]);
  
  const pulseScale = 1 + Math.sin(currentTime * 10) * 0.2;
  
  if (progress >= 1) return null;
  
  return (
    <group position={position}>
      <mesh ref={particleRef} scale={[pulseScale, pulseScale, pulseScale]}>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.9}
        />
      </mesh>
      <mesh ref={glowRef} scale={[pulseScale * 1.5, pulseScale * 1.5, pulseScale * 1.5]}>
        <sphereGeometry args={[0.25, 16, 16]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.3}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh scale={[0.8, 0.8, 0.8]}>
        <sphereGeometry args={[0.1, 12, 12]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.5}
        />
      </mesh>
    </group>
  );
};

const ArrivalBurst = ({ position, color, startTime, currentTime }) => {
  const particlesRef = useRef([]);
  
  const elapsed = currentTime - startTime;
  const duration = 0.5;
  const progress = Math.min(elapsed / duration, 1);
  
  const particleCount = 12;
  const particles = useMemo(() => {
    return Array.from({ length: particleCount }, (_, i) => {
      const angle = (i / particleCount) * Math.PI * 2;
      const speed = 0.5 + Math.random() * 0.5;
      return {
        id: i,
        angle,
        speed,
        elevation: (Math.random() - 0.5) * Math.PI * 0.5
      };
    });
  }, []);
  
  if (progress >= 1) return null;
  
  return (
    <group position={position}>
      {particles.map((p) => {
        const distance = progress * p.speed;
        const x = Math.cos(p.angle) * Math.cos(p.elevation) * distance;
        const y = Math.sin(p.elevation) * distance;
        const z = Math.sin(p.angle) * Math.cos(p.elevation) * distance;
        const scale = (1 - progress) * 0.8;
        
        return (
          <mesh key={p.id} position={[x, y, z]} scale={[scale, scale, scale]}>
            <sphereGeometry args={[0.08, 8, 8]} />
            <meshBasicMaterial
              color={color}
              transparent
              opacity={1 - progress}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        );
      })}
    </group>
  );
};

const IntroSticker = ({ pos, rot, color, emissive = 0, isBack = false }) => (
  <mesh position={pos} rotation={rot}>
    <planeGeometry args={[0.82, 0.82]} />
    <meshStandardMaterial
      color={color}
      roughness={isBack ? 0.4 : 0.18}
      metalness={isBack ? 0.1 : 0}
      side={THREE.DoubleSide}
      emissive={color}
      emissiveIntensity={isBack ? 0.08 : emissive}
      transparent={isBack}
      opacity={isBack ? 0.85 : 1}
    />
  </mesh>
);

const IntroCubie = React.forwardRef(({ position, size, explosionFactor = 0 }, ref) => {
  const limit = (size - 1) / 2;
  const x = Math.round(position[0] / (1 + explosionFactor * 1.8) + limit);
  const y = Math.round(position[1] / (1 + explosionFactor * 1.8) + limit);
  const z = Math.round(position[2] / (1 + explosionFactor * 1.8) + limit);

  // When exploded, show all faces; when collapsed, only show outer faces
  const showAllFaces = explosionFactor > 0.1;

  // Determine which faces should show based on position (outer faces of the cube)
  const isOuterPZ = z === size - 1;
  const isOuterNZ = z === 0;
  const isOuterPX = x === size - 1;
  const isOuterNX = x === 0;
  const isOuterPY = y === size - 1;
  const isOuterNY = y === 0;

  return (
    <group position={position} ref={ref}>
      <RoundedBox args={[0.98, 0.98, 0.98]} radius={0.05} smoothness={4}>
        <meshStandardMaterial color="#3d3225" roughness={0.6} metalness={0.1} />
      </RoundedBox>

      {/* Front face (PZ) - Red */}
      {(showAllFaces || isOuterPZ) && (
        <IntroSticker
          pos={[0, 0, 0.51]}
          rot={[0, 0, 0]}
          color={FACE_COLORS[1]}
          isBack={!isOuterPZ && showAllFaces}
        />
      )}

      {/* Back face (NZ) - Orange */}
      {(showAllFaces || isOuterNZ) && (
        <IntroSticker
          pos={[0, 0, -0.51]}
          rot={[0, Math.PI, 0]}
          color={FACE_COLORS[4]}
          isBack={!isOuterNZ && showAllFaces}
        />
      )}

      {/* Right face (PX) - Blue */}
      {(showAllFaces || isOuterPX) && (
        <IntroSticker
          pos={[0.51, 0, 0]}
          rot={[0, Math.PI / 2, 0]}
          color={FACE_COLORS[5]}
          isBack={!isOuterPX && showAllFaces}
        />
      )}

      {/* Left face (NX) - Green */}
      {(showAllFaces || isOuterNX) && (
        <IntroSticker
          pos={[-0.51, 0, 0]}
          rot={[0, -Math.PI / 2, 0]}
          color={FACE_COLORS[2]}
          isBack={!isOuterNX && showAllFaces}
        />
      )}

      {/* Top face (PY) - White */}
      {(showAllFaces || isOuterPY) && (
        <IntroSticker
          pos={[0, 0.51, 0]}
          rot={[-Math.PI / 2, 0, 0]}
          color={FACE_COLORS[3]}
          isBack={!isOuterPY && showAllFaces}
        />
      )}

      {/* Bottom face (NY) - Yellow */}
      {(showAllFaces || isOuterNY) && (
        <IntroSticker
          pos={[0, -0.51, 0]}
          rot={[Math.PI / 2, 0, 0]}
          color={FACE_COLORS[6]}
          isBack={!isOuterNY && showAllFaces}
        />
      )}
    </group>
  );
});

const IntroScene = ({ time, onComplete }) => {
  const cubieRefs = useRef([]);
  const { camera } = useThree();
  const size = 3;
  
  const [wormComplete, setWormComplete] = useState({});
  const [showBurst, setShowBurst] = useState({});
  const [burstTimes, setBurstTimes] = useState({});
  
  const explosionStart = 4;
  const explosionEnd = 6;
  const implodeStart = 9;
  const implodeEnd = 10;
  
  let explosionFactor = 0;
  if (time >= explosionStart && time < explosionEnd) {
    const t = (time - explosionStart) / (explosionEnd - explosionStart);
    const eased = t < 0.5 ? 4 * t ** 3 : 1 - Math.pow(-2 * t + 2, 3) / 2;
    explosionFactor = eased * 1.5;
  } else if (time >= explosionEnd && time < implodeStart) {
    explosionFactor = 1.5;
  } else if (time >= implodeStart && time < implodeEnd) {
    const t = (time - implodeStart) / (implodeEnd - implodeStart);
    const eased = 1 - (t < 0.5 ? 4 * t ** 3 : 1 - Math.pow(-2 * t + 2, 3) / 2);
    explosionFactor = eased * 1.5;
  }
  
  const wormStartTime = 7;
  
  // Generate all 9 worm paths (3x3 grid of antipodal pairs)
  const wormPaths = useMemo(() => {
    const paths = [];
    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        const id = `${x}-${y}`;
        paths.push({
          id,
          start: getStickerWorldPos(x, y, size - 1, 'PZ', size, explosionFactor),
          end: getStickerWorldPos(x, y, 0, 'NZ', size, explosionFactor),
          color1: FACE_COLORS[1],
          color2: FACE_COLORS[4]
        });
      }
    }
    return paths;
  }, [explosionFactor]);
  
  const handleWormComplete = (id) => {
    if (!wormComplete[id]) {
      setWormComplete(prev => ({...prev, [id]: true}));
      setShowBurst(prev => ({...prev, [id]: true}));
      setBurstTimes(prev => ({...prev, [id]: time}));
      if (id === '1-1') { // Only play sound for center worm
        play('/sounds/flip.mp3');
        vibrate(20);
      }
    }
  };
  
  useFrame(() => {
    let radius = 12;
    let rotSpeed = 0.2;
    
    if (time < 2) {
      radius = 12;
      rotSpeed = 0.2;
    } else if (time >= 2 && time < 3) {
      const jitter = Math.sin(time * 50) * 0.3;
      radius = 12 + jitter;
    } else if (time >= 3 && time < 4) {
      const t = (time - 3);
      radius = 12 + t * 6;
    } else if (time >= 4 && time < 9) {
      radius = 22;
      rotSpeed = 0.15;
    } else if (time >= 9 && time < 10) {
      const t = (time - 9);
      radius = 22 - t * 10;
    } else {
      radius = 12;
      rotSpeed = 0.2;
    }
    
    const angle = time * rotSpeed;
    camera.position.x = Math.sin(angle) * radius;
    camera.position.z = Math.cos(angle) * radius;
    camera.position.y = 3;
    camera.lookAt(0, 0, 0);
  });
  
  const items = useMemo(() => {
    const k = (size - 1) / 2;
    const arr = [];
    let i = 0;
    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        for (let z = 0; z < size; z++) {
          arr.push({ key: i++, pos: [x - k, y - k, z - k] });
        }
      }
    }
    return arr;
  }, [size]);
  
  const tunnelOpacity = useMemo(() => {
    if (time < explosionStart) return 0;
    if (time >= explosionStart && time < explosionStart + 0.5) {
      return (time - explosionStart) / 0.5;
    }
    if (time >= implodeStart) {
      const t = (time - implodeStart) / (implodeEnd - implodeStart);
      return 1 - t * 0.7;
    }
    return 1;
  }, [time]);
  
  const tunnels = useMemo(() => {
    const k = (size - 1) / 2;
    const pairs = [];
    
    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        pairs.push({
          id: `z-${x}-${y}`,
          start: getStickerWorldPos(x, y, size - 1, 'PZ', size, explosionFactor),
          end: getStickerWorldPos(x, y, 0, 'NZ', size, explosionFactor),
          color1: FACE_COLORS[1],
          color2: FACE_COLORS[4],
          group: 0
        });
      }
    }
    
    for (let y = 0; y < size; y++) {
      for (let z = 0; z < size; z++) {
        pairs.push({
          id: `x-${y}-${z}`,
          start: getStickerWorldPos(size - 1, y, z, 'PX', size, explosionFactor),
          end: getStickerWorldPos(0, y, z, 'NX', size, explosionFactor),
          color1: FACE_COLORS[5],
          color2: FACE_COLORS[2],
          group: 1
        });
      }
    }
    
    for (let x = 0; x < size; x++) {
      for (let z = 0; z < size; z++) {
        pairs.push({
          id: `y-${x}-${z}`,
          start: getStickerWorldPos(x, size - 1, z, 'PY', size, explosionFactor),
          end: getStickerWorldPos(x, 0, z, 'NY', size, explosionFactor),
          color1: FACE_COLORS[3],
          color2: FACE_COLORS[6],
          group: 2
        });
      }
    }
    
    return pairs;
  }, [explosionFactor, size]);
  
  const highlightedGroup = useMemo(() => {
    if (time >= 6.5 && time < 7.5) return 0;
    if (time >= 7.5 && time < 8.5) return 1;
    if (time >= 8.5 && time < 9.5) return 2;
    return -1;
  }, [time]);
  
  return (
    <group>
      {items.map((it, idx) => {
        const explodedPos = [
          it.pos[0] * (1 + explosionFactor * 1.8),
          it.pos[1] * (1 + explosionFactor * 1.8),
          it.pos[2] * (1 + explosionFactor * 1.8)
        ];
        return (
          <IntroCubie
            key={it.key}
            ref={el => (cubieRefs.current[idx] = el)}
            position={explodedPos}
            size={size}
            explosionFactor={explosionFactor}
          />
        );
      })}
      
      {time >= explosionStart && tunnels.map(t => (
        <IntroTunnel
          key={t.id}
          start={t.start}
          end={t.end}
          color1={t.color1}
          color2={t.color2}
          opacity={tunnelOpacity * (highlightedGroup === t.group ? 1 : highlightedGroup >= 0 ? 0.3 : 1)}
          groupId={t.group}
        />
      ))}
      
      {time >= wormStartTime && wormPaths.map(path => {
        const shouldShow = !wormComplete[path.id];
        return shouldShow ? (
          <WormParticle
            key={path.id}
            start={path.start}
            end={path.end}
            color1={path.color1}
            color2={path.color2}
            startTime={wormStartTime}
            currentTime={time}
            onComplete={() => handleWormComplete(path.id)}
          />
        ) : null;
      })}
      
      {wormPaths.map(path => {
        const burstTime = burstTimes[path.id];
        return showBurst[path.id] && burstTime && time < burstTime + 0.5 ? (
          <ArrivalBurst
            key={`burst-${path.id}`}
            position={path.end}
            color={path.color2}
            startTime={burstTime}
            currentTime={time}
          />
        ) : null;
      })}
    </group>
  );
};

const TextOverlay = ({ time }) => {
  const messages = useMemo(() => {
    const msgs = [];

    if (time >= 3 && time < 10) {
      msgs.push({ text: 'Welcome to the Wormhole Cube!', fade: time >= 3 && time < 3.3 ? (time - 3) / 0.3 : 1 });
    }
    if (time >= 3.5 && time < 10) {
      msgs.push({ text: 'Discovering opposite pairs...', fade: time >= 3.5 && time < 3.8 ? (time - 3.5) / 0.3 : 1 });
    }
    if (time >= 6 && time < 10) {
      msgs.push({ text: 'Each color has a partner across the cube', fade: time >= 6 && time < 6.3 ? (time - 6) / 0.3 : 1 });
    }
    if (time >= 6.5 && time < 7.5) {
      msgs.push({ text: 'Red ↔ Orange', fade: time >= 6.5 && time < 6.8 ? (time - 6.5) / 0.3 : 1, color: '#ef4444' });
    }
    if (time >= 7.5 && time < 8.5) {
      msgs.push({ text: 'Blue ↔ Green', fade: time >= 7.5 && time < 7.8 ? (time - 7.5) / 0.3 : 1, color: '#3b82f6' });
    }
    if (time >= 8.5 && time < 9.5) {
      msgs.push({ text: 'Yellow ↔ White', fade: time >= 8.5 && time < 8.8 ? (time - 8.5) / 0.3 : 1, color: '#eab308' });
    }
    if (time >= 9.5) {
      msgs.push({ text: 'Ready to explore!', fade: time >= 9.5 && time < 9.8 ? (time - 9.5) / 0.3 : 1 });
    }

    return msgs;
  }, [time]);

  const showFinal = time >= 10;
  const finalFade = time >= 10 && time < 10.5 ? (time - 10) / 0.5 : time >= 10.5 ? 1 : 0;

  return (
    <div className="intro-text-overlay">
      <div className="intro-messages">
        {messages.map((msg, i) => (
          <div
            key={i}
            className="intro-message"
            style={{
              opacity: msg.fade,
              color: msg.color || '#8b6f47'
            }}
          >
            {msg.text}
          </div>
        ))}
      </div>

      {showFinal && (
        <div className="intro-final-card" style={{ opacity: finalFade }}>
          <div className="intro-title-box">
            <h1>The Wormhole Cube</h1>
            <p>An Interactive Topology Puzzle</p>
          </div>
          <div className="intro-instructions">
            <p>Click any sticker to flip to its opposite color</p>
            <p>Drag to rotate • Explore and discover!</p>
          </div>
        </div>
      )}
    </div>
  );
};

const WelcomeScreen = ({ onEnter }) => {
  const [time, setTime] = useState(0);
  const [canSkip, setCanSkip] = useState(false);
  
  useEffect(() => {
    const start = performance.now();
    let raf;
    
    const animate = (now) => {
      const elapsed = (now - start) / 1000;
      setTime(elapsed);
      
      if (elapsed >= 2) setCanSkip(true);
      
      raf = requestAnimationFrame(animate);
    };
    
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, []);
  
  const handleEnter = () => {
    onEnter();
  };
  
  const handleSkip = () => {
    onEnter();
  };
  
  return (
    <div className="welcome-screen">
      <div className="welcome-canvas">
        <Canvas camera={{ position: [0, 3, 12], fov: 40 }}>
          <ambientLight intensity={1.25} />
          <pointLight position={[10, 10, 10]} intensity={1.35} />
          <pointLight position={[-10, -10, -10]} intensity={1.0} />
          <Suspense fallback={null}>
            <Environment preset="city" />
            <IntroScene time={time} />
          </Suspense>
        </Canvas>
      </div>
      
      <TextOverlay time={time} />
      
      {canSkip && (
        <button className="skip-intro-btn" onClick={handleSkip}>
          Skip ►
        </button>
      )}
      
      {time >= 10 && (
        <button className="enter-btn" onClick={handleEnter}>
          ENTER
        </button>
      )}
    </div>
  );
};

/* ---------- MAIN GAME COMPONENTS ---------- */

const WormholeTunnel = ({ meshIdx1, meshIdx2, dirKey1, dirKey2, cubieRefs, intensity, flips, color1, color2, size }) => {
  const linesRef = useRef([]);
  const pulseT = useRef(Math.random() * Math.PI * 2);
  
  const strandConfig = useMemo(() => {
    const count = Math.min(Math.max(1, flips), 50);
    return Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 4;
      const radiusFactor = Math.sqrt(i / count);
      return {
        id: i,
        angle,
        radius: 0.1 + radiusFactor * 0.25,
        baseOpacity: flips > 0 ? (0.3 + (1 - radiusFactor) * 0.5) : (0.15 + (1 - radiusFactor) * 0.3),
        lineWidth: Math.max(0.3, 1.5 - radiusFactor * 1.2),
        colors: new Float32Array(30 * 3)
      };
    });
  }, [flips]);

  useMemo(() => {
    const c1 = new THREE.Color(color1);
    const c2 = new THREE.Color(color2);
    const tempColor = new THREE.Color();
    
    strandConfig.forEach(strand => {
      for (let j = 0; j < 30; j++) {
        const t = j / 29;
        tempColor.lerpColors(c1, c2, t);
        strand.colors[j * 3] = tempColor.r;
        strand.colors[j * 3 + 1] = tempColor.g;
        strand.colors[j * 3 + 2] = tempColor.b;
      }
    });
  }, [color1, color2, strandConfig]);

  useFrame((state, delta) => {
    const mesh1 = cubieRefs[meshIdx1];
    const mesh2 = cubieRefs[meshIdx2];
    if (!mesh1 || !mesh2) return;

    const pos1 = getStickerWorldPosFromMesh(mesh1, dirKey1);
    const pos2 = getStickerWorldPosFromMesh(mesh2, dirKey2);
    if (!pos1 || !pos2) return;

    const vStart = new THREE.Vector3(...pos1);
    const vEnd = new THREE.Vector3(...pos2);
    
    const baseControlPoint = calculateSmartControlPoint(pos1, pos2, size);

    pulseT.current += delta * (2 + intensity * 0.5);
    const pulse = Math.sin(pulseT.current) * 0.1 + 0.9;

    linesRef.current.forEach((line, i) => {
      if (!line) return;
      const config = strandConfig[i];

      if (line.material) {
        line.material.opacity = config.baseOpacity * pulse;
      }

      const offsetX = Math.cos(config.angle) * config.radius;
      const offsetY = Math.sin(config.angle) * config.radius;
      
      const dir = new THREE.Vector3().subVectors(vEnd, vStart).normalize();
      const up = new THREE.Vector3(0, 1, 0);
      const right = new THREE.Vector3().crossVectors(dir, up).normalize();
      const trueUp = new THREE.Vector3().crossVectors(right, dir).normalize();
      
      const offsetVec = new THREE.Vector3()
        .addScaledVector(right, offsetX)
        .addScaledVector(trueUp, offsetY);

      const controlPoint = baseControlPoint.clone().add(offsetVec);
      
      const curve = new THREE.QuadraticBezierCurve3(vStart, controlPoint, vEnd);
      const points = curve.getPoints(29);

      const positions = line.geometry.attributes.position.array;
      for (let j = 0; j < points.length; j++) {
        positions[j * 3] = points[j].x;
        positions[j * 3 + 1] = points[j].y;
        positions[j * 3 + 2] = points[j].z;
      }
      line.geometry.attributes.position.needsUpdate = true;
    });
  });

  return (
    <group>
      {strandConfig.map((strand, i) => (
        <line key={strand.id} ref={el => linesRef.current[i] = el}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={30}
              array={new Float32Array(30 * 3)}
              itemSize={3}
            />
            <bufferAttribute
              attach="attributes-color"
              count={30}
              array={strand.colors}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial
            vertexColors
            transparent
            opacity={strand.baseOpacity}
            linewidth={strand.lineWidth}
          />
        </line>
      ))}
    </group>
  );
};

const WormholeNetwork = ({ cubies, size, showTunnels, manifoldMap, cubieRefs }) => { 
  const tunnelData = useMemo(() => {
    if (!showTunnels) return [];
    
    const connections = [];
    const processed = new Set();
    
    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        for (let z = 0; z < size; z++) {
          const cubie = cubies[x][y][z];
          
          Object.entries(cubie.stickers).forEach(([dirKey, sticker]) => {
            if (sticker.flips === 0) return;
            
            const gridId = getManifoldGridId(sticker, size);
            if (processed.has(gridId)) return;
            processed.add(gridId);
            
            const antipodalLoc = findAntipodalStickerByGrid(manifoldMap, sticker, size);
            if (!antipodalLoc) return;
            
            const idx1 = ((x * size) + y) * size + z;
            const idx2 = ((antipodalLoc.x * size) + antipodalLoc.y) * size + antipodalLoc.z;
            
            connections.push({
              id: gridId,
              meshIdx1: idx1,
              meshIdx2: idx2,
              dirKey1: dirKey,
              dirKey2: antipodalLoc.dirKey,
              flips: sticker.flips,
              intensity: Math.min(sticker.flips / 10, 1),
              color1: FACE_COLORS[sticker.orig],
              color2: FACE_COLORS[antipodalLoc.sticker.orig]
            });
          });
        }
      }
    }
    return connections;
  }, [cubies, size, showTunnels, manifoldMap]); 

  if (!showTunnels) return null;

  return (
    <group>
      {tunnelData.map((t) => (
        <WormholeTunnel
          key={t.id}
          meshIdx1={t.meshIdx1}
          meshIdx2={t.meshIdx2}
          dirKey1={t.dirKey1}
          dirKey2={t.dirKey2}
          cubieRefs={cubieRefs}
          intensity={t.intensity}
          flips={t.flips}
          color1={t.color1}
          color2={t.color2}
          size={size}
        />
      ))}
    </group>
  );
};

const ChaosWave = ({ from, to, color = "#ff0080", onComplete }) => {
  const [progress, setProgress] = useState(0);
  const meshRef = useRef();
  
  useFrame((_, delta) => {
    setProgress(p => {
      const newP = p + delta * 3;
      if (newP >= 1) {
        if (onComplete) onComplete();
        return 1;
      }
      return newP;
    });
  });

  useEffect(() => {
    if (progress >= 1) {
      const timer = setTimeout(() => {
        if (onComplete) onComplete();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [progress, onComplete]);

  if (progress >= 1) return null;

  const fromVec = new THREE.Vector3(...from);
  const toVec = new THREE.Vector3(...to);
  const pos = fromVec.lerp(toVec, progress);
  
  return (
    <mesh ref={meshRef} position={pos.toArray()}>
      <sphereGeometry args={[0.15, 16, 16]} />
      <meshBasicMaterial 
        color={color} 
        transparent 
        opacity={Math.max(0, 1 - progress)}
        emissive={color}
        emissiveIntensity={2}
      />
    </mesh>
  );
};

/* Tally Marks Component - Shows flip journey history on each sticker */
const TallyMarks = ({ flips, radius, origColor }) => {
  // Calculate full cycles and half cycles
  // Each flip is a half-cycle through the antipodal tunnel
  // 2 flips = 1 complete round-trip cycle
  const halfCycles = flips; // Each flip is a half-cycle
  const fullTallies = Math.floor(halfCycles / 2); // Full tally = 2 half-cycles
  const hasHalfTally = halfCycles % 2 === 1; // Odd parity = half tally

  // Determine contrasting color for tally marks
  // Use dark marks on light colors, light marks on dark colors
  const isLightColor = ['#ffffff', '#eab308', '#f97316'].includes(origColor);
  const tallyColor = isLightColor ? '#1a1a1a' : '#ffffff';

  // Scale tallies to fit within the tracker circle
  const baseScale = Math.min(radius * 1.4, 0.28);
  const lineHeight = baseScale * 0.7;
  const lineSpacing = baseScale * 0.18;
  const strokeWidth = 1.8;

  // Group tallies in sets of 5 (traditional tally: |||| with diagonal)
  const tallyGroups = [];
  let remaining = fullTallies;
  while (remaining > 0) {
    const groupSize = Math.min(remaining, 5);
    tallyGroups.push(groupSize);
    remaining -= groupSize;
  }

  // If no full tallies but has half, we still show something
  if (tallyGroups.length === 0 && hasHalfTally) {
    tallyGroups.push(0);
  }

  // Calculate total width to center the tallies
  const groupWidth = lineSpacing * 5;
  const totalGroups = tallyGroups.length;
  const totalWidth = totalGroups * groupWidth;
  const startX = -totalWidth / 2 + lineSpacing;

  return (
    <group position={[0, 0, 0.015]}>
      {tallyGroups.map((count, groupIndex) => {
        const groupX = startX + groupIndex * groupWidth;
        const lines = [];

        // Draw vertical tally lines for this group
        for (let i = 0; i < count; i++) {
          const x = groupX + i * lineSpacing;
          lines.push(
            <Line
              key={`tally-${groupIndex}-${i}`}
              points={[[x, -lineHeight / 2, 0], [x, lineHeight / 2, 0]]}
              color={tallyColor}
              lineWidth={strokeWidth}
              transparent
              opacity={0.9}
            />
          );
        }

        // Draw diagonal line for groups of 5
        if (count === 5) {
          lines.push(
            <Line
              key={`diag-${groupIndex}`}
              points={[
                [groupX - lineSpacing * 0.3, -lineHeight / 2 - 0.01, 0],
                [groupX + lineSpacing * 4.3, lineHeight / 2 + 0.01, 0]
              ]}
              color={tallyColor}
              lineWidth={strokeWidth}
              transparent
              opacity={0.9}
            />
          );
        }

        return <group key={`group-${groupIndex}`}>{lines}</group>;
      })}

      {/* Half tally - shown as a shorter, slightly faded line */}
      {hasHalfTally && (
        <group>
          <Line
            points={[
              [startX + fullTallies % 5 * lineSpacing + (fullTallies >= 5 ? Math.floor(fullTallies / 5) * groupWidth : 0),
               -lineHeight / 4, 0],
              [startX + fullTallies % 5 * lineSpacing + (fullTallies >= 5 ? Math.floor(fullTallies / 5) * groupWidth : 0),
               lineHeight / 4, 0]
            ]}
            color={tallyColor}
            lineWidth={strokeWidth * 0.8}
            transparent
            opacity={0.6}
          />
          {/* Small dot at top to indicate "incomplete" journey */}
          <mesh position={[
            startX + fullTallies % 5 * lineSpacing + (fullTallies >= 5 ? Math.floor(fullTallies / 5) * groupWidth : 0),
            lineHeight / 4 + 0.02,
            0
          ]}>
            <circleGeometry args={[0.015, 8]} />
            <meshBasicMaterial color={tallyColor} transparent opacity={0.6} />
          </mesh>
        </group>
      )}

      {/* Show flip count as small text for high counts */}
      {flips > 10 && (
        <Text
          position={[0, -radius * 0.6, 0.005]}
          fontSize={0.06}
          color={tallyColor}
          anchorX="center"
          anchorY="middle"
          fontWeight="bold"
        >
          ×{flips}
        </Text>
      )}
    </group>
  );
};

const StickerPlane=React.memo(function StickerPlane({ meta, pos, rot=[0,0,0], overlay, mode }) {
  const groupRef = useRef();
  const meshRef = useRef();
  const ringRef = useRef();
  const glowRef = useRef();
  const spinT = useRef(0);
  const shakeT = useRef(0);
  const pulseT = useRef(0);
  const flipFromColor = useRef(null);
  const flipToColor = useRef(null);

  const prevCurr = useRef(meta?.curr ?? 0);
  useEffect(() => {
    const curr = meta?.curr ?? 0;
    const prevVal = prevCurr.current;

    // Only trigger flip animation if the color actually changed to its antipodal
    if (curr !== prevVal && meta?.flips > 0 && ANTIPODAL_COLOR[prevVal] === curr) {
      // Store the colors for the flip animation
      flipFromColor.current = FACE_COLORS[prevVal];
      flipToColor.current = FACE_COLORS[curr];
      spinT.current = 1;
      play('/sounds/flip.mp3');
      vibrate(16);
    }
    prevCurr.current = curr;
  }, [meta?.curr, meta?.flips]);

  useFrame((_, delta) => {
    // Flip animation
    if (spinT.current > 0 && groupRef.current) {
      const dt = Math.min(delta * 4, spinT.current);
      spinT.current -= dt;
      const p = 1 - spinT.current;

      let angle;
      if (p < 0.5) {
        // First half: rotate towards the "portal"
        angle = Math.sin(p * Math.PI * 2) * Math.PI;
      } else {
        // Second half: emerge from portal with overshoot
        const overshoot = Math.sin((p - 0.5) * Math.PI * 4) * 0.15;
        angle = Math.PI + overshoot;
      }

      groupRef.current.rotation.y = rot[1] + angle;

      const scale = 1 + Math.sin(p * Math.PI) * 0.15;
      groupRef.current.scale.set(scale, scale, 1);

      // Animate color through the antipodal color during flip
      if (meshRef.current && flipFromColor.current && flipToColor.current) {
        const antipodalColor = flipToColor.current; // The destination IS the antipodal
        if (p < 0.4) {
          // Fade from original color
          meshRef.current.material.color.set(flipFromColor.current);
        } else if (p < 0.6) {
          // At midpoint, flash the antipodal color brightly
          meshRef.current.material.color.set(antipodalColor);
          meshRef.current.material.emissive.set(antipodalColor);
          meshRef.current.material.emissiveIntensity = 0.6 * (1 - Math.abs(p - 0.5) * 5);
        } else {
          // Settle into the new color
          meshRef.current.material.color.set(flipToColor.current);
          meshRef.current.material.emissiveIntensity = 0.15 * (1 - p);
        }
      }

      if (spinT.current <= 0) {
        groupRef.current.rotation.y = rot[1];
        groupRef.current.scale.set(1, 1, 1);
        // Start shake animation after flip completes
        shakeT.current = 0.5;
        flipFromColor.current = null;
        flipToColor.current = null;
        if (meshRef.current) {
          meshRef.current.material.emissiveIntensity = 0;
        }
      }
    }

    // Shake animation for parity indicator
    if (shakeT.current > 0 && groupRef.current) {
      const dt = Math.min(delta * 2, shakeT.current);
      shakeT.current -= dt;
      const intensity = shakeT.current * 2; // Decay from 1 to 0
      const shakeFreq = 25;
      const shakeX = Math.sin(shakeT.current * shakeFreq * Math.PI) * 0.03 * intensity;
      const shakeZ = Math.cos(shakeT.current * shakeFreq * Math.PI * 1.3) * 0.02 * intensity;
      groupRef.current.position.x = pos[0] + shakeX;
      groupRef.current.position.z = pos[2] + shakeZ;

      if (shakeT.current <= 0) {
        groupRef.current.position.set(pos[0], pos[1], pos[2]);
      }
    }

    pulseT.current += delta * 2.1;
    if (ringRef.current) {
      const s = 1 + (Math.sin(pulseT.current) * 0.08);
      ringRef.current.scale.setScalar(s);
    }

    if (glowRef.current) {
      const glowIntensity = 0.3 + Math.sin(pulseT.current * 1.5) * 0.2;
      glowRef.current.material.opacity = glowIntensity;
    }
  });

  const isSudokube = mode==='sudokube';
  const baseColor = isSudokube ? COLORS.white : (meta?.curr ? FACE_COLORS[meta.curr] : COLORS.black);
  const isWormhole = meta?.flips>0 && meta?.curr!==meta?.orig;
  const hasFlipHistory = meta?.flips > 0;
  
  const trackerRadius = Math.min(0.35, 0.06 + (meta?.flips ?? 0) * 0.012);
  const origColor = meta?.orig ? FACE_COLORS[meta.orig] : COLORS.black;
  
  const shadowIntensity = Math.min(0.5, (meta?.flips ?? 0) * 0.03);

  return (
    <group position={pos} rotation={rot} ref={groupRef}>
      <mesh ref={meshRef}>
        <planeGeometry args={[0.82,0.82]} />
        <meshStandardMaterial
          color={baseColor}
          roughness={0.18}
          metalness={0}
          side={THREE.DoubleSide}
          emissive={mode === 'wireframe' ? baseColor : (isWormhole ? baseColor : (hasFlipHistory ? '#000000' : 'black'))}
          emissiveIntensity={mode === 'wireframe' ? 0.4 : (isWormhole ? 0.15 : 0)}
        />
      </mesh>
      
      {!isSudokube && hasFlipHistory && (
        <mesh position={[0,0,0.005]}>
          <planeGeometry args={[0.82,0.82]} />
          <meshBasicMaterial 
            color="#000000" 
            transparent 
            opacity={shadowIntensity}
            blending={THREE.MultiplyBlending}
          />
        </mesh>
      )}
      
      {!isSudokube && hasFlipHistory && (
        <mesh position={[0,0,0.01]}>
          <circleGeometry args={[trackerRadius,32]} />
          <meshBasicMaterial
            color={origColor}
            opacity={isWormhole ? 1.0 : 0.5}
            transparent={!isWormhole}
          />
        </mesh>
      )}

      {/* Tally Marks - showing flip journey history */}
      {!isSudokube && hasFlipHistory && (
        <TallyMarks
          flips={meta?.flips ?? 0}
          radius={trackerRadius}
          origColor={origColor}
        />
      )}

      {!isSudokube && isWormhole && (
        <>
          <mesh ref={ringRef} position={[0,0,0.02]}>
            <ringGeometry args={[0.36,0.40,32]} />
            <meshBasicMaterial color="#dda15e" transparent opacity={0.85} />
          </mesh>
          <mesh ref={glowRef} position={[0,0,0.015]}>
            <circleGeometry args={[0.44,32]} />
            <meshBasicMaterial
              color="#bc6c25"
              transparent
              opacity={0.25}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        </>
      )}
      {overlay && (
        <Text position={[0,0,0.03]} fontSize={0.17} color="black" anchorX="center" anchorY="middle">
          {overlay}
        </Text>
      )}
    </group>
  );
});

const WireframeEdge = ({ start, end, color, intensity = 1, pulsePhase = 0 }) => {
  const lineRef = useRef();
  
  useFrame((state) => {
    if (!lineRef.current) return;
    const t = state.clock.elapsedTime + pulsePhase;
    const pulse = 0.7 + Math.sin(t * 3) * 0.3;
    lineRef.current.material.opacity = intensity * pulse;
  });
  
  return (
    <Line
      ref={lineRef}
      points={[start, end]}
      color={color}
      lineWidth={2.5}
      transparent
      opacity={intensity}
    />
  );
};

const Cubie = React.forwardRef(function Cubie({ 
  position, cubie, size, onPointerDown, visualMode, explosionFactor = 0 
}, ref){
  const limit=(size-1)/2; 
  const isEdge=(p,v)=>Math.abs(p-v)<0.01;
  
  const explodedPos = useMemo(() => {
    if (explosionFactor === 0) return position;
    const expansionFactor = 1.8;
    return [
      position[0] * (1 + explosionFactor * expansionFactor),
      position[1] * (1 + explosionFactor * expansionFactor),
      position[2] * (1 + explosionFactor * expansionFactor)
    ];
  }, [position, explosionFactor]);
  
  const handleDown=(e)=>{ 
    e.stopPropagation();
    const rX=Math.round(position[0]+limit), rY=Math.round(position[1]+limit), rZ=Math.round(position[2]+limit);
    onPointerDown({ pos:{x:rX,y:rY,z:rZ}, worldPos:new THREE.Vector3(...position), event:e });
  };
  
  const meta=(d)=>cubie.stickers[d]||null;

  const overlay=(dirKey)=>{
    const m=meta(dirKey); if(!m) return '';
    if(visualMode==='grid'){
      const { r,c } = faceRCFor(dirKey, cubie.x, cubie.y, cubie.z, size);
      const idx = r*size + c + 1;
      const idStr = String(idx).padStart(3,'0');
      return `M${m.curr}-${idStr}`;
    }
    if(visualMode==='sudokube'){
      const v = faceValue(dirKey, cubie.x, cubie.y, cubie.z, size);
      return String(v);
    }
    return '';
  };
  
  // Helper to get edge color for wireframe mode
  const getEdgeColor = (dirKey) => {
    const sticker = cubie.stickers[dirKey];
    if (!sticker) return COLORS.black;
    return FACE_COLORS[sticker.curr];
  };
  
  // Determine which edges are visible (on cube exterior)
  const isOnEdge = {
    px: cubie.x === size - 1,
    nx: cubie.x === 0,
    py: cubie.y === size - 1,
    ny: cubie.y === 0,
    pz: cubie.z === size - 1,
    nz: cubie.z === 0
  };
  
  // Generate wireframe edges for wireframe mode ONLY
  const wireframeEdges = useMemo(() => {
    if (visualMode !== 'wireframe') return [];
    
    const halfSize = 0.49;
    const eps = 0.01;
    const edgeList = [];
    const pulsePhase = Math.random() * Math.PI * 2;
    
    // Front face (PZ) - 4 edges
    if (isOnEdge.pz) {
      const color = getEdgeColor('PZ');
      const intensity = 1.0;
      
      edgeList.push(
        { start: [-halfSize, -halfSize, halfSize + eps], end: [halfSize, -halfSize, halfSize + eps], color, intensity, pulsePhase },
        { start: [-halfSize, halfSize, halfSize + eps], end: [halfSize, halfSize, halfSize + eps], color, intensity, pulsePhase },
        { start: [-halfSize, -halfSize, halfSize + eps], end: [-halfSize, halfSize, halfSize + eps], color, intensity, pulsePhase },
        { start: [halfSize, -halfSize, halfSize + eps], end: [halfSize, halfSize, halfSize + eps], color, intensity, pulsePhase }
      );
    }
    
    // Back face (NZ) - 4 edges
    if (isOnEdge.nz) {
      const color = getEdgeColor('NZ');
      const intensity = 1.0;
      
      edgeList.push(
        { start: [-halfSize, -halfSize, -halfSize - eps], end: [halfSize, -halfSize, -halfSize - eps], color, intensity, pulsePhase },
        { start: [-halfSize, halfSize, -halfSize - eps], end: [halfSize, halfSize, -halfSize - eps], color, intensity, pulsePhase },
        { start: [-halfSize, -halfSize, -halfSize - eps], end: [-halfSize, halfSize, -halfSize - eps], color, intensity, pulsePhase },
        { start: [halfSize, -halfSize, -halfSize - eps], end: [halfSize, halfSize, -halfSize - eps], color, intensity, pulsePhase }
      );
    }
    
    // Right face (PX) - 4 edges (all edges, not just 2)
    if (isOnEdge.px) {
      const color = getEdgeColor('PX');
      const intensity = 1.0;
      
      edgeList.push(
        { start: [halfSize + eps, -halfSize, -halfSize], end: [halfSize + eps, halfSize, -halfSize], color, intensity, pulsePhase },
        { start: [halfSize + eps, -halfSize, halfSize], end: [halfSize + eps, halfSize, halfSize], color, intensity, pulsePhase },
        { start: [halfSize + eps, -halfSize, -halfSize], end: [halfSize + eps, -halfSize, halfSize], color, intensity, pulsePhase },
        { start: [halfSize + eps, halfSize, -halfSize], end: [halfSize + eps, halfSize, halfSize], color, intensity, pulsePhase }
      );
    }
    
    // Left face (NX) - 4 edges
    if (isOnEdge.nx) {
      const color = getEdgeColor('NX');
      const intensity = 1.0;
      
      edgeList.push(
        { start: [-halfSize - eps, -halfSize, -halfSize], end: [-halfSize - eps, halfSize, -halfSize], color, intensity, pulsePhase },
        { start: [-halfSize - eps, -halfSize, halfSize], end: [-halfSize - eps, halfSize, halfSize], color, intensity, pulsePhase },
        { start: [-halfSize - eps, -halfSize, -halfSize], end: [-halfSize - eps, -halfSize, halfSize], color, intensity, pulsePhase },
        { start: [-halfSize - eps, halfSize, -halfSize], end: [-halfSize - eps, halfSize, halfSize], color, intensity, pulsePhase }
      );
    }
    
    // Top face (PY) - 4 edges
    if (isOnEdge.py) {
      const color = getEdgeColor('PY');
      const intensity = 1.0;
      
      edgeList.push(
        { start: [-halfSize, halfSize + eps, -halfSize], end: [halfSize, halfSize + eps, -halfSize], color, intensity, pulsePhase },
        { start: [-halfSize, halfSize + eps, halfSize], end: [halfSize, halfSize + eps, halfSize], color, intensity, pulsePhase },
        { start: [-halfSize, halfSize + eps, -halfSize], end: [-halfSize, halfSize + eps, halfSize], color, intensity, pulsePhase },
        { start: [halfSize, halfSize + eps, -halfSize], end: [halfSize, halfSize + eps, halfSize], color, intensity, pulsePhase }
      );
    }
    
    // Bottom face (NY) - 4 edges
    if (isOnEdge.ny) {
      const color = getEdgeColor('NY');
      const intensity = 1.0;
      
      edgeList.push(
        { start: [-halfSize, -halfSize - eps, -halfSize], end: [halfSize, -halfSize - eps, -halfSize], color, intensity, pulsePhase },
        { start: [-halfSize, -halfSize - eps, halfSize], end: [halfSize, -halfSize - eps, halfSize], color, intensity, pulsePhase },
        { start: [-halfSize, -halfSize - eps, -halfSize], end: [-halfSize, -halfSize - eps, halfSize], color, intensity, pulsePhase },
        { start: [halfSize, -halfSize - eps, -halfSize], end: [halfSize, -halfSize - eps, halfSize], color, intensity, pulsePhase }
      );
    }
    
    return edgeList;
  }, [visualMode, cubie, isOnEdge, size]);

  return (
    <group position={explodedPos} ref={ref}>
      <RoundedBox args={[0.98,0.98,0.98]} radius={0.05} smoothness={4} onPointerDown={handleDown}>
        <meshStandardMaterial 
          color={visualMode === 'wireframe' ? "#000000" : "#12151f"} 
          roughness={visualMode === 'wireframe' ? 0.9 : 0.5}
          metalness={0}
        />
      </RoundedBox>
      
      {/* LED Wireframe edges ONLY in wireframe mode */}
      {visualMode === 'wireframe' && wireframeEdges.map((edge, idx) => (
        <WireframeEdge
          key={idx}
          start={edge.start}
          end={edge.end}
          color={edge.color}
          intensity={edge.intensity}
          pulsePhase={edge.pulsePhase}
        />
      ))}
      
      {/* Regular stickers for ALL other modes (classic, grid, sudokube) */}
      {visualMode !== 'wireframe' && (
        <>
          {isEdge(position[2], (size-1)/2)  && meta('PZ') && <StickerPlane meta={meta('PZ')} pos={[0,0, 0.51]} mode={visualMode} overlay={overlay('PZ')}/>}
          {isEdge(position[2],-(size-1)/2) && meta('NZ') && <StickerPlane meta={meta('NZ')} pos={[0,0,-0.51]} rot={[0,Math.PI,0]} mode={visualMode} overlay={overlay('NZ')}/>}
          {isEdge(position[0], (size-1)/2)  && meta('PX') && <StickerPlane meta={meta('PX')} pos={[ 0.51,0,0]} rot={[0, Math.PI/2,0]} mode={visualMode} overlay={overlay('PX')}/>}
          {isEdge(position[0],-(size-1)/2)  && meta('NX') && <StickerPlane meta={meta('NX')} pos={[-0.51,0,0]} rot={[0,-Math.PI/2,0]} mode={visualMode} overlay={overlay('NX')}/>}
          {isEdge(position[1], (size-1)/2)  && meta('PY') && <StickerPlane meta={meta('PY')} pos={[0, 0.51,0]} rot={[-Math.PI/2,0,0]} mode={visualMode} overlay={overlay('PY')}/>}
          {isEdge(position[1],-(size-1)/2)  && meta('NY') && <StickerPlane meta={meta('NY')} pos={[0,-0.51,0]} rot={[ Math.PI/2,0,0]} mode={visualMode} overlay={overlay('NY')}/>}
        </>
      )}
    </group>
  );
});

const DragGuide=({ position, activeDir })=>{
  if(!position) return null;
  const arrows=[
    {id:'up',label:'▲',style:{top:-80,left:0}},
    {id:'down',label:'▼',style:{top:80,left:0}},
    {id:'left',label:'◀',style:{top:0,left:-80}},
    {id:'right',label:'▶',style:{top:0,left:80}}
  ];
  return (
    <Html position={[position.x,position.y,position.z]} center zIndexRange={[100,0]}>
      <div className="drag-guide-container">
        {arrows.map(a=>(
          <div key={a.id} className="guide-arrow" style={{
            ...a.style,
            transform:activeDir===a.id?'scale(1.5)':'scale(1)',
            color:activeDir===a.id?'var(--highlight)':'var(--text)'
          }}>
            {a.label}
          </div>
        ))}
      </div>
    </Html>
  );
};

/* Top Menu Bar - Summer 1978 Library Archive Style */
const TopMenuBar = ({
  moves,
  metrics,
  size,
  visualMode,
  flipMode,
  chaosMode,
  chaosLevel,
  cubies,
  onShowHelp,
  onShowSettings
}) => {
  const [time, setTime] = useState(0);
  const startTime = useRef(Date.now());

  // Retro color palette
  const colors = {
    ink: '#582f0e',
    inkMedium: '#7f5539',
    inkLight: '#9c6644',
    burntOrange: '#bc6c25',
    burntOrangeLight: '#dda15e',
    avocado: '#606c38',
    mustard: '#d4a373',
    paper: '#f2e8cf',
    paperCream: '#fefae0',
    divider: 'rgba(188, 108, 37, 0.25)'
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(Math.floor((Date.now() - startTime.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Calculate parity (even/odd flips)
  const parity = metrics.flips % 2 === 0 ? 'EVEN' : 'ODD';
  const parityColor = parity === 'EVEN' ? colors.avocado : colors.burntOrange;

  // Calculate face completion
  const faceStats = useMemo(() => {
    const faces = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    const faceTargets = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };

    for (const L of cubies) {
      for (const R of L) {
        for (const c of R) {
          for (const [dir, st] of Object.entries(c.stickers)) {
            const targetFace = dir === 'PZ' ? 1 : dir === 'NX' ? 2 : dir === 'PY' ? 3 :
                              dir === 'NZ' ? 4 : dir === 'PX' ? 5 : 6;
            faceTargets[targetFace]++;
            if (st.curr === targetFace) faces[targetFace]++;
          }
        }
      }
    }

    return Object.keys(faces).map(f => ({
      face: parseInt(f),
      complete: faces[f],
      total: faceTargets[f],
      percent: Math.round((faces[f] / faceTargets[f]) * 100)
    }));
  }, [cubies]);

  const totalComplete = faceStats.reduce((sum, f) => sum + f.complete, 0);
  const totalStickers = faceStats.reduce((sum, f) => sum + f.total, 0);
  const overallProgress = Math.round((totalComplete / totalStickers) * 100);

  const formatTime = (s) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const modeLabel = visualMode === 'classic' ? 'Classic' :
                   visualMode === 'grid' ? 'Grid' :
                   visualMode === 'sudokube' ? 'Sudoku' : 'Wire';

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      width: '100%',
      gap: '16px',
      pointerEvents: 'auto'
    }}>
      {/* Left Section - Archive Header */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
        {/* Logo Box - Library Archive Style */}
        <div className="bauhaus-box ui-element" style={{ padding: '12px 20px' }}>
          <h1 style={{
            margin: 0,
            fontSize: '28px',
            fontFamily: 'Georgia, serif',
            fontStyle: 'italic',
            fontWeight: 700,
            color: colors.ink,
            letterSpacing: '0.02em',
            lineHeight: 1
          }}>WORM³</h1>
          <p style={{
            margin: '4px 0 0',
            fontSize: '9px',
            color: colors.burntOrange,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            fontStyle: 'normal'
          }}>Mayo Manifold Machine • 1978</p>
        </div>

        {/* Stats Panel - Library Checkout Card */}
        <div className="ui-element stats-panel" style={{
          padding: '8px 4px',
          display: 'flex',
          gap: '1px',
          background: colors.paperCream,
          border: `1px solid ${colors.divider}`
        }}>
          {[
            { label: 'Moves', val: moves, color: colors.avocado },
            { label: 'Flips', val: metrics.flips, color: colors.burntOrange },
            { label: 'Worms', val: metrics.wormholes, color: colors.mustard },
            { label: 'Time', val: formatTime(time), color: colors.ink }
          ].map((stat, i) => (
            <div key={stat.label} style={{
              padding: '4px 14px',
              borderRight: i < 3 ? `1px solid ${colors.divider}` : 'none',
              textAlign: 'center'
            }}>
              <div style={{
                fontSize: '9px',
                textTransform: 'uppercase',
                color: colors.inkLight,
                letterSpacing: '0.1em',
                marginBottom: '2px'
              }}>{stat.label}</div>
              <div style={{
                fontSize: '18px',
                fontFamily: "'Courier New', monospace",
                fontWeight: 600,
                color: stat.color
              }}>{stat.val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Center Section - Mode & Status Tags */}
      <div style={{
        display: 'flex',
        gap: '8px',
        alignItems: 'center',
        flexWrap: 'wrap',
        justifyContent: 'center'
      }}>
        {/* Parity Tag */}
        <div className="ui-element" style={{
          padding: '5px 12px',
          background: `linear-gradient(135deg, ${parityColor}18, ${parityColor}08)`,
          borderColor: parityColor,
          borderWidth: '1px 2px 2px 1px'
        }}>
          <span style={{
            fontSize: '11px',
            fontWeight: 600,
            color: parityColor,
            letterSpacing: '0.1em',
            fontFamily: 'Georgia, serif'
          }}>
            ⟲ {parity}
          </span>
        </div>

        {/* Dimension Tag */}
        <div className="ui-element" style={{ padding: '5px 12px' }}>
          <span style={{
            fontSize: '11px',
            fontWeight: 600,
            color: colors.ink,
            letterSpacing: '0.05em',
            fontFamily: "'Courier New', monospace"
          }}>
            {size}×{size}×{size}
          </span>
        </div>

        {/* Mode Tag */}
        <div className="ui-element" style={{
          padding: '5px 12px',
          background: `linear-gradient(135deg, ${colors.inkLight}15, transparent)`
        }}>
          <span style={{
            fontSize: '11px',
            fontWeight: 600,
            color: colors.inkMedium,
            fontStyle: 'italic',
            fontFamily: 'Georgia, serif'
          }}>
            {modeLabel}
          </span>
        </div>

        {/* Active Mode: Flip */}
        {flipMode && (
          <div className="ui-element" style={{
            padding: '5px 12px',
            background: `linear-gradient(135deg, ${colors.burntOrange}20, ${colors.burntOrange}08)`,
            borderColor: colors.burntOrange
          }}>
            <span style={{
              fontSize: '11px',
              fontWeight: 600,
              color: colors.burntOrange,
              letterSpacing: '0.1em'
            }}>⚡ Flip</span>
          </div>
        )}

        {/* Active Mode: Chaos */}
        {chaosMode && (
          <div className="ui-element" style={{
            padding: '5px 12px',
            background: 'linear-gradient(135deg, #9c4a1a25, #9c4a1a10)',
            borderColor: '#9c4a1a',
            animation: 'chaos-pulse 1.5s ease-in-out infinite'
          }}>
            <span style={{
              fontSize: '11px',
              fontWeight: 600,
              color: '#9c4a1a',
              letterSpacing: '0.1em'
            }}>☢ Chaos L{chaosLevel}</span>
          </div>
        )}
      </div>

      {/* Right Section - Progress & Actions */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
        {/* Progress Dial */}
        <div className="ui-element" style={{
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          background: colors.paperCream
        }}>
          <div style={{ position: 'relative', width: '42px', height: '42px' }}>
            <svg width="42" height="42" viewBox="0 0 42 42">
              <circle
                cx="21" cy="21" r="17"
                fill="none"
                stroke="rgba(88, 47, 14, 0.15)"
                strokeWidth="3"
              />
              <circle
                cx="21" cy="21" r="17"
                fill="none"
                stroke={overallProgress === 100 ? colors.avocado : colors.burntOrange}
                strokeWidth="3"
                strokeDasharray={`${overallProgress * 1.07} ${107 - overallProgress * 1.07}`}
                strokeDashoffset="26.75"
                strokeLinecap="round"
                transform="rotate(-90 21 21)"
              />
            </svg>
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              fontSize: '10px',
              fontWeight: 700,
              fontFamily: "'Courier New', monospace",
              color: overallProgress === 100 ? colors.avocado : colors.ink
            }}>
              {overallProgress}%
            </div>
          </div>
          <div>
            <div style={{
              fontSize: '10px',
              fontWeight: 600,
              color: colors.ink,
              letterSpacing: '0.1em',
              textTransform: 'uppercase'
            }}>Solved</div>
            <div style={{
              fontSize: '11px',
              color: colors.inkLight,
              fontFamily: "'Courier New', monospace"
            }}>{totalComplete}/{totalStickers}</div>
          </div>
        </div>

        {/* Face Progress - Vintage Bar Chart */}
        <div className="ui-element" style={{ padding: '8px 12px', background: colors.paperCream }}>
          <div style={{
            fontSize: '9px',
            color: colors.inkLight,
            marginBottom: '6px',
            letterSpacing: '0.15em',
            textTransform: 'uppercase'
          }}>Faces</div>
          <div style={{ display: 'flex', gap: '4px' }}>
            {faceStats.map(f => (
              <div key={f.face} style={{
                width: '7px',
                height: '26px',
                background: 'rgba(88, 47, 14, 0.1)',
                border: '1px solid rgba(88, 47, 14, 0.15)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column-reverse'
              }}>
                <div style={{
                  width: '100%',
                  height: `${f.percent}%`,
                  background: FACE_COLORS[f.face],
                  transition: 'height 0.3s ease',
                  opacity: 0.85
                }} />
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions - Vintage Buttons */}
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={onShowHelp}
            className="btn-compact"
            style={{
              width: '34px',
              height: '34px',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
              fontWeight: 700,
              fontFamily: 'Georgia, serif'
            }}
          >
            ?
          </button>
          <button
            onClick={onShowSettings}
            className="btn-compact"
            style={{
              width: '34px',
              height: '34px',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '13px'
            }}
          >
            ⚙
          </button>
        </div>
      </div>
    </div>
  );
};

const InstabilityTracker = ({ entropy, wormholes, chaosLevel }) => {
  const [pulse, setPulse] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setPulse(Math.sin(Date.now() * 0.003) * 0.5 + 0.5);
    }, 50);
    return () => clearInterval(interval);
  }, []);
  
  const instability = Math.min(100, entropy + wormholes * 3);
  const level = instability < 25 ? 'STABLE' : instability < 50 ? 'UNSTABLE' : instability < 75 ? 'CRITICAL' : 'CHAOS';
  const color = instability < 25 ? '#22c55e' : instability < 50 ? '#eab308' : instability < 75 ? '#f97316' : '#ef4444';
  
  return (
    <div className="instability-tracker">
      <div className="tracker-label">
        <span style={{color}}>◆</span> {level}
      </div>
      <div className="tracker-bar-container">
        <div 
          className="tracker-bar-fill" 
          style={{
            width: `${instability}%`,
            background: `linear-gradient(90deg, ${color}, ${color}dd)`,
            opacity: 0.7 + pulse * 0.3
          }}
        />
      </div>
      <div className="tracker-value">{instability.toFixed(0)}%</div>
    </div>
  );
};

const MainMenu = ({ onStart }) => {
  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'linear-gradient(135deg, #f5f1e8, #e8dcc8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000
    }}>
      <div style={{
        textAlign: 'center',
        maxWidth: '650px',
        padding: '48px',
        background: '#fdfbf7',
        borderRadius: '8px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
        border: '1px solid #d4c5a9'
      }}>
        <h1 style={{
          fontSize: '56px',
          fontWeight: 600,
          margin: '0 0 12px 0',
          color: '#6b4423',
          fontFamily: 'Georgia, serif',
          letterSpacing: '1px'
        }}>The Wormhole Cube</h1>

        <p style={{
          fontSize: '18px',
          color: '#8b6f47',
          marginBottom: '32px',
          lineHeight: 1.7,
          fontFamily: 'Georgia, serif',
          fontStyle: 'italic'
        }}>
          An Interactive Journey into Topology
        </p>

        <div style={{
          background: '#f9f5ed',
          border: '2px solid #d4c5a9',
          borderRadius: '6px',
          padding: '28px',
          marginBottom: '36px',
          textAlign: 'left',
          fontSize: '15px',
          lineHeight: 1.9,
          color: '#5a4a3a'
        }}>
          <p style={{ margin: '0 0 16px 0' }}>
            Welcome! This puzzle helps you explore <strong style={{ color: '#8b6f47' }}>quotient spaces</strong> –
            a beautiful concept from topology where we identify opposite points as the same.
          </p>
          <p style={{ margin: '0 0 16px 0' }}>
            Think of it like this: if you could walk far enough in one direction, you'd find yourself
            coming back from the opposite side, but flipped! The colorful tunnels help you visualize
            these special connections.
          </p>
          <p style={{ margin: '0' }}>
            Don't worry if it sounds complex – learning happens through play. Click, drag, and discover!
          </p>
        </div>

        <button onClick={onStart} style={{
          background: 'linear-gradient(135deg, #c19a6b, #a67c52)',
          border: '2px solid #8b6f47',
          color: '#fdfbf7',
          fontSize: '20px',
          fontWeight: 600,
          padding: '16px 48px',
          borderRadius: '6px',
          cursor: 'pointer',
          boxShadow: '0 3px 12px rgba(107,68,35,0.2)',
          transition: 'all 0.2s',
          fontFamily: 'Georgia, serif'
        }}
        onMouseEnter={e => {
          e.target.style.transform = 'translateY(-2px)';
          e.target.style.boxShadow = '0 6px 20px rgba(107,68,35,0.3)';
        }}
        onMouseLeave={e => {
          e.target.style.transform = 'translateY(0)';
          e.target.style.boxShadow = '0 3px 12px rgba(107,68,35,0.2)';
        }}>
          Begin Learning
        </button>

        <div style={{
          marginTop: '32px',
          fontSize: '13px',
          color: '#9b8b7a',
          fontStyle: 'italic'
        }}>
          Press <strong style={{ color: '#6b4423' }}>H</strong> anytime to see helpful controls
        </div>
      </div>
    </div>
  );
};

const SettingsMenu = ({ onClose, settings, onSettingsChange }) => {
  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(245,241,232,0.92)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      backdropFilter: 'blur(4px)'
    }} onClick={onClose}>
      <div style={{
        background: '#fdfbf7',
        border: '2px solid #d4c5a9',
        borderRadius: '8px',
        padding: '32px',
        maxWidth: '500px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
      }} onClick={e => e.stopPropagation()}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px'
        }}>
          <h2 style={{
            margin: 0,
            fontSize: '28px',
            fontWeight: 600,
            color: '#6b4423',
            fontFamily: 'Georgia, serif'
          }}>Settings</h2>
          <button onClick={onClose} style={{
            background: '#e8dcc8',
            border: '1px solid #d4c5a9',
            color: '#6b4423',
            fontSize: '24px',
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s'
          }}>×</button>
        </div>

        <div style={{ color: '#5a4a3a' }}>
          <div style={{
            padding: '16px',
            background: '#f9f5ed',
            borderRadius: '6px',
            marginBottom: '16px',
            border: '2px solid #e8dcc8'
          }}>
            <p style={{ margin: 0, fontSize: '14px', fontStyle: 'italic', color: '#8b6f47', fontFamily: 'Georgia, serif' }}>
              More customization options are on the way! We're adding features like sound, animation controls, and color themes.
            </p>
          </div>

          <div style={{ fontSize: '14px', lineHeight: 2, fontFamily: 'Georgia, serif' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px',
              background: '#f9f5ed',
              borderRadius: '6px',
              marginBottom: '8px'
            }}>
              <span>🔊 Sound Effects</span>
              <span style={{ color: '#a89178', fontSize: '13px' }}>Coming Soon</span>
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px',
              background: '#f9f5ed',
              borderRadius: '6px',
              marginBottom: '8px'
            }}>
              <span>⚡ Animation Speed</span>
              <span style={{ color: '#a89178', fontSize: '13px' }}>Coming Soon</span>
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px',
              background: '#f9f5ed',
              borderRadius: '6px',
              marginBottom: '8px'
            }}>
              <span>💾 Auto-Save Progress</span>
              <span style={{ color: '#a89178', fontSize: '13px' }}>Coming Soon</span>
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px',
              background: '#f9f5ed',
              borderRadius: '6px'
            }}>
              <span>🎨 Custom Colors</span>
              <span style={{ color: '#a89178', fontSize: '13px' }}>Coming Soon</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const HelpMenu = ({ onClose }) => {
  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(245,241,232,0.92)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      backdropFilter: 'blur(4px)'
    }} onClick={onClose}>
      <div style={{
        background: '#fdfbf7',
        border: '2px solid #d4c5a9',
        borderRadius: '8px',
        padding: '32px',
        maxWidth: '600px',
        maxHeight: '80vh',
        overflowY: 'auto',
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
      }} onClick={e => e.stopPropagation()}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px'
        }}>
          <h2 style={{
            margin: 0,
            fontSize: '28px',
            fontWeight: 600,
            color: '#6b4423',
            fontFamily: 'Georgia, serif'
          }}>How to Play</h2>
          <button onClick={onClose} style={{
            background: '#e8dcc8',
            border: '1px solid #d4c5a9',
            color: '#6b4423',
            fontSize: '24px',
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s'
          }}>×</button>
        </div>

        <div style={{ color: '#5a4a3a', lineHeight: 1.7, fontFamily: 'Georgia, serif' }}>
          <section style={{ marginBottom: '24px' }}>
            <h3 style={{ color: '#8b6f47', marginBottom: '12px', fontSize: '18px', fontWeight: 600 }}>🎮 Moving the Cube</h3>
            <div style={{ paddingLeft: '16px', fontSize: '14px' }}>
              <p style={{ margin: '8px 0' }}><strong>Drag normally:</strong> Rotates a slice (like a Rubik's Cube)</p>
              <p style={{ margin: '8px 0' }}><strong>Hold Shift + Drag:</strong> Twists the face itself</p>
              <p style={{ margin: '8px 0' }}><strong>Click a sticker:</strong> Flips it to its "opposite" color</p>
            </div>
          </section>

          <section style={{ marginBottom: '24px' }}>
            <h3 style={{ color: '#a67c52', marginBottom: '12px', fontSize: '18px', fontWeight: 600 }}>🌀 Special Features</h3>
            <div style={{ paddingLeft: '16px', fontSize: '14px' }}>
              <p style={{ margin: '8px 0' }}><strong>Wormholes:</strong> The colorful tunnels show connections between opposite points</p>
              <p style={{ margin: '8px 0' }}><strong>Flip Mode:</strong> Turn color flipping on or off</p>
              <p style={{ margin: '8px 0' }}><strong>Chaos Mode:</strong> Watch instability spread across the cube!</p>
            </div>
          </section>

          <section style={{ marginBottom: '24px' }}>
            <h3 style={{ color: '#c19a6b', marginBottom: '12px', fontSize: '18px', fontWeight: 600 }}>👁️ Different Views</h3>
            <div style={{ paddingLeft: '16px', fontSize: '14px' }}>
              <p style={{ margin: '8px 0' }}><strong>Classic:</strong> The standard colorful cube</p>
              <p style={{ margin: '8px 0' }}><strong>Grid:</strong> Shows position labels (M1-001, etc.)</p>
              <p style={{ margin: '8px 0' }}><strong>Sudokube:</strong> Numbers instead of colors</p>
              <p style={{ margin: '8px 0' }}><strong>Wireframe:</strong> See-through edges with lights</p>
              <p style={{ margin: '8px 0' }}><strong>Explode:</strong> Spreads the cube apart to see all sides</p>
              <p style={{ margin: '8px 0' }}><strong>Tunnels:</strong> Hide or show the wormhole connections</p>
            </div>
          </section>

          <section style={{ marginBottom: '24px' }}>
            <h3 style={{ color: '#8b6f47', marginBottom: '12px', fontSize: '18px', fontWeight: 600 }}>📊 What the Numbers Mean</h3>
            <div style={{ paddingLeft: '16px', fontSize: '14px' }}>
              <p style={{ margin: '8px 0' }}><strong>M:</strong> How many moves you've made</p>
              <p style={{ margin: '8px 0' }}><strong>F:</strong> How many times you've flipped colors</p>
              <p style={{ margin: '8px 0' }}><strong>W:</strong> How many wormholes are currently active</p>
              <p style={{ margin: '8px 0' }}><strong>Instability Bar:</strong> Shows how chaotic things are getting!</p>
            </div>
          </section>

          <section>
            <h3 style={{ color: '#a67c52', marginBottom: '12px', fontSize: '18px', fontWeight: 600 }}>⌨️ Keyboard Shortcuts</h3>
            <div style={{ paddingLeft: '16px', fontSize: '14px' }}>
              <p style={{ margin: '8px 0' }}><strong>H</strong> or <strong>?</strong> — Open/close this help menu</p>
              <p style={{ margin: '8px 0' }}><strong>Space</strong> — Shuffle the cube randomly</p>
              <p style={{ margin: '8px 0' }}><strong>R</strong> — Reset everything</p>
              <p style={{ margin: '8px 0' }}><strong>F</strong> — Turn flip mode on/off</p>
              <p style={{ margin: '8px 0' }}><strong>T</strong> — Show/hide tunnels</p>
              <p style={{ margin: '8px 0' }}><strong>E</strong> — Toggle explosion view</p>
              <p style={{ margin: '8px 0' }}><strong>V</strong> — Change view mode</p>
              <p style={{ margin: '8px 0' }}><strong>C</strong> — Turn chaos mode on/off</p>
              <p style={{ margin: '8px 0' }}><strong>Esc</strong> — Close menus</p>
            </div>
          </section>
        </div>

        <div style={{
          marginTop: '24px',
          padding: '16px',
          background: '#f9f5ed',
          borderRadius: '6px',
          fontSize: '14px',
          color: '#6b4423',
          fontStyle: 'italic',
          border: '2px solid #e8dcc8',
          fontFamily: 'Georgia, serif'
        }}>
          💡 <strong>What you're learning:</strong> This puzzle demonstrates a special kind of mathematical space
          where opposite points are treated as the same location. When you flip a color, you're creating a connection
          through this space – that's what the wormholes represent!
        </div>
      </div>
    </div>
  );
};

const CubeAssembly=({ 
  size, cubies, onMove, onTapFlip, visualMode, animState, onAnimComplete, 
  showTunnels, explosionFactor, cascades, onCascadeComplete, manifoldMap 
})=>{
  const cubieRefs=useRef([]); 
  const controlsRef=useRef(); 
  const { camera }=useThree();
  const [dragStart,setDragStart]=useState(null); 
  const [activeDir,setActiveDir]=useState(null);

  const getBasis=()=>{ 
    const f=new THREE.Vector3(); 
    camera.getWorldDirection(f).normalize();
    const r=new THREE.Vector3().crossVectors(camera.up,f).normalize();
    const u=new THREE.Vector3().crossVectors(f,r).normalize();
    return { right:r, upScreen:u };
  };
  
  const normalFromEvent=e=>{
    const n=(e?.face?.normal||new THREE.Vector3(0,0,1)).clone();
    const nm=new THREE.Matrix3().getNormalMatrix(e?.object?.matrixWorld ?? new THREE.Matrix4());
    n.applyNormalMatrix(nm).normalize();
    return n;
  };
  
  const sgn=v=>v>=0?1:-1;
  
  const mapSwipe=(faceN,dx,dy,isFaceTwist=false)=>{
    // If face twist mode, rotate around the face normal itself
    if(isFaceTwist){
      const ax=Math.abs(faceN.x), ay=Math.abs(faceN.y), az=Math.abs(faceN.z);
      const m=Math.max(ax,ay,az);
      let axis, twistDir;
      if(m===ax){ axis='col'; twistDir=-sgn(faceN.x)*sgn(dx); } // Flipped
      else if(m===ay){ axis='row'; twistDir=-sgn(faceN.y)*sgn(-dy); } // Flipped
      else{ axis='depth'; twistDir=-sgn(faceN.z)*sgn(dx); } // Flipped
      return {axis,dir:twistDir};
    }
    // Normal slice rotation
    const {right,upScreen}=getBasis();
    const sw=new THREE.Vector3().addScaledVector(right,dx).addScaledVector(upScreen,dy); // Fixed: removed negative sign
    const t=sw.clone().projectOnPlane(faceN);
    if(t.lengthSq()<1e-6) return null;
    const ra=new THREE.Vector3().crossVectors(t,faceN).normalize();
    const ax=Math.abs(ra.x), ay=Math.abs(ra.y), az=Math.abs(ra.z);
    if(ax>=ay&&ax>=az) return {axis:'col',dir:sgn(ra.x)};
    if(ay>=ax&&ay>=az) return {axis:'row',dir:sgn(ra.y)};
    return {axis:'depth',dir:sgn(ra.z)};
  };
  
  const dirFromNormal=n=>{
    const a=[Math.abs(n.x),Math.abs(n.y),Math.abs(n.z)], m=Math.max(...a);
    if(m===a[0]) return n.x>=0?'PX':'NX';
    if(m===a[1]) return n.y>=0?'PY':'NY';
    return n.z>=0?'PZ':'NZ';
  };

  const onPointerDown=({pos,worldPos,event})=>{
    if(animState) return;
    setDragStart({
      pos, worldPos, event,
      screenX:event.clientX,
      screenY:event.clientY,
      n:normalFromEvent(event),
      shiftKey:event.shiftKey // Track if Shift was held
    });
    if(controlsRef.current) controlsRef.current.enabled=false;
  };

  useEffect(()=>{
    const move=e=>{
      if(!dragStart) return;
      const dx=e.clientX-dragStart.screenX, dy=e.clientY-dragStart.screenY;
      if(Math.abs(dx)>10||Math.abs(dy)>10)
        setActiveDir(Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up'));
      else setActiveDir(null);
    };
    const up=e=>{
      if(!dragStart) return;
      const dx=e.clientX-dragStart.screenX, dy=e.clientY-dragStart.screenY;
      const dist=Math.hypot(dx,dy);
      if(dist>=10){
        const m=mapSwipe(dragStart.n,dx,dy,dragStart.shiftKey); // Pass shiftKey for face twist
        if(m) onMove(m.axis,m.dir,dragStart.pos);
      }else{
        const dirKey=dirFromNormal(dragStart.n);
        onTapFlip(dragStart.pos,dirKey);
      }
      setDragStart(null);
      setActiveDir(null);
      if(controlsRef.current) controlsRef.current.enabled=true;
    };
    window.addEventListener('pointermove',move);
    window.addEventListener('pointerup',up);
    return ()=>{ 
      window.removeEventListener('pointermove',move); 
      window.removeEventListener('pointerup',up); 
    };
  },[dragStart,onMove,onTapFlip]);

  useFrame((_,delta)=>{
    if(!animState) return;
    const {axis,dir,sliceIndex,t}=animState;
    const speed=1.8, newT=Math.min(1,(t??0)+delta*speed);
    const ease=newT<0.5?4*newT**3:1-(-2*newT+2)**3/2;
    const prev=(t??0)<0.5?4*(t??0)**3:1-(-2*(t??0)+2)**3/2;
    const dRot=(ease-prev)*(Math.PI/2);
    const worldAxis=axis==='col'?new THREE.Vector3(1,0,0):axis==='row'?new THREE.Vector3(0,1,0):new THREE.Vector3(0,0,1);
    const k=(size-1)/2;
    
    const expansionFactor = 1 + explosionFactor * 1.8;
    
    cubieRefs.current.forEach(g=>{
      if(!g) return;
      const gx=Math.round(g.position.x/expansionFactor+k);
      const gy=Math.round(g.position.y/expansionFactor+k);
      const gz=Math.round(g.position.z/expansionFactor+k);
      const inSlice=(axis==='col'&&gx===sliceIndex)||(axis==='row'&&gy===sliceIndex)||(axis==='depth'&&gz===sliceIndex);
      if(inSlice){ 
        g.position.applyAxisAngle(worldAxis,dRot*dir); 
        g.rotateOnWorldAxis(worldAxis,dRot*dir); 
      }
    });
    if(newT>=1) { onAnimComplete(); vibrate(14); } else animState.t=newT;
  });

  const k=(size-1)/2;
  const items=useMemo(()=>{
    const arr=[]; let i=0;
    for(let x=0;x<size;x++)for(let y=0;y<size;y++)for(let z=0;z<size;z++){
      arr.push({key:i++, pos:[x-k,y-k,z-k], cubie:cubies[x][y][z]});
    }
    return arr;
  },[cubies,size,k]);

  useEffect(()=>{
    if(!animState){
      items.forEach((it,idx)=>{
        const g=cubieRefs.current[idx];
        if(g){ 
          const exploded = [
            it.pos[0] * (1 + explosionFactor * 1.8),
            it.pos[1] * (1 + explosionFactor * 1.8),
            it.pos[2] * (1 + explosionFactor * 1.8)
          ];
          g.position.set(...exploded); 
          g.rotation.set(0,0,0); 
        }
      });
    }
  },[animState,items,explosionFactor]);

  return (
    <group>
      <WormholeNetwork 
        cubies={cubies} 
        size={size} 
        showTunnels={showTunnels}
        manifoldMap={manifoldMap}
        cubieRefs={cubieRefs.current}
      />
      {cascades.map(c => (
        <ChaosWave 
          key={c.id} 
          from={c.from} 
          to={c.to}
          onComplete={() => onCascadeComplete(c.id)}
        />
      ))}
      {items.map((it,idx)=>(
        <Cubie 
          key={it.key} 
          ref={el=> (cubieRefs.current[idx]=el)} 
          position={it.pos} 
          cubie={it.cubie} 
          size={size} 
          visualMode={visualMode} 
          onPointerDown={onPointerDown}
          explosionFactor={explosionFactor}
        />
      ))}
      {dragStart && !animState && <DragGuide position={dragStart.worldPos} activeDir={activeDir}/>}
      <OrbitControls 
        ref={controlsRef} 
        enablePan={false} 
        minDistance={5} 
        maxDistance={28} 
        enabled={!animState && !dragStart}
        enableDamping={true}
        dampingFactor={0.05}
        rotateSpeed={0.8}
      />
    </group>
  );
};

const Tutorial = ({ onClose }) => {
  const [step, setStep] = useState(1);
  useEffect(()=>{ 
    document.body.style.overflow='hidden'; 
    return ()=>{ document.body.style.overflow=''; };
  },[]);
  
  return (
    <div className="tutorial-overlay">
      <div className="tutorial-card">
        <h2>WORM³ — Quick Start</h2>
        {step===1 && (
          <>
            <p>Click a sticker to flip <b>it</b> and its <b>permanent antipodal twin</b>.</p>
            <p>Colored tunnels appear showing each antipodal pair: <span style={{color:COLORS.blue}}>Blue↔Green</span>, <span style={{color:COLORS.red}}>Red↔Orange</span>, <span style={{color:COLORS.yellow}}>Yellow↔White</span></p>
          </>
        )}
        {step===2 && (
          <>
            <p>Drag on the cube to twist rows/columns/slices. <b>Antipodal pairs stay permanently linked</b> by original position.</p>
            <p>Tunnels gradient from one color to its antipodal partner, with up to 50 strands per connection!</p>
          </>
        )}
        {step===3 && (
          <>
            <p>Chaos Mode spreads wormholes to <b>N-S-E-W neighbors</b>—fight the cascade.</p>
            <p><b>Explode</b> view reveals the structure. Good luck, topologist!</p>
          </>
        )}
        <div className="tutorial-actions">
          <button className="bauhaus-btn" onClick={onClose}>Skip</button>
          {step<3
            ? <button className="bauhaus-btn" onClick={()=>setStep(s=>s+1)}>Next</button>
            : <button className="bauhaus-btn" onClick={onClose}>Let's play</button>}
        </div>
      </div>
    </div>
  );
};

/* First Flip Tutorial - Explains the core concepts after user's first flip */
const FirstFlipTutorial = ({ onClose }) => {
  const [step, setStep] = useState(0);

  const colors = {
    ink: '#582f0e',
    inkMedium: '#7f5539',
    burntOrange: '#bc6c25',
    avocado: '#606c38',
    paper: '#f2e8cf',
    paperCream: '#fefae0'
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(88, 47, 14, 0.7)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 2000,
      fontFamily: 'Georgia, serif'
    }}>
      <div style={{
        background: colors.paper,
        border: `3px solid ${colors.burntOrange}`,
        borderRadius: '4px',
        padding: '32px 40px',
        maxWidth: '580px',
        width: '90%',
        maxHeight: '85vh',
        overflow: 'auto',
        boxShadow: `4px 4px 0 rgba(88, 47, 14, 0.2), 0 12px 40px rgba(88, 47, 14, 0.4)`
      }}>
        <h2 style={{
          margin: '0 0 8px 0',
          fontSize: '28px',
          fontStyle: 'italic',
          fontWeight: 700,
          color: colors.ink,
          textAlign: 'center'
        }}>
          {step === 0 && "You Just Traveled Through a Wormhole!"}
          {step === 1 && "Antipodal Pairs"}
          {step === 2 && "Parity & Orientation"}
          {step === 3 && "Chaos Mode"}
          {step === 4 && "The Art of Solving"}
        </h2>

        <p style={{
          textAlign: 'center',
          fontSize: '11px',
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          color: colors.burntOrange,
          margin: '0 0 24px 0'
        }}>
          {step === 0 && "Your first flip through the manifold"}
          {step === 1 && "Every point has an opposite"}
          {step === 2 && "The mathematics of flipping"}
          {step === 3 && "When the manifold fights back"}
          {step === 4 && "Speed, strategy & elegance"}
        </p>

        <div style={{
          background: colors.paperCream,
          border: `1px solid rgba(188, 108, 37, 0.3)`,
          padding: '20px 24px',
          marginBottom: '24px',
          fontSize: '15px',
          lineHeight: 1.8,
          color: colors.inkMedium
        }}>
          {step === 0 && (
            <>
              <p style={{ margin: '0 0 16px 0' }}>
                That color flip you just witnessed? You sent a sticker through an <strong style={{ color: colors.ink }}>antipodal tunnel</strong> —
                a path connecting opposite points on the cube's surface.
              </p>
              <p style={{ margin: '0 0 16px 0' }}>
                In the <strong style={{ color: colors.ink }}>Real Projective Plane</strong>, opposite points are considered
                <em> the same point</em>. Walking infinitely far in any direction brings you back — but <em>inverted</em>.
              </p>
              <p style={{ margin: 0, fontStyle: 'italic', color: colors.burntOrange }}>
                "Imagine walking so far you return from the other side..."
              </p>
            </>
          )}

          {step === 1 && (
            <>
              <p style={{ margin: '0 0 16px 0' }}>
                Each face has a partner on the opposite side of the cube:
              </p>
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '24px',
                margin: '16px 0',
                fontSize: '14px'
              }}>
                <span><span style={{ color: FACE_COLORS[1] }}>■</span> Red ↔ Orange <span style={{ color: FACE_COLORS[4] }}>■</span></span>
                <span><span style={{ color: FACE_COLORS[5] }}>■</span> Blue ↔ Green <span style={{ color: FACE_COLORS[2] }}>■</span></span>
                <span><span style={{ color: FACE_COLORS[3] }}>■</span> White ↔ Yellow <span style={{ color: FACE_COLORS[6] }}>■</span></span>
              </div>
              <p style={{ margin: '16px 0 0 0' }}>
                When you flip a sticker, it transforms into its <strong style={{ color: colors.ink }}>antipodal color</strong>.
                The small circle on flipped tiles shows their <em>original</em> color — a breadcrumb trail of their journey.
              </p>
            </>
          )}

          {step === 2 && (
            <>
              <p style={{ margin: '0 0 16px 0' }}>
                Notice the <strong style={{ color: colors.avocado }}>EVEN</strong> / <strong style={{ color: colors.burntOrange }}>ODD</strong> indicator?
                That's <strong style={{ color: colors.ink }}>parity</strong> — the mathematical signature of your flips.
              </p>
              <p style={{ margin: '0 0 16px 0' }}>
                • <strong>Even parity:</strong> The cube can return to its original state<br />
                • <strong>Odd parity:</strong> Something is fundamentally "twisted"
              </p>
              <p style={{ margin: '0 0 16px 0' }}>
                The <strong style={{ color: colors.ink }}>tally marks</strong> on each sticker count its journeys through the manifold.
                A tile flipped 1000 times carries a different history than a fresh tile — even if they show the same color!
              </p>
              <p style={{ margin: 0, fontStyle: 'italic' }}>
                This is <em>orientation</em>: the hidden memory of transformation.
              </p>
            </>
          )}

          {step === 3 && (
            <>
              <p style={{ margin: '0 0 16px 0' }}>
                <strong style={{ color: '#9c4a1a' }}>Chaos Mode</strong> introduces <em>instability</em>.
                Flipped tiles at the cube's edges can spontaneously cascade to their neighbors!
              </p>
              <p style={{ margin: '0 0 16px 0' }}>
                <strong>Levels 1-4</strong> control how aggressively chaos spreads:
              </p>
              <ul style={{ margin: '0 0 16px 0', paddingLeft: '24px' }}>
                <li>L1: Gentle — occasional cascades</li>
                <li>L2: Moderate — regular spreading</li>
                <li>L3: Aggressive — rapid propagation</li>
                <li>L4: Maximum entropy — constant chaos</li>
              </ul>
              <p style={{ margin: 0 }}>
                Watch the <strong>Instability Tracker</strong> — when it goes critical, expect fireworks!
              </p>
            </>
          )}

          {step === 4 && (
            <>
              <p style={{ margin: '0 0 16px 0' }}>
                <strong style={{ color: colors.ink }}>Solving faster</strong> isn't just about speed — it's about <em>understanding the structure</em>.
              </p>
              <p style={{ margin: '0 0 16px 0' }}>
                <strong>Tips for mastery:</strong>
              </p>
              <ul style={{ margin: '0 0 16px 0', paddingLeft: '24px' }}>
                <li>Use <strong>EXPLODE</strong> view to see all antipodal connections</li>
                <li>Track parity — plan flips to maintain even state when possible</li>
                <li>In Chaos Mode, work from center outward to minimize cascades</li>
                <li>The <strong>face progress bars</strong> show which colors need attention</li>
              </ul>
              <p style={{ margin: 0, fontStyle: 'italic', color: colors.burntOrange }}>
                The topology is your friend once you learn to see it. Good luck, explorer!
              </p>
            </>
          )}
        </div>

        {/* Step indicators */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '8px',
          marginBottom: '20px'
        }}>
          {[0, 1, 2, 3, 4].map(i => (
            <div
              key={i}
              onClick={() => setStep(i)}
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: step === i ? colors.burntOrange : 'rgba(188, 108, 37, 0.3)',
                cursor: 'pointer',
                transition: 'background 0.2s'
              }}
            />
          ))}
        </div>

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '12px'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 24px',
              background: 'transparent',
              border: `2px solid ${colors.burntOrange}`,
              color: colors.burntOrange,
              fontFamily: 'Georgia, serif',
              fontSize: '14px',
              fontWeight: 600,
              letterSpacing: '0.1em',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            Skip
          </button>

          {step < 4 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              style={{
                padding: '10px 32px',
                background: colors.burntOrange,
                border: 'none',
                color: colors.paperCream,
                fontFamily: 'Georgia, serif',
                fontSize: '14px',
                fontWeight: 600,
                letterSpacing: '0.1em',
                cursor: 'pointer',
                boxShadow: `0 2px 0 #9c4a1a`,
                transition: 'all 0.2s'
              }}
            >
              Next →
            </button>
          ) : (
            <button
              onClick={onClose}
              style={{
                padding: '10px 32px',
                background: colors.avocado,
                border: 'none',
                color: colors.paperCream,
                fontFamily: 'Georgia, serif',
                fontSize: '14px',
                fontWeight: 600,
                letterSpacing: '0.1em',
                cursor: 'pointer',
                boxShadow: `0 2px 0 #283618`,
                transition: 'all 0.2s'
              }}
            >
              Start Exploring!
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

/* Main App */
export default function WORM3(){
  const [showWelcome, setShowWelcome] = useState(true);
  
  const [size,setSize]=useState(3);
  const [cubies,setCubies]=useState(()=>makeCubies(size));
  const [moves,setMoves]=useState(0);
  const [visualMode,setVisualMode]=useState('classic');
  const [flipMode,setFlipMode]=useState(true);
  const [chaosLevel,setChaosLevel]=useState(0);
  const [showHelp,setShowHelp]=useState(false);
  const [showSettings,setShowSettings]=useState(false);
  const [showMainMenu,setShowMainMenu]=useState(true);
  const chaosMode=chaosLevel>0;

  const [animState,setAnimState]=useState(null);
  const [pendingMove,setPendingMove]=useState(null);

  const [showTutorial, setShowTutorial] = useState(false);
  const [hasFlippedOnce, setHasFlippedOnce] = useState(() => {
    try { return localStorage.getItem('worm3_first_flip_done') === '1'; } catch { return false; }
  });
  const [showFirstFlipTutorial, setShowFirstFlipTutorial] = useState(false);

  const [showTunnels, setShowTunnels] = useState(true);
  const [exploded, setExploded] = useState(false);
  const [explosionT, setExplosionT] = useState(0);
  const [cascades, setCascades] = useState([]);
  
  const handleWelcomeComplete = () => {
    setShowWelcome(false);
    try{ localStorage.setItem('worm3_intro_seen', '1'); }catch{}
    setShowTutorial(true);
  };
  
  const closeTutorial = () => {
    setShowTutorial(false);
    try{ localStorage.setItem('worm3_tutorial_done','1'); }catch{}
  };

  useEffect(() => {
    let raf;
    const animate = () => {
      setExplosionT(t => {
        if (exploded && t < 1) return Math.min(1, t + 0.05);
        if (!exploded && t > 0) return Math.max(0, t - 0.05);
        return t;
      });
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [exploded]);
 
  const manifoldMap = useMemo(() => buildManifoldGridMap(cubies, size), [cubies, size]);

  const metrics=useMemo(()=>{
    let flips=0,wormholes=0,off=0,total=0;
    for(const L of cubies)for(const R of L)for(const c of R){
      for(const k of Object.keys(c.stickers)){
        const s=c.stickers[k];
        flips+=s.flips||0; total++;
        if(s.curr!==s.orig) off++;
        if(s.flips>0 && s.curr!==s.orig) wormholes++;
      }
    }
    return { flips, wormholes, entropy: Math.round((off/total)*100) };
  },[cubies]);

  useEffect(()=>{ 
    setCubies(makeCubies(size)); 
    setMoves(0); 
    setAnimState(null); 
  },[size]);

  useEffect(()=>{
    if(!chaosMode) return;
    let raf=0,last=performance.now(),acc=0;
    const period=[0,1000,750,500,350][chaosLevel];

    const step=(state)=>{
      const S=state.length; 
      const unstable=[];
      
      for(let x=0;x<S;x++)for(let y=0;y<S;y++)for(let z=0;z<S;z++){
        const c=state[x][y][z];
        for(const dirKey of Object.keys(c.stickers)){
          const st=c.stickers[dirKey];
          const onEdge=(dirKey==='PX'&&x===S-1)||(dirKey==='NX'&&x===0)||(dirKey==='PY'&&y===S-1)||(dirKey==='NY'&&y===0)||(dirKey==='PZ'&&z===S-1)||(dirKey==='NZ'&&z===0);
          if(st.flips>0 && st.curr!==st.orig && onEdge) 
            unstable.push({x,y,z,dirKey,flips:st.flips});
        }
      }
      
      if(!unstable.length) return state;

      const src=unstable[Math.floor(Math.random()*unstable.length)];
      const base=[0,0.10,0.20,0.35,0.50][chaosLevel];
      const pSelf=base*Math.log(src.flips+1), pN=base*0.6;

      let next=state;
      if (Math.random()<pSelf) {
        next=flipStickerPair(next,S,src.x,src.y,src.z,src.dirKey, manifoldMap); 
      }

      const neighbors=(()=>{
        const N=[];
        if(src.dirKey==='PX'||src.dirKey==='NX'){ 
          const xi=src.dirKey==='PX'?S-1:0; 
          const add=(yy,zz)=>{ if(yy>=0&&yy<S&&zz>=0&&zz<S)N.push([xi,yy,zz]); };
          add(src.y-1,src.z); add(src.y+1,src.z); add(src.y,src.z-1); add(src.y,src.z+1); 
        }
        else if(src.dirKey==='PY'||src.dirKey==='NY'){ 
          const yi=src.dirKey==='PY'?S-1:0; 
          const add=(xx,zz)=>{ if(xx>=0&&xx<S&&zz>=0&&zz<S)N.push([xx,yi,zz]); };
          add(src.x-1,src.z); add(src.x+1,src.z); add(src.x,src.z-1); add(src.x,src.z+1); 
        }
        else { 
          const zi=src.dirKey==='PZ'?S-1:0; 
          const add=(xx,yy)=>{ if(xx>=0&&xx<S&&yy>=0&&yy<S)N.push([xx,yy,zi]); };
          add(src.x-1,src.y); add(src.x+1,src.y); add(src.x,src.y-1); add(src.x,src.y+1); 
        }
        return N;
      })();

      for(const [nx,ny,nz] of neighbors) {
        if(Math.random()<pN) {
          next=flipStickerPair(next,S,nx,ny,nz,src.dirKey, manifoldMap); 
          
          const fromPos = getStickerWorldPos(src.x, src.y, src.z, src.dirKey, S, explosionT);
          const toPos = getStickerWorldPos(nx, ny, nz, src.dirKey, S, explosionT);
          
          setCascades(prev => [...prev, {
            id: Date.now() + Math.random(),
            from: fromPos,
            to: toPos
          }]);
        }
      }

      return next;
    };

    const loop=(now)=>{
      const dt=now-last; last=now; acc+=dt;
      if(acc>=period){ 
        setCubies(prev=>step(prev)); 
        acc=0; 
      }
      raf=requestAnimationFrame(loop);
    };
    raf=requestAnimationFrame(loop);
    return ()=>cancelAnimationFrame(raf);
  },[chaosMode,chaosLevel,explosionT, manifoldMap]); 

  const handleAnimComplete=()=>{
    if(pendingMove){
      const {axis,dir,sliceIndex}=pendingMove;
      setCubies(prev=>rotateSliceCubies(prev,size,axis,sliceIndex,dir));
      setMoves(m=>m+1);
      play('/sounds/rotate.mp3');
    }
    setAnimState(null); 
    setPendingMove(null);
  };

  const onMove=(axis,dir,sel)=>{
    const sliceIndex=axis==='col'?sel.x:axis==='row'?sel.y:sel.z;
    setAnimState({axis,dir,sliceIndex,t:0});
    setPendingMove({axis,dir,sliceIndex});
  };

  const onTapFlip=(pos,dirKey)=>{
    setCubies(prev=>flipStickerPair(prev,size,pos.x,pos.y,pos.z,dirKey, manifoldMap));
    setMoves(m=>m+1);

    // Trigger first-flip tutorial
    if (!hasFlippedOnce) {
      setHasFlippedOnce(true);
      try { localStorage.setItem('worm3_first_flip_done', '1'); } catch {}
      // Small delay so user sees the flip animation first
      setTimeout(() => setShowFirstFlipTutorial(true), 600);
    }
  };

  const onCascadeComplete = (id) => {
    setCascades(prev => prev.filter(c => c.id !== id));
  };

  const shuffle=()=>{
    let state=makeCubies(size);
    for(let i=0;i<25;i++){
      const ax=['row','col','depth'][Math.floor(Math.random()*3)];
      const slice=Math.floor(Math.random()*size);
      const dir=Math.random()>0.5?1:-1;
      state=rotateSliceCubies(state,size,ax,slice,dir);
    }
    setCubies(state); 
    setMoves(0);
  };

  const reset=()=>{
    setCubies(makeCubies(size));
    setMoves(0);
    play('/sounds/rotate.mp3');
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger if typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      switch(e.key.toLowerCase()) {
        case 'h':
        case '?':
          setShowHelp(h => !h);
          break;
        case ' ':
          e.preventDefault();
          shuffle();
          break;
        case 'r':
          reset();
          break;
        case 'f':
          setFlipMode(f => !f);
          break;
        case 't':
          setShowTunnels(t => !t);
          break;
        case 'e':
          setExploded(e => !e);
          break;
        case 'v':
          setVisualMode(v =>
            v==='classic'?'grid':
            v==='grid'?'sudokube':
            v==='sudokube'?'wireframe':
            'classic'
          );
          break;
        case 'c':
          setChaosLevel(l => l > 0 ? 0 : 1);
          break;
        case 'escape':
          setShowHelp(false);
          setShowSettings(false);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const cameraZ = ({2:8,3:10,4:14,5:18}[size] || 10);
  
  if (showWelcome) {
    return <WelcomeScreen onEnter={handleWelcomeComplete} />;
  }

  return (
    <div className="full-screen">
      {showTutorial && <Tutorial onClose={closeTutorial} />}

      <div className="canvas-container">
        <Canvas camera={{ position:[0,0,cameraZ], fov:40 }}>
          <ambientLight intensity={visualMode === 'wireframe' ? 0.2 : 1.25}/>
          <pointLight position={[10,10,10]} intensity={visualMode === 'wireframe' ? 0.3 : 1.35}/>
          <pointLight position={[-10,-10,-10]} intensity={visualMode === 'wireframe' ? 0.2 : 1.0}/>
          {visualMode === 'wireframe' && (
            <>
              <pointLight position={[0,0,0]} intensity={0.5} color="#fefae0" distance={15} decay={2}/>
              <pointLight position={[5,5,5]} intensity={0.25} color="#dda15e" />
              <pointLight position={[-5,-5,-5]} intensity={0.2} color="#bc6c25" />
            </>
          )}
          <Suspense fallback={null}>
            <Environment preset="city"/>
            <CubeAssembly
              size={size}
              cubies={cubies}
              onMove={onMove}
              onTapFlip={onTapFlip}
              visualMode={visualMode}
              animState={animState}
              onAnimComplete={handleAnimComplete}
              showTunnels={showTunnels}
              explosionFactor={explosionT}
              cascades={cascades}
              onCascadeComplete={onCascadeComplete}
              manifoldMap={manifoldMap}
              showInvitation={!hasFlippedOnce}
            />
          </Suspense>
        </Canvas>
      </div>

      <div className="ui-layer">
        <TopMenuBar
          moves={moves}
          metrics={metrics}
          size={size}
          visualMode={visualMode}
          flipMode={flipMode}
          chaosMode={chaosMode}
          chaosLevel={chaosLevel}
          cubies={cubies}
          onShowHelp={() => setShowHelp(true)}
          onShowSettings={() => setShowSettings(true)}
        />

        {/* Bottom Section - Controls & Manifold Selector */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <div className="controls-compact ui-element">
            <div className="controls-row">
              <button
                className={`btn-compact text ${flipMode?'active':''}`}
                onClick={()=>setFlipMode(!flipMode)}
              >
                FLIP
              </button>
              <button
                className={`btn-compact text ${chaosMode?'chaos':''}`}
                onClick={()=>setChaosLevel(l=>l>0?0:1)}
              >
                CHAOS
              </button>
              {chaosMode && (
                <div className="chaos-levels">
                  {[1,2,3,4].map(l=>(
                    <button
                      key={l}
                      className={`btn-level ${chaosLevel===l?'active':''}`}
                      onClick={()=>setChaosLevel(l)}
                    >
                      L{l}
                    </button>
                  ))}
                </div>
              )}
              <button
                className={`btn-compact text ${exploded?'active':''}`}
                onClick={()=>setExploded(!exploded)}
              >
                EXPLODE
              </button>
              <button
                className={`btn-compact text ${showTunnels?'active':''}`}
                onClick={()=>setShowTunnels(!showTunnels)}
              >
                TUNNELS
              </button>
              <button
                className="btn-compact text"
                onClick={()=>setVisualMode(v=>
                  v==='classic'?'grid':
                  v==='grid'?'sudokube':
                  v==='sudokube'?'wireframe':
                  'classic'
                )}
              >
                {visualMode.toUpperCase()}
              </button>
              <select
                className="btn-compact"
                value={size}
                onChange={e=>setSize(Number(e.target.value))}
                style={{ fontFamily: "'Courier New', monospace" }}
              >
                {[3,4,5].map(n=><option key={n} value={n}>{n}×{n}</option>)}
              </select>
              <button className="btn-compact shuffle text" onClick={shuffle}>
                SHUFFLE
              </button>
              <button className="btn-compact reset text" onClick={reset}>
                RESET
              </button>
            </div>
          </div>

          {/* Manifold Selector - Vintage Educational Footer */}
          <div className="manifold-selector" style={{
            fontFamily: 'Georgia, serif',
            fontSize: '10px',
            color: '#9c6644',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            opacity: 0.6,
            pointerEvents: 'auto'
          }}>
            Standard Euclidean ——— <span style={{ color: '#bc6c25', fontWeight: 600 }}>Antipodal Projection</span> ——— Real Projective Plane
          </div>
        </div>
      </div>

      {showMainMenu && <MainMenu onStart={() => setShowMainMenu(false)} />}
      {showSettings && <SettingsMenu onClose={() => setShowSettings(false)} />}
      {showHelp && <HelpMenu onClose={() => setShowHelp(false)} />}
      {showFirstFlipTutorial && <FirstFlipTutorial onClose={() => setShowFirstFlipTutorial(false)} />}
    </div>
  );
}