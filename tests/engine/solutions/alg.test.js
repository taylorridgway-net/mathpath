// Worked solutions for order of operations and exponents: every step's arithmetic is right,
// the steps follow the rules' order, and the last step is the answer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateProblem, DIFFICULTIES } from '../../../engine/generators/index.js';
import { solve } from '../../../engine/solutions/index.js';
import { toText } from '../../../engine/problem/text.js';

const IDS = ['alg.order-ops', 'alg.order-ops.no-parens', 'alg.order-ops.parens', 'alg.order-ops.integers', 'alg.exponents', 'alg.exponents.evaluate', 'alg.exponents.negative-base', 'alg.exponents.in-order'];
const num = (t) => Number(t.replace('−', '-').replace(/[()]/g, ''));

test('every step is right arithmetic, in the rules\' order, ending with the answer', () => {
  for (const d of DIFFICULTIES) for (let i = 0; i < 150; i++) for (const id of IDS) {
    const p = generateProblem(id, `sa-${i}`, d);
    const steps = solve(p);
    const v = p.answer.value;
    assert.ok(steps.at(-1).say.endsWith(`is ${v < 0 ? `−${-v}` : v}.`), `${toText(p.expression)}: ${steps.at(-1).say}`);
    let lastRank = 0;
    const rank = { 'Inside the parentheses first': 0, 'Powers next': 1, 'Multiply and divide, left to right': 2, 'Add and subtract, left to right': 3 };
    for (const s of steps.slice(0, -1)) {
      const m = /^(Inside the parentheses first|Multiply and divide, left to right|Add and subtract, left to right): (\(?−?\d+\)?) ([+−×÷]) (\(?−?\d+\)?) = (−?\d+)\./.exec(s.say);
      if (m) {
        const [a, b, r] = [num(m[2]), num(m[4]), num(m[5])];
        assert.equal({ '+': a + b, '−': a - b, '×': a * b, '÷': a / b }[m[3]], r, s.say);
      }
      const rule = Object.keys(rank).find((k) => s.say.startsWith(k));
      // Outside parentheses, the rules never go back to an earlier kind of step.
      if (rule && rule !== 'Inside the parentheses first') {
        assert.ok(rank[rule] >= lastRank, `${toText(p.expression)}: ${steps.map((x) => x.say).join(' / ')}`);
        lastRank = rank[rule];
      }
      assert.ok(!/undefined|NaN|\(\d+\)[^²³⁴⁵⁶⁷⁸⁹⁰¹]/.test(s.say), s.say);
    }
  }
});
