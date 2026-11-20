// Equivalent fractions: answers re-computed here from the displayed problem.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateProblem, DIFFICULTIES } from '../../../engine/generators/index.js';
import { checkAnswer } from '../../../engine/grading/check-answer.js';

const SEEDS = Array.from({ length: 200 }, (_, i) => `eq-${i}`);
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const catalog = new Set(JSON.parse(readFileSync(new URL('../../../curriculum/misconceptions/frac.json', import.meta.url), 'utf8')).misconceptions.map((m) => m.id));
const each = (id, fn) => { for (const d of DIFFICULTIES) for (const s of SEEDS) fn(generateProblem(id, s, d), d); };

test('scale: the exact scaled fraction is right; the same value written another way is not', () => {
  each('frac.equivalent.scale', (p) => {
    const { left, right } = p.expression;
    const k = right.n;
    assert.equal(right.d, k);
    const exact = { num: left.n * k, den: left.d * k };
    assert.equal(checkAnswer(p, exact).status, 'correct');
    assert.equal(checkAnswer(p, { num: left.n, den: left.d }).misconception, 'frac.eq-scaled-back');
    assert.equal(checkAnswer(p, { num: left.n * k, den: left.d }).misconception, 'frac.eq-top-only');
    assert.notEqual(checkAnswer(p, { num: left.n * k * 2, den: left.d * k * 2 }).status, 'correct', 'another equivalent fraction isn\'t what was asked');
  });
});

test('missing: the box is filled by multiplying, worked out independently; adding is recognised', () => {
  each('frac.equivalent.missing', (p, d) => {
    const { left, right } = p.expression;
    const want = right.n.type === 'blank' ? (left.n * right.d) / left.d : (left.d * right.n) / left.n;
    assert.ok(Number.isInteger(want), JSON.stringify(p.expression));
    assert.equal(checkAnswer(p, { whole: want }).status, 'correct');
    if (d === 3) assert.ok(gcd(left.n, left.d) > 1, 'level 3 shows a fraction that is not in simplest form');
    for (const m of p.misconceptions) {
      assert.ok(catalog.has(m.id));
      assert.equal(checkAnswer(p, { whole: m.value }).misconception, m.id);
    }
  });
});

test('simplify: always needs simplifying; half-way gets the "simplify" retry; dividing only the top is recognised', () => {
  each('frac.equivalent.simplify', (p) => {
    const { n, d } = p.expression;
    const g = gcd(n, d);
    assert.ok(g > 1 && n < d);
    assert.equal(checkAnswer(p, { num: n / g, den: d / g }).status, 'correct');
    const smallest = [2, 3, 5, 7].find((x) => g % x === 0 && x < g);
    if (smallest) assert.equal(checkAnswer(p, { num: n / smallest, den: d / smallest }).status, 'not-simplified');
    for (const m of p.misconceptions) assert.equal(checkAnswer(p, { num: m.value.n, den: m.value.d }).misconception, m.id);
  });
});

test('every wrong-answer pattern is in the catalog and points into equivalent fractions', () => {
  const all = JSON.parse(readFileSync(new URL('../../../curriculum/misconceptions/frac.json', import.meta.url), 'utf8')).misconceptions;
  for (const id of ['frac.eq-top-only', 'frac.eq-added', 'frac.eq-scaled-back', 'frac.eq-missing-added', 'frac.eq-divided-top-only']) {
    assert.ok(all.find((m) => m.id === id).pointsTo.startsWith('frac.equivalent.'), id);
  }
});
