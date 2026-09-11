import { Matrix4, Quaternion, Vector3 } from 'three';

// Continuous-time damping: the same elapsed time gives the same response at
// 30, 60 or 144 Hz, without snapping to the target after a slow frame.
export const dampingAlpha = (rate, delta) => -Math.expm1(-rate * Math.max(0, delta));

const basis = new Matrix4();
const right = new Vector3();
const up = new Vector3();
const forward = new Vector3();
const from = new Quaternion();
const to = new Quaternion();

function surfaceQuaternion(out, normal, heading) {
    up.copy(normal).normalize();
    forward.copy(heading).addScaledVector(up, -heading.dot(up));
    // A boundary step can include a component through the old face. Project
    // onto the new surface before constructing a rigid camera frame.
    if (forward.lengthSq() < 1e-8) {
        forward.set(Math.abs(up.x) < 0.9 ? 1 : 0, Math.abs(up.x) < 0.9 ? 0 : 1, 0);
        forward.addScaledVector(up, -forward.dot(up));
    }
    forward.normalize();
    right.crossVectors(up, forward).normalize();
    basis.makeBasis(right, up, forward);
    return out.setFromRotationMatrix(basis);
}

// Rotate heading and normal as one frame. Independent vector lerps can
// collapse on a reversal or change the camera's height/setback mid-corner.
export function blendSurfaceFrame(outNormal, outForward, oldNormal, oldForward, normal, heading, t) {
    surfaceQuaternion(from, oldNormal, oldForward);
    surfaceQuaternion(to, normal, heading);
    from.slerp(to, t);
    outNormal.set(0, 1, 0).applyQuaternion(from);
    outForward.set(0, 0, 1).applyQuaternion(from);
}
