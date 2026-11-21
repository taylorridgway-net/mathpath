// Evaluating expressions: every answer re-worked by putting the numbers into the
// expression's TEXT and letting JavaScript do the arithmetic (independent of the
// evaluator); mistakes are wrong, recognised and in the catalog; the worked solution
// ends with the answer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateProblem, DIFFICULTIES } from '../../../engine/generators/index.js';
import { checkAnswer } from '../../../engine/grading/check-answer.js';
import { solve } from '../../../engine/solutions/index.js';
import { toText } from '../../../engine/problem/text.js';

const IDS = ['alg.evaluate', 'alg.evaluate.substitute', 'alg.evaluate.negative', 'alg.evaluate.two-letters'];
const SEEDS = Array.from({ length: 250 }, (_, i) => `ev-${i}`);
const catalog = new Map(JSON.parse(readFileSync(new URL('../../../curriculum/misconceptions/alg.json', import.meta.url), 'utf8')).misconceptions.map((m) => [m.id, m.pointsTo]));
const typed = (v) => ({ whole: Math.abs(v), ...(v < 0 ? { negative: true } : {}) });

// "3x^2 - x" with x = -2 -> "3*(-2)**2 - (-2)"; "lw" -> "(l)*(w)".
function plain(text, values) {
  let t = text.includes(' = ') ? text.split(' = ')[1] : text;
  t = t.replace(/(\d)([a-z])/g, '$1*$2').replace(/([a-z])([a-z])/g, '$1*$2').replace(/([a-z])([a-z])/g, '$1*$2');
  t = t.replace(/(\d)\(/g, '$1*(').replace(/\^(\d)/g, '**$1');
  t = t.replace(/[a-z]/g, (k) => `(${values[k]})`);
  t = t.replace(/(^|[^\w)])-\((-?\d+)\)\*\*(\d)/g, '$1-(($2)**$3)'); // -x^2 is -(x^2)
  return Function(`"use strict"; return (${t});`)();
}

for (const id of IDS) {
  test(`${id}: the answer matches plain arithmetic; mistakes are wrong and recognised`, () => {
    for (const d of DIFFICULTIES) for (const seed of SEEDS) {
      const p = generateProblem(id, seed, d);
      const text = toText(p.expression);
      assert.equal(p.answer.value, plain(text, p.values), `${p.instruction} ${text}`);
      assert.equal(checkAnswer(p, typed(p.answer.value)).status, 'correct');
      for (const m of p.misconceptions) {
        assert.ok(catalog.get(m.id)?.startsWith('alg.evaluate'), m.id);
        const r = checkAnswer(p, typed(m.value));
        assert.equal(r.status, 'wrong', `${text}: ${m.id}`);
        assert.equal(r.misconception, m.id);
      }
      const last = solve(p).at(-1).say;
      const v = p.answer.value;
      assert.ok(last.endsWith(`is ${v < 0 ? `−${-v}` : v}.`), `${text}: ${last}`);
    }
  });
}

test('negative-number problems really use a negative; level 3 formulas show the formula', () => {
  for (const seed of SEEDS) {
    assert.ok(generateProblem('alg.evaluate.negative', seed, 2).values.x < 0);
    assert.match(toText(generateProblem('alg.evaluate.two-letters', seed, 3).expression), /^[A-Za-z] = /);
  }
});

test('every evaluating mistake in the catalog is generated', () => {
  const seen = new Set();
  for (const seed of SEEDS) for (const id of IDS) for (const d of DIFFICULTIES) for (const m of generateProblem(id, seed, d).misconceptions) seen.add(m.id);
  assert.deepEqual([...seen].sort(), [...catalog].filter(([, to]) => to.startsWith('alg.evaluate')).map(([k]) => k).sort());
});
