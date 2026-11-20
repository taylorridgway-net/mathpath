// Worked solutions for integers end with the right answer, and the rule they state matches the answer's sign.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateProblem, DIFFICULTIES } from '../../../engine/generators/index.js';
import { solve } from '../../../engine/solutions/index.js';
import { toText } from '../../../engine/problem/text.js';

test('every integer solution ends with the answer; "even/odd number of negatives" matches the sign', () => {
  for (const d of DIFFICULTIES) for (let i = 0; i < 150; i++) {
    for (const id of ['int.add-sub', 'int.mult-div', 'int.add-sub.same-sign', 'int.add-sub.different-signs', 'int.add-sub.subtract', 'int.mult-div.multiply', 'int.mult-div.divide']) {
      const p = generateProblem(id, `si-${i}`, d);
      const v = p.answer.value;
      const steps = solve(p);
      const text = steps.map((s) => s.say).join(' ');
      assert.ok(steps.at(-1).say.endsWith(`is ${v < 0 ? `−${-v}` : v}.`), steps.at(-1).say);
      assert.ok(toText(steps.at(-1).show).endsWith(`= ${v < 0 ? `-${-v}` : v}`), toText(steps.at(-1).show));
      if (text.includes('even number of negatives')) assert.ok(v > 0);
      if (text.includes('odd number of negatives')) assert.ok(v < 0);
      assert.ok(!/undefined|NaN/.test(text), text);
    }
  }
});
