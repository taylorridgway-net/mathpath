// Generators for "Solve inequalities" (alg.inequalities): one- and two-step,
// and the rule that multiplying or dividing by a negative number flips the sign.
// The student picks the sign and types the number: x > −3 (answer type 'inequality').
// See engine/generators/frac/add-sub.js for what a generator returns.

import { fraction, add, sub, mul, div, equals, reduce } from '../../math/fraction.js';

const int = (value) => ({ type: 'int', value });
const op = (sym, left, right) => ({ type: 'op', op: sym, left, right });
const ineq = (sign, left, right) => ({ type: 'ineq', op: sign, left, right });
const x = { type: 'var', name: 'x' };
const term = (coef) => (coef === 1 ? x : { type: 'term', coef, name: 'x' });
const F = (n, d = 1) => fraction(n, d);
const nonZero = (rng, lo, hi) => { for (;;) { const v = rng.int(lo, hi); if (v !== 0) return v; } };
const FLIP = { '<': '>', '>': '<', '≤': '≥', '≥': '≤' };
const STRICT = { '<': '≤', '≤': '<', '>': '≥', '≥': '>' }; // "or equal to" added or dropped
const SIGNS = ['<', '≤', '>', '≥'];

function problem(expression, sign, value, candidates) {
  const v = reduce(value);
  const out = [];
  for (const c of candidates) {
    if (!c || !c.value) continue;
    const w = reduce(c.value);
    if ((c.sign === sign && equals(w, v)) || out.some((m) => m.sign === c.sign && equals(m.value, w))) continue;
    out.push({ id: c.id, sign: c.sign, value: w });
  }
  return { instruction: 'Solve for x.', expression, answer: { type: 'inequality', sign, value: v }, misconceptions: out };
}

// a x + b (sign) c, solved: x (sign') (c − b)/a, flipping when a < 0.
function build(rng, a, b, value) {
  const sign = rng.pick(SIGNS);
  const c = add(mul(F(a), value), F(b));
  const lhs = b === 0 ? term(a) : b < 0 ? op('-', term(a), int(-b)) : op('+', term(a), int(b));
  const answerSign = a < 0 ? FLIP[sign] : sign;
  return { expression: ineq(sign, lhs, int(c.n / c.d)), sign: answerSign, c, raw: sign }; // c is whole by construction
}

// The mistakes, for a x + b (sign) c.
function mistakes(a, b, c, raw, answerSign, value) {
  return [
    a < 0 ? { id: 'alg.ineq-no-flip', sign: raw, value } : null, // forgot to flip
    a > 0 ? { id: 'alg.ineq-flipped-anyway', sign: FLIP[raw], value } : null, // flipped without a negative to divide by
    { id: 'alg.ineq-or-equal', sign: STRICT[answerSign], value }, // dropped or added "or equal to"
    b !== 0 ? { id: 'alg.ineq-wrong-inverse', sign: answerSign, value: div(add(c, F(b)), F(a)) } : null, // added b instead of subtracting
  ];
}

// ---------- solve (no flipping) ----------
//   1: one step (x + 4 > 9, 3x ≤ 12);  2: two steps, negatives allowed in the numbers (2x − 5 ≥ −11);
//   3: a fraction answer (4x + 1 < 7 -> x < 3/2)
const solveIneq = {
  version: 1,
  generate(rng, difficulty) {
    let a; let b; let v;
    if (difficulty === 1) {
      if (rng.chance(0.5)) { a = 1; b = nonZero(rng, -9, 9); } else { a = rng.int(2, 9); b = 0; }
      v = F(rng.int(1, 12));
    } else if (difficulty === 2) { a = rng.int(2, 9); b = nonZero(rng, -12, 12); v = F(nonZero(rng, -10, 10)); } else {
      a = rng.int(2, 6); b = nonZero(rng, -9, 9);
      let m; do m = nonZero(rng, -15, 15); while (m % a === 0);
      v = F(m, a);
    }
    const p = build(rng, a, b, v);
    return problem(p.expression, p.sign, v, mistakes(a, b, p.c, p.raw, p.sign, v));
  },
};

// ---------- flip the sign ----------
//   1: one step with a negative in front (−x > 4, −3x ≤ 12);  2: two steps (−2x + 5 > 11);
//   3: a fraction answer (−4x + 1 < 7 -> x > −3/2)
const flip = {
  version: 1,
  alsoUses: ['alg.inequalities.solve'],
  generate(rng, difficulty) {
    let a; let b; let v;
    if (difficulty === 1) { a = -rng.int(1, 9); b = 0; v = F(nonZero(rng, -10, 10)); } else if (difficulty === 2) {
      a = -rng.int(2, 9); b = nonZero(rng, -12, 12); v = F(nonZero(rng, -10, 10));
    } else {
      a = -rng.int(2, 6); b = nonZero(rng, -9, 9);
      let m; do m = nonZero(rng, -15, 15); while (m % a === 0);
      v = F(m, -a);
    }
    const p = build(rng, a, b, v);
    return problem(p.expression, p.sign, v, mistakes(a, b, p.c, p.raw, p.sign, v));
  },
};

// ---------- the whole skill ----------
// In the diagnostic one two-step inequality with a negative in front stands for both parts
// (owner: a right answer shows what it depends on). Practice mixes both kinds.
const full = {
  version: 1,
  covers: ['alg.inequalities.solve', 'alg.inequalities.flip'],
  // Level 2 (what the diagnostic asks) is always the kind with a negative in front.
  generate(rng, difficulty) {
    if (difficulty === 2) return flip.generate(rng, 2);
    return (rng.chance(0.5) ? flip : solveIneq).generate(rng, difficulty);
  },
};

export const inequalityGenerators = {
  'alg.inequalities': full,
  'alg.inequalities.solve': solveIneq,
  'alg.inequalities.flip': flip,
};
