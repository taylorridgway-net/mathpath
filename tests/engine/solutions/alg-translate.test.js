// Worked solutions for writing expressions and equations from words: every
// "a × b = c" and "a + b × c = d" is right, and the answer is in the last step.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateProblem, DIFFICULTIES } from '../../../engine/generators/index.js';
import { solve } from '../../../engine/solutions/index.js';
import { toText } from '../../../engine/problem/text.js';
import { exprText } from '../../../engine/solutions/alg-translate.js';

test('translating solutions: arithmetic right, answer last', () => {
  for (const id of ['alg.translate.expression', 'alg.translate.equation']) for (const d of DIFFICULTIES) for (let i = 0; i < 200; i++) {
    const p = generateProblem(id, `st-${i}`, d);
    const steps = solve(p);
    const all = steps.map((s) => s.say).join(' / ');
    assert.doesNotMatch(all, /undefined|NaN/, all);
    for (const m of all.matchAll(/(?<![\d)] [+−×÷] )((?:\d+ [+−×] )+\d+) = (\d+)(?![\d/x])/g)) {
      assert.equal(Function(`"use strict"; return (${m[1].replace(/×/g, '*').replace(/−/g, '-')});`)(), Number(m[2]), `${m[0]} in ${all}`);
    }
    const last = steps.at(-1).say;
    const a = p.answer;
    const want = a.type === 'linear' ? exprText(a.coef, a.constant) : String(a.value.n);
    assert.ok(last.includes(want), `${toText(p.expression)}: ${last} (want ${want})`);
  }
});
