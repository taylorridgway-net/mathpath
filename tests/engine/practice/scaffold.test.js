// One box per step ("Putting it together", guided). Answers are worked out here
// from the displayed problem, independently of the scaffold's own answers.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startScaffold, replayScaffold } from '../../../engine/practice/scaffold.js';
import { generateProblem } from '../../../engine/generators/index.js';

const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const lcm = (a, b) => (a * b) / gcd(a, b);

// Every whole problem over many seeds and all difficulties.
function* problems() {
  for (const d of [1, 2, 3]) for (let i = 0; i < 150; i++) yield generateProblem('frac.add-sub', `sc${i}`, d);
}

function solveByHand(problem, chosen) {
  const { left: x, right: y, op } = problem.expression;
  const L = chosen ?? lcm(x.d, y.d);
  const a = (x.n * L) / x.d;
  const c = (y.n * L) / y.d;
  return { L, a, c, n: op === '+' ? a + c : a - c };
}

test('a student who does each step right reaches the final step with the right fraction', () => {
  for (const p of problems()) {
    const { L, a, c, n } = solveByHand(p);
    const s = startScaffold(p);
    for (const v of [L, a, c, n]) assert.equal(s.submit({ whole: v }).status, 'correct', JSON.stringify(p.expression));
    const fin = s.current();
    assert.equal(fin.id, 'final');
    assert.deepEqual(fin.expression.left, { type: 'frac', n, d: L });
    assert.equal(s.record().length, 4);
    assert.ok(s.record().every((r) => !r.revealed));
  }
});

test('later steps use the student\'s own common denominator (the product, not the least)', () => {
  const p = generateProblem('frac.add-sub', 'big', 3); // shared factor: product > least
  const { left: x, right: y } = p.expression;
  const product = x.d * y.d;
  assert.notEqual(product, lcm(x.d, y.d));
  const { a, c, n } = solveByHand(p, product);
  const s = startScaffold(p);
  assert.deepEqual(s.submit({ whole: product }), { status: 'correct', retry: false, note: 'not-least' });
  for (const v of [a, c, n]) assert.equal(s.submit({ whole: v }).status, 'correct');
  assert.deepEqual(s.current().expression.left, { type: 'frac', n, d: product });
});

test('adding the denominators: that misconception\'s message and a retry', () => {
  const p = generateProblem('frac.add-sub', 'm1', 2); // denominators share no factor, so b + d is never common
  const { left: x, right: y } = p.expression;
  const s = startScaffold(p);
  const r = s.submit({ whole: x.d + y.d });
  assert.deepEqual(r, { status: 'wrong', retry: true, feedback: { kind: 'misconception', id: 'frac.add-denominators' } });
  assert.equal(s.current().id, 'common-denom');
});

test('additive scaling in a rewrite step is recognised', () => {
  const p = generateProblem('frac.add-sub', 'm2', 2);
  const { L } = solveByHand(p);
  const { left: x } = p.expression;
  const s = startScaffold(p);
  s.submit({ whole: L });
  const r = s.submit({ whole: x.n + (L - x.d) });
  assert.equal(r.feedback?.id, 'frac.additive-scaling');
});

test('wrong with no pattern: a hint for that step', () => {
  const p = generateProblem('frac.add-sub', 'h', 2);
  const { L } = solveByHand(p);
  const s = startScaffold(p);
  s.submit({ whole: L });
  s.submit({ whole: solveByHand(p).a });
  s.submit({ whole: solveByHand(p).c });
  const r = s.submit({ whole: 999 });
  assert.deepEqual(r.feedback, { kind: 'hint', step: 'combine' });
});

test('wrong twice or "not sure": the step is filled in (least common denominator) and the student goes on', () => {
  const p = generateProblem('frac.add-sub', 'r', 3);
  const { L, a } = solveByHand(p);
  const s = startScaffold(p);
  assert.equal(s.submit({}).revealed, L, 'blank reveals straight away');
  assert.equal(s.current().id, 'rewrite-1');
  s.submit({ whole: 9999 });
  assert.equal(s.submit({ whole: 9998 }).revealed, a);
  const rec = s.record();
  assert.deepEqual(rec.map((r) => r.revealed), [true, true]);
  assert.equal(rec[1].attempts.length, 2);
});

test('replaying the saved step answers gives the same state', () => {
  const p = generateProblem('frac.add-sub', 'rp', 2);
  const { L, a } = solveByHand(p);
  const answers = [{ whole: 1 }, { whole: L }, { whole: a }];
  const live = startScaffold(p);
  for (const x of answers) live.submit(x);
  assert.deepEqual(replayScaffold(p, answers).record(), live.record());
  assert.equal(replayScaffold(p, answers).current().id, 'rewrite-2');
});

test('the final step is left to the practice session', () => {
  const p = generateProblem('frac.add-sub', 'f', 1);
  const { L, a, c, n } = solveByHand(p);
  const s = replayScaffold(p, [L, a, c, n].map((v) => ({ whole: v })));
  assert.throws(() => s.submit({ whole: 1 }));
});
