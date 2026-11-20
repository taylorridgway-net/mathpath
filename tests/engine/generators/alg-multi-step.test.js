// Multi-step equations: every answer, put back into the equation as shown, makes both
// sides equal (exact fractions); every mistake is wrong, recognised, and in the catalog;
// the worked solution ends with the answer and its check really balances.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateProblem, DIFFICULTIES } from '../../../engine/generators/index.js';
import { checkAnswer } from '../../../engine/grading/check-answer.js';
import { solve } from '../../../engine/solutions/index.js';
import { toText } from '../../../engine/problem/text.js';
import { fraction, add, sub, mul, equals, reduce } from '../../../engine/math/fraction.js';

const IDS = ['alg.multi-step', 'alg.multi-step.both-sides', 'alg.multi-step.distribute'];
const SEEDS = Array.from({ length: 250 }, (_, i) => `ms-${i}`);
const catalog = new Map(JSON.parse(readFileSync(new URL('../../../curriculum/misconceptions/alg.json', import.meta.url), 'utf8')).misconceptions.map((m) => [m.id, m.pointsTo]));
const F = (n, d = 1) => fraction(n, d);

// Evaluate one side at x = v, straight from the expression tree.
function at(node, v) {
  switch (node.type) {
    case 'int': return F(node.value);
    case 'var': return v;
    case 'term': return mul(F(node.coef), v);
    case 'scaled': return mul(F(node.coef), at(node.of, v));
    case 'op': return node.op === '+' ? add(at(node.left, v), at(node.right, v)) : sub(at(node.left, v), at(node.right, v));
    default: throw new Error(node.type);
  }
}
const typed = (f) => { const r = reduce(f); return r.d === 1 ? { whole: Math.abs(r.n), ...(r.n < 0 ? { negative: true } : {}) } : { num: Math.abs(r.n), den: r.d, ...(r.n < 0 ? { negative: true } : {}) }; };

for (const id of IDS) {
  test(`${id}: the answer balances the equation; mistakes are wrong, recognised and point to multi-step`, () => {
    for (const d of DIFFICULTIES) for (const seed of SEEDS) {
      const p = generateProblem(id, seed, d);
      const v = p.answer.value;
      const e = p.expression;
      assert.ok(equals(at(e.left, v), at(e.right, v)), `${toText(e)} with x = ${v.n}/${v.d}`);
      assert.equal(checkAnswer(p, typed(v)).status, 'correct');
      if (d < 3) assert.equal(v.d, 1, `whole-number answers below level 3: ${toText(e)}`);
      assert.doesNotMatch(toText(e), /\d{4,}/);
      for (const m of p.misconceptions) {
        assert.equal(catalog.get(m.id)?.startsWith('alg.multi-step'), true, m.id);
        const r = checkAnswer(p, typed(m.value));
        assert.equal(r.status, 'wrong', `${toText(e)}: ${m.id}`);
        assert.equal(r.misconception, m.id);
      }
      const steps = solve(p);
      const last = steps.at(-1).say;
      const r = reduce(v);
      const shown = `${r.n < 0 ? '−' : ''}${Math.abs(r.n)}${r.d === 1 ? '' : `/${r.d}`}`;
      assert.ok(last.endsWith(`x = ${shown}.`), `${toText(e)}: ${last}`);
      const [, lhs, rhs] = /left side is (\S+) and the right side is (\S+)\./.exec(last);
      assert.equal(lhs, rhs, last);
      assert.doesNotMatch(steps.map((s) => s.say).join(' '), /undefined|NaN/);
    }
  });
}

test('levels: level 1 positive; distributing puts parentheses in; level 3 has fraction answers', () => {
  for (const seed of SEEDS) {
    assert.ok(generateProblem('alg.multi-step.both-sides', seed, 1).answer.value.n > 0);
    assert.match(toText(generateProblem('alg.multi-step.distribute', seed, 1).expression), /\(/);
    assert.match(toText(generateProblem('alg.multi-step', seed, 2).expression), /\(.*=.*x/);
  }
  assert.ok(SEEDS.some((s) => generateProblem('alg.multi-step', s, 3).answer.value.d > 1));
});

test('every multi-step mistake in the catalog is generated', () => {
  const seen = new Set();
  for (const seed of SEEDS) for (const id of IDS) for (const d of DIFFICULTIES) for (const m of generateProblem(id, seed, d).misconceptions) seen.add(m.id);
  assert.deepEqual([...seen].sort(), [...catalog].filter(([, to]) => to.startsWith('alg.multi-step')).map(([k]) => k).sort());
});
