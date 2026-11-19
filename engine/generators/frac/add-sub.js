// Problem generators for the skill "Add and subtract fractions" (frac.add-sub).
//
// One generator per diagnostic subskill, plus a "full" generator for complete
// unlike-denominator problems (the diagnostic's starting question).
//
// Every generator: generate(rng, difficulty) -> problem, where difficulty is 1, 2 or 3.
// A problem contains:
//   instruction      what the student is asked to do
//   expression       the math to display (see engine/problem/text.js)
//   answer           what counts as right (see engine/grading/check-answer.js)
//   misconceptions   wrong answers that reveal a specific misunderstanding
//
// IMPORTANT: the server re-creates problems from the seed to check saved work.
// If you change what a generator produces, bump its `version` and update the
// saved examples with `npm run update-golden`. The tests will remind you.
//
// Design choices:
//   - Denominators stay at 12 or below: the goal is diagnosing understanding,
//     not testing big-number arithmetic.
//   - Fractions shown in a problem are always in simplest form.
//   - Each subskill's problems isolate that subskill where possible (e.g. the
//     "combine" problems never need simplifying, so a wrong answer there is
//     about combining, not simplifying).

import { fraction, gcd, lcm, add, sub, equals, reduce } from '../../math/fraction.js';

const MAX_DEN = 12;

// ---------- building blocks ----------

const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const coprime = (a, b) => gcd(a, b) === 1;
const frac = (n, d) => ({ type: 'frac', n, d });
const mixed = (whole, n, d) => ({ type: 'mixed', whole, n, d });
const op = (sym, left, right) => ({ type: 'op', op: sym, left, right });

// Numerators that make a proper fraction in simplest form with denominator d.
const properNumerators = (d) => range(1, d - 1).filter((n) => coprime(n, d));

// Pairs of different denominators, by difficulty:
//   1: one divides the other (3 and 6) -> the bigger one is the common denominator
//   2: no common factor (3 and 4)       -> multiply them
//   3: share a factor, neither divides the other (4 and 6) -> LCM is less than the product
// Common denominators are capped (40 at difficulty 2, 60 at difficulty 3) so the
// problems test fraction understanding, not big-number multiplication.
const DENOMINATOR_PAIRS = {
  1: pairs((a, b) => b % a === 0),
  2: pairs((a, b) => coprime(a, b) && a * b <= 40),
  3: pairs((a, b) => !coprime(a, b) && b % a !== 0 && lcm(a, b) <= 60),
};
function pairs(keep) {
  const out = [];
  for (const a of range(2, MAX_DEN)) for (const b of range(a + 1, MAX_DEN)) if (keep(a, b)) out.push([a, b]);
  return out;
}

function pickDenominatorPair(rng, difficulty) {
  const [a, b] = rng.pick(DENOMINATOR_PAIRS[difficulty]);
  return rng.chance(0.5) ? [a, b] : [b, a];
}

// Every (d, a, b) with a/d and b/d proper and in simplest form, kept if `keep` says so.
function likeDenominatorTriples(dens, keep) {
  const out = [];
  for (const d of dens) {
    for (const a of properNumerators(d)) for (const b of properNumerators(d)) if (keep(d, a, b)) out.push([d, a, b]);
  }
  return out;
}

// Wrong answers that point to misconceptions. Drops any that would accidentally
// be correct, aren't valid numbers, or repeat an earlier one.
function misconceptionList(correctMatches, candidates) {
  const out = [];
  for (const c of candidates) {
    if (c.value === null || c.value === undefined) continue;
    if (correctMatches(c.value)) continue;
    if (out.some((o) => sameValue(o.value, c.value))) continue;
    out.push(c);
  }
  return out;
}
function sameValue(x, y) {
  if (typeof x === 'number' || typeof y === 'number') return x === y;
  return equals(x, y);
}
// A fraction, or null if the denominator would be zero or negative.
const maybeFraction = (n, d) => (d > 0 ? fraction(n, d) : null);

function fractionAnswer(value) {
  return { type: 'fraction', value: reduce(value), form: 'any' };
}

// ---------- subskill: find a common denominator ----------

