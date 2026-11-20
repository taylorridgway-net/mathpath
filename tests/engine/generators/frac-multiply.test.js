// Multiply fractions: answers worked out here independently; each part tests what it says it does.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateProblem, DIFFICULTIES } from '../../../engine/generators/index.js';
import { checkAnswer } from '../../../engine/grading/check-answer.js';

const SEEDS = Array.from({ length: 300 }, (_, i) => `mul-${i}`);
const catalog = new Set(JSON.parse(readFileSync(new URL('../../../curriculum/misconceptions/frac.json', import.meta.url), 'utf8')).misconceptions.map((m) => m.id));
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const val = (x) => (x.type === 'int' ? [x.value, 1] : [x.n, x.d]);
const IDS = ['frac.multiply', 'frac.multiply.by-whole', 'frac.multiply.by-fraction', 'frac.multiply.simplify'];

// The raw product (before simplifying), from the expression alone.
function product(e) {
  assert.ok(['×', 'of'].includes(e.op));
  const [a, b] = val(e.left);
  const [c, d] = val(e.right);
  return [a * c, b * d];
}
const typed = (n, d) => (d === 1 ? { whole: n } : { num: n, den: d });

for (const id of IDS) {
  test(`${id}: the answer is the product in simplest form; shown fractions are simplest; mistakes are real and wrong`, () => {
    for (const diff of DIFFICULTIES) for (const seed of SEEDS) {
      const p = generateProblem(id, seed, diff);
      for (const side of [p.expression.left, p.expression.right]) {
        if (side.type === 'frac') { assert.equal(gcd(side.n, side.d), 1); assert.ok(side.d <= 12); }
      }
      const [n, d] = product(p.expression);
      const g = gcd(n, d);
      assert.equal(checkAnswer(p, typed(n / g, d / g)).status, 'correct', JSON.stringify(p.expression));
      if (g > 1) assert.equal(checkAnswer(p, { num: n, den: d }).status, 'not-simplified');
      for (const m of p.misconceptions) {
        assert.ok(catalog.has(m.id), m.id);
        const r = checkAnswer(p, typed(m.value.n, m.value.d));
        assert.equal(r.status, 'wrong');
        assert.equal(r.misconception, m.id);
      }
    }
  });
}

test('by-fraction and by-whole never need simplifying; simplify always does', () => {
  for (const diff of DIFFICULTIES) for (const seed of SEEDS) {
    for (const id of ['frac.multiply.by-fraction', 'frac.multiply.by-whole']) {
      const [n, d] = product(generateProblem(id, seed, diff).expression);
      assert.ok(gcd(n, d) === 1 || n % d === 0, `${id} ${n}/${d}`); // "2/3 of 12" = 24/3 is a whole number
    }
    const [n, d] = product(generateProblem('frac.multiply.simplify', seed, diff).expression);
    assert.ok(gcd(n, d) > 1);
  }
});

test('levels: by-whole goes from less than 1, to more than 1, to a fraction of an amount', () => {
  for (const seed of SEEDS) {
    const [n1, d1] = product(generateProblem('frac.multiply.by-whole', seed, 1).expression);
    assert.ok(n1 < d1);
    const [n2, d2] = product(generateProblem('frac.multiply.by-whole', seed, 2).expression);
    assert.ok(n2 > d2);
    const p3 = generateProblem('frac.multiply.by-whole', seed, 3);
    assert.equal(p3.expression.op, 'of');
    const [n3, d3] = product(p3.expression);
    assert.equal(n3 % d3, 0);
  }
});

test('the classic mistakes are recognised: 2/5 × 3/5 = 6/5, and 2/3 of 12 = 4', () => {
  const seen = new Set();
  for (const seed of SEEDS) for (const id of IDS) for (const d of DIFFICULTIES) {
    for (const m of generateProblem(id, seed, d).misconceptions) seen.add(m.id);
  }
  for (const id of ['frac.mult-keep-denominator', 'frac.mult-cross', 'frac.mult-added', 'frac.mult-whole-both', 'frac.mult-whole-bottom', 'frac.of-divide-only']) assert.ok(seen.has(id), id);
});
