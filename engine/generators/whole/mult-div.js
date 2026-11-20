// Generators for "Multiply and divide whole numbers" (whole.mult-div):
// facts to 12 × 12, and dividing with a remainder. (Owner decision: no
// 2-digit multiplication or long division for now.)
//
// Facts problems carry slowAfterMs: in the diagnostic, a RIGHT answer that took
// longer than that counts as shaky, not known (owner decision). Never shown to students.

import { int, op, range, misconceptionList } from './common.js';

export const SLOW_FACT_MS = 5000;

// Factor pairs by difficulty:
//   1: one factor is 2, 5 or 10                       (5 × 7)
//   2: one factor is 3, 4, 6 or 11, the other 2-9     (4 × 6)
//   3: the hard ones: one factor 6, 7, 8, 9 or 12, the other 4-12 (7 × 8, 12 × 9)
const FACT_PAIRS = {
  1: pairs([2, 5, 10], range(2, 10)),
  2: pairs([3, 4, 6, 11], range(2, 9)),
  3: pairs([6, 7, 8, 9, 12], range(4, 12)),
};
function pairs(firsts, seconds) {
  const out = [];
  for (const a of firsts) for (const b of seconds) out.push([a, b]);
  return out;
}
function pickFact(rng, difficulty) {
  const [a, b] = rng.pick(FACT_PAIRS[difficulty]);
  return rng.chance(0.5) ? [a, b] : [b, a];
}

const multFacts = {
  version: 1,
  // In the diagnostic, only hard facts: 4 × 2 right says little about 7 × 8.
  diagnosticDifficulty: { probe: 3, confirm: 3 },
  generate(rng, difficulty) {
    const [a, b] = pickFact(rng, difficulty);
    const product = a * b;
    return {
      instruction: 'Multiply.',
      expression: op('×', int(a), int(b)),
      answer: { type: 'integer', value: product },
      slowAfterMs: SLOW_FACT_MS,
      misconceptions: misconceptionList(product, [
        { id: 'whole.neighbour-fact', value: a * (b - 1) },
        { id: 'whole.neighbour-fact', value: a * (b + 1) },
        { id: 'whole.neighbour-fact', value: (a - 1) * b },
        { id: 'whole.neighbour-fact', value: (a + 1) * b },
        { id: 'whole.added-not-multiplied', value: a + b },
      ]),
    };
  },
};

const divFacts = {
  version: 1,
  // In the diagnostic, only hard facts: 4 × 2 right says little about 7 × 8.
  diagnosticDifficulty: { probe: 3, confirm: 3 },
  generate(rng, difficulty) {
    const [a, b] = pickFact(rng, difficulty);
    const product = a * b;
    return {
      instruction: 'Divide.',
      expression: op('÷', int(product), int(a)),
      answer: { type: 'integer', value: b },
      slowAfterMs: SLOW_FACT_MS,
      misconceptions: misconceptionList(b, [
        { id: 'whole.neighbour-fact', value: b - 1 },
        { id: 'whole.neighbour-fact', value: b + 1 },
      ]),
    };
  },
};

// ---------- divide with a remainder ----------
//   1: divide by 2 or 5;   2: by 3, 4 or 6;   3: by 7, 8 or 9.   Quotient 2-12, remainder at least 1.
const DIVISORS = { 1: [2, 5], 2: [3, 4, 6], 3: [7, 8, 9] };

const remainders = {
  version: 1,
  alsoUses: ['whole.mult-div.div-facts'],
  generate(rng, difficulty) {
    const d = rng.pick(DIVISORS[difficulty]);
    const q = rng.int(2, 12);
    const r = rng.int(1, d - 1);
    const n = q * d + r;
    const same = (x, y) => x.quotient === y.quotient && x.remainder === y.remainder;
    const right = { quotient: q, remainder: r };
    return {
      instruction: 'Divide. Write the remainder too.',
      expression: op('÷', int(n), int(d)),
      answer: { type: 'quotient-remainder', ...right },
      misconceptions: misconceptionList(right, [
        { id: 'whole.remainder-too-big', value: { quotient: q - 1, remainder: r + d } },
        { id: 'whole.remainder-dropped', value: { quotient: q, remainder: 0 } },
      ], same).filter((m) => m.value.quotient >= 0),
    };
  },
};

const mixed = {
  version: 1,
  mixed: true, // a mix of its parts, not one whole problem (the diagnostic asks the parts instead)
  covers: ['whole.mult-div.mult-facts', 'whole.mult-div.div-facts', 'whole.mult-div.remainders'],
  generate(rng, difficulty) {
    const part = rng.pick(this.covers);
    return { ...multDivGenerators[part].generate(rng, difficulty), part };
  },
};

const multDivGenerators = {
  'whole.mult-div.mult-facts': multFacts,
  'whole.mult-div.div-facts': divFacts,
  'whole.mult-div.remainders': remainders,
};

export const wholeMultDivGenerators = { 'whole.mult-div': mixed, ...multDivGenerators };
