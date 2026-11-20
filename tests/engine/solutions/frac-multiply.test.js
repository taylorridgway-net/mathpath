// Worked solutions for multiplying end with the right answer, in simplest form.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateProblem, DIFFICULTIES } from '../../../engine/generators/index.js';
import { solve } from '../../../engine/solutions/index.js';
import { toText } from '../../../engine/problem/text.js';

test('every multiplying solution ends with the answer, and shows it', () => {
  for (const d of DIFFICULTIES) for (let i = 0; i < 150; i++) {
    for (const id of ['frac.multiply', 'frac.multiply.by-whole', 'frac.multiply.by-fraction', 'frac.multiply.simplify']) {
      const p = generateProblem(id, `sm-${i}`, d);
      const steps = solve(p);
      const { n, d: den } = p.answer.value;
      const want = den === 1 ? String(n) : `${n}/${den}`;
      const last = steps.at(-1);
      assert.ok(last.say.includes(`is ${want}`), `${id}: "${last.say}" should end with ${want}`);
      assert.ok(toText(last.show).endsWith(want), toText(last.show));
    }
  }
});
