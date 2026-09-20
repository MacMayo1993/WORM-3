import { expect, it } from 'vitest';
import { rollup } from 'rollup';
import { developmentModuleAudit, developmentAuditFailures } from '../../scripts/development-module-audit.mjs';
it.each([false, true])('detects a used static fixture import even when merged into main: %s', leak => {
  return (async () => {
    const audit = developmentModuleAudit(); audit.configResolved({ root: '/test' });
    const bundle = await rollup({ input: '/test/src/main.js', plugins: [{
      name: 'test-modules', resolveId: id => id,
      load: id => id.endsWith('/main.js')
        ? leak ? "import { value } from '/test/src/worm/dev/GapLab.js'; console.log(value);" : "if (false) import('/test/src/worm/dev/GapLab.js'); console.log('game');"
        : 'export const value = Math.random();',
    }, audit] });
    try {
      const { output } = await bundle.generate({ format: 'es' });
      const report = JSON.parse(output.find(item => item.type === 'asset').source);
      expect(developmentAuditFailures(report)).toHaveLength(leak ? 1 : 0);
      if (leak) expect(report.forbiddenModules[0].chunk).toBe('main.js');
    } finally { await bundle.close(); }
  })();
});
it('fails closed when the build did not emit an audit', () => {
  expect(developmentAuditFailures(undefined)).toHaveLength(1);
});
