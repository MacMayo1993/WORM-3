import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { getHandmadeParts, CRAFT } from './handmadeParts.js';
import { safeAccessories, HANDMADE_HATS } from './handmadeAccessoriesData.js';

const constructors = { sphere: THREE.SphereGeometry, box: THREE.BoxGeometry, cylinder: THREE.CylinderGeometry,
  cone: THREE.ConeGeometry, torus: THREE.TorusGeometry };

// Ink outline: every piece is wrapped in a dark hull (the back faces of a copy
// pushed out along its smoothed normals), the way a sticker or a cartoon cel is
// edged. It is what keeps a cream hat, a pink bow or a green leaf legible on a
// worm of any colour in front of any scene, at thumbnail size. Thickness is in
// bead radii, so it scales with the piece. Parts too small to carry a line
// (stitches, spots, crimps) and clear glass are left out of the hull.
export const CRAFT_OUTLINE_THICKNESS = 0.065;
const OUTLINE_MIN_EXTENT = 0.13;

function outlineHull(geometries, thickness) {
  const hulls = [];
  for (const source of geometries) {
    const bare = source.clone();
    bare.deleteAttribute('normal');
    bare.deleteAttribute('uv');
    // Weld coincident vertices so box corners and cylinder seams share one
    // normal; otherwise the hull would split open along every hard edge.
    const hull = mergeVertices(bare, 1e-4);
    bare.dispose();
    hull.computeVertexNormals();
    const position = hull.attributes.position, normal = hull.attributes.normal;
    for (let i = 0; i < position.count; i++) {
      position.setXYZ(i, position.getX(i) + normal.getX(i) * thickness,
        position.getY(i) + normal.getY(i) * thickness, position.getZ(i) + normal.getZ(i) * thickness);
    }
    hulls.push(hull);
  }
  const merged = mergeGeometries(hulls);
  hulls.forEach(g => g.dispose());
  return merged;
}

const _box = new THREE.Box3(), _size = new THREE.Vector3();
function wantsOutline(part, geometry) {
  if (part.mat.transparent || part.noOutline) return false;
  geometry.computeBoundingBox();
  _box.copy(geometry.boundingBox).getSize(_size);
  return Math.max(_size.x, _size.y, _size.z) >= OUTLINE_MIN_EXTENT * 2;
}

// Merge decorative stitches/beads by colour and finish: bounded draw calls, no new textures.
// Parts that move on their own (a pinwheel's blades, a key, orbiting fireflies)
// sit in their own pivot group; each group is at most a handful of meshes
// plus one outline hull. `model.userData` lists everything animateCraftModel
// touches, so posing never walks the scene graph.
export function buildCraftModel(id) {
  const model = new THREE.Group();
  const parts = getHandmadeParts(id), rigDefs = parts.rigs || {};
  const dummy = new THREE.Object3D();
  const motions = [], paints = [], beads = [], flies = [];
  const buckets = new Map();
  for (const part of parts) {
    const geometry = new constructors[part.geo[0]](...part.geo[1]);
    dummy.position.fromArray(part.pos); dummy.rotation.set(...(part.rot || [0,0,0]));
    dummy.scale.fromArray(part.scale || [1,1,1]); dummy.updateMatrix();
    geometry.applyMatrix4(dummy.matrix);
    const name = part.rig || '';
    if (name) { const [px, py, pz] = rigDefs[name].pivot; geometry.translate(-px, -py, -pz); }
    if (!buckets.has(name)) buckets.set(name, { entries: [] });
    buckets.get(name).entries.push({ part, geometry });
  }
  for (const [name, bucket] of buckets) {
    let holder = model;
    if (name) {
      holder = new THREE.Group(); holder.name = `rig-${name}`;
      holder.position.fromArray(rigDefs[name].pivot);
      model.add(holder);
      motions.push({ object: holder, motion: rigDefs[name] });
    }
    const batches = new Map(), outlined = [];
    for (const { part, geometry } of bucket.entries) {
      const key = part.role || `${part.mat.color}|${part.mat.roughness}|${part.mat.metalness}|${part.mat.opacity ?? 1}`;
      if (!batches.has(key)) batches.set(key, { geometries: [], mat: part.mat, role: part.role });
      batches.get(key).geometries.push(geometry);
      if (wantsOutline(part, geometry)) outlined.push(geometry);
    }
    if (outlined.length) {
      const hull = new THREE.Mesh(outlineHull(outlined, CRAFT_OUTLINE_THICKNESS),
        new THREE.MeshBasicMaterial({ color: CRAFT.ink, side: THREE.BackSide }));
      hull.userData.role = 'outline';
      hull.raycast = () => null;
      holder.add(hull);
    }
    for (const batch of batches.values()) {
      const geo = mergeGeometries(batch.geometries);
      batch.geometries.forEach(g => g.dispose());
      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial(batch.mat));
      mesh.userData.role = batch.role;
      mesh.raycast = () => null;
      holder.add(mesh);
      const role = batch.role;
      if (role === 'paint') paints.push(mesh);
      else if (role?.startsWith('bead')) beads.push({ mesh, slot: role === 'bead0' ? 1 : 6 });
      else if (role?.startsWith('firefly')) flies.push({ mesh, phase: role === 'firefly0' ? 0 : 2.1 });
    }
  }
  Object.assign(model.userData, { motions, paints, beads, flies });
  return model;
}

export function disposeCraftModel(model) {
  model.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); });
  model.clear();
}

// Spin and sway about each rig's pivot, plus firefly flicker. `time` comes
// from callers that already freeze it for pause and reduced motion, so a
// frozen clock leaves every piece at rest.
export function animateCraftModel(model, time) {
  const data = model.userData;
  if (!data.motions) return;
  for (const { object, motion } of data.motions) {
    const swing = Math.sin(time * (motion.freq ?? 3) + (motion.phase ?? 0));
    const spin = motion.spin, sway = motion.sway;
    object.rotation.set(
      (spin ? spin[0] * time : 0) + (sway ? sway[0] * swing : 0),
      (spin ? spin[1] * time : 0) + (sway ? sway[1] * swing : 0),
      (spin ? spin[2] * time : 0) + (sway ? sway[2] * swing : 0));
  }
  for (const { mesh, phase } of data.flies) mesh.material.emissiveIntensity = 1.15 + 0.85 * Math.sin(time * 4.2 + phase);
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
  const {model} = entry, data = model.userData;
  // Time is frozen by callers for pause/reduced motion.
  model.rotation.set(0,0,0);
  animateCraftModel(model, time);
  model.scale.setScalar(transit ? .76 : 1);
  if(paint!=null) for(const mesh of data.paints) mesh.material.color.set(paint);
  if(palette) for(const {mesh,slot} of data.beads) mesh.material.color.set(palette[slot] ?? '#e6bb67');
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
  const craft = group.children.find(child => child.userData.motions);
  if(craft) animateCraftModel(craft,time);
}
