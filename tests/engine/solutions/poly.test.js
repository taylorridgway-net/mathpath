// Worked solutions for multiplying and factoring: numeric statements are right,
// the answer is in the last step, and the "ac method" split really adds to b.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateProblem, generators, DIFFICULTIES } from '../../../engine/generators/index.js';
import { solve } from '../../../engine/solutions/index.js';
import { toText } from '../../../engine/problem/text.js';
import { answerText } from '../../../engine/solutions/poly.js';

const PARTS = Object.keys(generators).filter((id) => id.startsWith('poly.') && !generators[id].mixed);

test('polynomial solutions: arithmetic right, answer last', () => {
  for (const id of PARTS) for (const d of DIFFICULTIES) for (let i = 0; i < 150; i++) {
    const p = generateProblem(id, `sp-${i}`, d);
    const steps = solve(p);
    const all = steps.map((s) => s.say).join(' / ');
    assert.doesNotMatch(all, /undefined|NaN|\+ −|− −|(?<![\d.])1x\b/, all);
    // "a × b = c", "a + b = c", "a ÷ b = c" with whole numbers (negatives in parentheses).
    for (const m of all.matchAll(/(?<![\w)·] )(?<![\d.−])(\(?−?\d+\)?) ([×+÷−]) (\(?−?\d+\)?) = (−?\d+)(?![\dx/])/g)) {
      const v = (t) => Number(t.replace(/[()]/g, '').replace('−', '-'));
      const [x, y] = [v(m[1]), v(m[3])];
      const got = { '×': x * y, '+': x + y, '÷': x / y, '−': x - y }[m[2]];
      assert.equal(got, v(m[4]), `${m[0]} in ${all}`);
    }
    assert.ok(steps.at(-1).say.includes(answerText(p.answer)), `${toText(p.expression)}: ${steps.at(-1).say} (want ${answerText(p.answer)})`);
  }
});
