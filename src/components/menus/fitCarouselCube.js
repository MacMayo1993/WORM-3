import { Vector3 } from 'three';

const point = new Vector3();
const viewPoint = new Vector3();
const result = { x: 0, y: 1.2, scale: 0.8, turnPullback: 0 };
const SIDE_RESERVE = 40;
// Envelope in cube units. 4.8 holds any tumble, including corner-on. A portrait
// phone stage is width-bound, and there the carousel only ever parks a face
// toward the player and turns between faces, so it is fitted to those poses
// (fitCarouselCube.test.js walks every face-to-face turn): the cube fills the
// blank band the tumble allowance used to leave above and below it. A turn
// between faces swings an edge or corner wider than a parked face, so the cube
// eases back by up to TURN_PULLBACK while it is between faces. The shrink is a
// function of the pose itself, not of a separate scale easing, so it can never
// lag the rotation: see carouselTurnScale.
const TUMBLE_ENVELOPE = 4.8;
const PRESENTED_ENVELOPE = 4.0;
const PHONE_STAGE_MAX_WIDTH = 600;
const TURN_PULLBACK = 0.18;

/**
 * Scale factor for a cube `angleFromFace` radians from the nearest parked face
 * pose. 1 when parked (at both ends of every turn, so there is no pop), full
 * pullback from 45° on, where the silhouette is widest.
 */
export function carouselTurnScale(angleFromFace, pullback) {
  return 1 - pullback * Math.sin(Math.min(Math.max(angleFromFace, 0) * 2, Math.PI / 2));
}

// Project the DOM stage's center onto the menu cube's z=0 plane. Unlike a fixed
// portrait offset, this also works when a short screen scrolls or turns sideways.
// The envelope (see above) leaves room for the changing silhouette and bob.
export function fitCarouselCube(camera, viewport, stage) {
  if (!stage?.width || !stage?.height || !viewport.width || !viewport.height) return result;
  const centerX = stage.left + stage.width / 2;
  const centerY = stage.top + stage.height / 2 - 6;
  point.set(centerX / viewport.width * 2 - 1, 1 - centerY / viewport.height * 2, 0.5).unproject(camera);
  point.sub(camera.position);
  point.multiplyScalar(-camera.position.z / point.z).add(camera.position);
  viewPoint.copy(point).applyMatrix4(camera.matrixWorldInverse);
  const distance = -viewPoint.z;
  const pixelsPerUnit = camera.projectionMatrix.elements[5] * viewport.height / (2 * distance);
  // The side arrows sit over the stage edges; the cube may pass under their
  // outer half, so only 20px per side is held back for them.
  // (On portrait phones they sit beside the face dots instead; the same margin
  // then keeps the widest mid-turn silhouette on screen.)
  const available = Math.max(80, Math.min(stage.width - SIDE_RESERVE, stage.height - 42));
  result.x = point.x;
  result.y = point.y;
  const portraitPhone = stage.width <= PHONE_STAGE_MAX_WIDTH && stage.height > stage.width;
  const envelope = portraitPhone ? PRESENTED_ENVELOPE : TUMBLE_ENVELOPE;
  result.scale = available / (envelope * pixelsPerUnit + available * 2 / distance);
  result.turnPullback = portraitPhone ? TURN_PULLBACK : 0;
  return result;
}
