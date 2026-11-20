// Generators for "Equivalent fractions and simplest form" (frac.equivalent).
// See engine/generators/frac/add-sub.js for what a generator returns.

import { fraction, gcd, reduce } from '../../math/fraction.js';

const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const frac = (n, d) => ({ type: 'frac', n, d });
const op = (sym, left, right) => ({ type: 'op', op: sym, left, right });
const eq = (left, right) => ({ type: 'eq', left, right });
const blank = { type: 'blank' };
const properSimplest = (maxDen) => range(2, maxDen).flatMap((d) => range(1, d - 1).filter((n) => gcd(n, d) === 1).map((n) => [n, d]));

// ---------- scale: multiply top and bottom by the same number ----------
//   1: by 2 or 3, denominator up to 6;  2: by 2-5, up to 10;  3: by 4-9, up to 12.
// The answer is the scaled fraction EXACTLY (6/15, not 2/5): form 'exact'.
const SCALE = { 1: { k: [2, 3], max: 6 }, 2: { k: [2, 3, 4, 5], max: 10 }, 3: { k: [4, 5, 6, 7, 8, 9], max: 12 } };

const scale = {
  version: 1,
  generate(rng, difficulty) {
    const { k: ks, max } = SCALE[difficulty];
    const [a, b] = rng.pick(properSimplest(max));
    const k = rng.pick(ks);
    return {
      instruction: `Multiply the top and the bottom by ${k}. Write the new fraction (don't simplify it).`,
      expression: op('×', frac(a, b), frac(k, k)),
      answer: { type: 'fraction', value: fraction(a, b), form: 'exact', n: a * k, d: b * k },
      misconceptions: [
        { id: 'frac.eq-top-only', value: fraction(a * k, b) },
        { id: 'frac.eq-added', value: fraction(a + k, b + k) },
        { id: 'frac.eq-scaled-back', value: fraction(a, b), exact: true },
      ].filter((m) => m.exact || !(m.value.n * b === a * m.value.d)),
    };
  },
};

// ---------- missing: fill in the box ----------
//   1: the numerator is missing, by 2 or 3                  (3/4 = ?/12)
//   2: either number is missing, by 2-5                      (2/5 = 8/?)
//   3: the given fraction isn't in simplest form, so go through it (6/8 = ?/12 -> 9)
const missing = {
  version: 1,
  generate(rng, difficulty) {
    let left;
    let right;
    let answer;
    if (difficulty < 3) {
      const [a, b] = rng.pick(properSimplest(difficulty === 1 ? 6 : 10));
      const k = rng.pick(difficulty === 1 ? [2, 3] : [2, 3, 4, 5]);
      left = frac(a, b);
      const topMissing = difficulty === 1 || rng.chance(0.5);
      right = topMissing ? frac(blank, b * k) : frac(a * k, blank);
      answer = topMissing ? a * k : b * k;
    } else {
      // a/b in simplest form, shown as (a*m)/(b*m); asked for over b*k with k != m.
      const [a, b] = rng.pick(properSimplest(6));
      const [m, k] = rng.pick([[2, 3], [3, 2], [2, 5], [4, 3], [3, 4], [2, 4], [4, 2], [3, 5]]);
      left = frac(a * m, b * m);
      const topMissing = rng.chance(0.5);
      right = topMissing ? frac(blank, b * k) : frac(a * k, blank);
      answer = topMissing ? a * k : b * k;
    }
    // Adding instead of multiplying: the same difference top and bottom.
    const added = right.n === blank ? left.n + (right.d - left.d) : left.d + (right.n - left.n);
    return {
      instruction: 'Fill in the missing number so the two fractions are equal.',
      expression: eq(left, right),
      answer: { type: 'integer', value: answer },
      misconceptions: added !== answer && added > 0 ? [{ id: 'frac.eq-missing-added', value: added }] : [],
    };
  },
};

// ---------- simplify ----------
//   1: divide by 2 or 5 (6/8, 10/15);   2: by 3, 4 or 6 (9/12, 16/20);   3: by 6-12, bigger numbers (36/48, 42/56)
const SIMPLIFY = { 1: [2, 5], 2: [3, 4, 6], 3: [6, 7, 8, 9, 12] };

const simplify = {
  version: 1,
  ifNotSimplified: 'frac.equivalent.simplify',
  generate(rng, difficulty) {
    const g = rng.pick(SIMPLIFY[difficulty]);
    const [a, b] = rng.pick(properSimplest(difficulty === 3 ? 8 : 6).filter(([, d]) => d * g <= (difficulty === 3 ? 96 : 60)));
    const n = a * g;
    const d = b * g;
    return {
      instruction: 'Write this fraction in simplest form.',
      expression: frac(n, d),
      answer: { type: 'fraction', value: reduce(fraction(n, d)), form: 'any' },
      misconceptions: [{ id: 'frac.eq-divided-top-only', value: fraction(a, d) }].filter((m) => m.value.n * b !== a * m.value.d),
    };
  },
};

const mixed = {
  version: 1,
  mixed: true, // a mix of its parts, not one whole problem (the diagnostic asks the parts instead)
  covers: ['frac.equivalent.scale', 'frac.equivalent.missing', 'frac.equivalent.simplify'],
  generate(rng, difficulty) {
    const part = rng.pick(this.covers);
    return { ...parts[part].generate(rng, difficulty), part };
  },
};

const parts = {
  'frac.equivalent.scale': scale,
  'frac.equivalent.missing': missing,
  'frac.equivalent.simplify': simplify,
};

export const equivalentGenerators = { 'frac.equivalent': mixed, ...parts };
