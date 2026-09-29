import {
  AddEquation, BufferGeometry, Color, CustomBlending, DoubleSide, Float32BufferAttribute, LinearFilter, Mesh, NearestFilter, NoBlending,
  OneFactor, OneMinusSrcAlphaFactor, OrthographicCamera, PlaneGeometry, Points, Scene,
  ShaderMaterial, Vector2, Vector4, WebGLRenderTarget,
} from 'three';
import { createMotifGeometry, GPU_QUALITY } from './gpuGeometry.js';
import { createMotifMotion } from './gpuMotion.js';
import { motifVertexShader, motifFragmentShader, compositeVertexShader, compositeFragmentShader, motionVertexShader, motionFragmentShader } from './gpuShaders.js';
import { isMobile } from '../utils/device.js';

export function createGpuArt(gl, model, reduced = false) {
  const motion = createMotifMotion(model), recipe = model.recipe;
  const useAtlas = gl.capabilities?.maxVertexTextures > 0;
  const motionScene = new Scene(), compositeScene = new Scene(), camera = new OrthographicCamera();
  const palette = [...recipe.colors.warm, ...recipe.colors.cool].map(c => new Color(c));
  const uniforms = {
    center: { value: motion.center }, first: { value: motion.first }, second: { value: motion.second },
    turns: { value: motion.turns }, palette: { value: palette }, reach: { value: recipe.reach },
    resolution: { value: 1 }, glow: { value: recipe.glow }, dash: { value: ['solid', 'dashed', 'dotted'].indexOf(recipe.dash) },
  };
  const material = new ShaderMaterial({ uniforms, defines: useAtlas ? { USE_MOTION_ATLAS: 1 } : {}, vertexShader: motifVertexShader, fragmentShader: motifFragmentShader,
    depthTest: false, depthWrite: false, side: DoubleSide, toneMapped: false,
    transparent: true, blending: CustomBlending, blendEquation: AddEquation,
    blendSrc: OneFactor, blendDst: OneMinusSrcAlphaFactor,
  });
  // Dense icosahedral designs can cover the same pixel hundreds of times.
  // Bound their fill cost as well as their triangles, before the game's FPS
  // monitor has to react. Every motif/group remains present and animated.
  const dense = recipe.showMotif && model.groups.length * model.strokes.length > 720;
  const standardQuality = { ...(isMobile ? GPU_QUALITY.mobile : GPU_QUALITY.normal),
    ...(dense ? { size: isMobile ? 320 : 384, fps: 30 } : {}) };
  const reducedQuality = { ...GPU_QUALITY.reduced, ...(dense ? { size: 256 } : {}) };
  let quality = reduced ? reducedQuality : standardQuality;
  const mesh = new Mesh(createMotifGeometry(model, quality, useAtlas), material);
  mesh.frustumCulled = false; motionScene.add(mesh);
  const atlasScene = new Scene();
  const atlas = useAtlas ? new WebGLRenderTarget(256, 1, { depthBuffer: false, stencilBuffer: false,
    minFilter: NearestFilter, magFilter: NearestFilter, generateMipmaps: false }) : null;
  let points;
  if (atlas) {
    uniforms.motionMap = { value: atlas.texture }; uniforms.motionSize = { value: new Vector2(256, 1) };
    points = new Points(new BufferGeometry(), new ShaderMaterial({ uniforms,
      vertexShader: motionVertexShader, fragmentShader: motionFragmentShader,
      depthTest: false, depthWrite: false, toneMapped: false, blending: NoBlending,
    }));
    points.frustumCulled = false; atlasScene.add(points);
  }
  const rebuildAtlas = () => {
    if (!atlas) return;
    const data = mesh.geometry.userData.motion, geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(data.position, 3));
    geometry.setAttribute('curveCenter', new Float32BufferAttribute(data.center, 2));
    geometry.setAttribute('pixelIndex', new Float32BufferAttribute(data.pixel, 1));
    points.geometry.dispose(); points.geometry = geometry;
    const height = Math.max(1, Math.ceil(data.pixel.length / 256));
    atlas.setSize(256, height); uniforms.motionSize.value.set(256, height);
  };
  rebuildAtlas();
  const targets = Array.from({ length: 3 }, () => new WebGLRenderTarget(quality.size, quality.size, {
    depthBuffer: false, stencilBuffer: false, minFilter: LinearFilter, magFilter: LinearFilter, generateMipmaps: false,
  }));
  const blend = ['source-over', 'lighter', 'screen', 'multiply', 'difference'].indexOf(recipe.blend);
  const composite = new ShaderMaterial({
    vertexShader: compositeVertexShader, fragmentShader: compositeFragmentShader,
    depthTest: false, depthWrite: false, toneMapped: false, blending: NoBlending,
    uniforms: {
      strokes: { value: targets[0].texture }, history: { value: targets[1].texture },
      ground: { value: new Color(recipe.colors.ground) }, fade: { value: 1 }, fresh: { value: 1 },
      blend: { value: Math.max(0, blend) }, bloom: { value: recipe.bloom * recipe.bloom }, pixel: { value: 1 / quality.size },
    },
  });
  const plane = new Mesh(new PlaneGeometry(2, 2), composite); plane.frustumCulled = false; compositeScene.add(plane);
  let front = 1, valid = false, lastTime = 0, lastFrame = -Infinity, disposed = false;
  const viewport = new Vector4(), scissor = new Vector4(), clearColor = new Color();
  const moving = recipe.showMotif && recipe.speed > 0 && (recipe.wobble > 0 || recipe.drift > 0 || recipe.spin !== 0);
  const restore = () => { valid = false; };
  gl.domElement.addEventListener('webglcontextrestored', restore);
  return {
    get texture() { return targets[front].texture; },
    get stats() { return { size: quality.size, triangles: mesh.geometry.userData.triangles, passes: atlas ? 3 : 2,
      targetBytes: 3 * quality.size ** 2 * 4 + (atlas ? atlas.width * atlas.height * 4 : 0) }; },
    update(now, time, paused, reducedEffects) {
      if (disposed) return false;
      const nextQuality = reducedEffects ? reducedQuality : standardQuality;
      if (quality !== nextQuality) {
        quality = nextQuality;
        mesh.geometry.dispose(); mesh.geometry = createMotifGeometry(model, quality, useAtlas); rebuildAtlas();
        for (const target of targets) target.setSize(quality.size, quality.size);
        valid = false;
      }
      if (valid && (paused || !moving || now - lastFrame < 1000 / quality.fps - .5)) return false;
      const dt = valid ? Math.max(0, time - lastTime) : 0;
      motion.update(recipe.t + time * recipe.speed * .4);
      uniforms.resolution.value = quality.size;
      composite.uniforms.pixel.value = 1 / quality.size;
      composite.uniforms.bloom.value = reducedEffects ? 0 : recipe.bloom * recipe.bloom;
      composite.uniforms.fade.value = valid && recipe.trail > 0 ? 1 - Math.pow(recipe.trail, dt * 30) : 1;
      composite.uniforms.fresh.value = valid ? 0 : 1;
      composite.uniforms.history.value = targets[front].texture;
      const destination = front === 1 ? 2 : 1;
      // Share the game's context, and restore every state this pass touches.
      // Portal captures and postprocessing can enter with their own framebuffer.
      const priorTarget = gl.getRenderTarget(), face = gl.getActiveCubeFace(), mip = gl.getActiveMipmapLevel();
      const autoClear = gl.autoClear, xr = gl.xr.enabled, scissorTest = gl.getScissorTest();
      const alpha = gl.getClearAlpha(); gl.getClearColor(clearColor); gl.getViewport(viewport); gl.getScissor(scissor);
      try {
        gl.xr.enabled = false; gl.autoClear = false;
        gl.setClearColor(0, 0);
        if (atlas) {
          gl.setRenderTarget(atlas); gl.setScissorTest(false); gl.clear(true, false, false);
          gl.render(atlasScene, camera);
        }
        gl.setRenderTarget(targets[0]); gl.setScissorTest(false);
        gl.clear(true, false, false);
        gl.render(motionScene, camera);
        gl.setRenderTarget(targets[destination]); gl.setScissorTest(false);
        if (!valid) {
          // Initialize the sampled history before the first draw (also after
          // context restoration); never sample a freshly allocated attachment.
          gl.setRenderTarget(targets[front]); gl.clear(true, false, false);
          gl.setRenderTarget(targets[destination]);
        }
        gl.render(compositeScene, camera);
        front = destination; valid = true; lastTime = time; lastFrame = now;
      } finally {
        gl.setRenderTarget(priorTarget, face, mip); gl.setViewport(viewport); gl.setScissor(scissor); gl.setScissorTest(scissorTest);
        gl.setClearColor(clearColor, alpha); gl.autoClear = autoClear; gl.xr.enabled = xr;
      }
      return true;
    },
    dispose() {
      if (disposed) return;
      disposed = true; gl.domElement.removeEventListener('webglcontextrestored', restore);
      mesh.geometry.dispose(); material.dispose(); plane.geometry.dispose(); composite.dispose();
      if (atlas) { atlas.dispose(); points.geometry.dispose(); points.material.dispose(); }
      for (const target of targets) target.dispose();
    },
  };
}
