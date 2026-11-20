// Worked solutions for comparing end with the right sign (worked out here by cross-multiplying).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateProblem, DIFFICULTIES } from '../../../engine/generators/index.js';
import { solve } from '../../../engine/solutions/index.js';

test('every comparing solution reaches the right answer', () => {
  for (const d of DIFFICULTIES) for (let i = 0; i < 150; i++) {
    for (const id of ['frac.compare.like', 'frac.compare.benchmark', 'frac.compare.unlike', 'frac.compare']) {
      const p = generateProblem(id, `sc-${i}`, d);
      const text = solve(p).map((s) => s.say).join(' ');
      const e = p.expression;
      let want;
      if (e.type === 'compare') {
        const v = (f) => (f.type === 'int' ? [f.value, 1] : [f.n, f.d]);
        const [a, b] = v(e.left); const [c, dd] = v(e.right);
        const sym = a * dd < c * b ? '<' : a * dd === c * b ? '=' : '>';
        const t = (f) => (f.type === 'int' ? String(f.value) : `${f.n}/${f.d}`);
        want = `${t(e.left)} ${sym} ${t(e.right)}.`;
      } else {
        const x = e.n / e.d;
        const dist = [x, Math.abs(x - 0.5), 1 - x];
        want = `is closest to ${['0', '1/2', '1'][dist.indexOf(Math.min(...dist))]}.`;
      }
      assert.ok(text.includes(want), `${id} d${d}: "${text}" should contain "${want}"`);
    }
  }
});
