import { useEffect, useState } from 'react';
import { EquirectangularReflectionMapping, LinearSRGBColorSpace } from 'three';
import { RGBELoader, EXRLoader } from 'three-stdlib';
import { presetsObj } from '@react-three/drei/helpers/environment-assets.js';

// Match drei's pinned preset assets, but do not use its suspending loader for
// optional scenery. A failed useLoader request is rethrown during rendering,
// which reports a browser error even when a React boundary preserves the cube.
const PRESET_ROOT = 'https://raw.githack.com/pmndrs/drei-assets/456060a26bbeb8fdf79326f224b6d99b8bcce736/hdri/';
const resources = new Map();

function acquire(url) {
  let resource = resources.get(url);
  if (!resource) {
    resource = { users: 0, texture: null, disposed: false, releaseTimer: null };
    resources.set(url, resource);
    resource.promise = Promise.resolve().then(() => {
      const extension = url.split('?')[0].split('.').at(-1).toLowerCase();
      const Loader = extension === 'hdr' ? RGBELoader : extension === 'exr' ? EXRLoader : null;
      if (!Loader) throw new Error(`Unsupported environment file: ${url}`);
      return new Loader().loadAsync(url);
    }).then(texture => {
      if (resource.disposed) { texture.dispose(); return null; }
      texture.mapping = EquirectangularReflectionMapping;
      texture.colorSpace = LinearSRGBColorSpace;
      resource.texture = texture;
      return texture;
    }).catch(error => {
      // Handle network/decoding failure here, never in a render or global error
      // listener. The scene's ordinary lights and solid backdrop remain intact.
      console.warn('[SafeEnvironment] environment map unavailable; continuing without it.', error?.message ?? error);
      return null;
    });
  }
  clearTimeout(resource.releaseTimer);
  resource.users++;
  return resource;
}

function release(url, resource) {
  resource.users--;
  if (resource.users) return;
  // StrictMode and same-turn scene switches can immediately acquire it again.
  // Otherwise dispose once the last reflection/panorama consumer is gone.
  resource.releaseTimer = setTimeout(() => {
    resource.disposed = true;
    resource.texture?.dispose();
    resources.delete(url);
  }, 0);
}

export default function useOptionalEnvironment({ preset, files, path = '' } = {}) {
  const url = files ? `${path}${files}` : presetsObj[preset] ? `${PRESET_ROOT}${presetsObj[preset]}` : null;
  const [loaded, setLoaded] = useState(null);
  useEffect(() => {
    if (!url) return undefined;
    let active = true;
    const resource = acquire(url);
    resource.promise.then(texture => { if (active) setLoaded({ url, texture, resource }); });
    return () => { active = false; release(url, resource); };
  }, [url]);
  // A newly selected panorama never receives the previous request's texture,
  // including when an older fetch resolves after switching away from it.
  return loaded?.url === url && resources.get(url) === loaded.resource ? loaded.texture : null;
}
