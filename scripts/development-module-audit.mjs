import { relative } from 'node:path';
export const AUDIT_FILE = 'development-module-audit.json';
export const isDevelopmentModule = id => /^src\/worm\/(dev|traversal)\//.test(id.replaceAll('\\', '/'));

// Inspect Rollup's module graph: manifest entry names cannot detect a static
// import merged into an otherwise innocently named production chunk.
export function developmentModuleAudit() {
  let root;
  return {
    name: 'development-module-audit', apply: 'build',
    configResolved(config) { root = config.root; },
    generateBundle(_, bundle) {
      const forbiddenModules = [];
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== 'chunk') continue;
        for (const [id, info] of Object.entries(chunk.modules)) {
          const source = relative(root, id).replaceAll('\\', '/');
          if (info.renderedLength > 0 && isDevelopmentModule(source)) forbiddenModules.push({ source, chunk: chunk.fileName });
        }
      }
      this.emitFile({ type: 'asset', fileName: AUDIT_FILE, source: JSON.stringify({ version: 1, forbiddenModules }, null, 2) });
    },
  };
}
export function developmentAuditFailures(audit) {
  if (audit?.version !== 1 || !Array.isArray(audit.forbiddenModules)) return ['Missing or invalid development-module audit; rebuild production.'];
  return audit.forbiddenModules.map(item => `development module entered production: ${item.source} (${item.chunk})`);
}
