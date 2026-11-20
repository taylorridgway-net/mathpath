// Worked solutions for dividing end with the right answer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateProblem, DIFFICULTIES } from '../../../engine/generators/index.js';
import { solve } from '../../../engine/solutions/index.js';
import { toText } from '../../../engine/problem/text.js';

test('every dividing solution ends with the answer, and shows it', () => {
  for (const d of DIFFICULTIES) for (let i = 0; i < 150; i++) {
    for (const id of ['frac.divide', 'frac.divide.meaning', 'frac.divide.reciprocal', 'frac.divide.multiply-reciprocal']) {
      const p = generateProblem(id, `sd-${i}`, d);
      const steps = solve(p);
      const { n, d: den } = p.answer.value;
      const want = den === 1 ? String(n) : `${n}/${den}`;
      const last = steps.at(-1);
      assert.ok(last.say.includes(`is ${want}`), `${id}: "${last.say}" should give ${want}`);
      assert.ok(toText(last.show).endsWith(want), toText(last.show));
      assert.ok(!steps.some((s) => s.say.includes('undefined') || s.say.includes('NaN')), JSON.stringify(steps));
    }
  }
});
