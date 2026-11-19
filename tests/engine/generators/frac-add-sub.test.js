// Tests for the fraction add/subtract generators.
//
// The key idea: these tests do NOT trust the generator's own answer. For
// hundreds of seeds at every difficulty, they re-compute the answer from the
// problem as displayed, using simple arithmetic written here, and compare.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateProblem, generators, DIFFICULTIES } from '../../../engine/generators/index.js';
import { checkAnswer } from '../../../engine/grading/check-answer.js';
import { toText } from '../../../engine/problem/text.js';

const SEEDS = Array.from({ length: 300 }, (_, i) => `seed-${i}`);
const IDS = Object.keys(generators).filter((id) => id.startsWith('frac.add-sub'));

// ---------- independent arithmetic (deliberately not using engine/math) ----------
const gcd = (a, b) => (b === 0 ? Math.abs(a) : gcd(b, a % b));
const valueOf = (node) => {
  switch (node.type) {
    case 'frac': return [node.n, node.d];
    case 'mixed': return [node.whole * node.d + node.n, node.d];
    case 'op': {
      const [a, b] = valueOf(node.left);
      const [c, d] = valueOf(node.right);
      return node.op === '+' ? [a * d + c * b, b * d] : [a * d - c * b, b * d];
    }
    default: throw new Error(`can't evaluate ${node.type}`);
  }
};
const sameValue = ([a, b], [c, d]) => a * d === c * b;

// The keypad entry a student would type for a fraction value, in simplest form.
const typed = ({ n, d }) => {
  if (d === 1) return { whole: Math.abs(n), negative: n < 0 };
  return { num: Math.abs(n), den: d, negative: n < 0 };
};
const typedMixed = ({ n, d }) => ({ whole: Math.floor(n / d), num: n % d, den: d });

// Every displayed fraction should be proper, simplest, and have a sensible denominator.
function displayedFractions(node, out = []) {
  if (node.type === 'frac' || node.type === 'mixed') out.push(node);
  for (const key of ['left', 'right']) if (node[key]) displayedFractions(node[key], out);
  for (const item of node.items || []) displayedFractions(item, out);
  return out;
}

const misconceptionCatalog = JSON.parse(
  readFileSync(new URL('../../../curriculum/misconceptions/frac.json', import.meta.url), 'utf8'),
);
const knownMisconceptions = new Set(misconceptionCatalog.misconceptions.map((m) => m.id));
const fracGraph = JSON.parse(readFileSync(new URL('../../../curriculum/graph/frac.json', import.meta.url), 'utf8'));
const graphIds = new Set(fracGraph.skills.flatMap((s) => [s.id, ...s.subskills.map((x) => x.id)]));

function eachProblem(fn) {
  for (const id of IDS) for (const difficulty of DIFFICULTIES) for (const seed of SEEDS) {
    fn(generateProblem(id, seed, difficulty), id, difficulty);
  }
}

// ---------- tests that apply to every generator ----------

test('every generator ID is a real skill or subskill in the graph', () => {
  for (const id of IDS) assert.ok(graphIds.has(id), `${id} is not in frac.json`);
});

test('same seed -> identical problem', () => {
  for (const id of IDS) for (const difficulty of DIFFICULTIES) {
    assert.deepEqual(generateProblem(id, 'x', difficulty), generateProblem(id, 'x', difficulty));
  }
});

test('enough variety: many different problems per generator and difficulty', () => {
  for (const id of IDS) for (const difficulty of DIFFICULTIES) {
    const distinct = new Set(SEEDS.map((s) => toText(generateProblem(id, s, difficulty).expression)));
    assert.ok(distinct.size >= 15, `${id} difficulty ${difficulty}: only ${distinct.size} different problems`);
  }
});

