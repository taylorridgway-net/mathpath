// Generators for "Multi-step equations" (alg.multi-step): x on both sides, and
// distributing first. The student types the value of x (whole, negative, or at the
// hardest level a fraction in simplest form), as in alg.equations.
// See engine/generators/frac/add-sub.js for what a generator returns.
//
// Every equation is built from its answer, and each classic mistake is worked out by
// solving the equation the way the mistaken student would.

import { fraction, add, sub, mul, div, equals, reduce } from '../../math/fraction.js';

const int = (value) => ({ type: 'int', value });
const op = (sym, left, right) => ({ type: 'op', op: sym, left, right });
const eq = (left, right) => ({ type: 'eq', left, right });
const x = { type: 'var', name: 'x' };
const term = (coef) => (coef === 1 ? x : { type: 'term', coef, name: 'x' });
const scaled = (coef, inner) => ({ type: 'scaled', coef, of: inner });
const F = (n, d = 1) => fraction(n, d);
const nonZero = (rng, lo, hi) => { for (;;) { const v = rng.int(lo, hi); if (v !== 0) return v; } };
const answerFor = (value) => ({ type: 'fraction', value: reduce(value), form: 'any', allowNegative: true });

// "ax + b" (b may be 0 or negative): a term, then + or − a number.
const side = (a, b) => (a === 0 ? int(b) : b === 0 ? term(a) : b < 0 ? op('-', term(a), int(-b)) : op('+', term(a), int(b)));
// "(x + b)" inside parentheses.
const inner = (b) => (b < 0 ? op('-', x, int(-b)) : op('+', x, int(b)));
// Solve A x + B = C x + D; null if there's no single answer.
const solve = (A, B, C, D) => (A === C ? null : div(sub(F(D), F(B)), sub(F(A), F(C))));

function problem(expression, value, candidates) {
  const v = reduce(value);
  const out = [];
  for (const c of candidates) {
    if (!c.value) continue;
    const w = reduce(c.value);
    if (equals(w, v) || out.some((m) => equals(m.value, w))) continue;
    out.push({ id: c.id, value: w });
  }
  return { instruction: 'Solve for x.', expression, answer: answerFor(v), misconceptions: out };
}

// The classic mistakes for A x + B = C x + D.
const bothSidesMistakes = (A, B, C, D) => [
  { id: 'alg.ms-move-sign', value: A + C === 0 ? null : div(sub(F(D), F(B)), F(A + C)) }, // added Cx to the left instead of subtracting
  { id: 'alg.ms-move-constant', value: solve(A, -B, C, D) }, // moved B across without changing its sign
];

// ---------- x on both sides ----------
//   1: whole numbers, x on the left has more (5x + 3 = 2x + 15);
//   2: negatives (−2x + 7 = 3x − 8, 4x − 9 = x + 6 with a negative answer);
//   3: more x on the right (2x + 9 = 5x − 3), or a fraction answer (3x + 1 = x + 6 -> 5/2)
const bothSides = {
  version: 1,
  generate(rng, difficulty) {
    let A; let C; let v; let B;
    if (difficulty === 1) {
      C = rng.int(1, 6); A = C + rng.int(1, 5); v = F(rng.int(1, 10)); B = rng.int(1, 15);
    } else if (difficulty === 2) {
      do { A = nonZero(rng, -9, 9); C = nonZero(rng, -9, 9); } while (A === C);
      v = F(nonZero(rng, -10, 10)); B = nonZero(rng, -15, 15);
    } else if (rng.chance(0.5)) {
      A = rng.int(1, 5); C = A + rng.int(2, 5); v = F(rng.int(1, 9)); B = rng.int(2, 15);
    } else {
      C = rng.int(1, 5); const k = rng.int(2, 5); A = C + k;
      let m; do m = nonZero(rng, -15, 15); while (m % k === 0);
      v = F(m, k); B = rng.int(-9, 9);
    }
    // D = (A − C) v + B, a whole number by construction.
    const Dv = add(mul(sub(F(A), F(C)), v), F(B));
    const D = Dv.n / Dv.d;
    if (!Number.isInteger(D) || D === 0 || Math.abs(D) > 80) return bothSides.generate(rng, difficulty);
    return problem(eq(side(A, B), side(C, D)), v, [
      ...bothSidesMistakes(A, B, C, D),
      { id: 'alg.ms-stopped-early', value: F(D - B) }, // got (A − C)x = D − B, then stopped
    ]);
  },
};

