import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { getHandmadeParts } from './handmadeParts.js';
import { safeAccessories, HANDMADE_HATS } from './handmadeAccessoriesData.js';

const constructors = { sphere: THREE.SphereGeometry, box: THREE.BoxGeometry, cylinder: THREE.CylinderGeometry,
  cone: THREE.ConeGeometry, torus: THREE.TorusGeometry };

// Merge decorative stitches/beads by material: bounded draw calls, no new textures.
export function buildCraftModel(id) {
  const group = new THREE.Group(), batches = new Map(), dummy = new THREE.Object3D();
  for (const part of getHandmadeParts(id)) {
    const geometry = new constructors[part.geo[0]](...part.geo[1]);
    dummy.position.fromArray(part.pos); dummy.rotation.set(...(part.rot || [0,0,0]));
    dummy.scale.fromArray(part.scale || [1,1,1]); dummy.updateMatrix();
    geometry.applyMatrix4(dummy.matrix);
    const key = part.role || part.mat.color;
    if (!batches.has(key)) batches.set(key, { parts: [], mat: part.mat, role: part.role });
    batches.get(key).parts.push(geometry);
  }
  for (const batch of batches.values()) {
    const geo = mergeGeometries(batch.parts);
    batch.parts.forEach(g => g.dispose());
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial(batch.mat));
    mesh.userData.role = batch.role;
    mesh.raycast = () => null;
    group.add(mesh);
  }
  return group;
}
export function createAccessoryRig(equipment) {
  const root = new THREE.Group(); root.name = 'worm-accessories';
  const entries = [];
  for (const [slot,id] of Object.entries(safeAccessories(equipment))) {
    if (id==='none') continue;
    const repeats = ['friendshipBeads','quiltPatches','buttonTrail'].includes(id) ? 3 : 1;
    for(let i=0;i<repeats;i++) {
      const group = new THREE.Group(), model = buildCraftModel(id);
      group.name = `accessory-${id}-${i}`; group.visible = false; group.add(model); root.add(group);
      entries.push({id,slot,index:1+i*2,group,model});
    }
  }
  return { root, entries, tail: new THREE.Object3D(), tailValid: false, tailCenter: new THREE.Vector3(),
    tailForward: new THREE.Vector3(), tailNormal: new THREE.Vector3(), tailRadius: 0,
    hasTail: entries.some(e => e.slot === 'tail'),
    dispose() { root.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); }); root.clear(); } };
}
const x = new THREE.Vector3(), y = new THREE.Vector3(), z = new THREE.Vector3(), basis = new THREE.Matrix4();
export function poseAccessoryFrame(group, center, forward, normal, radius) {
  z.copy(forward).negate();
  if(z.lengthSq()<1e-9) z.set(0,0,1);
  z.normalize(); y.copy(normal).addScaledVector(z,-normal.dot(z));
  if(y.lengthSq()<1e-9) { y.set(Math.abs(z.y)<.9?0:1, Math.abs(z.y)<.9?1:0,0); y.addScaledVector(z,-y.dot(z)); }
  y.normalize(); x.crossVectors(y,z).normalize(); basis.makeBasis(x,y,z);
  group.position.copy(center); group.quaternion.setFromRotationMatrix(basis); group.scale.setScalar(radius);
}
function detail(entry,time,transit,paint,palette) {
  const {model,id} = entry;
  // Small secondary motion only. Time is frozen by callers for pause/reduced motion.
  model.rotation.set(0,0,0);
  if(id==='ribbonTail') model.rotation.z = Math.sin(time*4)*.08;
  if(id==='seedSatchel') model.rotation.z = Math.sin(time*3)*.035;
  model.scale.setScalar(transit ? .76 : 1);
  for(const child of model.children) {
    const role=child.userData.role;
    if(role==='paint' && paint!=null) child.material.color.set(paint);
    if(role?.startsWith('bead') && palette) child.material.color.set(palette[role==='bead0'?1:6] ?? '#e6bb67');
  }
}
export function poseHeadAccessories(rig, center, forward, normal, radius, time=0, transit=false, character='classic') {
  for(const entry of rig.entries) if(entry.slot==='face'||entry.slot==='neck') {
    poseAccessoryFrame(entry.group,center,forward,normal,radius);
    entry.group.visible=true; detail(entry,time,transit);
    entry.model.position.set(0,0,0);
    if(character==='mobi' && entry.slot==='face') {
      entry.model.rotation.x=-.665; entry.model.position.set(0,.35,.10);
    }
  }
}
export function beginAccessoryBody(rig) {
  rig.tailValid=false;
  for(const e of rig.entries) if(e.slot==='body'||e.slot==='tail') e.group.visible=false;
}
export function poseBodyAccessories(rig,index,center,forward,normal,radius,time,transit,paint,palette) {
  if(!rig.entries.length) return;
  if(rig.hasTail) {
    rig.tailCenter.copy(center);rig.tailForward.copy(forward);rig.tailNormal.copy(normal);
    rig.tailRadius=radius;rig.tailValid=true;rig.tailTransit=transit;
  }
  for(const e of rig.entries) if(e.slot==='body' && e.index===index) {
    poseAccessoryFrame(e.group,center,forward,normal,radius);
    e.group.visible=true; detail(e,time,transit,paint,palette);
  }
}
export function finishAccessoryBody(rig,time,_transit,paint,palette) {
  for(const e of rig.entries) if(e.slot==='tail') {
    e.group.visible=rig.tailValid;
    if(!rig.tailValid) continue;
    poseAccessoryFrame(e.group,rig.tailCenter,rig.tailForward,rig.tailNormal,rig.tailRadius);
    detail(e,time,rig.tailTransit,paint,palette);
  }
}

export function poseHandmadeHat(group,id,forward,normal,time=0,transit=false) {
  group.scale.setScalar(1);
  if(!HANDMADE_HATS.some(item => item.id===id)) return;
  poseAccessoryFrame(group,group.position,forward,normal,transit ? .78 : 1);
  group.rotateZ(Math.sin(time*2.5)*(id==='sprout'?.065:.018));
}
