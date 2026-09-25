// How far the puzzle camera may zoom out, per cube size. Shared by the orbit
// controls and anything that must stay beyond the camera (the background
// ambience places its cubes and wormholes past this so they can never drift
// between the camera and the puzzle).
export const MAX_DISTANCE_BY_SIZE = { 2: 28, 3: 28, 4: 38, 5: 52, 6: 68, 7: 85, 8: 98, 9: 110, 10: 123, 15: 175 };

export function maxCameraDistance(size) {
  return MAX_DISTANCE_BY_SIZE[size] ?? 28;
}
