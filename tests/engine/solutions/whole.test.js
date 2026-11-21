// Worked solutions for whole numbers: every one ends with the right answer
// (worked out here independently), and the column steps really add up.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateProblem, generators, DIFFICULTIES } from '../../../engine/generators/index.js';
import { solve } from '../../../engine/solutions/index.js';

const SEEDS = Array.from({ length: 100 }, (_, i) => `sol-${i}`);
const IDS = Object.keys(generators).filter((id) => id.startsWith('whole.') && !id.startsWith('whole.place-value')); // place value: its own tests
const gcd = (a, b) => (b ? gcd(b, a % b) : a);

function expectedText(p) {
  const kind = p.part || p.generator;
  const e = p.expression;
  const n = (i) => (e.items ? e.items[i].value : [e.left.value, e.right.value][i]);
  const first = Number(p.instruction.match(/\d+/)?.[0]);
  if (kind.endsWith('add-regroup')) return `= ${n(0) + n(1)}.`;
  if (kind.endsWith('sub-regroup')) return `= ${n(0) - n(1)}.`;
  if (kind.endsWith('mult-facts')) return `= ${n(0) * n(1)}.`;
  if (kind.endsWith('div-facts')) return `= ${n(0) / n(1)}.`;
  if (kind.endsWith('remainders')) return `= ${Math.floor(n(0) / n(1))} R ${n(0) % n(1)}.`;
  if (kind.endsWith('.factors')) return Array.from({ length: first }, (_, i) => i + 1).filter((d) => first % d === 0).join(', ');
  if (kind.endsWith('.primes')) { const out = []; let m = first; for (let d = 2; m > 1; d++) while (m % d === 0) { out.push(d); m /= d; } return `${first} = ${out.join(' × ')}.`; }
  if (kind.endsWith('.gcf')) return `The greatest is ${gcd(n(0), n(1))}.`;
  if (kind.endsWith('.lcm')) return `${(n(0) * n(1)) / gcd(n(0), n(1))} (`;
  throw new Error(kind);
}

test('every worked solution reaches the right answer', () => {
  for (const id of IDS) for (const d of DIFFICULTIES) for (const seed of SEEDS) {
    const p = generateProblem(id, seed, d);
    const steps = solve(p);
    const text = steps.map((s) => s.say).join(' ');
    assert.ok(text.includes(expectedText(p)), `${id} ${seed}: "${text}" should contain "${expectedText(p)}"`);
  }
});

test('subtraction across zeros: the borrowing steps leave the right digits (503 − 278)', () => {
  const p = { generator: 'whole.add-sub.sub-regroup', expression: { type: 'op', op: '-', left: { type: 'int', value: 503 }, right: { type: 'int', value: 278 } } };
  const text = solve(p).map((s) => s.say).join(' ');
  assert.match(text, /5 becomes 4/);
  assert.match(text, /Ones: 13 − 8 = 5/);
  assert.match(text, /Tens: 9 − 7 = 2/);
  assert.match(text, /Hundreds: 4 − 2 = 2/);
  assert.match(text, /= 225\./);
});

test('addition: each column step adds up, carries included (478 + 356)', () => {
  const p = { generator: 'whole.add-sub.add-regroup', expression: { type: 'op', op: '+', left: { type: 'int', value: 478 }, right: { type: 'int', value: 356 } } };
  const text = solve(p).map((s) => s.say).join(' ');
  assert.match(text, /Ones: 8 \+ 6 = 14/);
  assert.match(text, /Tens: 7 \+ 5 \+ 1 = 13/);
  assert.match(text, /Hundreds: 4 \+ 3 \+ 1 = 8/);
  assert.match(text, /= 834\./);
});

test('a mixed-review problem is solved as the part it really is', () => {
  for (const seed of SEEDS.slice(0, 20)) {
    const p = generateProblem('whole.mult-div', seed, 2);
    assert.ok(solve(p).map((s) => s.say).join(' ').includes(expectedText(p)));
  }
});
