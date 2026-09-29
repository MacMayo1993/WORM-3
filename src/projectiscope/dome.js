import { BackSide, Mesh, ShaderMaterial, SphereGeometry } from 'three';

// Lift the artifact's azimuthal RP² disk back onto its orientation cover S².
// Opposite directions share a sample: d ~ -d. Blend both boundary representatives
// across the equator to hide raster/near-sheet color discontinuities at the join.
export const DOME_DISK_RADIUS = 0.47;
export const DOME_SEAM_WIDTH = 0.035;
export const DOME_DRIFT_SPEED = 0.065;

export const domeFragmentShader = `
  uniform sampler2D designMap;
  uniform sampler2D drawingMap;
  varying vec3 direction;
  vec2 diskUV(vec3 d) {
    float r = length(d.xy);
    float angle = atan(r, abs(d.z));
    vec2 disk = d.xy * (angle / (1.57079632679 * max(r, 0.00001)));
    return vec2(0.5) + ${DOME_DISK_RADIUS} * disk;
  }
  void main() {
    vec3 d = normalize(direction);
    vec2 uv = diskUV(d);
    vec3 front = texture2D(designMap, uv).rgb;
    vec3 back = texture2D(designMap, vec2(1.0) - uv).rgb;
    vec4 frontInk = texture2D(drawingMap, uv);
    vec4 backInk = texture2D(drawingMap, vec2(1.0) - uv);
    front = mix(front, frontInk.rgb, frontInk.a);
    back = mix(back, backInk.rgb, backInk.a);
    float sheet = smoothstep(-${DOME_SEAM_WIDTH}, ${DOME_SEAM_WIDTH}, d.z);
    gl_FragColor = vec4(mix(back, front, sheet) * 0.78, 1.0);
    #include <colorspace_fragment>
  }
`;

export function createProjectiscopeDome(texture, drawingTexture) {
  const material = new ShaderMaterial({
    uniforms: { designMap: { value: texture }, drawingMap: { value: drawingTexture } },
    vertexShader: `
      varying vec3 direction;
      void main() {
        direction = position;
        // Ignore translation for every camera, including portal render passes.
        vec3 viewDirection = mat3(viewMatrix) * mat3(modelMatrix) * position;
        gl_Position = projectionMatrix * vec4(viewDirection, 1.0);
        // Infinite sky: independent of camera near/far distances and cube size.
        gl_Position.z = gl_Position.w;
      }
    `,
    fragmentShader: domeFragmentShader,
    side: BackSide, depthWrite: false, depthTest: false, toneMapped: false,
  });
  const dome = new Mesh(new SphereGeometry(1, 48, 32), material);
  dome.name = 'Projectiscope 360 dome';
  dome.frustumCulled = false;
  dome.renderOrder = -1000;
  // Start off-axis so the original disk center never reads as a framed picture.
  dome.rotation.set(0.35, 0.6, 0.15);
  return dome;
}
