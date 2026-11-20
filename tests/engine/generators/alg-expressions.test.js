// Simplify expressions: the answer ax + b must agree with the shown expression at
// several values of x (worked out with JavaScript's own arithmetic on the text).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateProblem, DIFFICULTIES } from '../../../engine/generators/index.js';
import { checkAnswer } from '../../../engine/grading/check-answer.js';
import { toText } from '../../../engine/problem/text.js';
import { keypadOptionsFor } from '../../../web/components/keypad.js';

const SEEDS = Array.from({ length: 300 }, (_, i) => `ex-${i}`);
const catalog = new Map(JSON.parse(readFileSync(new URL('../../../curriculum/misconceptions/alg.json', import.meta.url), 'utf8')).misconceptions.map((m) => [m.id, m.pointsTo]));
const IDS = ['alg.expressions', 'alg.expressions.like-terms', 'alg.expressions.distribute'];

// "3(x + 4) - 2x" at x = v: write the implied multiplications out, then let JavaScript work it out.
function at(text, v) {
  const js = text
    .replace(/(\d)x/g, '$1*x').replace(/(\d)\(/g, '$1*(').replace(/-\(/g, '-1*(')
    .replace(/x/g, `(${v})`);
  return Function(`"use strict"; return (${js});`)();
}

for (const id of IDS) {
  test(`${id}: ax + b matches the expression for every x; mistakes don't, and point to this skill`, () => {
    for (const d of DIFFICULTIES) for (const seed of SEEDS) {
      const p = generateProblem(id, seed, d);
      const text = toText(p.expression);
      const { coef: a, constant: b } = p.answer;
      for (const v of [0, 1, 2, 5]) assert.equal(at(text, v) + 0, a * v + b + 0, `${text} at x = ${v}`);
      assert.ok(a !== 0 && b !== 0, 'both boxes have something in them');
      assert.equal(checkAnswer(p, { coef: a, constant: b }).status, 'correct');
      assert.equal(keypadOptionsFor(p).answerKind, 'linear');
      for (const m of p.misconceptions) {
        const part = (p.part || id);
        assert.ok(catalog.get(m.id) === part || catalog.get(m.id)?.startsWith(`${part}.`), `${m.id} -> ${catalog.get(m.id)} (${part})`);
        const r = checkAnswer(p, { coef: m.value.coef, constant: m.value.constant });
        assert.equal(r.status, 'wrong');
        assert.equal(r.misconception, m.id);
      }
    }
  });
}

test('the classic mistakes are all generated; a half-typed answer isn\'t graded', () => {
  const seen = new Set();
  for (const seed of SEEDS) for (const id of IDS) for (const d of DIFFICULTIES) for (const m of generateProblem(id, seed, d).misconceptions) seen.add(m.id);
  for (const [mid, to] of catalog) if (to.startsWith('alg.expressions')) assert.ok(seen.has(mid), mid);
  const p = generateProblem('alg.expressions.distribute', 'ex-1', 1);
  assert.equal(checkAnswer(p, { coef: 3 }).status, 'invalid');
});

test('the independent evaluator agrees with hand-worked examples', () => {
  assert.equal(at('3(x + 4)', 2), 18);
  assert.equal(at('-2(x - 5)', 1), 8);
  assert.equal(at('12 - (x + 3)', 1), 8);
  assert.equal(at('5x - 7 - 2x + 3', 2), 2);
});
