// Execute the production clearance GLSL in real WebGL, including the floor
// hemisphere that used to be exempt. No game fixture or performance build needed.
// CHROMIUM=/path/to/chrome node scripts/perf-worm/camera-clearance.mjs
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { fileURLToPath } from 'node:url';

const bundle = await build({ bundle: true, write: false, format: 'iife', stdin: {
  resolveDir: fileURLToPath(new URL('../../', import.meta.url)),
  contents: `
    import * as THREE from 'three';
    import { tunnelCameraClearanceGLSL, tunnelCameraUniforms } from './src/manifold/tunnelCameraClearance.js';
    import { tunnelCoreClipUniforms } from './src/manifold/tunnelCoreClip.js';
    import { makeCautionOpeningUniforms } from './src/worm/healerWorm/cautionOpening.js';
    window.checkClearance = () => {
      const gl = new THREE.WebGLRenderer({ antialias: false });
      gl.setSize(1, 1);
      const target = new THREE.WebGLRenderTarget(1, 1);
      gl.setRenderTarget(target);
      const camera = new THREE.PerspectiveCamera(), scene = new THREE.Scene();
      const uniforms = {
        ...tunnelCameraUniforms, ...tunnelCoreClipUniforms, ...makeCautionOpeningUniforms(),
        uCameraClearance: { value: 1 }, uCoreClipOff: { value: 1 },
        point: { value: new THREE.Vector3() },
      };
      const shader = mode => new THREE.ShaderMaterial({ uniforms,
        vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }',
        fragmentShader: 'uniform vec3 point; ' + tunnelCameraClearanceGLSL +
          (mode === 'opaque' ? 'void main() { clearTunnelCamera(point); gl_FragColor = vec4(1.0); }'
            : 'void main() { gl_FragColor = vec4(vec3(tunnelCameraVisibility(point)), 1.0); }'),
      });
      const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), shader('opaque'));
      quad.frustumCulled = false; scene.add(quad);
      const pixel = new Uint8Array(4);
      let checks = 0;
      const check = (label, point, visible) => {
        uniforms.point.value.copy(point); gl.clear(); gl.render(scene, camera);
        gl.readRenderTargetPixels(target, 0, 0, 1, 1, pixel);
        if (visible ? pixel[0] !== 255 : pixel[0] !== 0)
          throw Error(label + ': expected ' + (visible ? 'visible' : 'clear') + ', red=' + pixel[0]);
        checks++;
      };
      const local = (x, y, z) => new THREE.Vector3(x, y, z).applyQuaternion(camera.quaternion).add(camera.position);
      for (const mode of ['opaque', 'veil']) {
        quad.material.dispose(); quad.material = shader(mode);
        for (const bank of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
          camera.position.set(2.3, -1.7, .8);
          camera.rotation.set(.3, -.7, bank); camera.updateMatrixWorld();
          uniforms.uTunnelCameraPosition.value.copy(camera.position);
          camera.getWorldDirection(uniforms.uCameraAhead.value);
          // All directions, especially directly below and nearly edge-on floors.
          for (let i = 0; i < 48; i++) {
            const y = 1 - 2 * (i + .5) / 48, angle = i * 2.399963229728653;
            const r = Math.sqrt(1 - y * y) * .35;
            check(mode + ' lens sphere', local(r * Math.cos(angle), y * .35, r * Math.sin(angle)), false);
          }
          check('floor touching lens', local(0, -.001, -.01), false);
          check('floor below lens', local(0, -.25, -.05), false);
          check('band curling ahead', local(.12, -.12, -.65), false);
          check('distant track', local(0, -.12, -1), true);
          check('adjacent route', local(.65, -.1, -.3), true);
          // The mirror camera must see the same world-space cut as the rider.
          const cleared = local(0, -.2, -.1), intact = local(0, -.12, -1);
          camera.position.set(-3, 2, 4); camera.rotation.set(.8, 1.2, .5);
          check('mirror retains lens clearance', cleared, false);
          check('mirror retains remote route', intact, true);
          uniforms.uCameraClearance.value = 0;
          check('inactive ride keeps nearby bands', cleared, true);
          uniforms.uCameraClearance.value = 1;
        }
      }
      quad.geometry.dispose(); quad.material.dispose(); target.dispose(); gl.dispose();
      return { checks, modes: ['opaque', 'veil'], banks: 4 };
    };
  `,
} });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined,
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', error => errors.push(error.message));
  await page.setContent('<!doctype html><title>Tunnel lens regression</title>');
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const result = await page.evaluate(() => window.checkClearance());
  if (errors.length) throw Error(errors.join('\n'));
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
}
