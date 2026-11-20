// Worked solutions for negative fractions end with the right answer, and the sign step matches it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateProblem, DIFFICULTIES } from '../../../engine/generators/index.js';
import { solve } from '../../../engine/solutions/index.js';
import { toText } from '../../../engine/problem/text.js';

test('every negative-fraction solution ends with the answer; "answer is negative/positive" matches it', () => {
  for (const d of DIFFICULTIES) for (let i = 0; i < 200; i++) {
    for (const id of ['frac.signed', 'frac.signed.sign-placement', 'frac.signed.add-sub', 'frac.signed.mult-div']) {
      const p = generateProblem(id, `ss-${i}`, d);
      const { n, d: den } = p.answer.value;
      const want = `${n < 0 ? '−' : ''}${Math.abs(n)}${den === 1 ? '' : `/${den}`}`;
      const steps = solve(p);
      const text = steps.map((s) => s.say).join(' ');
      assert.ok(steps.at(-1).say.endsWith(`is ${want}.`), `${id}: ${steps.at(-1).say} (want ${want})`);
      assert.ok(toText(steps.at(-1).show).endsWith(`= ${n < 0 ? '-' : ''}${Math.abs(n)}${den === 1 ? '' : `/${den}`}`), toText(steps.at(-1).show));
      if (text.includes('so the answer is negative')) assert.ok(n < 0);
      if (text.includes('so the answer is positive')) assert.ok(n > 0);
      assert.ok(!/undefined|NaN/.test(text), text);
    }
  }
});