test('displayed fractions are proper, in simplest form, denominators 2-12', () => {
  eachProblem((p, id) => {
    for (const f of displayedFractions(p.expression)) {
      const where = `${id}: ${toText(p.expression)}`;
      if (typeof f.n === 'number') {
        assert.ok(f.n >= 1 && f.n < f.d, `${where}: ${f.n}/${f.d} not proper`);
        assert.equal(gcd(f.n, f.d), 1, `${where}: ${f.n}/${f.d} not simplest`);
      }
      assert.ok(f.d >= 2 && f.d <= 72, `${where}: odd denominator ${f.d}`);
      if (p.expression.type !== 'eq') assert.ok(f.d <= 12, `${where}: denominator over 12`);
    }
  });
});

test('the correct answer is graded "correct"', () => {
  eachProblem((p, id) => {
    const where = `${id} d${p.difficulty}: ${toText(p.expression)}`;
    if (p.answer.type === 'fraction') {
      assert.equal(checkAnswer(p, typed(p.answer.value)).status, 'correct', where);
      if (p.answer.value.n > p.answer.value.d && p.answer.value.d > 1) {
        assert.equal(checkAnswer(p, typedMixed(p.answer.value)).status, 'correct', `${where} (mixed form)`);
      }
    } else if (p.answer.type === 'integer') {
      assert.equal(checkAnswer(p, { whole: p.answer.value }).status, 'correct', where);
    } else {
      assert.equal(checkAnswer(p, { whole: p.answer.least }).status, 'correct', where);
    }
  });
});

test('every misconception answer is graded wrong and tagged with that misconception', () => {
  eachProblem((p, id) => {
    for (const m of p.misconceptions) {
      assert.ok(knownMisconceptions.has(m.id), `${m.id} is not in curriculum/misconceptions/frac.json`);
      const raw = typeof m.value === 'number' ? { whole: m.value } : typed(m.value);
      const result = checkAnswer(p, raw);
      assert.equal(result.status, 'wrong', `${id}: ${toText(p.expression)} misconception ${m.id} graded ${result.status}`);
      assert.equal(result.misconception, m.id);
    }
  });
});

test('misconceptions in the catalog point to real subskills', () => {
  for (const m of misconceptionCatalog.misconceptions) {
    assert.ok(graphIds.has(m.pointsTo), `${m.id} points to unknown ${m.pointsTo}`);
  }
});

// ---------- answer checks, one per kind of problem ----------

test('add/subtract problems: answer matches independent arithmetic and is positive and reduced', () => {
  eachProblem((p, id) => {
    if (p.expression.type !== 'op') return;
    const expected = valueOf(p.expression);
    const { n, d } = p.answer.value;
    const where = `${id}: ${toText(p.expression)} gave ${n}/${d}`;
    assert.ok(sameValue([n, d], expected), where);
    assert.ok(n > 0, `${where}: answer should be positive`);
    assert.equal(gcd(n, d), 1, `${where}: stored answer should be reduced`);
  });
});

test('rewrite problems: blank numerator makes the fractions equal', () => {
  for (const difficulty of DIFFICULTIES) for (const seed of SEEDS) {
    const p = generateProblem('frac.add-sub.rewrite', seed, difficulty);
    const { left, right } = p.expression;
    assert.equal(right.n.type, 'blank');
    assert.equal(p.answer.value * left.d, left.n * right.d, toText(p.expression));
    assert.ok(right.d > left.d && right.d % left.d === 0);
  }
});

test('common-denominator problems: least is the true LCM, and pairs match the difficulty', () => {
  for (const difficulty of DIFFICULTIES) for (const seed of SEEDS) {
    const p = generateProblem('frac.add-sub.common-denom', seed, difficulty);
    const [b, d] = p.expression.items.map((f) => f.d);
    assert.deepEqual(p.answer.of, [b, d]);
    let least = 1;
    while (least % b !== 0 || least % d !== 0) least++;
    assert.equal(p.answer.least, least);
    assert.ok(least <= (difficulty === 2 ? 40 : 60), `common denominator ${least} is too big`);
    const [small, big] = [Math.min(b, d), Math.max(b, d)];
    assert.notEqual(b, d);
    if (difficulty === 1) assert.equal(big % small, 0);
    if (difficulty === 2) assert.equal(gcd(b, d), 1);
    if (difficulty === 3) assert.ok(gcd(b, d) > 1 && big % small !== 0);
  }
});

