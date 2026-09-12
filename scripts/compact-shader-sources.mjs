// GLSL comments and indentation are useful in source, but need not be shipped.
// Keep line boundaries for preprocessor directives. Skip interpolated templates
// so a comment cannot accidentally expose an interpolated expression as code.
export const compactGLSL = source => source
  .replace(/\/\*[\s\S]*?\*\//g, comment => comment.replace(/[^\n]/g, ' '))
  .split('\n').map(line => line.replace(/\/\/.*$/, '').trim().replace(/[ \t]+/g, ' '))
  .join('\n').trim();

export function compactShaderSources() {
  return {
    name: 'compact-shader-sources',
    apply: 'build',
    transform(code, id) {
      if (!/\/3d\/styles\/shaders\/\w+\.js$/.test(id)) return null;
      const edits = [];
      const visit = node => {
        if (!node || typeof node !== 'object') return;
        if (node.type === 'TemplateLiteral' && node.expressions.length === 0) {
          const q = node.quasis[0];
          // Fail closed if a parser ever changes the range contract.
          if (code.slice(q.start, q.end) === q.value.raw) {
            edits.push({ start: q.start, end: q.end, value: compactGLSL(q.value.raw) });
          }
          return;
        }
        for (const value of Object.values(node)) {
          if (Array.isArray(value)) value.forEach(visit);
          else if (value && typeof value === 'object') visit(value);
        }
      };
      visit(this.parse(code));
      for (const edit of edits.sort((a, b) => b.start - a.start)) {
        code = code.slice(0, edit.start) + edit.value + code.slice(edit.end);
      }
      return { code, map: null };
    },
  };
}
