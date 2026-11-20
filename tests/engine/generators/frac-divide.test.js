// Divide fractions: answers worked out here independently; each part tests what it says it does.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateProblem, DIFFICULTIES } from '../../../engine/generators/index.js';
import { checkAnswer } from '../../../engine/grading/check-answer.js';

const SEEDS = Array.from({ length: 300 }, (_, i) => `div-${i}`);
const catalog = new Set(JSON.parse(readFileSync(new URL('../../../curriculum/misconceptions/frac.json', import.meta.url), 'utf8')).misconceptions.map((m) => m.id));
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const val = (x) => (x.type === 'int' ? [x.value, 1] : [x.n, x.d]);
const IDS = ['frac.divide', 'frac.divide.meaning', 'frac.divide.reciprocal', 'frac.divide.multiply-reciprocal'];
const typed = (n, d) => (d === 1 ? { whole: n } : { num: n, den: d });

// The raw answer (before simplifying), from the expression alone: x ÷ y = x × (1/y); a reciprocal is 1 ÷ x.
function quotient(e) {
  if (e.type !== 'op') { const [a, b] = val(e); return [b, a]; }
  assert.equal(e.op, '÷');
  const [a, b] = val(e.left);
  const [c, d] = val(e.right);
  return [a * d, b * c];
}

for (const id of IDS) {
  test(`${id}: the answer is right and simplest; shown fractions are simplest; mistakes are real and wrong`, () => {
    for (const diff of DIFFICULTIES) for (const seed of SEEDS) {
      const p = generateProblem(id, seed, diff);
      const parts = p.expression.type === 'op' ? [p.expression.left, p.expression.right] : [p.expression];
      for (const side of parts) if (side.type === 'frac') { assert.equal(gcd(side.n, side.d), 1); assert.ok(side.d <= 12); }
      const [n, d] = quotient(p.expression);
      const g = gcd(n, d);
      assert.ok(n / g <= 60 && d / g <= 60, `${id}: ${n / g}/${d / g} is too big`);
      assert.equal(checkAnswer(p, typed(n / g, d / g)).status, 'correct', JSON.stringify(p.expression));
      for (const m of p.misconceptions) {
        assert.ok(catalog.has(m.id), m.id);
        const r = checkAnswer(p, typed(m.value.n, m.value.d));
        assert.equal(r.status, 'wrong');
        assert.equal(r.misconception, m.id);
      }
    }
  });
}

test('meaning always has a whole-number answer; multiply-reciprocal never needs simplifying; the whole skill does at level 2', () => {
  for (const diff of DIFFICULTIES) for (const seed of SEEDS) {
    const [n, d] = quotient(generateProblem('frac.divide.meaning', seed, diff).expression);
    assert.equal(n % d, 0);
    const [n2, d2] = quotient(generateProblem('frac.divide.multiply-reciprocal', seed, diff).expression);
    assert.equal(gcd(n2, d2), 1);
  }
  for (const seed of SEEDS) {
    const [n, d] = quotient(generateProblem('frac.divide', seed, 2).expression);
    assert.ok(gcd(n, d) > 1);
  }
});

test('the classic mistakes are recognised: multiplying without flipping, flipping the wrong one, writing the same number back', () => {
  const seen = new Set();
  for (const seed of SEEDS) for (const id of IDS) for (const d of DIFFICULTIES) {
    for (const m of generateProblem(id, seed, d).misconceptions) seen.add(m.id);
  }
  for (const id of ['frac.div-no-flip', 'frac.div-flip-first', 'frac.div-meaning-multiplied', 'frac.recip-same']) assert.ok(seen.has(id), id);
});

test('a reciprocal written as a mixed number gets the "use an improper fraction" hint, not marked wrong', () => {
  const p = generateProblem('frac.divide.reciprocal', 'div-0', 1); // a proper fraction: its reciprocal is bigger than 1
  const [n, d] = quotient(p.expression);
  assert.equal(checkAnswer(p, { whole: Math.floor(n / d), num: n % d, den: d }).status, 'wrong-form');
});
