import { Object3D, Sphere } from 'three';

// The lit footprint square draws after the tile's own transparent layers.
export const FOOTPRINT_RENDER_ORDER = 2;

// A WORM tile at rest is drawn entirely by batches (the plain sticker by
// StickerInstances, a styled one, the antipodal back, the border and the footprint
// by the tile-surface batches), and every batch only needs its anchor's world
// matrix. So a resting tile mounts no scene objects at all: its anchors are these
// detached frames, plain Object3Ds whose `parent` points at the cubie's content
// group but which are in no one's `children`. three.js never walks them (no
// updateMatrixWorld, no projectObject); the batches' trackers walk up from them
// through `parent` and recompute a frame's world matrix only when it or the cubie
// moves. On a 15×15 that is 1,350 tiles × 9 objects gone from the per-frame walk.
//
// A tile mounts its real subtree (StickerPlane's JSX) only while something on it
// needs real meshes: a flip, a portal, a death, a heal, a volume style, a label.
//
// They mirror StickerPlane's own groups: `tile` its tile group (position, rotation,
// the flip's squish), `front` its inner group (artwork angle, press depth and
// shrink), `back` its antipodal-back group, and `foot` the lit footprint square.
export function createTileFrames() {
  const tile = new Object3D(), front = new Object3D(), back = new Object3D(), foot = new Object3D();
  tile.name = 'tile-frame';
  front.name = 'sticker-front';
  back.name = 'sticker-antipodal-back';
  foot.name = 'tile-footprint';
  front.parent = back.parent = foot.parent = tile;
  foot.visible = false;
  foot.renderOrder = FOOTPRINT_RENDER_ORDER;
  // Bumped by every writer of the frames (StickerPlane's tick, its layout effects,
  // poseTileFrames), so a batch can tell a still frame from a moved one without
  // comparing its transforms (frameWorldVersion).
  return { tile, front, back, foot, version: 0, sphere: new Sphere(), cullStamp: 0, inView: true };
}

/** Put the frames where StickerPlane's groups would be for a tile at rest. */
export function poseTileFrames(frames, pos, rot, angle) {
  const { tile, front, back } = frames;
  tile.position.set(pos[0], pos[1], pos[2]);
  tile.rotation.set(rot[0] ?? 0, rot[1] ?? 0, rot[2] ?? 0);
  tile.scale.set(1, 1, 1);
  front.position.set(0, 0, 0);
  front.rotation.set(0, 0, angle);
  front.scale.set(1, 1, 1);
  // Behind the sticker's 0.016 thickness, at 80% (StickerPlane's back group).
  back.position.set(0, 0, -0.018);
  back.rotation.set(0, Math.PI, -angle);
  back.scale.set(0.8, 0.8, 1);
  frames.version++;
}

// Frame world versions, far above any tracker's own count so the two never meet
// on an entry that moves between them.
let frameWorlds = 2 ** 40;

/** Whether `anchor` hangs straight off its resting tile frame (or is that frame). */
export function isRestingFrameAnchor(frames, anchor) {
  return !!frames && !!frames.tile.parent && (anchor === frames.tile || anchor.parent === frames.tile);
}

/**
 * The world version of a resting anchor for one batch entry. A resting board's
 * thousands of anchors are almost all still; the batch's tracker would compare each
 * one's transform every frame to find that out. Here the entry keeps the versions
 * it last saw, its cubie's (`hostVersion`, from the caller's tracker) and its
 * frames' own, and recomposes the anchor's world matrix only when one moved.
 */
export function frameWorldVersion(entry, frames, anchor, hostVersion) {
  if (entry.hostVersion !== hostVersion || entry.framesVersion !== frames.version) {
    const { tile } = frames;
    tile.updateMatrix();
    tile.matrixWorld.multiplyMatrices(tile.parent.matrixWorld, tile.matrix);
    frames.sphere.center.setFromMatrixPosition(tile.matrixWorld);
    frames.sphere.radius = TILE_CULL_RADIUS * tile.matrixWorld.getMaxScaleOnAxis();
    if (anchor !== tile) {
      anchor.updateMatrix();
      anchor.matrixWorld.multiplyMatrices(tile.matrixWorld, anchor.matrix);
    }
    entry.hostVersion = hostVersion;
    entry.framesVersion = frames.version;
    entry.frameWorld = ++frameWorlds;
  }
  return entry.frameWorld;
}

// The cubie's content group is the frames' parent, but a child's layout effects
// run before an ancestor's ref attaches, so on a cubie's first commit the tile
// frames wait here and the cubie adopts them from its ref callback.
export function createTileFrameHost() {
  return { parent: null, pending: new Set() };
}

export function attachTileFrame(host, frame) {
  if (!host) return () => {};
  if (host.parent) frame.parent = host.parent;
  else host.pending.add(frame);
  return () => host.pending.delete(frame);
}

export function adoptTileFrames(host, node) {
  host.parent = node;
  if (!node) return;
  for (const frame of host.pending) frame.parent = node;
  host.pending.clear();
}

// Everything a tile draws (sticker, back, border, footprint, a press or a rumble
// heave) lies within this of its centre, at any scale a cubie takes.
export const TILE_CULL_RADIUS = 0.8;
let cullStamps = 0;
/** A stamp per frustum pass, so tiles test once per pass whatever number of entries they own. */
export const nextCullStamp = () => ++cullStamps;

/** Whether a resting tile is in view, tested once per pass for all its entries. */
export function tileInView(frames, frustum, stamp) {
  if (frames.cullStamp !== stamp) {
    frames.cullStamp = stamp;
    frames.inView = frustum.intersectsSphere(frames.sphere);
  }
  return frames.inView;
}