// ---------- distribute first ----------
//   1: a(x + b) = c (3(x + 4) = 27);  2: a negative in front, or an x to combine (−2(x − 5) = 4, 3(x + 2) + 2x = 31);
//   3: parentheses on both sides (4(x − 1) = 2(x + 5)), or a fraction answer
const distribute = {
  version: 1,
  alsoUses: ['alg.equations.two-step'],
  generate(rng, difficulty) {
    let a; let b; let e = 0; let c = 0; let d = 0; let v; let right;
    if (difficulty === 1) {
      a = rng.int(2, 9); b = nonZero(rng, -9, 9); v = F(rng.int(1, 10));
      if (b < 0 && v.n + b <= 0) v = F(-b + rng.int(1, 6));
    } else if (difficulty === 2) {
      if (rng.chance(0.5)) { a = -rng.int(2, 6); b = nonZero(rng, -9, 9); v = F(nonZero(rng, -10, 10)); } else { a = rng.int(2, 6); b = nonZero(rng, -9, 9); e = nonZero(rng, -5, 5); if (a + e === 0) e += 1; v = F(rng.int(-6, 10) || 2); }
    } else if (rng.chance(0.5)) {
      // a(x + b) = c(x + d), a ≠ c
      a = rng.int(2, 8); do c = rng.int(2, 8); while (c === a); b = nonZero(rng, -6, 6); v = F(nonZero(rng, -10, 10));
      // d from the answer: a(v + b) = c(v + d) -> d = a(v + b)/c − v; keep it whole.
      const dv = sub(div(mul(F(a), add(v, F(b))), F(c)), v);
      if (dv.d !== 1 || dv.n === 0 || Math.abs(dv.n) > 12) return distribute.generate(rng, difficulty);
      d = dv.n;
      right = scaled(c, inner(d));
    } else {
      a = rng.int(2, 6); b = nonZero(rng, -6, 6); let m; do m = rng.int(1, 30); while (m % a === 0); v = F(m, a);
    }
    // Left: a(x + b) [+ e x]; right: a number, unless set above.
    const A = a + e;
    const B = a * b;
    let C = 0; let D;
    if (right) { C = c; D = c * d; } else {
      const Dv = add(mul(F(A), v), F(B));
      if (Dv.d !== 1 || Math.abs(Dv.n) > 120) return distribute.generate(rng, difficulty);
      D = Dv.n; right = int(D);
    }
    const left = e === 0 ? scaled(a, inner(b)) : e < 0 ? op('-', scaled(a, inner(b)), term(-e)) : op('+', scaled(a, inner(b)), term(e));
    return problem(eq(left, right), v, [
      // a(x + b) read as ax + b (only the first term multiplied), on each side.
      { id: 'alg.ms-distribute-first', value: solve(A, b, C, right.type === 'scaled' ? d : D) },
      // the sign of the second product wrong (−2(x − 5) = −2x − 10)
      { id: 'alg.ms-distribute-sign', value: solve(A, -B, C, D) },
      ...(C ? bothSidesMistakes(A, B, C, D) : []),
    ]);
  },
};

// ---------- the whole skill ----------
//   One equation that needs both: a(x + b) = cx + d.
//   1: whole numbers, positive answer;  2: negatives;  3: a fraction answer
const full = {
  version: 1,
  covers: ['alg.multi-step.both-sides', 'alg.multi-step.distribute'],
  generate(rng, difficulty) {
    let a; let b; let C; let v;
    if (difficulty === 1) { a = rng.int(2, 6); b = rng.int(1, 8); C = rng.int(1, a - 1); v = F(rng.int(1, 10)); } else if (difficulty === 2) {
      a = rng.pick([-1, 1]) * rng.int(2, 6); b = nonZero(rng, -8, 8); do C = nonZero(rng, -6, 6); while (C === a); v = F(nonZero(rng, -10, 10));
    } else {
      // a and C at least 2 apart, so a fraction answer is possible.
      a = rng.int(2, 6); b = nonZero(rng, -8, 8); do C = rng.int(1, 9); while (Math.abs(a - C) < 2); const k = a - C;
      let m; do m = nonZero(rng, -20, 20); while (m % k === 0); v = F(m, k);
    }
    const B = a * b;
    const Dv = add(mul(F(a - C), v), F(B));
    if (Dv.d !== 1 || Dv.n === 0 || Math.abs(Dv.n) > 80) return full.generate(rng, difficulty);
    const D = Dv.n;
    return problem(eq(scaled(a, inner(b)), side(C, D)), v, [
      { id: 'alg.ms-distribute-first', value: solve(a, b, C, D) },
      { id: 'alg.ms-distribute-sign', value: solve(a, -B, C, D) },
      ...bothSidesMistakes(a, B, C, D),
    ]);
  },
};

export const multiStepGenerators = {
  'alg.multi-step': full,
  'alg.multi-step.both-sides': bothSides,
  'alg.multi-step.distribute': distribute,
};
