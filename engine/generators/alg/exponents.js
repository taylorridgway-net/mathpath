// Generators for "Exponents" (alg.exponents). Whole-number exponents only,
// including 0 (owner decision 2026-11-20: no negative exponents for now).
// See engine/generators/frac/add-sub.js for what a generator returns.

import { evaluate } from './evaluate.js';

const int = (value) => ({ type: 'int', value });
const op = (sym, left, right) => ({ type: 'op', op: sym, left, right });
const group = (of) => ({ type: 'group', of });
const pow = (base, exp) => ({ type: 'pow', base, exp });
const neg = (of) => ({ type: 'neg', of });
const answerFor = (value) => ({ type: 'integer', value, allowNegative: true });

function problem(e, candidates) {
  const value = evaluate(e);
  const out = [];
  for (const c of candidates) if (c.value !== null && Number.isInteger(c.value) && c.value !== value && !out.some((m) => m.value === c.value)) out.push(c);
  return { instruction: 'Find the value.', expression: e, answer: answerFor(value), misconceptions: out };
}

// ---------- evaluate a power ----------
//   1: squares to 12² and cubes to 5³;  2: powers of 2, 3 and 10, and anything to the 0 or 1;  3: bigger cubes and fourth powers
const evaluatePower = {
  version: 1,
  generate(rng, difficulty) {
    let base;
    let exp;
    if (difficulty === 1) [base, exp] = rng.chance(0.6) ? [rng.int(2, 12), 2] : [rng.int(2, 5), 3];
    else if (difficulty === 2) {
      [base, exp] = rng.pick([
        () => [2, rng.int(3, 6)], () => [3, rng.int(3, 4)], () => [10, rng.int(2, 5)], () => [rng.int(2, 15), 0], () => [rng.int(2, 15), 1], () => [1, rng.int(3, 9)],
      ])();
    } else [base, exp] = rng.pick([() => [rng.int(6, 10), 3], () => [rng.int(2, 5), 4], () => [2, rng.int(7, 10)], () => [rng.int(20, 99), 0]])();
    return problem(pow(int(base), exp), [
      { id: 'alg.exp-times', value: base * exp }, // 2⁴ = 8
      { id: 'alg.exp-zero', value: exp === 0 ? 0 : null }, // 7⁰ = 0
      { id: 'alg.exp-zero', value: exp === 0 ? base : null }, // 7⁰ = 7
    ]);
  },
};

// ---------- negative bases ----------
//   1: (−3)²: the base is negative, so a positive answer;  2: −3²: only 3 is squared, so negative;
//   3: odd powers and both kinds mixed ((−2)³, −2⁴)
const negativeBase = {
  version: 1,
  generate(rng, difficulty) {
    const kind = difficulty === 1 ? 'paren' : difficulty === 2 ? 'front' : rng.pick(['paren', 'front']);
    const exp = difficulty === 3 ? rng.int(3, 4) : 2;
    const a = exp === 2 ? rng.int(2, 12) : rng.int(2, 5);
    const e = kind === 'paren' ? pow(int(-a), exp) : neg(pow(int(a), exp));
    const value = evaluate(e);
    return problem(e, [
      { id: 'alg.exp-negative-base', value: -value }, // (−3)² = −9, or −3² = 9
      { id: 'alg.exp-times', value: (kind === 'paren' ? -a : a) * exp * (kind === 'front' ? -1 : 1) },
    ]);
  },
};

// ---------- powers in the order of operations ----------
//   1: 2 + 3², 4 × 2³;  2: (2 + 3)², (6 − 4)³;  3: two powers, or a power with × and − (5 × 2² − 3)
const inOrder = {
  version: 1,
  alsoUses: ['alg.exponents.evaluate'],
  generate(rng, difficulty) {
    const small = () => int(rng.int(2, 5));
    let e;
    let wrong;
    if (difficulty === 1) {
      const [a, b, x] = [rng.int(1, 12), rng.int(2, 5), rng.pick([2, 2, 3])];
      const sym = rng.pick(['+', '×']);
      e = op(sym, int(a), pow(int(b), x));
      wrong = { id: 'alg.exp-power-last', value: (sym === '+' ? a + b : a * b) ** x }; // (2 + 3)²
    } else if (difficulty === 2) {
      const [a, b] = [rng.int(1, 6), rng.int(1, 6)];
      const sym = rng.pick(['+', '-']);
      const [p, q] = sym === '-' && a < b ? [b, a] : [a, b];
      const x = rng.pick([2, 2, 3]);
      e = pow(group(op(sym, int(p), int(q))), x);
      wrong = { id: 'alg.exp-each-term', value: sym === '+' ? p ** x + q ** x : p ** x - q ** x }; // (2 + 3)² = 2² + 3²
    } else {
      const [a, b, c] = [rng.int(2, 6), rng.int(2, 4), rng.int(1, 9)];
      e = rng.chance(0.5) ? op('-', op('×', int(a), pow(int(b), 2)), int(c)) : op('+', pow(small(), 2), pow(small(), 2));
      wrong = { id: 'alg.exp-power-last', value: e.type === 'op' && e.op === '-' ? (a * b) ** 2 - c : null }; // (5 × 2)² − 3
    }
    return problem(e, [wrong, { id: 'alg.exp-times', value: null }]);
  },
};

const mixed = {
  version: 1,
  mixed: true,
  // In the diagnostic one power-in-an-expression problem stands for evaluating powers too.
  // Negative bases rest on integer multiplying, so that part is checked on its own.
  screener: 'alg.exponents.in-order',
  covers: ['alg.exponents.evaluate', 'alg.exponents.in-order'],
  parts: ['alg.exponents.evaluate', 'alg.exponents.negative-base', 'alg.exponents.in-order'],
  generate(rng, difficulty) {
    const part = rng.pick(this.parts);
    return { ...parts[part].generate(rng, difficulty), part };
  },
};

const parts = {
  'alg.exponents.evaluate': evaluatePower,
  'alg.exponents.negative-base': negativeBase,
  'alg.exponents.in-order': inOrder,
};

export const exponentGenerators = { 'alg.exponents': mixed, ...parts };
