// Order of operations and exponents: answers worked out here with a separate,
// plain evaluator (the expression's text, read with JavaScript's own arithmetic).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateProblem, DIFFICULTIES } from '../../../engine/generators/index.js';
import { checkAnswer } from '../../../engine/grading/check-answer.js';
import { toText } from '../../../engine/problem/text.js';
import { keypadOptionsFor } from '../../../web/components/keypad.js';

const SEEDS = Array.from({ length: 300 }, (_, i) => `alg-${i}`);
const catalog = new Map(JSON.parse(readFileSync(new URL('../../../curriculum/misconceptions/alg.json', import.meta.url), 'utf8')).misconceptions.map((m) => [m.id, m.pointsTo]));
const IDS = ['alg.order-ops', 'alg.order-ops.no-parens', 'alg.order-ops.parens', 'alg.order-ops.integers', 'alg.exponents', 'alg.exponents.evaluate', 'alg.exponents.negative-base', 'alg.exponents.in-order'];
const typed = (v) => ({ whole: Math.abs(v), ...(v < 0 ? { negative: true } : {}) });

// Independent check: turn the text into JavaScript and let it do the arithmetic.
// "-3^2" in maths is -(3^2); JavaScript refuses "-3 ** 2", so write it as -(3 ** 2).
function plain(text) {
  const js = text.replace(/×/g, '*').replace(/÷/g, '/')
    .replace(/(^|[^\d)])-(\d+)\^(\d+)/g, '$1-($2 ** $3)')
    .replace(/(\(-?\d+\)|\d+|\))\^(\d+)/g, '$1 ** $2');
  return Function(`"use strict"; return (${js});`)();
}

for (const id of IDS) {
  test(`${id}: the answer matches plain arithmetic on the shown expression; mistakes are real, wrong and recognised`, () => {
    for (const d of DIFFICULTIES) for (const seed of SEEDS) {
      const p = generateProblem(id, seed, d);
      const text = toText(p.expression);
      const want = plain(text);
      assert.ok(Number.isInteger(want), `${text} = ${want}`);
      assert.equal(p.answer.value, want, text);
      assert.equal(checkAnswer(p, typed(want)).status, 'correct');
      assert.equal(keypadOptionsFor(p).allowNegative, true);
      for (const m of p.misconceptions) {
        assert.ok(catalog.get(m.id)?.startsWith(`${(p.part || id).split('.').slice(0, 2).join('.')}.`), `${m.id} -> ${catalog.get(m.id)}`);
        const r = checkAnswer(p, typed(m.value));
        assert.equal(r.status, 'wrong', `${text}: ${m.id} ${m.value}`);
        assert.equal(r.misconception, m.id);
      }
    }
  });
}

test('every wrong-answer pattern in the catalog is generated somewhere', () => {
  const seen = new Set();
  for (const seed of SEEDS) for (const id of IDS) for (const d of DIFFICULTIES) for (const m of generateProblem(id, seed, d).misconceptions) seen.add(m.id);
  assert.deepEqual([...seen].sort(), [...catalog].filter(([, to]) => /^alg\.(order-ops|exponents)\./.test(to)).map(([k]) => k).sort());
});

test('what each part is about: whole-number answers without negatives; parentheses where promised; powers with whole exponents', () => {
  for (const seed of SEEDS) for (const d of DIFFICULTIES) {
    const np = generateProblem('alg.order-ops.no-parens', seed, d);
    assert.ok(!toText(np.expression).includes('(') && np.answer.value >= 0);
    assert.ok(toText(generateProblem('alg.order-ops.parens', seed, d).expression).includes('('));
    assert.ok(toText(generateProblem('alg.order-ops.integers', seed, d).expression).includes('-'));
    const ev = generateProblem('alg.exponents.evaluate', seed, d).expression;
    assert.ok(Number.isInteger(ev.exp) && ev.exp >= 0);
  }
  // −3² and (−3)² both appear, with opposite signs.
  const texts = SEEDS.map((s) => toText(generateProblem('alg.exponents.negative-base', s, 3).expression));
  assert.ok(texts.some((t) => t.startsWith('(-')) && texts.some((t) => /^-\d/.test(t)));
});

test('the independent evaluator agrees with hand-worked examples', () => {
  assert.equal(plain('2 + 3 × 4'), 14);
  assert.equal(plain('-3^2'), -9);
  assert.equal(plain('(-3)^2'), 9);
  assert.equal(plain('6 - 12 ÷ (-6)'), 8);
  assert.equal(plain('(2 + 3)^2'), 25);
  assert.equal(plain('5 × 2^2 - 3'), 17);
});
