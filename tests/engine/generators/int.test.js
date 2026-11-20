// Integers: answers worked out here by evaluating the expression; mistakes are real, wrong, and recognised.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateProblem, DIFFICULTIES } from '../../../engine/generators/index.js';
import { checkAnswer } from '../../../engine/grading/check-answer.js';
import { keypadOptionsFor } from '../../../web/components/keypad.js';

const SEEDS = Array.from({ length: 300 }, (_, i) => `int-${i}`);
const catalog = new Map(JSON.parse(readFileSync(new URL('../../../curriculum/misconceptions/int.json', import.meta.url), 'utf8')).misconceptions.map((m) => [m.id, m.pointsTo]));
const IDS = ['int.add-sub', 'int.add-sub.same-sign', 'int.add-sub.different-signs', 'int.add-sub.subtract', 'int.mult-div', 'int.mult-div.multiply', 'int.mult-div.divide'];
const typed = (v) => ({ whole: Math.abs(v), ...(v < 0 ? { negative: true } : {}) });

function evaluate(e) {
  if (e.type === 'int') return e.value;
  const [l, r] = [evaluate(e.left), evaluate(e.right)];
  return { '+': l + r, '-': l - r, '×': l * r, '÷': l / r }[e.op];
}
const numbers = (e) => (e.type === 'int' ? [e.value] : [...numbers(e.left), ...numbers(e.right)]);

for (const id of IDS) {
  test(`${id}: the answer is the value of the expression; a negative number is involved; mistakes point to this skill`, () => {
    for (const d of DIFFICULTIES) for (const seed of SEEDS) {
      const p = generateProblem(id, seed, d);
      const value = evaluate(p.expression);
      assert.ok(Number.isInteger(value), JSON.stringify(p.expression));
      assert.equal(checkAnswer(p, typed(value)).status, 'correct');
      assert.ok(numbers(p.expression).some((n) => n < 0) || value < 0, 'something negative');
      assert.equal(keypadOptionsFor(p).allowNegative, true);
      for (const m of p.misconceptions) {
        const skill = (p.part || id).split('.').slice(0, 2).join('.');
        assert.ok(catalog.get(m.id)?.startsWith(skill), `${m.id} -> ${catalog.get(m.id)}`);
        const r = checkAnswer(p, typed(m.value));
        assert.equal(r.status, 'wrong');
        assert.equal(r.misconception, m.id);
      }
    }
  });
}

test('the classic mistakes are all generated: -3 + -5 = 8, 3 - 8 = 5, 4 - (-6) = -2, -6 × -7 = -42', () => {
  const seen = new Set();
  for (const seed of SEEDS) for (const id of IDS) for (const d of DIFFICULTIES) for (const m of generateProblem(id, seed, d).misconceptions) seen.add(m.id);
  assert.deepEqual([...seen].sort(), [...catalog.keys()].sort());
});

test('levels: subtracting starts with smaller minus bigger, then minus a negative; dividing at level 3 has two negatives', () => {
  for (const seed of SEEDS) {
    const [a, b] = numbers(generateProblem('int.add-sub.subtract', seed, 1).expression);
    assert.ok(a > 0 && b > a);
    assert.ok(numbers(generateProblem('int.add-sub.subtract', seed, 2).expression)[1] < 0);
    assert.ok(numbers(generateProblem('int.mult-div.divide', seed, 3).expression).every((n) => n < 0));
  }
});

test('a negative answer typed without the minus sign is wrong (and called a sign mistake where that fits)', () => {
  const p = generateProblem('int.mult-div.multiply', 'int-1', 1); // one negative: the product is negative
  const value = evaluate(p.expression);
  assert.ok(value < 0);
  const r = checkAnswer(p, { whole: -value });
  assert.equal(r.status, 'wrong');
  assert.equal(r.misconception, 'int.mult-sign');
});
