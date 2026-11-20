// Generators for "Solve one- and two-step equations" (alg.equations).
// See engine/generators/frac/add-sub.js for what a generator returns.
// The student types the value of x: a whole number, a negative, or (hardest level)
// a fraction in simplest form.

import { fraction, gcd, add, sub, mul, div, equals, reduce } from '../../math/fraction.js';

const int = (value) => ({ type: 'int', value });
const frac = (n, d) => ({ type: 'frac', n, d });
const op = (sym, left, right) => ({ type: 'op', op: sym, left, right });
const eq = (left, right) => ({ type: 'eq', left, right });
const x = { type: 'var', name: 'x' };
const term = (coef) => ({ type: 'term', coef, name: 'x' });
const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const F = (n, d = 1) => fraction(n, d);
// A number to show: whole (maybe negative) or a fraction.
const show = (f) => (f.d === 1 ? int(f.n) : f.n < 0 ? { type: 'neg', of: frac(-f.n, f.d) } : frac(f.n, f.d));
const answerFor = (value) => ({ type: 'fraction', value: reduce(value), form: 'any', allowNegative: true });
const proper = (maxDen) => range(2, maxDen).flatMap((d) => range(1, d - 1).filter((n) => gcd(n, d) === 1).map((n) => F(n, d)));
const nonZero = (rng, lo, hi) => { for (;;) { const v = rng.int(lo, hi); if (v !== 0) return v; } };

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

// ---------- undo adding or subtracting ----------
//   1: whole numbers (x + 5 = 12, x − 3 = 8);  2: negatives (x + 9 = 4, x − 3 = −8, −5 + x = 2);
//   3: fractions (x + 1/4 = 2/3)
const addSub = {
  version: 1,
  generate(rng, difficulty) {
    let a;
    let b;
    if (difficulty === 1) [a, b] = [F(rng.int(2, 20)), F(rng.int(2, 30))];
    else if (difficulty === 2) [a, b] = [F(nonZero(rng, -15, 15)), F(nonZero(rng, -20, 20))];
    else {
      // Fractions, with a common denominator of 24 or less (the point is the equation, not big numbers).
      do [a, b] = [rng.pick(proper(8)), rng.pick(proper(8))]; while ((a.d * b.d) / gcd(a.d, b.d) > 24 || a.d === b.d);
    }
    const plus = rng.chance(0.5);
    // x + a = b  -> x = b − a;   x − a = b -> x = b + a
    if (difficulty === 1 && plus && b.n <= a.n) b = add(b, a); // keep whole-number answers positive at level 1
    const value = plus ? sub(b, a) : add(b, a);
    const aFirst = difficulty === 2 && plus && rng.chance(0.4); // −5 + x = 2
    const lhs = aFirst ? op('+', show(a), x) : op(plus ? '+' : '-', x, show(a));
    return problem(eq(lhs, show(b)), value, [
      { id: 'alg.eq-add-same-op', value: plus ? add(b, a) : sub(b, a) }, // did the operation instead of undoing it
      { id: 'alg.eq-add-sign', value: mul(value, F(-1)) },
    ]);
  },
};

