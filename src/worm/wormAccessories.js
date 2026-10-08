import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { getHandmadeParts, CRAFT } from './handmadeParts.js';
import { createArchGeometry } from './craftGeometry.js';
import { safeAccessories, HANDMADE_HATS } from './handmadeAccessoriesData.js';
import { uploadInstancePrefix } from '../3d/instanceUploads.js';

const constructors = { sphere: THREE.SphereGeometry, box: THREE.BoxGeometry, cylinder: THREE.CylinderGeometry,
  cone: THREE.ConeGeometry, torus: THREE.TorusGeometry };
const makeGeometry = (name, args) => (name === 'arch' ? createArchGeometry(...args) : new constructors[name](...args));

// Ink outline: every piece is wrapped in a dark hull (the back faces of a copy
// pushed out along its smoothed normals), the way a sticker or a cartoon cel is
// edged. It is what keeps a cream hat, a pink bow or a green leaf legible on a
// worm of any colour in front of any scene, at thumbnail size. Thickness is in
// bead radii, so it scales with the piece. Parts too small to carry a line
// (stitches, spots, crimps) and clear glass are left out of the hull.
export const CRAFT_OUTLINE_THICKNESS = 0.065;
const OUTLINE_MIN_EXTENT = 0.13;
// One material for every hull: it has no per-piece state, so sharing it keeps
// the program count flat and nothing has to dispose it per model.
const HULL_MATERIAL = new THREE.MeshBasicMaterial({ color: CRAFT.ink, side: THREE.BackSide });

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

// ─── Templates ────────────────────────────────────────────────────────────────
// A piece's geometry is built once per id and shared by every instance of it:
// the selector draws the same dozen pieces over and over (one shared preview
// rig, rebuilt for every thumbnail), and welding an outline hull per draw is
// far too much work for that. Only materials are per instance, because paint,
// bead colours and firefly flicker are written into them each frame.
// The cache is bounded by the catalogue (26 pieces), so it is never evicted.
const templates = new Map();
const _dummy = new THREE.Object3D();

function buildTemplate(id) {
  const parts = getHandmadeParts(id);
  const rigDefs = parts.rigs || {};
  const buckets = new Map(), hullBuckets = new Map();
  for (const part of parts) {
    const geometry = makeGeometry(part.geo[0], part.geo[1]);
    _dummy.position.fromArray(part.pos); _dummy.rotation.set(...(part.rot || [0,0,0]));
    _dummy.scale.fromArray(part.scale || [1,1,1]); _dummy.updateMatrix();
    geometry.applyMatrix4(_dummy.matrix);
    const rig = part.rig || '', sel = part.sel || 'all';
    if (rig) { const [px, py, pz] = rigDefs[rig].pivot; geometry.translate(-px, -py, -pz); }
    const key = `${rig}|${sel}`;
    if (!buckets.has(key)) buckets.set(key, { rig, sel, entries: [] });
    buckets.get(key).entries.push({ part, geometry });
    // A part's hull rides with the part, unless the model says another selector's
    // hull stands for it (colour variants of one piece share a single hull).
    if (wantsOutline(part, geometry)) {
      const hullSel = part.hullSel || sel, hullKey = `${rig}|${hullSel}`;
      if (!hullBuckets.has(hullKey)) hullBuckets.set(hullKey, { rig, sel: hullSel, geometries: [] });
      hullBuckets.get(hullKey).geometries.push(geometry);
    }
  }
  const groups = [];
  for (const bucket of buckets.values()) {
    const batches = new Map();
    for (const { part, geometry } of bucket.entries) {
      const key = part.role || `${part.mat.color}|${part.mat.roughness}|${part.mat.metalness}|${part.mat.opacity ?? 1}`;
      if (!batches.has(key)) batches.set(key, { geometries: [], mat: part.mat, role: part.role });
      batches.get(key).geometries.push(geometry);
    }
    const merged = [];
    for (const batch of batches.values()) {
      const geometry = batch.geometries.length === 1 ? batch.geometries[0].clone() : mergeGeometries(batch.geometries);
      merged.push({ geometry, mat: batch.mat, role: batch.role });
    }
    groups.push({ rig: bucket.rig, sel: bucket.sel, hull: null, batches: merged });
  }
  // Hulls are built after the batches so a hull may belong to a different group.
  const groupFor = (rig, sel) => groups.find(g => g.rig === rig && g.sel === sel)
    ?? groups[groups.push({ rig, sel, hull: null, batches: [] }) - 1];
  for (const bucket of hullBuckets.values()) {
    groupFor(bucket.rig, bucket.sel).hull = outlineHull(bucket.geometries, CRAFT_OUTLINE_THICKNESS);
  }
  for (const bucket of buckets.values()) bucket.entries.forEach(({ geometry }) => geometry.dispose());
  return { rigDefs, cover: parts.cover || null, groups };
}

