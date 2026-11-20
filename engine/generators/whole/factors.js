// Generators for "Factors and multiples" (whole.factors-multiples):
// all the factors of a number, prime factorization, GCF, LCM.

import { int, range, pickUntil, misconceptionList, gcd, lcm } from './common.js';

const factorsOf = (n) => range(1, n).filter((d) => n % d === 0);
const isPrime = (n) => n > 1 && factorsOf(n).length === 2;
const primeFactors = (n) => {
  const out = [];
  for (let p = 2, m = n; m > 1; p++) while (m % p === 0) { out.push(p); m /= p; }
  return out;
};

// ---------- all the factors ----------
//   1: 12-30 with at least 4 factors (18);   2: 30-60 with at least 6 (48);   3: 60-100 with at least 8 (84)
const FACTOR_NUMBERS = {
  1: range(12, 30).filter((n) => factorsOf(n).length >= 4),
  2: range(30, 60).filter((n) => factorsOf(n).length >= 6),
  3: range(60, 100).filter((n) => factorsOf(n).length >= 8),
};

const factors = {
  version: 1,
  generate(rng, difficulty) {
    const n = rng.pick(FACTOR_NUMBERS[difficulty]);
    return {
      instruction: `List all the factors of ${n}.`,
      expression: int(n),
      answer: { type: 'set', values: factorsOf(n), of: n },
      misconceptions: [
        { id: 'whole.multiples-not-factors', test: 'multiples-not-factors' },
        { id: 'whole.factor-pairs-missed', test: 'some-factors-missing' },
      ],
    };
  },
};

// ---------- prime factorization ----------
//   1: 2-3 primes from 2, 3, 5, at most 30 (12 = 2 × 2 × 3)
//   2: 3-4 primes from 2, 3, 5, 7, at most 100 (84 = 2 × 2 × 3 × 7)
//   3: 3-5 primes from 2-13, 60-200, with a repeat (150 = 2 × 3 × 5 × 5)
const PRIME_SETS = {
  1: { primes: [2, 3, 5], count: [2, 3], min: 4, max: 30 },
  2: { primes: [2, 3, 5, 7], count: [3, 4], min: 20, max: 100 },
  3: { primes: [2, 3, 5, 7, 11, 13], count: [3, 5], min: 60, max: 200 },
};

const primes = {
  version: 1,
  alsoUses: ['whole.factors-multiples.factors'],
  generate(rng, difficulty) {
    const set = PRIME_SETS[difficulty];
    const list = pickUntil(rng, () => {
      const k = rng.int(...set.count);
      return Array.from({ length: k }, () => rng.pick(set.primes)).sort((a, b) => a - b);
    }, (xs) => {
      const n = xs.reduce((p, x) => p * x, 1);
      return n >= set.min && n <= set.max && (difficulty < 3 || new Set(xs).size < xs.length);
    });
    const n = list.reduce((p, x) => p * x, 1);
    return {
      instruction: `Write ${n} as a product of primes.`,
      expression: int(n),
      answer: { type: 'multiset', values: list, product: n },
      misconceptions: [{ id: 'whole.not-all-prime', test: 'product-right-not-all-prime' }],
    };
  },
};

// ---------- greatest common factor ----------
//   1: both at most 30;   2: at most 60;   3: at most 100.
//   From 2 on, neither number divides the other (the GCF isn't just the smaller number),
//   and the GCF is at least 3 (level 2) or 4 (level 3), so it isn't almost always 2.
const LIMIT = { 1: 30, 2: 60, 3: 100 };

const gcfGen = {
  version: 1,
  alsoUses: ['whole.factors-multiples.factors'],
  generate(rng, difficulty) {
    const [a, b] = pickUntil(rng, () => [rng.int(4, LIMIT[difficulty]), rng.int(4, LIMIT[difficulty])], ([x, y]) => {
      const g = gcd(x, y);
      if (x === y || g < 2) return false;
      if (difficulty >= 2 && (x % y === 0 || y % x === 0)) return false;
      return g >= [0, 2, 3, 4][difficulty];
    });
    const g = gcd(a, b);
    return {
      instruction: `Find the greatest common factor of ${a} and ${b}.`,
      expression: { type: 'list', items: [int(a), int(b)] },
      answer: { type: 'integer', value: g },
      misconceptions: misconceptionList(g, [
        { id: 'whole.gave-lcm', value: lcm(a, b) },
        ...factorsOf(g).filter((d) => d > 1 && d < g).map((d) => ({ id: 'whole.common-not-greatest', value: d })),
      ]),
    };
  },
};

// ---------- least common multiple ----------
//   1: both 2-10;   2: 4-12, sharing a factor (LCM less than the product);   3: 6-20, sharing a factor, LCM at most 120
const lcmGen = {
  version: 1,
  generate(rng, difficulty) {
    const [lo, hi] = { 1: [2, 10], 2: [4, 12], 3: [6, 20] }[difficulty];
    const [a, b] = pickUntil(rng, () => [rng.int(lo, hi), rng.int(lo, hi)], ([x, y]) => {
      if (x === y || x % y === 0 || y % x === 0) return false;
      if (difficulty >= 2 && gcd(x, y) === 1) return false;
      return lcm(x, y) <= 120;
    });
    const m = lcm(a, b);
    return {
      instruction: `Find the least common multiple of ${a} and ${b}.`,
      expression: { type: 'list', items: [int(a), int(b)] },
      answer: { type: 'integer', value: m },
      misconceptions: misconceptionList(m, [
        { id: 'whole.gave-gcf', value: gcd(a, b) > 1 ? gcd(a, b) : null },
        { id: 'whole.product-not-least', value: a * b },
      ]),
    };
  },
};

const mixed = {
  version: 1,
  mixed: true, // a mix of its parts, not one whole problem (the diagnostic asks the parts instead)
  covers: ['whole.factors-multiples.factors', 'whole.factors-multiples.primes', 'whole.factors-multiples.gcf', 'whole.factors-multiples.lcm'],
  generate(rng, difficulty) {
    const part = rng.pick(this.covers);
    return { ...factorGenerators[part].generate(rng, difficulty), part };
  },
};

const factorGenerators = {
  'whole.factors-multiples.factors': factors,
  'whole.factors-multiples.primes': primes,
  'whole.factors-multiples.gcf': gcfGen,
  'whole.factors-multiples.lcm': lcmGen,
};

export const wholeFactorGenerators = { 'whole.factors-multiples': mixed, ...factorGenerators };
export { isPrime, factorsOf, primeFactors };
