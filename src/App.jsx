// src/App.jsx
import React, { useState, useMemo, useRef, useEffect, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { RoundedBox, Text, OrbitControls, Html, Environment, Line } from '@react-three/drei';
import * as THREE from 'three';
import './App.css';

/* ---------- Constants ---------- */
const COLORS={ red:'#ef4444', blue:'#3b82f6', yellow:'#eab308', white:'#ffffff', orange:'#f97316', green:'#22c55e', black:'#121212', wormhole:'#a855f7' };
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

const IntroSticker = ({ pos, rot, color, emissive = 0 }) => (
  <mesh position={pos} rotation={rot}>
    <planeGeometry args={[0.82, 0.82]} />
    <meshStandardMaterial
      color={color}
      roughness={0.18}
      metalness={0}
      side={THREE.DoubleSide}
      emissive={color}
      emissiveIntensity={emissive}
    />
  </mesh>
);

const IntroCubie = React.forwardRef(({ position, size }, ref) => {
  const limit = (size - 1) / 2;
  const x = position[0] + limit;
  const y = position[1] + limit;
  const z = position[2] + limit;
  
  return (
    <group position={position} ref={ref}>
      <RoundedBox args={[0.98, 0.98, 0.98]} radius={0.05} smoothness={4}>
        <meshStandardMaterial color="#12151f" roughness={0.5} />
      </RoundedBox>
      {z === size - 1 && <IntroSticker pos={[0, 0, 0.51]} rot={[0, 0, 0]} color={FACE_COLORS[1]} />}
      {z === 0 && <IntroSticker pos={[0, 0, -0.51]} rot={[0, Math.PI, 0]} color={FACE_COLORS[4]} />}
      {x === size - 1 && <IntroSticker pos={[0.51, 0, 0]} rot={[0, Math.PI / 2, 0]} color={FACE_COLORS[5]} />}
      {x === 0 && <IntroSticker pos={[-0.51, 0, 0]} rot={[0, -Math.PI / 2, 0]} color={FACE_COLORS[2]} />}
      {y === size - 1 && <IntroSticker pos={[0, 0.51, 0]} rot={[-Math.PI / 2, 0, 0]} color={FACE_COLORS[3]} />}
      {y === 0 && <IntroSticker pos={[0, -0.51, 0]} rot={[Math.PI / 2, 0, 0]} color={FACE_COLORS[6]} />}
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
      msgs.push({ text: '> TOPOLOGY DETECTED', fade: time >= 3 && time < 3.3 ? (time - 3) / 0.3 : 1 });
    }
    if (time >= 3.5 && time < 10) {
      msgs.push({ text: '> INITIALIZING MANIFOLD ANALYSIS...', fade: time >= 3.5 && time < 3.8 ? (time - 3.5) / 0.3 : 1 });
    }
    if (time >= 6 && time < 10) {
      msgs.push({ text: '> ANTIPODAL PAIR DETECTION: COMPLETE', fade: time >= 6 && time < 6.3 ? (time - 6) / 0.3 : 1 });
    }
    if (time >= 6.5 && time < 7.5) {
      msgs.push({ text: '> RED ↔ ORANGE', fade: time >= 6.5 && time < 6.8 ? (time - 6.5) / 0.3 : 1, color: '#ef4444' });
    }
    if (time >= 7.5 && time < 8.5) {
      msgs.push({ text: '> BLUE ↔ GREEN', fade: time >= 7.5 && time < 7.8 ? (time - 7.5) / 0.3 : 1, color: '#3b82f6' });
    }
    if (time >= 8.5 && time < 9.5) {
      msgs.push({ text: '> YELLOW ↔ WHITE', fade: time >= 8.5 && time < 8.8 ? (time - 8.5) / 0.3 : 1, color: '#eab308' });
    }
    if (time >= 9.5) {
      msgs.push({ text: '> MANIFOLD COHERENCE: STABLE', fade: time >= 9.5 && time < 9.8 ? (time - 9.5) / 0.3 : 1 });
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
              color: msg.color || '#00ff41'
            }}
          >
            {msg.text}
          </div>
        ))}
      </div>
      
      {showFinal && (
        <div className="intro-final-card" style={{ opacity: finalFade }}>
          <div className="intro-title-box">
            <h1>WORM³</h1>
            <p>Non-Orientable Topology Puzzle</p>
          </div>
          <div className="intro-instructions">
            <p>Click any sticker to flip</p>
            <p>Drag to rotate • Explode to explore</p>
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

const StickerPlane=React.memo(function StickerPlane({ meta, pos, rot=[0,0,0], overlay, mode }) {
  const groupRef = useRef();
  const ringRef = useRef();
  const glowRef = useRef();
  const spinT = useRef(0);
  const pulseT = useRef(0);

  const prevCurr = useRef(meta?.curr ?? 0);
  useEffect(() => {
    const curr = meta?.curr ?? 0;
    const prevVal = prevCurr.current;
    
    // Only trigger flip animation if the color actually changed to its antipodal
    if (curr !== prevVal && meta?.flips > 0 && ANTIPODAL_COLOR[prevVal] === curr) {
      spinT.current = 1;
      play('/sounds/flip.mp3');
      vibrate(16);
    }
    prevCurr.current = curr;
  }, [meta?.curr, meta?.flips]);

  useFrame((_, delta) => {
    if (spinT.current > 0 && groupRef.current) {
      const dt = Math.min(delta * 4, spinT.current);
      spinT.current -= dt;
      const p = 1 - spinT.current;
      
      let angle;
      if (p < 0.5) {
        angle = Math.sin(p * Math.PI * 2) * Math.PI;
      } else {
        const overshoot = Math.sin((p - 0.5) * Math.PI * 4) * 0.15;
        angle = Math.PI + overshoot;
      }
      
      groupRef.current.rotation.y = rot[1] + angle;
      
      const scale = 1 + Math.sin(p * Math.PI) * 0.15;
      groupRef.current.scale.set(scale, scale, 1);
      
      if (spinT.current <= 0) {
        groupRef.current.rotation.y = rot[1];
        groupRef.current.scale.set(1, 1, 1);
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
      <mesh>
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
      
      {!isSudokube && isWormhole && (
        <>
          <mesh ref={ringRef} position={[0,0,0.02]}>
            <ringGeometry args={[0.36,0.40,32]} />
            <meshBasicMaterial color="#00ffff" transparent opacity={0.85} />
          </mesh>
          <mesh ref={glowRef} position={[0,0,0.015]}>
            <circleGeometry args={[0.44,32]} />
            <meshBasicMaterial 
              color="#00ffff" 
              transparent 
              opacity={0.2}
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
  
  const mapSwipe=(faceN,dx,dy)=>{
    const {right,upScreen}=getBasis();
    const sw=new THREE.Vector3().addScaledVector(right,dx).addScaledVector(upScreen,-dy);
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
      n:normalFromEvent(event) 
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
        const m=mapSwipe(dragStart.n,dx,dy);
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

/* Main App */
export default function WORM3(){
  const [showWelcome, setShowWelcome] = useState(true);
  
  const [size,setSize]=useState(3);
  const [cubies,setCubies]=useState(()=>makeCubies(size));
  const [moves,setMoves]=useState(0);
  const [visualMode,setVisualMode]=useState('classic');
  const [flipMode,setFlipMode]=useState(true);
  const [chaosLevel,setChaosLevel]=useState(0);
  const chaosMode=chaosLevel>0;

  const [animState,setAnimState]=useState(null);
  const [pendingMove,setPendingMove]=useState(null);

  const [showTutorial, setShowTutorial] = useState(false);
  
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
              <pointLight position={[0,0,0]} intensity={0.5} color="#ffffff" distance={15} decay={2}/>
              <pointLight position={[5,5,5]} intensity={0.2} color="#00ffff" />
              <pointLight position={[-5,-5,-5]} intensity={0.2} color="#ff00ff" />
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
            />
          </Suspense>
        </Canvas>
      </div>

      <div className="ui-layer">
        <div className="flex justify-between items-start">
          <div className="bauhaus-box ui-element compact">
            <h1>WORM³</h1>
            <div className="stats-compact">
              <span>M:{moves}</span>
              <span>F:{metrics.flips}</span>
              <span style={{color:'#a855f7'}}>W:{metrics.wormholes}</span>
            </div>
          </div>
          <InstabilityTracker 
            entropy={metrics.entropy} 
            wormholes={metrics.wormholes}
            chaosLevel={chaosLevel}
          />
        </div>

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
      </div>
    </div>
  );
}