function getTemplate(id) {
  let template = templates.get(id);
  if (!template) { template = buildTemplate(id); templates.set(id, template); }
  return template;
}

export const isCoverPiece = id => !!getTemplate(id).cover;

// ─── Single pieces ────────────────────────────────────────────────────────────
// Parts that move on their own (a pinwheel's blades, a key, orbiting fireflies)
// sit in their own pivot group; each group is at most a handful of meshes
// plus one outline hull. `model.userData` lists everything animateCraftModel
// touches, so posing never walks the scene graph.
function instantiate(template) {
  const model = new THREE.Group();
  const motions = [], paints = [], beads = [], flies = [];
  const holders = new Map();
  for (const group of template.groups) {
    let holder = model;
    if (group.rig) {
      holder = holders.get(group.rig);
      if (!holder) {
        const def = template.rigDefs[group.rig];
        holder = new THREE.Group(); holder.name = `rig-${group.rig}`;
        holder.position.fromArray(def.pivot);
        model.add(holder); holders.set(group.rig, holder);
        motions.push({ object: holder, motion: def });
      }
    }
    if (group.hull) {
      const hull = new THREE.Mesh(group.hull, HULL_MATERIAL);
      hull.userData.role = 'outline';
      hull.raycast = () => null;
      holder.add(hull);
    }
    for (const batch of group.batches) {
      const mesh = new THREE.Mesh(batch.geometry, new THREE.MeshStandardMaterial(batch.mat));
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

// ─── Covers ───────────────────────────────────────────────────────────────────
// A cape, a quilt or a trail of buttons runs the length of the body, so it is
// drawn as the piece that wraps ONE segment and laid once per segment every
// frame: it grows with the worm and is still a handful of draws however long
// the worm gets. Each part of the piece is one InstancedMesh (plus its ink
// hull); the pieces differ only by which instances carry a part ('first',
// 'last', or every n-th from c — the quilt's four colours, the buttons).
export const COVER_CAPACITY = 560;   // drawn segments are LOD-thinned to ~550 at MAX_TAIL
const SEG_STRIDE = 15;               // px py pz | x y z | y y y | z z z | radius | transit | gap

function parseSelector(sel) {
  if (sel === 'first' || sel === 'last' || sel === 'all') return { kind: sel, n: 1, c: 0 };
  const [n, c] = sel.split(':').map(Number);
  return { kind: 'cycle', n, c };
}
const selects = (m, k, count) => m.kind === 'all' || (m.kind === 'cycle' ? k % m.n === m.c : m.kind === 'first' ? k === 0 : k === count - 1);

function createCoverStrip(id, capacity = COVER_CAPACITY) {
  const template = getTemplate(id);
  const group = new THREE.Group();
  group.name = `cover-${id}`;
  const meshes = [];
  const add = (geometry, material, sel, role) => {
    const selector = parseSelector(sel);
    const cap = selector.kind === 'all' ? capacity : selector.kind === 'cycle' ? Math.ceil(capacity / selector.n) + 1 : 1;
    const mesh = new THREE.InstancedMesh(geometry, material, cap);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.count = 0; mesh.visible = false;
    mesh.frustumCulled = false;      // instances span the whole body; the geometry's own bounds say nothing
    mesh.raycast = () => null;
    mesh.userData.role = role;
    group.add(mesh);
    meshes.push({ mesh, ...selector, count: 0 });
  };
  for (const g of template.groups) {
    if (g.hull) add(g.hull, HULL_MATERIAL, g.sel, 'outline');
    for (const batch of g.batches) add(batch.geometry, new THREE.MeshStandardMaterial(batch.mat), g.sel, batch.role);
  }
  group.visible = false;
  return { id, meta: template.cover, group, meshes, capacity };
}

function disposeCoverStrip(strip) {
  for (const { mesh } of strip.meshes) {
    if (mesh.material !== HULL_MATERIAL) mesh.material.dispose();
    mesh.dispose();                  // frees the instance buffer; the geometry is a shared template
  }
  strip.group.clear();
}

const _smooth = u => u * u * (3 - 2 * u);
// Lay one piece per recorded body segment, with the strip's own taper and ripple.
function finishCover(strip, rig, time) {
  const { meta, meshes } = strip;
  // `total` is every segment the worm posed; `count` is how many the cover draws
  // (a preview stops short of the frame's edge). The taper belongs to the worm's
  // real tail, so a truncated run keeps its full width.
  const segs = rig.segs, count = rig.segCount, total = Math.max(rig.segTotal, count);
  for (const m of meshes) m.count = 0;
  for (let k = 0; k < count; k++) {
    const o = k * SEG_STRIDE;
    const radius = segs[o + 12];
    const ts = segs[o + 13] ? 0.76 : 1;
    // Narrow towards the tail so the garment ends in a point, not a square.
    let girth = 1;
    if (meta.taper) girth = meta.taper.min + (1 - meta.taper.min) * _smooth(Math.min(1, (total - 1 - k) / meta.taper.tail));
    // Stretch over the gap when LOD (or MOBI's blocks) spaces segments wider than the piece was drawn for.
    const gap = segs[o + 14];
    const length = meta.stretch !== false && k > 0 && gap > 0 ? Math.min(8, Math.max(0.9, gap / (radius * meta.gap))) : 1;
    const pitch = meta.ripple ? Math.sin(time * meta.ripple.freq - k * meta.ripple.wave) * meta.ripple.pitch : 0;
    const c = Math.cos(pitch), s = Math.sin(pitch);
    const sx = radius * girth * ts, sy = sx, sz = radius * length * ts;
    const xx = segs[o + 3], xy = segs[o + 4], xz = segs[o + 5];
    const yx = segs[o + 6], yy = segs[o + 7], yz = segs[o + 8];
    const zx = segs[o + 9], zy = segs[o + 10], zz = segs[o + 11];
    for (const m of meshes) {
      if (!selects(m, k, total)) continue;
      const a = m.mesh.instanceMatrix.array, i = m.count++ * 16;
      a[i] = xx * sx; a[i + 1] = xy * sx; a[i + 2] = xz * sx; a[i + 3] = 0;
      a[i + 4] = (yx * c + zx * s) * sy; a[i + 5] = (yy * c + zy * s) * sy; a[i + 6] = (yz * c + zz * s) * sy; a[i + 7] = 0;
      a[i + 8] = (zx * c - yx * s) * sz; a[i + 9] = (zy * c - yy * s) * sz; a[i + 10] = (zz * c - yz * s) * sz; a[i + 11] = 0;
      a[i + 12] = segs[o]; a[i + 13] = segs[o + 1]; a[i + 14] = segs[o + 2]; a[i + 15] = 1;
    }
  }
  for (const m of meshes) {
    m.mesh.count = m.count;
    m.mesh.visible = m.count > 0;
    uploadInstancePrefix(m.mesh.instanceMatrix, m.count);
  }
  strip.group.visible = count > 0;
}

// A static run of pieces for callers that want to see a cover without a worm
// (tests, and anything that asks buildCraftModel for one).
const _showcaseUp = new THREE.Vector3(0, 1, 0), _showcaseForward = new THREE.Vector3(0, 0, -1), _showcaseAt = new THREE.Vector3();
function coverShowcase(id, pieces = 4) {
  const strip = createCoverStrip(id, pieces + 1);
  const rig = { segs: new Float32Array(pieces * SEG_STRIDE), segCount: 0, segTotal: 0 };
  for (let k = 0; k < pieces; k++) {
    _showcaseAt.set(0, 0, k * 0.86);
    recordSegment(rig, _showcaseAt, _showcaseForward, _showcaseUp, 1, false);
  }
  rig.segTotal = rig.segCount;
  finishCover(strip, rig, 0);
  strip.group.userData.motions = [];
  strip.group.userData.strip = strip;
  return strip.group;
}

export function buildCraftModel(id) {
  const template = getTemplate(id);
  return template.cover ? coverShowcase(id) : instantiate(template);
}

export function disposeCraftModel(model) {
  if (model.userData.strip) { disposeCoverStrip(model.userData.strip); return; }
  model.traverse(o => { if (o.material && o.material !== HULL_MATERIAL) o.material.dispose(); });
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

// ─── The rig ──────────────────────────────────────────────────────────────────
// Where a body piece rides, by segment index. Backpacks sit on the shoulders, a
// bead behind the one that touches the head (there they read as a hat); strings
// of beads keep their neck-to-tail spacing. A worm too short to reach a piece's
// segment wears it on its last one (see finishAccessoryBody).
const BODY_INDEX = { spoolBackpack: 2, matchboxBackpack: 2, fireflyJar: 2, seedSatchel: 2 };
const REPEATED = ['friendshipBeads'];

export function createAccessoryRig(equipment, coverCapacity = COVER_CAPACITY) {
  const root = new THREE.Group(); root.name = 'worm-accessories';
  const entries = [], bodyAt = new Map();
  let strip = null;
  for (const [slot,id] of Object.entries(safeAccessories(equipment))) {
    if (id==='none') continue;
    if (slot === 'body' && isCoverPiece(id)) {
      strip = createCoverStrip(id, coverCapacity);
      root.add(strip.group);
      entries.push({ id, slot, index: -1, group: strip.group, model: strip.group, strip });
      continue;
    }
    const repeats = REPEATED.includes(id) ? 3 : 1;
    for(let i=0;i<repeats;i++) {
      const group = new THREE.Group(), model = buildCraftModel(id);
      group.name = `accessory-${id}-${i}`; group.visible = false; group.add(model); root.add(group);
      const entry = { id, slot, index: (BODY_INDEX[id] ?? 1) + i * 2, group, model, single: slot === 'body' && repeats === 1 };
      entries.push(entry);
      if (slot === 'body') { if (!bodyAt.has(entry.index)) bodyAt.set(entry.index, []); bodyAt.get(entry.index).push(entry); }
    }
  }
  const fallbackMax = entries.reduce((m, e) => (e.single ? Math.max(m, e.index) : m), -1);
  return { root, entries, bodyAt, strip, fallbackMax, lastIndex: -1, lastCenter: new THREE.Vector3(), lastForward: new THREE.Vector3(), lastNormal: new THREE.Vector3(), lastRadius: 0, lastTransit: false, segs: strip ? new Float32Array(strip.capacity * SEG_STRIDE) : null, segCount: 0, segTotal: 0, coverLimit: Infinity,
    tail: new THREE.Object3D(), tailValid: false, tailCenter: new THREE.Vector3(),
    tailForward: new THREE.Vector3(), tailNormal: new THREE.Vector3(), tailRadius: 0,
    hasTail: entries.some(e => e.slot === 'tail'),
    dispose() {
      for (const e of entries) {
        if (e.strip) disposeCoverStrip(e.strip);
        else disposeCraftModel(e.model);
      }
      root.clear();
    } };
}
const x = new THREE.Vector3(), y = new THREE.Vector3(), z = new THREE.Vector3(), basis = new THREE.Matrix4();
// The accessory frame: +Z back along the path, +Y out of the surface, +X across.
function frameBasis(forward, normal) {
  z.copy(forward).negate();
  if(z.lengthSq()<1e-9) z.set(0,0,1);
  z.normalize(); y.copy(normal).addScaledVector(z,-normal.dot(z));
  if(y.lengthSq()<1e-9) { y.set(Math.abs(z.y)<.9?0:1, Math.abs(z.y)<.9?1:0,0); y.addScaledVector(z,-y.dot(z)); }
  y.normalize(); x.crossVectors(y,z).normalize();
}
export function poseAccessoryFrame(group, center, forward, normal, radius) {
  frameBasis(forward, normal);
  basis.makeBasis(x,y,z);
  group.position.copy(center); group.quaternion.setFromRotationMatrix(basis); group.scale.setScalar(radius);
}
function recordSegment(rig, center, forward, normal, radius, transit) {
  const o = rig.segCount * SEG_STRIDE, segs = rig.segs;
  frameBasis(forward, normal);
  // Distance to the segment before, so a thinned or MOBI-spaced run still tiles.
  const gap = rig.segCount > 0
    ? Math.hypot(center.x - segs[o - SEG_STRIDE], center.y - segs[o - SEG_STRIDE + 1], center.z - segs[o - SEG_STRIDE + 2]) : 0;
  segs[o] = center.x; segs[o + 1] = center.y; segs[o + 2] = center.z;
  segs[o + 3] = x.x; segs[o + 4] = x.y; segs[o + 5] = x.z;
  segs[o + 6] = y.x; segs[o + 7] = y.y; segs[o + 8] = y.z;
  segs[o + 9] = z.x; segs[o + 10] = z.y; segs[o + 11] = z.z;
  segs[o + 12] = radius; segs[o + 13] = transit ? 1 : 0; segs[o + 14] = gap;
  rig.segCount++;
}
function detail(entry,time,transit,paint,palette) {
  const {model} = entry, data = model.userData;
  // Time is frozen by callers for pause/reduced motion.
  model.rotation.set(0,0,0);
  animateCraftModel(model, time);
  model.scale.setScalar(transit ? .76 : 1);
  // Colours only change when the worm's colour does, so parse them once, not every frame.
  if(paint!=null) for(const mesh of data.paints) if(mesh.userData.paint!==paint) { mesh.userData.paint=paint; mesh.material.color.set(paint); }
  if(palette) for(const {mesh,slot} of data.beads) { const c=palette[slot] ?? '#e6bb67'; if(mesh.userData.paint!==c) { mesh.userData.paint=c; mesh.material.color.set(c); } }
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
  rig.segCount=0;
  rig.segTotal=0;
  rig.lastIndex=-1;
  for(const e of rig.entries) if(e.slot==='body'||e.slot==='tail') e.group.visible=false;
}
export function poseBodyAccessories(rig,index,center,forward,normal,radius,time,transit,paint,palette) {
  if(!rig.entries.length) return;
  if(rig.hasTail) {
    rig.tailCenter.copy(center);rig.tailForward.copy(forward);rig.tailNormal.copy(normal);
    rig.tailRadius=radius;rig.tailValid=true;rig.tailTransit=transit;
  }
  if(rig.strip) {
    rig.segTotal++;
    if(rig.segCount < Math.min(rig.strip.capacity, rig.coverLimit)) recordSegment(rig,center,forward,normal,radius,transit);
  }
  // Remember the nearest segments, for a worm too short to reach a piece's own.
  if(index <= rig.fallbackMax) {
    rig.lastIndex=index;rig.lastCenter.copy(center);rig.lastForward.copy(forward);rig.lastNormal.copy(normal);
    rig.lastRadius=radius;rig.lastTransit=transit;
  }
  const here = rig.bodyAt.get(index);
  if(here) for(const e of here) {
    poseAccessoryFrame(e.group,center,forward,normal,radius);
    e.group.visible=true; detail(e,time,transit,paint,palette);
  }
}
export function finishAccessoryBody(rig,time,_transit,paint,palette) {
  if(rig.strip) finishCover(rig.strip,rig,time);
  if(rig.lastIndex>=0) for(const e of rig.entries) if(e.single && !e.group.visible && e.index>rig.lastIndex) {
    poseAccessoryFrame(e.group,rig.lastCenter,rig.lastForward,rig.lastNormal,rig.lastRadius);
    e.group.visible=true; detail(e,time,rig.lastTransit,paint,palette);
  }
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
