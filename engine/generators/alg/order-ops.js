// Generators for "Order of operations" (alg.order-ops).
// See engine/generators/frac/add-sub.js for what a generator returns.
// Answers are whole numbers (negative ones in the integer part): the keypad shows (−).

import { evaluate } from './evaluate.js';

const int = (value) => ({ type: 'int', value });
const op = (sym, left, right) => ({ type: 'op', op: sym, left, right });
const group = (of) => ({ type: 'group', of });
const answerFor = (value) => ({ type: 'integer', value, allowNegative: true });

// The usual wrong ways, as wrong-answer patterns (only the ones that give a different answer).
export function orderMistakes(e, ids = {}) {
  const right = evaluate(e);
  const out = [];
  const add = (id, way) => {
    if (!id) return;
    const v = evaluate(e, way);
    if (Number.isInteger(v) && v !== right && !out.some((m) => m.value === v)) out.push({ id, value: v });
  };
  add(ids.leftToRight ?? 'alg.ops-left-to-right', 'leftToRight');
  add(ids.ignoreParens, 'ignoreParens');
  add(ids.addBeforeSub, 'addBeforeSub');
  add(ids.multBeforeDiv, 'multBeforeDiv');
  return out;
}

// Keep making problems until one has a whole-number answer that fits (and every division is exact).
function make(rng, build, ok = (v) => v >= 0) {
  for (let i = 0; i < 1000; i++) {
    const e = build();
    const v = evaluate(e);
    if (Number.isInteger(v) && ok(v)) return e;
  }
  throw new Error('order-ops: no problem found (generator bug)');
}

function problem(e, ids) {
  return {
    instruction: 'Find the value.',
    expression: e,
    answer: answerFor(evaluate(e)),
    misconceptions: orderMistakes(e, ids),
  };
}

const n = (rng, lo, hi) => int(rng.int(lo, hi));

// ---------- no parentheses ----------
//   1: two operations, one is × (2 + 3 × 4, 5 × 3 − 4);  2: three operations;
//   3: with ÷, and − then + left to right (20 − 6 + 4, 24 ÷ 4 × 2)
const noParens = {
  version: 1,
  generate(rng, difficulty) {
    const shapes = {
      1: [
        () => op('+', n(rng, 1, 20), op('×', n(rng, 2, 9), n(rng, 2, 9))),
        () => op('-', op('×', n(rng, 2, 9), n(rng, 2, 9)), n(rng, 1, 9)),
      ],
      2: [
        () => op('-', op('+', n(rng, 1, 20), op('×', n(rng, 2, 9), n(rng, 2, 9))), n(rng, 1, 9)),
        () => op('+', op('×', n(rng, 2, 9), n(rng, 2, 9)), op('×', n(rng, 2, 9), n(rng, 2, 9))),
        () => op('+', op('-', n(rng, 30, 60), op('×', n(rng, 2, 6), n(rng, 2, 6))), n(rng, 1, 9)),
      ],
      3: [
        () => { const d = rng.int(2, 9); return op('×', op('÷', int(d * rng.int(2, 9)), int(d)), n(rng, 2, 6)); },
        () => op('+', op('-', n(rng, 15, 40), n(rng, 2, 9)), n(rng, 2, 9)),
        () => { const d = rng.int(2, 9); return op('-', op('+', n(rng, 2, 20), op('÷', int(d * rng.int(2, 9)), int(d))), n(rng, 1, 5)); },
      ],
    }[difficulty];
    return problem(make(rng, rng.pick(shapes)), { addBeforeSub: 'alg.ops-add-before-subtract', multBeforeDiv: 'alg.ops-multiply-before-divide' });
  },
};

