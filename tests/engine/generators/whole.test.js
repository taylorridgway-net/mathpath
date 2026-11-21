// Tests for the whole-number generators. As with fractions, the answer is
// re-computed here from the problem as displayed, never taken from the generator.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateProblem, generators, DIFFICULTIES } from '../../../engine/generators/index.js';
import { checkAnswer } from '../../../engine/grading/check-answer.js';
import { addNoCarry, addColumnSums, subSmallerFromLarger, subBorrowNoDecrease } from '../../../engine/generators/whole/add-sub.js';

const SEEDS = Array.from({ length: 200 }, (_, i) => `w-${i}`);
const catalog = new Set(JSON.parse(readFileSync(new URL('../../../curriculum/misconceptions/whole.json', import.meta.url), 'utf8')).misconceptions.map((m) => m.id));
const graph = JSON.parse(readFileSync(new URL('../../../curriculum/graph/whole.json', import.meta.url), 'utf8'));
const graphIds = new Set(graph.skills.flatMap((s) => [s.id, ...s.subskills.map((x) => x.id)]));

// ---------- independent arithmetic ----------
const num = (node) => node.value;
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const factorsOf = (n) => { const f = []; for (let d = 1; d <= n; d++) if (n % d === 0) f.push(d); return f; };
const isPrime = (n) => factorsOf(n).length === 2;
const numberIn = (text) => text.match(/\d+/g).map(Number);
const digitsOf = (n) => String(n).split('').reverse().map(Number);

// What a student who knows the subject types.
function solve(p) {
  const e = p.expression;
  const kind = p.part || p.generator;
  if (kind.endsWith('.factors')) return { list: factorsOf(numberIn(p.instruction)[0]) };
  if (kind.endsWith('.primes')) {
    let n = numberIn(p.instruction)[0];
    const out = [];
    for (let d = 2; n > 1; d++) while (n % d === 0) { out.push(d); n /= d; }
    return { list: out.reverse() }; // any order is fine
  }
  if (kind.endsWith('.gcf')) { const [a, b] = e.items.map(num); return { whole: gcd(a, b) }; }
  if (kind.endsWith('.lcm')) { const [a, b] = e.items.map(num); return { whole: (a * b) / gcd(a, b) }; }
  const [a, b] = [num(e.left), num(e.right)];
  if (e.op === '+') return { whole: a + b };
  if (e.op === '-') return { whole: a - b };
  if (e.op === '×') return { whole: a * b };
  if (e.op === '÷') return a % b === 0 && !kind.endsWith('remainders') ? { whole: a / b } : { whole: Math.floor(a / b), rem: a % b };
  throw new Error(`can't solve ${kind}`);
}

const IDS = Object.keys(generators).filter((id) => id.startsWith('whole.') && !id.startsWith('whole.place-value')); // place value: its own tests
function each(fn) {
  for (const id of IDS) for (const d of DIFFICULTIES) for (const seed of SEEDS) fn(generateProblem(id, seed, d), id, d);
}

test('every whole-number generator belongs to a skill or subskill in the graph, and covers real subskills', () => {
  for (const id of IDS) {
    assert.ok(graphIds.has(id), id);
    for (const c of generators[id].covers || []) assert.ok(graphIds.has(c), `${id} covers ${c}`);
  }
  for (const s of graph.skills) for (const sub of s.subskills) assert.ok(generators[sub.id], `no generator for ${sub.id}`);
});

test('the answer worked out independently is marked right, for every problem', () => {
  each((p, id) => assert.equal(checkAnswer(p, solve(p)).status, 'correct', `${id}: ${JSON.stringify(p.expression)} ${p.instruction}`));
});

test('every wrong-answer pattern is in the catalog and really is wrong', () => {
  each((p, id) => {
    for (const m of p.misconceptions) {
      assert.ok(catalog.has(m.id), `${id}: unknown misconception ${m.id}`);
      if (m.test) continue;
      const raw = typeof m.value === 'number' ? { whole: m.value } : { whole: m.value.quotient, rem: m.value.remainder };
      const r = checkAnswer(p, raw);
      assert.equal(r.status, 'wrong', `${id}: misconception ${m.id} value ${JSON.stringify(m.value)} is not wrong`);
      assert.ok(r.misconception, `${id}: ${m.id} not recognised`);
    }
  });
});

test('add with carrying: the carries each level promises', () => {
  for (const d of DIFFICULTIES) for (const seed of SEEDS) {
    const { left, right } = generateProblem('whole.add-sub.add-regroup', seed, d).expression;
    const [a, b] = [digitsOf(left.value), digitsOf(right.value)];
    const onesCarry = a[0] + b[0] >= 10;
    if (d === 1) assert.ok(onesCarry && left.value + right.value < 100 && left.value < 100 && right.value < 100);
    if (d === 3) assert.ok(onesCarry && a[1] + b[1] + 1 >= 10 && left.value >= 100 && right.value >= 100);
  }
});

