// Inequalities: the answer (sign and number) is exactly the set of x that make the
// inequality true (checked by trying numbers on both sides of the boundary); mistakes
// are wrong and recognised; the worked solution ends with the answer and its check is true.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateProblem, DIFFICULTIES } from '../../../engine/generators/index.js';
import { checkAnswer } from '../../../engine/grading/check-answer.js';
import { solve } from '../../../engine/solutions/index.js';
import { toText } from '../../../engine/problem/text.js';
import { fraction, add, sub, mul, compare, reduce } from '../../../engine/math/fraction.js';

const IDS = ['alg.inequalities', 'alg.inequalities.solve', 'alg.inequalities.flip'];
const SEEDS = Array.from({ length: 250 }, (_, i) => `iq-${i}`);
const catalog = new Map(JSON.parse(readFileSync(new URL('../../../curriculum/misconceptions/alg.json', import.meta.url), 'utf8')).misconceptions.map((m) => [m.id, m.pointsTo]));
const F = (n, d = 1) => fraction(n, d);
const holds = (l, sign, r) => { const c = compare(l, r); return { '<': c < 0, '≤': c <= 0, '>': c > 0, '≥': c >= 0 }[sign]; };
const at = (node, v) => (node.type === 'int' ? F(node.value) : node.type === 'var' ? v : node.type === 'term' ? mul(F(node.coef), v)
  : node.op === '+' ? add(at(node.left, v), at(node.right, v)) : sub(at(node.left, v), at(node.right, v)));
const typed = (sign, f) => { const r = reduce(f); return { sign, ...(r.d === 1 ? { whole: Math.abs(r.n) } : { num: Math.abs(r.n), den: r.d }), ...(r.n < 0 ? { negative: true } : {}) }; };

for (const id of IDS) {
  test(`${id}: the answer describes exactly the x that work; mistakes are wrong and recognised`, () => {
    for (const d of DIFFICULTIES) for (const seed of SEEDS) {
      const p = generateProblem(id, seed, d);
      const { sign, value } = p.answer;
      const e = p.expression;
      // Try the boundary and numbers just either side: the original and the answer agree on each.
      for (const k of [F(0), F(1, 7), F(-1, 7), F(3), F(-3)]) {
        const v = add(value, k);
        assert.equal(holds(at(e.left, v), e.op, at(e.right, v)), holds(v, sign, value), `${toText(e)} at x = ${v.n}/${v.d}: answer x ${sign} ${value.n}/${value.d}`);
      }
      assert.equal(checkAnswer(p, typed(sign, value)).status, 'correct');
      assert.equal(checkAnswer(p, { whole: 3 }).status, 'invalid', 'no sign: not an answer');
      if (d < 3) assert.equal(value.d, 1);
      for (const m of p.misconceptions) {
        assert.ok(catalog.get(m.id)?.startsWith('alg.inequalities'), m.id);
        const r = checkAnswer(p, typed(m.sign, m.value));
        assert.equal(r.status, 'wrong', `${toText(e)}: ${m.id}`);
        assert.equal(r.misconception, m.id);
      }
      const last = solve(p).at(-1).say;
      assert.ok(last.endsWith(`So x ${sign} ${value.n < 0 ? '−' : ''}${Math.abs(reduce(value).n)}${reduce(value).d === 1 ? '' : `/${reduce(value).d}`}.`), `${toText(e)}: ${last}`);
      assert.match(last, / is true\./, `${toText(e)}: ${last}`);
    }
  });
}

test('flip problems always have a negative in front of x; solve problems never do', () => {
  for (const seed of SEEDS) for (const d of DIFFICULTIES) {
    assert.match(toText(generateProblem('alg.inequalities.flip', seed, d).expression), /^-/);
    assert.doesNotMatch(toText(generateProblem('alg.inequalities.solve', seed, d).expression), /^-/);
  }
});

test('every inequality mistake in the catalog is generated', () => {
  const seen = new Set();
  for (const seed of SEEDS) for (const id of IDS) for (const d of DIFFICULTIES) for (const m of generateProblem(id, seed, d).misconceptions) seen.add(m.id);
  assert.deepEqual([...seen].sort(), [...catalog].filter(([, to]) => to.startsWith('alg.inequalities')).map(([k]) => k).sort());
});

test('grading: an unsimplified fraction gets the simplify retry; the wrong sign is wrong', () => {
  const p = { answer: { type: 'inequality', sign: '>', value: F(3, 2) }, misconceptions: [] };
  assert.equal(checkAnswer(p, { sign: '>', num: 6, den: 4 }).status, 'not-simplified');
  assert.equal(checkAnswer(p, { sign: '≥', num: 3, den: 2 }).status, 'wrong');
  assert.equal(checkAnswer(p, { sign: '>', whole: 1, num: 1, den: 2 }).status, 'correct', 'mixed numbers are fine');
});
