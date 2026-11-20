// Understand fractions: answers worked out here from the picture or division shown.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateProblem, DIFFICULTIES } from '../../../engine/generators/index.js';
import { checkAnswer } from '../../../engine/grading/check-answer.js';

const SEEDS = Array.from({ length: 200 }, (_, i) => `mn-${i}`);
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const catalog = new Set(JSON.parse(readFileSync(new URL('../../../curriculum/misconceptions/frac.json', import.meta.url), 'utf8')).misconceptions.map((m) => m.id));
const each = (id, fn) => { for (const d of DIFFICULTIES) for (const s of SEEDS) fn(generateProblem(id, s, d), d); };
const typed = (n, d) => (d === 1 ? { whole: n } : { num: n, den: d });
const checkPatterns = (p) => {
  for (const m of p.misconceptions) {
    assert.ok(catalog.has(m.id), m.id);
    assert.equal(checkAnswer(p, typed(m.value.n, m.value.d)).misconception, m.id, `${m.id} on ${JSON.stringify(p.expression)}`);
  }
};

test('pictures: shaded parts over all the parts is right; the picture always has one simplest answer', () => {
  each('frac.meaning.read-models', (p, d) => {
    const { parts, shaded, shape, rows, cols } = p.expression;
    assert.ok(shaded >= 1 && shaded < parts && gcd(shaded, parts) === 1);
    if (shape === 'area') assert.equal(rows * cols, parts);
    if (d === 1) assert.equal(shape, 'bar');
    assert.equal(checkAnswer(p, typed(shaded, parts)).status, 'correct');
    checkPatterns(p);
  });
});

test('number line: the dot is at point / parts-per-whole; past 1 at level 3; mixed numbers accepted', () => {
  each('frac.meaning.number-line', (p, d) => {
    const { max, perUnit, point } = p.expression;
    assert.ok(point > 0 && point < max * perUnit && gcd(point, perUnit) === 1);
    if (d === 3) assert.ok(point > perUnit && max > 1, 'past 1');
    assert.equal(checkAnswer(p, typed(point, perUnit)).status, 'correct');
    if (point > perUnit) {
      assert.equal(checkAnswer(p, { whole: Math.floor(point / perUnit), num: point % perUnit, den: perUnit }).status, 'correct');
    }
    checkPatterns(p);
  });
});

test('division: a ÷ b is a/b; a whole-number fraction is the whole number (typing it as a fraction gets the simplify retry)', () => {
  each('frac.meaning.division', (p, d) => {
    if (d === 2) {
      const { n, d: den } = p.expression;
      assert.equal(n % den, 0);
      assert.equal(checkAnswer(p, { whole: n / den }).status, 'correct');
      assert.equal(checkAnswer(p, { num: n, den }).status, den === n ? 'not-simplified' : 'not-simplified');
    } else {
      const a = p.expression.left.value;
      const b = p.expression.right.value;
      assert.equal(gcd(a, b), 1);
      assert.ok(d === 1 ? a < b : a > b);
      assert.equal(checkAnswer(p, typed(a, b)).status, 'correct');
    }
    checkPatterns(p);
  });
});
