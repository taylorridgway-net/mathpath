// Generators for "Negative fractions" (frac.signed).
// See engine/generators/frac/add-sub.js for what a generator returns.
// Answers may be negative (answer.allowNegative: the keypad shows a (−) key).
//
// Parts:
//   sign-placement  3/(−5) = −3/5;  (−6)/(−9) = 2/3: where the sign goes, then simplify
//   add-sub         −1/2 + 1/3,  2/5 − (−3/4): integer sign rules with fraction adding
//   mult-div        −2/3 × 3/5,  −1/2 ÷ (−3/4): sign rule, then multiply or divide

import { fraction, gcd, add, sub, mul, equals, reduce } from '../../math/fraction.js';

const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const frac = (n, d) => ({ type: 'frac', n, d });
const op = (sym, left, right) => ({ type: 'op', op: sym, left, right });
// A signed fraction for display: -3/4 as "−" in front of 3/4.
const show = (f) => (f.n < 0 ? { type: 'neg', of: frac(-f.n, f.d) } : frac(f.n, f.d));
const neg = (f) => fraction(-f.n, f.d);
const proper = (maxDen, minDen = 2) => range(minDen, maxDen).flatMap((d) => range(1, d - 1).filter((n) => gcd(n, d) === 1).map((n) => fraction(n, d)));
const answerFor = (value) => ({ type: 'fraction', value: reduce(value), form: 'any', allowNegative: true });

function wrongs(value, candidates) {
  const out = [];
  for (const c of candidates) {
    if (!c.value || equals(c.value, value) || out.some((o) => equals(o.value, c.value))) continue;
    out.push(c);
  }
  return out;
}

// ---------- where the sign goes ----------
//   1: negative bottom: 3/(−5) = −3/5;   2: both negative: (−6)/(−9) = 2/3 (simplify too);
//   3: either, and it needs simplifying: 8/(−12) = −2/3
const signPlacement = {
  version: 1,
  ifNotSimplified: 'frac.equivalent.simplify',
  alsoUses: [],
  generate(rng, difficulty) {
    const base = rng.pick(proper(difficulty === 1 ? 9 : 6));
    const k = difficulty === 1 ? 1 : rng.int(2, 4);
    const bothNegative = difficulty === 2 || (difficulty === 3 && rng.chance(0.5));
    const [n, d] = bothNegative ? [-base.n * k, -base.d * k] : (rng.chance(0.5) ? [base.n * k, -base.d * k] : [-base.n * k, base.d * k]);
    if (difficulty === 1 && n < 0) return this.generate(rng, difficulty); // level 1: the sign is on the bottom
    const value = fraction(n, d); // fraction() moves the sign to the top
    return {
      instruction: 'Write this as one fraction in simplest form, with any negative sign in front.',
      expression: frac(n, d),
      answer: answerFor(value),
      misconceptions: wrongs(reduce(value), [
        // (−6)/(−9) = −2/3: two negatives left as negative
        { id: 'frac.signed-two-negatives', value: bothNegative ? neg(reduce(value)) : null },
        // 3/(−5) = 3/5: the sign dropped
        { id: 'frac.signed-sign-dropped', value: bothNegative ? null : neg(reduce(value)) },
      ]),
    };
  },
};

