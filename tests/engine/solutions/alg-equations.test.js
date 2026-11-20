// Worked solutions for equations end with the right value of x.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateProblem, DIFFICULTIES } from '../../../engine/generators/index.js';
import { solve } from '../../../engine/solutions/index.js';
import { toText } from '../../../engine/problem/text.js';
import { reduce } from '../../../engine/math/fraction.js';

test('every equation solution ends with "x = <answer>", and two-step ones undo adding/subtracting first', () => {
  for (const d of DIFFICULTIES) for (let i = 0; i < 200; i++) {
    for (const id of ['alg.equations', 'alg.equations.add-sub', 'alg.equations.mult-div', 'alg.equations.two-step']) {
      const p = generateProblem(id, `se-${i}`, d);
      const v = reduce(p.answer.value);
      const want = `x = ${v.n < 0 ? '−' : ''}${Math.abs(v.n)}${v.d === 1 ? '' : `/${v.d}`}.`;
      const steps = solve(p);
      assert.ok(steps.at(-1).say.endsWith(want), `${toText(p.expression)}: ${steps.at(-1).say} (want ${want})`);
      if ((p.part || id).endsWith('two-step') || (id === 'alg.equations' && steps.length === 3)) {
        assert.ok(/^.*Undo (adding|subtracting)/.test(steps[0].say), steps[0].say);
      }
      assert.ok(!steps.some((s) => /undefined|NaN/.test(s.say)), steps.map((s) => s.say).join(' / '));
    }
  }
});
