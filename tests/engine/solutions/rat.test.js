// Worked solutions for ratios and percents: every "a op b = c" they state is right,
// and the answer is in the last step.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateProblem, generators, DIFFICULTIES } from '../../../engine/generators/index.js';
import { solve } from '../../../engine/solutions/index.js';
import { toText } from '../../../engine/problem/text.js';
import { parseDecimal } from '../../../engine/math/decimal.js';

const PARTS = Object.keys(generators).filter((id) => id.startsWith('rat.') && !generators[id].mixed);

test('every stated calculation is right, and the answer is in the last step', () => {
  for (const id of PARTS) for (const d of DIFFICULTIES) for (let i = 0; i < 120; i++) {
    const p = generateProblem(id, `rs-${i}`, d);
    const steps = solve(p);
    const all = steps.map((s) => s.say).join(' / ');
    assert.doesNotMatch(all, /undefined|NaN|Infinity/, all);
    // Whole chains like "4 × 15 ÷ 3 = 20", worked left to right.
    for (const m of all.replace(/\$/g, '').matchAll(/(?<![\d.]|[\d.] [+−×÷] )((?:\d+(?:\.\d+)? [+−×÷] )+\d+(?:\.\d+)?) = (\d+(?:\.\d+)?)/g)) {
      const tokens = m[1].split(' ');
      let acc = parseDecimal(tokens[0]);
      for (let k = 1; k < tokens.length; k += 2) {
        const y = parseDecimal(tokens[k + 1]);
        const [n, dd] = { '+': [acc.n * y.d + y.n * acc.d, acc.d * y.d], '−': [acc.n * y.d - y.n * acc.d, acc.d * y.d], '×': [acc.n * y.n, acc.d * y.d], '÷': [acc.n * y.d, acc.d * y.n] }[tokens[k]];
        acc = { n, d: dd };
      }
      const r = parseDecimal(m[2]);
      assert.equal(acc.n * r.d, r.n * acc.d, `${m[0]} in: ${all}`);
    }
    const a = p.answer;
    const shown = a.type === 'choice' ? a.options[a.correct] : `${a.prefix || ''}${a.value}${a.suffix || ''}`;
    assert.ok(steps.at(-1).say.includes(shown), `${toText(p.expression)}: "${steps.at(-1).say}" should include ${shown}`);
  }
});