const commonDenom = {
  version: 1,
  generate(rng, difficulty) {
    const [b, d] = pickDenominatorPair(rng, difficulty);
    const a = rng.pick(properNumerators(b));
    const c = rng.pick(properNumerators(d));
    const least = lcm(b, d);
    const isCommon = (x) => x > 0 && x % b === 0 && x % d === 0;
    return {
      instruction: 'Find a common denominator for these two fractions.',
      expression: { type: 'list', items: [frac(a, b), frac(c, d)] },
      answer: { type: 'common-multiple', of: [b, d], least },
      misconceptions: misconceptionList(isCommon, [
        { id: 'frac.add-denominators', value: b + d },
        { id: 'frac.larger-denominator', value: Math.max(b, d) },
      ]),
    };
  },
};

// ---------- subskill: rewrite over the common denominator ----------

const rewrite = {
  version: 1,
  generate(rng, difficulty) {
    // How big the scale factor and starting denominator can be, by difficulty.
    const { maxDen, factors } = {
      1: { maxDen: 6, factors: [2, 3] },
      2: { maxDen: 10, factors: [2, 3, 4, 5] },
      3: { maxDen: 12, factors: [3, 4, 5, 6] },
    }[difficulty];
    const b = rng.int(2, maxDen);
    const k = rng.pick(factors);
    const a = rng.pick(properNumerators(b));
    const target = b * k;
    const correct = a * k;
    return {
      instruction: 'Fill in the missing numerator so the two fractions are equal.',
      expression: { type: 'eq', left: frac(a, b), right: frac({ type: 'blank' }, target) },
      answer: { type: 'integer', value: correct },
      misconceptions: misconceptionList((x) => x === correct, [
        { id: 'frac.additive-scaling', value: a + (target - b) },
        { id: 'frac.numerator-unchanged', value: a },
      ]),
    };
  },
};

// ---------- subskill: add/subtract numerators, keep the denominator ----------
// Same denominators, and the answer never needs simplifying.

const COMBINE = {
  1: likeDenominatorTriples(range(3, MAX_DEN), (d, a, b) => a + b < d && coprime(a + b, d)),
  2: likeDenominatorTriples(range(3, MAX_DEN), (d, a, b) => a + b > d && coprime(a + b, d)),
  3: likeDenominatorTriples(range(3, MAX_DEN), (d, a, b) => a > b && coprime(a - b, d)),
};

const combine = {
  version: 1,
  generate(rng, difficulty) {
    const [d, a, b] = rng.pick(COMBINE[difficulty]);
    const subtract = difficulty === 3;
    const value = subtract ? sub(fraction(a, d), fraction(b, d)) : add(fraction(a, d), fraction(b, d));
    return {
      instruction: `${subtract ? 'Subtract' : 'Add'}. Write your answer in simplest form.`,
      expression: op(subtract ? '-' : '+', frac(a, d), frac(b, d)),
      answer: fractionAnswer(value),
      misconceptions: misconceptionList((x) => equals(x, value), subtract ? [] : [
        { id: 'frac.add-across', value: fraction(a + b, 2 * d) },
      ]),
    };
  },
};

// ---------- subskill: simplify the result ----------
// Same denominators, and the raw answer ALWAYS needs simplifying.

const SIMPLIFY = {
  1: likeDenominatorTriples(range(4, MAX_DEN), (d, a, b) => a + b < d && !coprime(a + b, d)),
  2: likeDenominatorTriples(range(4, MAX_DEN), (d, a, b) => a > b && !coprime(a - b, d)),
  3: likeDenominatorTriples(range(4, MAX_DEN), (d, a, b) => a + b >= d && !coprime(a + b, d)),
};

const simplifyResult = {
  version: 1,
  generate(rng, difficulty) {
    const [d, a, b] = rng.pick(SIMPLIFY[difficulty]);
    const subtract = difficulty === 2;
    const value = subtract ? sub(fraction(a, d), fraction(b, d)) : add(fraction(a, d), fraction(b, d));
    return {
      instruction: `${subtract ? 'Subtract' : 'Add'}. Write your answer in simplest form.`,
      expression: op(subtract ? '-' : '+', frac(a, d), frac(b, d)),
      answer: fractionAnswer(value),
      misconceptions: misconceptionList((x) => equals(x, value), subtract ? [] : [
        { id: 'frac.add-across', value: fraction(a + b, 2 * d) },
      ]),
    };
  },
};

