// Generators for "Divide fractions" (frac.divide).
// See engine/generators/frac/add-sub.js for what a generator returns.
//
// Parts:
//   meaning              how many 1/3s fit into 4? (4 ÷ 1/3 = 12): whole-number answers
//   reciprocal           flip it: 3/5 -> 5/3, 4 -> 1/4, 1/6 -> 6
//   multiply-reciprocal  a/b ÷ c/d = a/b × d/c; the answer never needs simplifying,
//                        so a miss here is about dividing, not simplifying
//   whole skill          the same, needing simplifying at the higher levels
// Fractions shown are always in simplest form; denominators stay at 12 or below.

import { fraction, gcd, equals, reduce } from '../../math/fraction.js';

const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const frac = (n, d) => ({ type: 'frac', n, d });
const int = (value) => ({ type: 'int', value });
const op = (sym, left, right) => ({ type: 'op', op: sym, left, right });
const proper = (maxDen, minDen = 2) => range(minDen, maxDen).flatMap((d) => range(1, d - 1).filter((n) => gcd(n, d) === 1).map((n) => [n, d]));
const show = ([n, d]) => (d === 1 ? int(n) : frac(n, d));

function wrongs(value, candidates) {
  const out = [];
  for (const c of candidates) {
    if (!c.value || c.value.d <= 0 || c.value.n <= 0) continue;
    if (equals(c.value, value) || out.some((o) => equals(o.value, c.value))) continue;
    out.push(c);
  }
  return out;
}

// x ÷ y with x = a/b, y = c/d (whole numbers have d = 1): the problem and its usual mistakes.
function divisionProblem([a, b], [c, d]) {
  const value = fraction(a * d, b * c);
  return {
    instruction: 'Divide. Write your answer in simplest form.',
    expression: op('÷', show([a, b]), show([c, d])),
    answer: { type: 'fraction', value: reduce(value), form: 'any' },
    misconceptions: wrongs(value, [
      { id: 'frac.div-no-flip', value: fraction(a * c, b * d) }, // multiplied without flipping
      { id: 'frac.div-flip-first', value: fraction(b * c, a * d) }, // flipped the first number instead
    ]),
  };
}

// ---------- meaning: how many groups? ----------
//   1: how many unit fractions in a whole number (how many 1/4s in 3?)
//   2: how many of a non-unit fraction in a whole number, whole answer (how many 2/3s in 6? 9)
//   3: how many unit fractions in a fraction (how many 1/8s in 3/4? 6)
const meaning = {
  version: 1,
  generate(rng, difficulty) {
    let x;
    let y;
    if (difficulty === 1) {
      x = [rng.int(2, 6), 1];
      y = [1, rng.int(2, 6)];
    } else if (difficulty === 2) {
      const [c, d] = rng.pick(proper(6, 3).filter(([n]) => n > 1));
      x = [c * rng.int(2, 4), 1];
      y = [c, d];
    } else {
      const [a, b] = rng.pick(proper(6, 2));
      const k = rng.int(2, Math.floor(12 / b)); // the small piece's denominator stays at 12 or below
      x = [a, b];
      y = [1, b * k];
    }
    const value = fraction(x[0] * y[1], x[1] * y[0]);
    const say = (f) => (f[1] === 1 ? String(f[0]) : `${f[0]}/${f[1]}`);
    return {
      instruction: `How many ${say(y)}s fit into ${say(x)}?`,
      expression: op('÷', show(x), show(y)),
      answer: { type: 'fraction', value: reduce(value), form: 'any' },
      misconceptions: wrongs(value, [{ id: 'frac.div-meaning-multiplied', value: fraction(x[0] * y[0], x[1] * y[1]) }]),
    };
  },
};

// ---------- reciprocal ----------
//   1: a proper fraction (3/5 -> 5/3);  2: a whole number (4 -> 1/4);  3: a unit fraction or one bigger than 1 (1/6 -> 6, 7/3 -> 3/7)
const reciprocal = {
  version: 1,
  generate(rng, difficulty) {
    let x;
    if (difficulty === 1) x = rng.pick(proper(12, 3).filter(([n]) => n > 1));
    else if (difficulty === 2) x = [rng.int(2, 12), 1];
    else if (rng.chance(0.5)) x = [1, rng.int(2, 12)];
    else { const [n, d] = rng.pick(proper(9, 2)); x = [n + d, d]; }
    const value = fraction(x[1], x[0]);
    return {
      instruction: 'Write the reciprocal.',
      expression: show(x),
      answer: { type: 'fraction', value, form: 'improper' },
      misconceptions: wrongs(value, [{ id: 'frac.recip-same', value: fraction(x[0], x[1]) }]),
    };
  },
};

// ---------- multiply by the reciprocal (answer already simplest) ----------
//   1: a whole number and a fraction (3 ÷ 2/5 = 15/2, or 2/5 ÷ 3 = 2/15)
//   2: two fractions, denominators up to 9;  3: up to 12, one may be bigger than 1
function simplestDivisions(difficulty, wantSimplest) {
  const out = [];
  if (difficulty === 1) {
    for (const [c, d] of proper(9)) for (const k of range(2, 9)) {
      if (k * d > 60) continue;
      if ((gcd(k * d, c) === 1) === wantSimplest) out.push([[k, 1], [c, d]]);
      if ((gcd(c, d * k) === 1) === wantSimplest) out.push([[c, d], [k, 1]]);
    }
    return out;
  }
  const max = difficulty === 2 ? 9 : 12;
  for (const [a, b] of proper(max)) for (const [c, d] of proper(max)) {
    if (a * d === b * c || a * d > 60 || b * c > 60) continue; // keep the numbers in the answer small
    if ((gcd(a * d, b * c) === 1) === wantSimplest) out.push([[a, b], [c, d]]);
  }
  return out;
}
const POOLS = {};
const pool = (difficulty, wantSimplest) => (POOLS[`${difficulty}${wantSimplest}`] ||= simplestDivisions(difficulty, wantSimplest));

const multiplyReciprocal = {
  version: 1,
  alsoUses: ['frac.divide.reciprocal'],
  generate(rng, difficulty) {
    let [x, y] = rng.pick(pool(difficulty, true));
    // Sometimes 7/4 instead of 3/4, if the answer stays simplest and small.
    const bigger = [x[0] + x[1], x[1]];
    if (difficulty === 3 && rng.chance(0.4) && gcd(bigger[0] * y[1], bigger[1] * y[0]) === 1 && bigger[0] * y[1] <= 60) x = bigger;
    return divisionProblem(x, y);
  },
};

// ---------- whole skill ----------
//   1: two fractions, already simplest;  2: two fractions, needs simplifying;
//   3: needs simplifying, with whole numbers or bigger denominators
const full = {
  version: 1,
  covers: ['frac.divide.meaning', 'frac.divide.reciprocal', 'frac.divide.multiply-reciprocal'],
  ifNotSimplified: 'frac.multiply.simplify',
  generate(rng, difficulty) {
    if (difficulty === 1) return divisionProblem(...rng.pick(pool(2, true)));
    const [x, y] = rng.pick(pool(difficulty === 2 ? 2 : rng.pick([1, 3]), false));
    return divisionProblem(x, y);
  },
};

export const divideGenerators = {
  'frac.divide': full,
  'frac.divide.meaning': meaning,
  'frac.divide.reciprocal': reciprocal,
  'frac.divide.multiply-reciprocal': multiplyReciprocal,
};
