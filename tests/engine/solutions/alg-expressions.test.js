// Worked solutions for simplifying expressions end with the right ax + b.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateProblem, DIFFICULTIES } from '../../../engine/generators/index.js';
import { solve } from '../../../engine/solutions/index.js';
import { toText } from '../../../engine/problem/text.js';

test('every expression solution ends with the right ax + b; distributing is shown when there are parentheses', () => {
  for (const d of DIFFICULTIES) for (let i = 0; i < 200; i++) {
    for (const id of ['alg.expressions', 'alg.expressions.like-terms', 'alg.expressions.distribute']) {
      const p = generateProblem(id, `sx-${i}`, d);
      const { coef: a, constant: b } = p.answer;
      const xt = a === 1 ? 'x' : a === -1 ? '−x' : `${a < 0 ? '−' : ''}${Math.abs(a)}x`;
      const want = `${xt} ${b < 0 ? '−' : '+'} ${Math.abs(b)}.`;
      const steps = solve(p);
      assert.ok(steps.at(-1).say.endsWith(want), `${toText(p.expression)}: ${steps.at(-1).say} (want ${want})`);
      if (toText(p.expression).includes('(')) assert.ok(/each term inside/.test(steps[0].say), steps[0].say);
      assert.ok(!steps.some((s) => /undefined|NaN/.test(s.say)));
    }
  }
});
