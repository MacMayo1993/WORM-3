import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { WebGLAttributes } from 'three/src/renderers/webgl/WebGLAttributes.js';
import { uploadInstancePrefix, setInstanceCount } from '../3d/instanceUploads.js';

describe('instance GPU uploads', () => {
  it.each([true, false])('uploads only live matrices and skips empty pools (WebGL2=%s)', isWebGL2 => {
    const gl = { FLOAT: 5126, createBuffer: () => ({}), bindBuffer: vi.fn(), bufferData: vi.fn(), bufferSubData: vi.fn() };
    const buffers = WebGLAttributes(gl, { isWebGL2 });
    const attr = new THREE.InstancedBufferAttribute(new Float32Array(2048 * 16), 16);
    buffers.update(attr, 34962);
    uploadInstancePrefix(attr, 0);
    buffers.update(attr, 34962);
    expect(gl.bufferSubData).not.toHaveBeenCalled();
    uploadInstancePrefix(attr, 5);
    buffers.update(attr, 34962);
    const args = gl.bufferSubData.mock.calls[0];
    expect(isWebGL2 ? args[4] * 4 : args[2].byteLength).toBe(5 * 16 * 4);
    expect(attr.updateRanges).toHaveLength(0);
    uploadInstancePrefix(attr, 0);
    buffers.update(attr, 34962);
    expect(gl.bufferSubData).toHaveBeenCalledTimes(1);
  });

  it('retains pending writes when a hidden mesh misses a render and shrinks', () => {
    const attr = new THREE.InstancedBufferAttribute(new Float32Array(256 * 3), 3);
    uploadInstancePrefix(attr, 9);
    uploadInstancePrefix(attr, 2);
    uploadInstancePrefix(attr, 0);
    expect(attr.updateRanges).toEqual([{ start: 0, count: 27 }]);
    attr.clearUpdateRanges(); // renderer consumed the update
    uploadInstancePrefix(attr, 2);
    expect(attr.updateRanges).toEqual([{ start: 0, count: 6 }]);
  });

  it('hides empty batches and restores them on the next spawn', () => {
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial(), 4);
    setInstanceCount(mesh, 0);
    expect(mesh.visible).toBe(false);
    setInstanceCount(mesh, 3);
    expect(mesh.visible).toBe(true);
    expect(mesh.count).toBe(3);
    mesh.geometry.dispose(); mesh.material.dispose(); mesh.dispose();
  });
});
