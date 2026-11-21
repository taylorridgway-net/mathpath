// Worked solutions for decimals: every "a op b = c" they state is right, the column
// picture's answer row reads the right answer with the points lined up, and the
// answer itself is in the last step.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateProblem, generators, DIFFICULTIES } from '../../../engine/generators/index.js';
import { solve } from '../../../engine/solutions/index.js';
import { toText } from '../../../engine/problem/text.js';
import { columnLayout } from '../../../engine/problem/column.js';
import { parseDecimal, sameDecimal, fromScaled } from '../../../engine/math/decimal.js';

const PARTS = Object.keys(generators).filter((id) => id.startsWith('dec.') && !generators[id].mixed);
const value = (t) => { const f = parseDecimal(t); return f.n / f.d; };

test('every stated calculation is right; no undefined or float junk; the answer is in the last step', () => {
  for (const id of PARTS) for (const d of DIFFICULTIES) for (let i = 0; i < 120; i++) {
    const p = generateProblem(id, `sd-${i}`, d);
    const steps = solve(p);
    const all = steps.map((s) => s.say).join(' / ');
    assert.doesNotMatch(all, /undefined|NaN|\d\.\d*0000|\d{9,}/, `${toText(p.expression)}: ${all}`);
    // Whole chains like "6 + 4 + 1 = 11", worked left to right.
    for (const m of all.matchAll(/(?<![\d.] [+−×÷] )((?:\d+(?:\.\d+)? [+−×÷] )+\d+(?:\.\d+)?) = (\d+(?:\.\d+)?)/g)) {
      const tokens = m[1].split(' ');
      let acc = parseDecimal(tokens[0]);
      for (let k = 1; k < tokens.length; k += 2) {
        const b = parseDecimal(tokens[k + 1]);
        const [n, dd] = { '+': [acc.n * b.d + b.n * acc.d, acc.d * b.d], '−': [acc.n * b.d - b.n * acc.d, acc.d * b.d], '×': [acc.n * b.n, acc.d * b.d], '÷': [acc.n * b.d, acc.d * b.n] }[tokens[k]];
        acc = { n, d: dd };
      }
      const r = parseDecimal(m[2]);
      assert.equal(acc.n * r.d, r.n * acc.d, `${m[0]} in: ${all}`);
    }
    const last = steps.at(-1).say;
    const a = p.answer;
    const shown = a.type === 'decimal' ? a.value : a.type === 'choice' ? a.options[a.correct] : a.type === 'fraction' ? `${a.value.n}/${a.value.d}` : String(a.value);
    assert.ok(last.replace(/−/g, '-').includes(shown), `${toText(p.expression)}: "${last}" should include ${shown}`);
  }
});

test('the column picture: points lined up, answer row reads the answer', () => {
  for (const id of ['dec.add-sub.line-up', 'dec.add-sub.whole-numbers']) for (const d of DIFFICULTIES) for (let i = 0; i < 150; i++) {
    const p = generateProblem(id, `sc-${i}`, d);
    const col = solve(p).filter((s) => s.show?.type === 'column').at(-1).show;
    const layout = columnLayout(col.op, col.top, col.bottom, Infinity, { places: col.places });
    const digits = layout.columns.map((c) => c.result ?? '').reverse().join('');
    const read = fromScaled(Number(digits), col.places);
    assert.ok(sameDecimal(read, p.answer.value), `${toText(p.expression)}: column reads ${read}, answer ${p.answer.value}`);
    // The top and bottom shown are the problem's numbers.
    const [x, y] = toText(p.expression).split(/ [+-] /);
    assert.ok(sameDecimal(fromScaled(col.top, col.places), x) && sameDecimal(fromScaled(col.bottom, col.places), y), toText(p.expression));
    assert.equal(value(p.answer.value) >= 0, true);
  }
});

test('column layout for decimals: 0.35 shows its 0; filled-in zeros are marked', () => {
  const l = columnLayout('+', 350, 125, Infinity, { places: 2, topPlaces: 1, bottomPlaces: 2 }); // 3.5 + 1.25
  assert.deepEqual(l.columns.map((c) => c.result).reverse(), [4, 7, 5]);
  assert.equal(l.columns[0].topPadded, true);
  assert.equal(l.columns[0].bottomPadded, undefined);
  const small = columnLayout('-', 100, 91, Infinity, { places: 2 }); // 1.00 - 0.91 = 0.09
  assert.deepEqual(small.columns.map((c) => c.result).reverse(), [0, 0, 9]);
});