// ---------- parentheses ----------
//   1: (2 + 3) × 4;  2: two groups or a group and another operation;  3: a minus sign before parentheses (20 − (8 − 3))
const parens = {
  version: 1,
  alsoUses: [],
  generate(rng, difficulty) {
    const shapes = {
      1: [
        () => op('×', group(op('+', n(rng, 1, 9), n(rng, 1, 9))), n(rng, 2, 9)),
        () => op('×', n(rng, 2, 9), group(op('-', n(rng, 6, 15), n(rng, 1, 5)))),
      ],
      2: [
        () => op('+', n(rng, 1, 20), op('×', group(op('+', n(rng, 1, 9), n(rng, 1, 6))), n(rng, 2, 6))),
        () => op('×', group(op('+', n(rng, 1, 6), n(rng, 1, 6))), group(op('-', n(rng, 6, 12), n(rng, 1, 5)))),
      ],
      3: [
        () => op('-', n(rng, 20, 40), group(op('-', n(rng, 8, 15), n(rng, 1, 7)))),
        () => op('×', group(op('+', n(rng, 1, 9), op('×', n(rng, 2, 5), n(rng, 2, 5)))), n(rng, 2, 4)),
        () => op('-', n(rng, 30, 60), op('×', n(rng, 2, 5), group(op('+', n(rng, 1, 6), n(rng, 1, 6))))),
      ],
    }[difficulty];
    return problem(make(rng, rng.pick(shapes)), { ignoreParens: 'alg.ops-ignored-parentheses' });
  },
};

// ---------- with negative numbers ----------
//   1: −2 + 3 × 4,  5 × (−3) + 7;  2: (−4 − 2) × 3,  −2 × (−5) − 6;  3: with ÷ and two negatives
const integers = {
  version: 1,
  generate(rng, difficulty) {
    const neg = (lo, hi) => int(-rng.int(lo, hi));
    const shapes = {
      1: [
        () => op('+', neg(1, 12), op('×', n(rng, 2, 6), n(rng, 2, 6))),
        () => op('+', op('×', n(rng, 2, 6), neg(2, 6)), n(rng, 1, 12)),
      ],
      2: [
        () => op('×', group(op('-', neg(1, 9), n(rng, 1, 9))), n(rng, 2, 5)),
        () => op('-', op('×', neg(2, 6), neg(2, 6)), n(rng, 1, 20)),
      ],
      3: [
        () => { const d = rng.int(2, 6); return op('-', n(rng, 1, 9), op('÷', int(d * rng.int(2, 6)), int(-d))); },
        () => { const d = rng.int(2, 5); return op('÷', group(op('+', neg(5, 20), n(rng, 1, 9))), int(d)); },
        () => op('-', neg(1, 9), op('×', n(rng, 2, 6), neg(2, 6))),
      ],
    }[difficulty];
    const e = make(rng, rng.pick(shapes), (v) => v !== 0);
    const value = evaluate(e);
    const p = problem(e, { ignoreParens: 'alg.ops-int-ignored-parentheses', leftToRight: 'alg.ops-int-left-to-right' });
    // Right steps, but the sign slipped.
    if (value !== 0 && !p.misconceptions.some((m) => m.value === -value)) p.misconceptions.push({ id: 'alg.ops-int-sign', value: -value });
    return p;
  },
};

// ---------- whole skill ----------
//   1: no parentheses (three operations);  2: parentheses and another operation;  3: harder parentheses, or negatives
const full = {
  version: 1,
  // Screens the skill: a right answer shows the order of operations with and without parentheses.
  // The negative-number part rests on integer skills, so it's checked on its own.
  covers: ['alg.order-ops.no-parens', 'alg.order-ops.parens'],
  generate(rng, difficulty) {
    if (difficulty === 1) return noParens.generate(rng, 2);
    if (difficulty === 2) return parens.generate(rng, 2);
    return rng.chance(0.5) ? parens.generate(rng, 3) : integers.generate(rng, 2);
  },
};

export const orderOpsGenerators = {
  'alg.order-ops': full,
  'alg.order-ops.no-parens': noParens,
  'alg.order-ops.parens': parens,
  'alg.order-ops.integers': integers,
};
