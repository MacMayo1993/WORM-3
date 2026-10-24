import { Object3D } from 'three';
import { FOOTPRINT_RENDER_ORDER } from './tileFootprint.js';

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
  return { tile, front, back, foot };
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