// ---------- add and subtract ----------
//   1: same denominator, one negative (−3/7 + 5/7);   2: one denominator divides the other, adding (−1/2 + 1/6);
//   3: subtracting, with negatives (2/5 − (−3/4), −1/4 − 1/6)
const addSub = {
  version: 1,
  ifNotSimplified: 'frac.add-sub.simplify-result',
  generate(rng, difficulty) {
    for (;;) {
      let x;
      let y;
      if (difficulty === 1) {
        const d = rng.int(3, 12);
        const tops = range(1, d - 1).filter((n) => gcd(n, d) === 1);
        [x, y] = [fraction(rng.pick(tops), d), fraction(rng.pick(tops), d)];
      } else if (difficulty === 2) {
        const b = rng.int(2, 6);
        const d = b * rng.pick([2, 3]);
        [x, y] = [rng.pick(proper(b, b)), rng.pick(proper(d, d))];
        if (rng.chance(0.5)) [x, y] = [y, x];
      } else {
        const [b, d] = [rng.int(2, 9), rng.int(2, 9)];
        if (b === d) continue;
        [x, y] = [rng.pick(proper(b, b)), rng.pick(proper(d, d))];
      }
      const subtract = difficulty === 3;
      // Signs: at least one negative; on subtraction, often a negative after the minus.
      const signs = rng.pick(subtract ? [[1, -1], [-1, 1], [-1, -1]] : [[-1, 1], [1, -1], [-1, -1]]);
      x = signs[0] < 0 ? neg(x) : x;
      y = signs[1] < 0 ? neg(y) : y;
      const value = subtract ? sub(x, y) : add(x, y);
      if (value.n === 0) continue;
      return {
        instruction: `${subtract ? 'Subtract' : 'Add'}. Write your answer in simplest form.`,
        expression: op(subtract ? '-' : '+', show(x), show(y)),
        answer: answerFor(value),
        misconceptions: wrongs(reduce(value), [
          { id: 'frac.signed-wrong-sign', value: neg(reduce(value)) },
          // 2/5 − (−3/4) worked as 2/5 − 3/4
          { id: 'frac.signed-sub-ignored-sign', value: subtract ? add(x, y) : null },
        ]),
      };
    }
  },
};

// ---------- multiply and divide ----------
//   1: multiply, one negative;   2: divide, one or two negatives;   3: either, two negatives, needs simplifying
const multDiv = {
  version: 1,
  ifNotSimplified: 'frac.multiply.simplify',
  generate(rng, difficulty) {
    for (;;) {
      const x = rng.pick(proper(difficulty === 1 ? 6 : 9));
      const y = rng.pick(proper(difficulty === 1 ? 6 : 9));
      const divide = difficulty === 2 || (difficulty === 3 && rng.chance(0.5));
      const raw = divide ? [x.n * y.d, x.d * y.n] : [x.n * y.n, x.d * y.d];
      const needsSimplifying = gcd(raw[0], raw[1]) > 1;
      if (difficulty < 3 && needsSimplifying) continue;
      if (difficulty === 3 && !needsSimplifying) continue;
      if (Math.max(...raw) > 72) continue;
      const signs = difficulty === 1 ? rng.pick([[-1, 1], [1, -1]]) : difficulty === 3 ? [-1, -1] : rng.pick([[-1, 1], [1, -1], [-1, -1]]);
      const a = signs[0] < 0 ? neg(x) : x;
      const b = signs[1] < 0 ? neg(y) : y;
      const value = divide ? mul(a, fraction(b.d * Math.sign(b.n), Math.abs(b.n))) : mul(a, b);
      return {
        instruction: `${divide ? 'Divide' : 'Multiply'}. Write your answer in simplest form.`,
        expression: op(divide ? '÷' : '×', show(a), show(b)),
        answer: answerFor(value),
        misconceptions: wrongs(reduce(value), [{ id: 'frac.signed-mult-sign', value: neg(reduce(value)) }]),
      };
    }
  },
};

const mixed = {
  version: 1,
  mixed: true, // each part is asked on its own in the diagnostic (they rest on different skills)
  covers: ['frac.signed.sign-placement', 'frac.signed.add-sub', 'frac.signed.mult-div'],
  generate(rng, difficulty) {
    const part = rng.pick(this.covers);
    return { ...parts[part].generate(rng, difficulty), part };
  },
};

const parts = {
  'frac.signed.sign-placement': signPlacement,
  'frac.signed.add-sub': addSub,
  'frac.signed.mult-div': multDiv,
};

export const signedGenerators = { 'frac.signed': mixed, ...parts };
