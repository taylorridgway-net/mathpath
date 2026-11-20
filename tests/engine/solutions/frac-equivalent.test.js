// Worked solutions for equivalent fractions end with the right answer (worked out here).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateProblem, DIFFICULTIES } from '../../../engine/generators/index.js';
import { solve } from '../../../engine/solutions/index.js';

const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const SEEDS = Array.from({ length: 100 }, (_, i) => `se-${i}`);

test('every equivalent-fractions solution reaches the right answer', () => {
  for (const d of DIFFICULTIES) for (const seed of SEEDS) {
    for (const id of ['frac.equivalent.scale', 'frac.equivalent.missing', 'frac.equivalent.simplify', 'frac.equivalent']) {
      const p = generateProblem(id, seed, d);
      const kind = p.part || p.generator;
      const e = p.expression;
      const text = solve(p).map((s) => s.say).join(' ');
      let want;
      if (kind.endsWith('scale')) want = `= ${e.left.n * e.right.n}/${e.left.d * e.right.n}.`;
      if (kind.endsWith('missing')) {
        want = e.right.n.type === 'blank' ? `= ${(e.left.n * e.right.d) / e.left.d}/${e.right.d}.` : `= ${e.right.n}/${(e.left.d * e.right.n) / e.left.n}.`;
      }
      if (kind.endsWith('simplify')) { const g = gcd(e.n, e.d); want = `simplest form: ${e.n / g}/${e.d / g}.`; }
      assert.ok(text.includes(want), `${id} ${seed} d${d}: "${text}" should contain "${want}"`);
    }
  }
});
