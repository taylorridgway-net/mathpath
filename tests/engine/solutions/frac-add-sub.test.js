// Worked solutions must be correct math, every step, for every kind of problem.
// Every equation shown is checked with independent arithmetic, and the last
// step must equal the problem's answer.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateProblem, DIFFICULTIES } from '../../../engine/generators/index.js';
import { solveAddSub } from '../../../engine/solutions/frac-add-sub.js';
import { toText } from '../../../engine/problem/text.js';

const IDS = ['frac.add-sub', 'frac.add-sub.common-denom', 'frac.add-sub.rewrite', 'frac.add-sub.combine', 'frac.add-sub.simplify-result'];
const SEEDS = Array.from({ length: 200 }, (_, i) => `sol-${i}`);

// Independent evaluator: [numerator, denominator].
function value(node) {
  switch (node.type) {
    case 'int': return [node.value, 1];
    case 'frac': return [node.n, node.d];
    case 'op': {
      const [a, b] = value(node.left);
      const [c, d] = value(node.right);
      if (node.op === '+') return [a * d + c * b, b * d];
      if (node.op === '-') return [a * d - c * b, b * d];
      if (node.op === '×') return [a * c, b * d];
      throw new Error(`unknown op ${node.op}`);
    }
    default: throw new Error(`can't evaluate ${node.type}`);
  }
}
const same = ([a, b], [c, d]) => a * d === c * b;

function checkEquations(node, where) {
  if (node.type === 'eq') assert.ok(same(value(node.left), value(node.right)), `${where}: false step ${toText(node)}`);
  for (const item of node.items || []) checkEquations(item, where);
}

for (const id of IDS) {
  test(`${id}: every step is true and the last step is the answer`, () => {
    for (const difficulty of DIFFICULTIES) for (const seed of SEEDS) {
      const p = generateProblem(id, seed, difficulty);
      const where = `${id} d${difficulty} ${toText(p.expression)}`;
      const steps = solveAddSub(p);
      assert.ok(steps.length >= 1, where);
      for (const s of steps) {
        assert.equal(typeof s.say, 'string');
        assert.ok(!/undefined|NaN|null/.test(s.say), `${where}: bad text "${s.say}"`);
        if (s.show) checkEquations(s.show, where);
      }
      // The final shown value is the answer.
      const last = steps.at(-1).show;
      const final = last.type === 'eq' ? last.right : last;
      if (p.answer.type === 'fraction') {
        assert.ok(same(value(final), [p.answer.value.n, p.answer.value.d]), `${where}: ends at ${toText(final)}`);
        const [n, d] = value(final);
        assert.equal(Math.abs(gcdOf(n, d)), 1, `${where}: final answer not simplest`);
      } else if (p.answer.type === 'integer') {
        // Rewrite problems end with "a/b = ?/D" filled in: the numerator is the answer.
        assert.equal(final.n, p.answer.value, where);
      } else {
        assert.equal(final.value, p.answer.least, where);
      }
    }
  });
}

function gcdOf(a, b) {
  return b === 0 ? a : gcdOf(b, a % b);
}

test('rewrite: the final step shows the missing numerator', () => {
  const p = generateProblem('frac.add-sub.rewrite', 'x', 2);
  const last = solveAddSub(p).at(-1).show;
  assert.equal(last.right.n, p.answer.value);
});

test('a readable example', () => {
  const steps = solveAddSub({
    generator: 'frac.add-sub',
    expression: { type: 'op', op: '+', left: { type: 'frac', n: 1, d: 4 }, right: { type: 'frac', n: 1, d: 6 } },
  });
  assert.deepEqual(steps.map((s) => s.say.split('.')[0]), ['Step 1', 'Step 2', 'Step 3', 'Step 4']);
  assert.equal(toText(steps[1].show), '1/4 = 3/12 and 1/6 = 2/12');
  assert.equal(toText(steps[2].show), '3/12 + 2/12 = 5/12');
});