// ---------- each subskill tests what it claims to ----------

test('combine problems never need simplifying (so mistakes point at combining)', () => {
  for (const difficulty of DIFFICULTIES) for (const seed of SEEDS) {
    const p = generateProblem('frac.add-sub.combine', seed, difficulty);
    const [n, d] = valueOf(p.expression);
    const { left, right } = p.expression;
    assert.equal(left.d, right.d, 'same denominators');
    const raw = p.expression.op === '+' ? left.n + right.n : left.n - right.n;
    assert.equal(gcd(raw, left.d), 1, `${toText(p.expression)} needs simplifying`);
    assert.ok(sameValue([n, d], [raw, left.d]));
    if (difficulty === 2) assert.ok(raw > left.d, 'difficulty 2 should give an improper result');
    assert.equal(p.expression.op, difficulty === 3 ? '-' : '+');
  }
});

test('simplify-result problems always need simplifying', () => {
  for (const difficulty of DIFFICULTIES) for (const seed of SEEDS) {
    const p = generateProblem('frac.add-sub.simplify-result', seed, difficulty);
    const { left, right } = p.expression;
    assert.equal(left.d, right.d);
    const raw = p.expression.op === '+' ? left.n + right.n : left.n - right.n;
    assert.ok(gcd(raw, left.d) > 1, `${toText(p.expression)} doesn't need simplifying`);
    // The unsimplified answer must get the retry-with-hint result.
    assert.equal(checkAnswer(p, { num: raw, den: left.d }).status, 'not-simplified', toText(p.expression));
  }
});

test('mixed-number problems: difficulty 2 carries, difficulty 3 must regroup', () => {
  for (const difficulty of DIFFICULTIES) for (const seed of SEEDS) {
    const p = generateProblem('frac.add-sub.mixed', seed, difficulty);
    const { left, right, op } = p.expression;
    assert.equal(left.type, 'mixed');
    assert.equal(left.d, right.d);
    if (difficulty === 1) assert.ok(op === '+' && left.n + right.n < left.d);
    if (difficulty === 2) {
      assert.ok(op === '+' && left.n + right.n > left.d);
      // Not carrying (e.g. 3 5/4) should be "not-simplified", not "wrong".
      const uncarried = { whole: left.whole + right.whole, num: left.n + right.n, den: left.d };
      assert.equal(checkAnswer(p, uncarried).status, 'not-simplified', toText(p.expression));
    }
    if (difficulty === 3) {
      assert.ok(op === '-' && left.n < right.n, `${toText(p.expression)} doesn't need regrouping`);
      assert.ok(left.whole - right.whole >= 2, 'answer whole part should be at least 1');
    }
  }
});

test('full problems use unlike denominators and match difficulty', () => {
  for (const difficulty of DIFFICULTIES) for (const seed of SEEDS) {
    const p = generateProblem('frac.add-sub', seed, difficulty);
    const { left, right, op } = p.expression;
    assert.notEqual(left.d, right.d);
    if (difficulty === 1) assert.equal(op, '+');
  }
  // Higher difficulties include both adding and subtracting.
  const ops = new Set(SEEDS.map((s) => generateProblem('frac.add-sub', s, 3).expression.op));
  assert.deepEqual([...ops].sort(), ['+', '-']);
});

test('the add-across misconception is caught on full problems', () => {
  // 1/2 + 1/3 = 2/5 is the classic. Find a generated addition problem and check it.
  const p = SEEDS.map((s) => generateProblem('frac.add-sub', s, 2)).find((x) => x.expression.op === '+');
  const { left, right } = p.expression;
  const result = checkAnswer(p, { num: left.n + right.n, den: left.d + right.d });
  assert.equal(result.misconception, 'frac.add-across');
});
