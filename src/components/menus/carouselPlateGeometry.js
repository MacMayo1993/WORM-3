import { Shape, ExtrudeGeometry } from 'three';

// Rounded enamel insert; shallow physical bevel catches the studio lights.
// The face remains below z=.03 so labels and surface worms keep their clearance.
const half = 1.44, radius = 0.12;
const shape = new Shape();
shape.moveTo(-half + radius, -half);
shape.lineTo(half - radius, -half);
shape.quadraticCurveTo(half, -half, half, -half + radius);
shape.lineTo(half, half - radius);
shape.quadraticCurveTo(half, half, half - radius, half);
shape.lineTo(-half + radius, half);
shape.quadraticCurveTo(-half, half, -half, half - radius);
shape.lineTo(-half, -half + radius);
shape.quadraticCurveTo(-half, -half, -half + radius, -half);
export const carouselPlateGeometry = new ExtrudeGeometry(shape, {
  depth: 0.035, bevelEnabled: true, bevelThickness: 0.022,
  bevelSize: 0.035, bevelSegments: 3, curveSegments: 8, steps: 1,
});
carouselPlateGeometry.translate(0, 0, -0.035);