test('subtract with borrowing: level 3 always borrows across a zero; answers are never negative', () => {
  for (const d of DIFFICULTIES) for (const seed of SEEDS) {
    const { left, right } = generateProblem('whole.add-sub.sub-regroup', seed, d).expression;
    assert.ok(left.value > right.value);
    const [a, b] = [digitsOf(left.value), digitsOf(right.value)];
    if (d === 3) assert.ok(a[1] === 0 && a[0] < b[0], `${left.value} - ${right.value}`);
    if (d === 2) assert.ok(!a.slice(0, -1).includes(0));
  }
});

test('facts stay within 12 × 12; level 3 always has a hard factor (6-9 or 12); facts are marked for the slow rule', () => {
  for (const d of DIFFICULTIES) for (const seed of SEEDS) {
    const p = generateProblem('whole.mult-div.mult-facts', seed, d);
    const [a, b] = [p.expression.left.value, p.expression.right.value];
    assert.ok(a >= 2 && a <= 12 && b >= 2 && b <= 12);
    if (d === 3) assert.ok([6, 7, 8, 9, 12].includes(a) || [6, 7, 8, 9, 12].includes(b));
    assert.equal(p.slowAfterMs, 5000);
    const q = generateProblem('whole.mult-div.div-facts', seed, d);
    assert.equal(q.expression.left.value % q.expression.right.value, 0, 'division facts divide exactly');
  }
});

test('remainders: always at least 1 and less than the divisor', () => {
  for (const d of DIFFICULTIES) for (const seed of SEEDS) {
    const { left, right } = generateProblem('whole.mult-div.remainders', seed, d).expression;
    const r = left.value % right.value;
    assert.ok(r >= 1 && r < right.value);
  }
});

test('prime factorization: the order doesn\'t matter; 60 = 4 × 15 is recognised as not all prime', () => {
  for (const seed of SEEDS.slice(0, 50)) {
    const p = generateProblem('whole.factors-multiples.primes', seed, 2);
    const list = solve(p).list;
    assert.ok(list.every(isPrime));
    assert.equal(checkAnswer(p, { list: [...list].reverse() }).status, 'correct');
    if (list.length >= 3) {
      const merged = [list[0] * list[1], ...list.slice(2)];
      assert.equal(checkAnswer(p, { list: merged }).misconception, 'whole.not-all-prime');
    }
  }
});

test('factors: listing multiples, or missing a pair, is recognised', () => {
  const p = generateProblem('whole.factors-multiples.factors', 'x', 1);
  const n = numberIn(p.instruction)[0];
  assert.equal(checkAnswer(p, { list: [n, 2 * n, 3 * n] }).misconception, 'whole.multiples-not-factors');
  assert.equal(checkAnswer(p, { list: factorsOf(n).slice(1) }).misconception, 'whole.factor-pairs-missed');
  assert.equal(checkAnswer(p, { list: [...factorsOf(n), n] }).status, 'correct', 'a repeat in a factor list is harmless');
});

test('GCF from level 2: neither number divides the other, and the GCF isn\'t 2', () => {
  for (const d of [2, 3]) for (const seed of SEEDS) {
    const [a, b] = generateProblem('whole.factors-multiples.gcf', seed, d).expression.items.map(num);
    assert.ok(a % b !== 0 && b % a !== 0 && gcd(a, b) >= 3, `${a}, ${b}`);
  }
});

test('LCM from level 2: the numbers share a factor, so multiplying them is NOT the answer', () => {
  for (const d of [2, 3]) for (const seed of SEEDS) {
    const [a, b] = generateProblem('whole.factors-multiples.lcm', seed, d).expression.items.map(num);
    assert.ok(gcd(a, b) > 1, `${a}, ${b}`);
  }
});

test('the wrong-answer rules themselves, on the textbook examples', () => {
  assert.equal(addNoCarry(47, 38), 75);
  assert.equal(addColumnSums(47, 38), 715);
  assert.equal(subSmallerFromLarger(52, 27), 35);
  assert.equal(subBorrowNoDecrease(503, 278), 335);
});

test('a remainder answer: the remainder box can be left empty only when it is 0', () => {
  const p = generateProblem('whole.mult-div.remainders', 'r', 1);
  const right = solve(p);
  assert.equal(checkAnswer(p, { whole: right.whole }).misconception, 'whole.remainder-dropped');
});