// ---------- undo multiplying or dividing ----------
//   1: 3x = 21, x/4 = 6;  2: negatives (−3x = 12, 4x = −20, x/(−2) = 5);
//   3: fractions: (2/3)x = 10, or a fraction answer (6x = 4 -> 2/3)
const multDiv = {
  version: 1,
  generate(rng, difficulty) {
    const kind = rng.pick(['times', 'times', 'over']);
    if (difficulty === 3) {
      if (rng.chance(0.5)) {
        const c = rng.pick(proper(5));
        const value = F(c.d * rng.int(1, 6));
        const b = mul(c, value);
        return problem(eq(term(frac(c.n, c.d)), show(b)), value, [
          { id: 'alg.eq-mult-same-op', value: mul(b, c) },
          { id: 'alg.eq-flipped-division', value: div(c, b) },
        ]);
      }
      let a; let b;
      for (;;) { [a, b] = [rng.int(2, 9), rng.int(1, 12)]; if (b % a !== 0) break; }
      const value = F(b, a);
      return problem(eq(term(a), int(b)), value, [
        { id: 'alg.eq-mult-same-op', value: F(a * b) },
        { id: 'alg.eq-flipped-division', value: F(a, b) }, // 6x = 4 -> 6/4
        { id: 'alg.eq-mult-wrong-inverse', value: F(b - a) },
      ]);
    }
    const sign = (v) => (difficulty === 2 && rng.chance(0.5) ? -v : v);
    const a = sign(rng.int(2, 9));
    const q = difficulty === 2 ? nonZero(rng, -12, 12) : rng.int(2, 12);
    if (kind === 'times') {
      const b = a * q; // ax = b
      return problem(eq(term(a), int(b)), F(q), [
        { id: 'alg.eq-mult-same-op', value: F(a * b) },
        { id: 'alg.eq-mult-wrong-inverse', value: F(b - a) },
        { id: 'alg.eq-flipped-division', value: F(a, b) },
        { id: 'alg.eq-mult-sign', value: F(-q) },
      ]);
    }
    // x / a = q  -> x = a × q
    return problem(eq(frac(x, a), int(q)), F(a * q), [
      { id: 'alg.eq-mult-same-op', value: F(q, a) },
      { id: 'alg.eq-mult-sign', value: F(-a * q) },
    ]);
  },
};

// ---------- two steps ----------
//   1: 3x + 5 = 20 (whole numbers);  2: negatives (−2x + 7 = 1, 4x − 9 = −1) or x/3 − 2 = 5;
//   3: a fraction answer (2x + 3 = 8 -> 5/2) or a fraction in front of x ((2/3)x + 1 = 7)
const twoStep = {
  version: 1,
  generate(rng, difficulty) {
    let coef; // number or fraction
    let value;
    if (difficulty === 1) [coef, value] = [F(rng.int(2, 9)), F(rng.int(1, 12))];
    else if (difficulty === 2) [coef, value] = [F(nonZero(rng, -9, 9) || 2), F(nonZero(rng, -10, 10))];
    else if (rng.chance(0.5)) {
      const a = rng.int(2, 6);
      let n; do n = rng.int(1, 4 * a); while (n % a === 0);
      [coef, value] = [F(a), F(n, a)];
    } else {
      const c = rng.pick(proper(5));
      [coef, value] = [c, F(c.d * rng.int(1, 5))];
    }
    if (difficulty === 2 && Math.abs(coef.n) === 1) coef = F(coef.n * 3);
    const b = difficulty === 1 ? F(rng.int(1, 15)) : F(nonZero(rng, -12, 12));
    const c = add(mul(coef, value), b); // coef·x + b = c
    // Show "x/3" for a coefficient 1/3 sometimes; otherwise "ax" or "(2/3)x".
    const left = coef.d !== 1 && coef.n === 1 && rng.chance(0.6) ? frac(x, coef.d) : term(coef.d === 1 ? coef.n : frac(coef.n, coef.d));
    const lhs = b.n < 0 ? op('-', left, show(F(-b.n, b.d))) : op('+', left, show(b));
    const ax = sub(c, b);
    return problem(eq(lhs, show(c)), value, [
      { id: 'alg.eq-stopped-early', value: ax }, // undid the + b, then stopped
      { id: 'alg.eq-two-wrong-inverse', value: div(add(c, b), coef) }, // added b instead of subtracting
      { id: 'alg.eq-divide-first', value: sub(div(c, coef), b) }, // divided first, then subtracted b
      { id: 'alg.eq-two-sign', value: mul(value, F(-1)) },
    ]);
  },
};

// ---------- whole skill ----------
//   1: two steps, whole numbers;  2: two steps with negatives;  3: two steps with fractions, or one-step with fractions
const full = {
  version: 1,
  // One two-step equation shows both kinds of undoing (owner: a right answer shows what it depends on).
  covers: ['alg.equations.add-sub', 'alg.equations.mult-div', 'alg.equations.two-step'],
  generate(rng, difficulty) {
    if (difficulty < 3 || rng.chance(0.6)) return twoStep.generate(rng, difficulty);
    return (rng.chance(0.5) ? addSub : multDiv).generate(rng, 3);
  },
};

export const equationGenerators = {
  'alg.equations': full,
  'alg.equations.add-sub': addSub,
  'alg.equations.mult-div': multDiv,
  'alg.equations.two-step': twoStep,
};
