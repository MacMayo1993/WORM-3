import { it, expect } from 'vitest';
import { parseAst } from 'rollup/parseAst';
import { compactGLSL, compactShaderSources } from '../../scripts/compact-shader-sources.mjs';
it('preserves directive line boundaries and separates tokens around block comments', () => {
  expect(compactGLSL('  #define N 2\n // explanation\n float /* help */ x;\n')).toBe('#define N 2\n\nfloat x;');
});
it('compacts only standalone shader templates and leaves interpolated comments untouched', () => {
  const code = 'const a = `  void main() { // note\n } `; const b = `// note ${a}\nvoid main(){}`;';
  const out = compactShaderSources().transform.call({ parse: parseAst }, code, '/src/3d/styles/shaders/sampleShaders.js');
  expect(out.code).toContain('`void main() {\n}`');
  expect(out.code).toContain('`// note ${a}\nvoid main(){}`');
  expect(() => parseAst(out.code)).not.toThrow();
});
