import { Vector3 } from 'three';

// Fit inside one sticker, with enough room to see a falling head and its tail.
export const CAUTION_OPENING_RADIUS = 0.4;
export const CAUTION_OPENING_TOP = 1.05;

export function makeCautionOpeningUniforms() {
    return {
        uCautionOpen: { value: 0 },
        uCautionMouth: { value: new Vector3() },
        uCautionNormal: { value: new Vector3(0, 1, 0) },
        uCautionDepth: { value: 0 },
    };
}

export function syncCautionOpening(uniforms, fall) {
    uniforms.uCautionOpen.value = fall ? 1 : 0;
    if (!fall) return;
    uniforms.uCautionMouth.value.copy(fall.mouth);
    uniforms.uCautionNormal.value.copy(fall.normal);
    uniforms.uCautionDepth.value = fall.depth + 0.3;
}

// Clear only the falling lane through bands, rails, styled faces and veils.
// Other branches of the Möbius highway remain intact.
export const cautionOpeningGLSL = `
uniform float uCautionOpen, uCautionDepth;
uniform vec3 uCautionMouth, uCautionNormal;
bool insideCautionOpening(vec3 point) {
    if (uCautionOpen < 0.5) return false;
    vec3 offset = point - uCautionMouth;
    float along = dot(offset, uCautionNormal);
    return along < ${CAUTION_OPENING_TOP} && along > -uCautionDepth
        && length(offset - along * uCautionNormal) < ${CAUTION_OPENING_RADIUS};
}`;
