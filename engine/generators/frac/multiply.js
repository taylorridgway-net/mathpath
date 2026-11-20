// Generators for "Multiply fractions" (frac.multiply).
// See engine/generators/frac/add-sub.js for what a generator returns.
//
// Parts:
//   by-whole     3 × 2/7, and "2/3 of 12" (a fraction of an amount)
//   by-fraction  2/3 × 4/5: tops times tops, bottoms times bottoms (never needs simplifying,
//                so a miss here is about multiplying, not simplifying)
//   simplify     the product always needs simplifying (or cancelling first)
//   whole skill  a mix, needing simplifying at the higher levels
// Fractions shown are always in simplest form; denominators stay at 12 or below.

import { fraction, gcd, mul, add, equals, reduce } from '../../math/fraction.js';

const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const frac = (n, d) => ({ type: 'frac', n, d });
const int = (value) => ({ type: 'int', value });
const op = (sym, left, right) => ({ type: 'op', op: sym, left, right });
const proper = (maxDen, minDen = 2) => range(minDen, maxDen).flatMap((d) => range(1, d - 1).filter((n) => gcd(n, d) === 1).map((n) => [n, d]));
const answerFor = (value) => ({ type: 'fraction', value: reduce(value), form: 'any' });

// Wrong answers that point at a misunderstanding, minus any that equal the right answer or repeat.
function wrongs(value, candidates) {
  const out = [];
  for (const c of candidates) {
    if (!c.value || c.value.d <= 0 || c.value.n <= 0) continue;
    if (equals(c.value, value) || out.some((o) => equals(o.value, c.value))) continue;
    out.push(c);
  }
  return out;
}

// The usual mistakes with two fractions a/b × c/d.
function fractionMistakes(a, b, c, d) {
  return [
    // 2/5 × 3/5 -> 6/5: keeps the denominator as if adding
    { id: 'frac.mult-keep-denominator', value: b === d ? fraction(a * c, b) : null },
    // cross-multiplies: a×d over b×c
    { id: 'frac.mult-cross', value: fraction(a * d, b * c) },
    // adds instead
    { id: 'frac.mult-added', value: add(fraction(a, b), fraction(c, d)) },
  ];
}

// ---------- by-whole ----------
//   1: whole × fraction, answer less than 1 (2 × 3/7)
//   2: answer bigger than 1 (4 × 3/5 = 12/5 or 2 2/5)
//   3: a fraction of an amount, whole-number answer (2/3 of 12 = 8)
const byWhole = {
  version: 1,
  generate(rng, difficulty) {
    if (difficulty === 3) {
      const [a, b] = rng.pick(proper(10, 3).filter(([n]) => n > 1));
      const q = rng.pick(range(2, 9));
      const k = b * q;
      const value = fraction(a * k, b);
      return {
        instruction: `Find ${a}/${b} of ${k}.`,
        expression: op('of', frac(a, b), int(k)),
        answer: answerFor(value),
        misconceptions: wrongs(value, [
          { id: 'frac.of-divide-only', value: fraction(q, 1) },
          { id: 'frac.mult-whole-both', value: fraction(a, b) },
        ]),
      };
    }
    const pool = [];
    for (const [a, b] of proper(12, 3)) {
      for (const k of range(2, 9)) {
        if (gcd(a * k, b) !== 1) continue; // never needs simplifying
        if (difficulty === 1 ? a * k < b : a * k > b && a * k <= 3 * b) pool.push([k, a, b]);
      }
    }
    const [k, a, b] = rng.pick(pool);
    const value = fraction(k * a, b);
    const left = rng.chance(0.5);
    return {
      instruction: 'Multiply. Write your answer in simplest form.',
      expression: left ? op('×', int(k), frac(a, b)) : op('×', frac(a, b), int(k)),
      answer: answerFor(value),
      misconceptions: wrongs(value, [
        { id: 'frac.mult-whole-both', value: fraction(a, b) }, // k×a over k×b
        { id: 'frac.mult-whole-bottom', value: fraction(a, k * b) },
      ]),
    };
  },
};

