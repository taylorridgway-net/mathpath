// Worked solutions for graphing inequalities: no gaps, the right inequality named,
// and the last step draws exactly the answer graph.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateProblem, generators, DIFFICULTIES } from '../../../engine/generators/index.js';
import { solve } from '../../../engine/solutions/index.js';
import { toText } from '../../../engine/problem/text.js';

const PARTS = Object.keys(generators).filter((id) => id.startsWith('alg.inequality-graphs.'));
const n = (v) => (v < 0 ? `−${-v}` : String(v));

test('graphing solutions: the last step draws the answer; reading names the inequality', () => {
  for (const id of PARTS) for (const d of DIFFICULTIES) for (let i = 0; i < 150; i++) {
    const p = generateProblem(id, `sg-${i}`, d);
    const steps = solve(p);
    const all = steps.map((s) => s.say).join(' / ');
    assert.doesNotMatch(all, /undefined|NaN/, all);
    const a = p.answer;
    if (a.type === 'numline') {
      const last = steps.at(-1).show;
      assert.equal(last?.type, 'numline', toText(p.expression));
      assert.deepEqual([last.points, last.shade], [a.points, a.shade]);
      for (const q of a.points) assert.ok(all.includes(`at ${n(q.v)}`), `${toText(p.expression)}: ${all}`);
    } else {
      assert.ok(steps.at(-1).say.includes(`x ${a.sign} ${n(a.value.n)}`), all);
    }
    // "Subtract 4: 3x < 18" style steps: check the arithmetic where a solve step is shown.
    for (const m of all.matchAll(/(Add|Subtract) (\d+) on both sides: (−?\d+)x ([<>≤≥]) (−?\d+)/g)) {
      const [, how, k, coef, sign, rhs] = m;
      const shown = toText(p.expression);
      const c = Number(/([<>≤≥]) (-?\d+)$/.exec(shown)[2]);
      assert.equal(Number(rhs.replace('−', '-')), how === 'Add' ? c + Number(k) : c - Number(k), `${shown}: ${m[0]}`);
      void coef; void sign;
    }
  }
});
