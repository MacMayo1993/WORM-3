export const FOLLOW_WORM = 'follow';
export const STEADY_FOLLOW_WORM = 'steady';
export const STATIONARY_WORM_CAMERA = 'stationary';

export const normalizeWormCameraMode = value =>
  value === STATIONARY_WORM_CAMERA || value === STEADY_FOLLOW_WORM ? value : FOLLOW_WORM;

export const hasStationaryWormCamera = settings => settings?.wormCameraMode === STATIONARY_WORM_CAMERA;
export const hasSteadyWormCamera = settings => settings?.wormCameraMode === STEADY_FOLLOW_WORM;
export const usesWormRideCamera = settings => normalizeWormCameraMode(settings?.wormCameraMode) === FOLLOW_WORM;