// ---------- by-fraction ----------
//   1: denominators up to 5;  2: up to 9;  3: up to 12, one factor may be bigger than 1
// The product is already in simplest form.
const byFraction = {
  version: 1,
  generate(rng, difficulty) {
    const max = { 1: 5, 2: 9, 3: 12 }[difficulty];
    for (;;) {
      let [a, b] = rng.pick(proper(max));
      const [c, d] = rng.pick(proper(max));
      if (difficulty === 3 && rng.chance(0.4)) a += b; // 7/4 instead of 3/4
      if (gcd(a, b) !== 1 || gcd(a * c, b * d) !== 1 || b * d > 100) continue;
      const value = fraction(a * c, b * d);
      return {
        instruction: 'Multiply. Write your answer in simplest form.',
        expression: op('×', frac(a, b), frac(c, d)),
        answer: answerFor(value),
        misconceptions: wrongs(value, fractionMistakes(a, b, c, d)),
      };
    }
  },
};

// ---------- simplify ----------
//   1: denominators up to 6, simplify by 2, 3 or 4 (2/3 × 3/4 = 6/12 = 1/2)
//   2: denominators up to 9
//   3: up to 12, and a factor cancels both ways (4/9 × 3/8 = 1/6)
const simplify = {
  version: 1,
  alsoUses: ['frac.multiply.by-fraction'],
  ifNotSimplified: 'frac.multiply.simplify',
  generate(rng, difficulty) {
    const max = difficulty === 1 ? 6 : difficulty === 2 ? 9 : 12;
    for (;;) {
      const [a, b] = rng.pick(proper(max));
      const [c, d] = rng.pick(proper(max));
      const g = gcd(a * c, b * d);
      if (g === 1 || b * d > 100) continue;
      if (difficulty === 1 && g > 4) continue;
      if (difficulty === 3 && !(gcd(a, d) > 1 && gcd(c, b) > 1)) continue; // cancel both ways
      const value = mul(fraction(a, b), fraction(c, d));
      return {
        instruction: 'Multiply. Write your answer in simplest form.',
        expression: op('×', frac(a, b), frac(c, d)),
        answer: answerFor(value),
        misconceptions: wrongs(value, fractionMistakes(a, b, c, d)),
      };
    }
  },
};

// ---------- whole skill ----------
//   1: fraction × fraction, already simplest;  2: fraction × fraction that needs simplifying;
//   3: needs simplifying: two fractions, or a whole number times a fraction (6 × 5/8 = 15/4)
const full = {
  version: 1,
  covers: ['frac.multiply.by-whole', 'frac.multiply.by-fraction', 'frac.multiply.simplify'],
  ifNotSimplified: 'frac.multiply.simplify',
  generate(rng, difficulty) {
    if (difficulty === 1) return byFraction.generate(rng, 2);
    if (difficulty === 2 || rng.chance(0.5)) return simplify.generate(rng, difficulty);
    const pool = [];
    for (const [a, b] of proper(12, 3)) for (const k of range(2, 9)) if (gcd(k, b) > 1 && b % k !== 0 && (k * a) % b !== 0) pool.push([k, a, b]);
    const [k, a, b] = rng.pick(pool);
    const value = fraction(k * a, b);
    return {
      instruction: 'Multiply. Write your answer in simplest form.',
      expression: op('×', int(k), frac(a, b)),
      answer: answerFor(value),
      misconceptions: wrongs(value, [
        { id: 'frac.mult-whole-both', value: fraction(a, b) },
        { id: 'frac.mult-whole-bottom', value: fraction(a, k * b) },
      ]),
    };
  },
};

export const multiplyGenerators = {
  'frac.multiply': full,
  'frac.multiply.by-whole': byWhole,
  'frac.multiply.by-fraction': byFraction,
  'frac.multiply.simplify': simplify,
};