// ---------- subskill: mixed numbers, including regrouping ----------
//   1: add, no regrouping (1 1/5 + 2 2/5)
//   2: add, fractions make more than a whole (1 3/5 + 2 4/5)
//   3: subtract, must regroup (3 1/4 - 1 3/4)

const MIXED = {
  1: likeDenominatorTriples(range(3, MAX_DEN), (d, a, b) => a + b < d && coprime(a + b, d)),
  2: likeDenominatorTriples(range(3, MAX_DEN), (d, a, b) => a + b > d && coprime(a + b - d, d)),
  3: likeDenominatorTriples(range(3, MAX_DEN), (d, a, b) => a < b && coprime(d + a - b, d)),
};

const mixedNumbers = {
  version: 1,
  generate(rng, difficulty) {
    const [d, a, b] = rng.pick(MIXED[difficulty]);
    const subtract = difficulty === 3;
    let w1;
    let w2;
    if (subtract) {
      w1 = rng.int(3, 9);
      w2 = rng.int(1, w1 - 2); // keeps the answer's whole-number part at least 1
    } else {
      w1 = rng.int(1, 6);
      w2 = rng.int(1, 6);
    }
    const first = fraction(w1 * d + a, d);
    const second = fraction(w2 * d + b, d);
    const value = subtract ? sub(first, second) : add(first, second);

    const candidates = subtract
      ? [
          { id: 'frac.mixed-subtract-reversed', value: fraction((w1 - w2) * d + (b - a), d) },
          d === 10 ? null : { id: 'frac.mixed-borrow-ten', value: fraction((w1 - w2 - 1) * d + (10 + a - b), d) },
        ].filter(Boolean)
      : [];

    return {
      instruction: `${subtract ? 'Subtract' : 'Add'}. Write your answer in simplest form.`,
      expression: op(subtract ? '-' : '+', mixed(w1, a, d), mixed(w2, b, d)),
      answer: fractionAnswer(value),
      misconceptions: misconceptionList((x) => equals(x, value), candidates),
    };
  },
};

// ---------- whole skill: unlike denominators, start to finish ----------
//   1: one denominator divides the other, add
//   2: no common factor, add or subtract
//   3: shared factor (LCM < product), add or subtract

const full = {
  version: 1,
  generate(rng, difficulty) {
    const [b, d] = pickDenominatorPair(rng, difficulty);
    let x = fraction(rng.pick(properNumerators(b)), b);
    let y = fraction(rng.pick(properNumerators(d)), d);
    const subtract = difficulty > 1 && rng.chance(0.5);
    if (subtract && x.n * y.d < y.n * x.d) [x, y] = [y, x]; // keep answers positive
    const value = subtract ? sub(x, y) : add(x, y);
    const common = lcm(x.d, y.d);

    const candidates = subtract
      ? [
          { id: 'frac.subtract-across', value: maybeFraction(x.n - y.n, x.d - y.d) },
          { id: 'frac.numerators-not-scaled', value: fraction(x.n - y.n, common) },
        ]
      : [
          { id: 'frac.add-across', value: fraction(x.n + y.n, x.d + y.d) },
          { id: 'frac.numerators-not-scaled', value: fraction(x.n + y.n, common) },
        ];

    return {
      instruction: `${subtract ? 'Subtract' : 'Add'}. Write your answer in simplest form.`,
      expression: op(subtract ? '-' : '+', frac(x.n, x.d), frac(y.n, y.d)),
      answer: fractionAnswer(value),
      misconceptions: misconceptionList((v) => equals(v, value), candidates),
    };
  },
};

// Keyed by the skill or subskill ID in curriculum/graph/frac.json.
export const addSubGenerators = {
  'frac.add-sub': full,
  'frac.add-sub.common-denom': commonDenom,
  'frac.add-sub.rewrite': rewrite,
  'frac.add-sub.combine': combine,
  'frac.add-sub.simplify-result': simplifyResult,
  'frac.add-sub.mixed': mixedNumbers,
};
