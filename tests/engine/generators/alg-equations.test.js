// Equations: the answer is checked by putting it back into the equation (exact fractions).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateProblem, DIFFICULTIES } from '../../../engine/generators/index.js';
import { checkAnswer } from '../../../engine/grading/check-answer.js';
import { toText } from '../../../engine/problem/text.js';
import { fraction, add, sub, mul, div, equals, reduce } from '../../../engine/math/fraction.js';

const SEEDS = Array.from({ length: 300 }, (_, i) => `eq-${i}`);
const catalog = new Map(JSON.parse(readFileSync(new URL('../../../curriculum/misconceptions/alg.json', import.meta.url), 'utf8')).misconceptions.map((m) => [m.id, m.pointsTo]));
const IDS = ['alg.equations', 'alg.equations.add-sub', 'alg.equations.mult-div', 'alg.equations.two-step'];
const typed = (f) => ({ ...(f.d === 1 ? { whole: Math.abs(f.n) } : { num: Math.abs(f.n), den: f.d }), ...(f.n < 0 ? { negative: true } : {}) });

// Value of one side with x = v.
function side(node, v) {
  switch (node.type) {
    case 'int': return fraction(node.value);
    case 'frac': return node.n.type === 'var' ? div(v, fraction(node.d)) : fraction(node.n, node.d);
    case 'neg': return mul(side(node.of, v), fraction(-1));
    case 'var': return v;
    case 'term': return mul(typeof node.coef === 'number' ? fraction(node.coef) : fraction(node.coef.n, node.coef.d), v);
    case 'op': return { '+': add, '-': sub }[node.op](side(node.left, v), side(node.right, v));
    default: throw new Error(node.type);
  }
}
const solves = (e, v) => equals(side(e.left, v), side(e.right, v));

for (const id of IDS) {
  test(`${id}: the answer makes the equation true; mistakes don't; each points to this skill's part`, () => {
    for (const d of DIFFICULTIES) for (const seed of SEEDS) {
      const p = generateProblem(id, seed, d);
      const v = reduce(p.answer.value);
      assert.ok(solves(p.expression, v), `${toText(p.expression)} with x = ${v.n}/${v.d}`);
      assert.equal(checkAnswer(p, typed(v)).status, 'correct');
      for (const m of p.misconceptions) {
        assert.ok(catalog.get(m.id)?.startsWith('alg.equations.'), m.id);
        assert.ok(!solves(p.expression, m.value), `${m.id} would be right`);
        const r = checkAnswer(p, typed(m.value));
        assert.equal(r.status, 'wrong');
        assert.equal(r.misconception, m.id);
      }
    }
  });
}

test('levels: whole numbers first, negatives next, fractions at the hardest level (owner decision)', () => {
  for (const seed of SEEDS) {
    for (const part of ['alg.equations.add-sub', 'alg.equations.mult-div', 'alg.equations.two-step']) {
      const t1 = toText(generateProblem(part, seed, 1).expression);
      assert.ok(!t1.includes('-') || part.endsWith('add-sub'), `${part} level 1: ${t1}`);
      assert.ok(generateProblem(part, seed, 1).answer.value.d === 1, `${part} level 1 has a whole-number answer`);
    }
  }
  const hasFraction = (part) => SEEDS.some((s) => { const p = generateProblem(part, s, 3); return toText(p.expression).includes('/') || p.answer.value.d !== 1; });
  for (const part of ['alg.equations.add-sub', 'alg.equations.mult-div', 'alg.equations.two-step']) assert.ok(hasFraction(part), part);
  const seen = new Set();
  for (const seed of SEEDS) for (const id of IDS) for (const d of DIFFICULTIES) for (const m of generateProblem(id, seed, d).misconceptions) seen.add(m.id);
  for (const [mid, to] of catalog) if (to.startsWith('alg.equations.')) assert.ok(seen.has(mid), mid);
});
