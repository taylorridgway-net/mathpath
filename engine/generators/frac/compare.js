// Generators for "Compare and order fractions" (frac.compare). Answered with
// buttons: <, =, > (or "closest to 0, 1/2 or 1").
// See engine/generators/frac/add-sub.js for what a generator returns.
//
// A wrong button is matched to a misconception by asking what each classic
// mistake would choose: comparing only the tops, "bigger denominator means
// bigger fraction", or "same number of pieces missing means equal".

import { gcd } from '../../math/fraction.js';

const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const frac = (n, d) => ({ type: 'frac', n, d });
const SIGNS = ['<', '=', '>'];
const sign = (x, y) => (x < y ? 0 : x === y ? 1 : 2);
const signOf = (a, b, c, d) => sign(a * d, c * b); // a/b ? c/d
const simplest = (n, d) => gcd(n, d) === 1;

function compareProblem({ left, right, instruction }, predictions) {
  const value = (f) => (f.type === 'int' ? [f.value, 1] : [f.n, f.d]);
  const [a, b] = value(left);
  const [c, d] = value(right);
  const correct = signOf(a, b, c, d);
  const seen = new Set([correct]);
  const misconceptions = [];
  for (const [id, choice] of predictions(a, b, c, d)) {
    if (choice === null || seen.has(choice)) continue;
    seen.add(choice);
    misconceptions.push({ id, choice });
  }
  return {
    instruction: instruction || 'Which sign goes in the box?',
    expression: { type: 'compare', left, right },
    answer: { type: 'choice', options: SIGNS, correct },
    misconceptions,
  };
}

// ---------- same denominator ----------
//   1: proper, denominator 3-10 (5/8 ? 3/8);  2: denominator up to 12, may be bigger than 1;  3: both bigger than 1
const like = {
  version: 1,
  generate(rng, difficulty) {
    const d = rng.int(3, difficulty === 1 ? 10 : 12);
    const [lo, hi] = { 1: [1, d - 1], 2: [1, 2 * d - 1], 3: [d + 1, 3 * d - 1] }[difficulty];
    const pool = range(lo, hi).filter((n) => simplest(n, d) && n % d !== 0);
    const a = rng.pick(pool);
    const c = rng.pick(pool.filter((n) => n !== a));
    return compareProblem({ left: frac(a, d), right: frac(c, d) }, () => []);
  },
};

// ---------- benchmarks ----------
//   1: more or less than 1/2;  2: more or less than 1;  3: closest to 0, 1/2 or 1
const benchmark = {
  version: 1,
  generate(rng, difficulty) {
    if (difficulty === 3) {
      const b = rng.int(5, 12);
      const options = ['0', '{1/2}', '1'];
      const a = rng.pick(range(1, b - 1).filter((n) => {
        if (!simplest(n, b)) return false;
        const dist = [n / b, Math.abs(n / b - 0.5), 1 - n / b].sort((x, y) => x - y);
        return dist[1] - dist[0] >= 1 / 12; // a clear winner, no near-ties
      }));
      const dists = [a / b, Math.abs(a / b - 0.5), 1 - a / b];
      return {
        instruction: 'Which number is this fraction closest to?',
        expression: frac(a, b),
        answer: { type: 'choice', options, correct: dists.indexOf(Math.min(...dists)) },
        misconceptions: [],
      };
    }
    const b = rng.int(3, 12);
    const pool = difficulty === 1
      ? range(1, b - 1).filter((n) => simplest(n, b) && 2 * n !== b)
      : range(1, 2 * b - 1).filter((n) => simplest(n, b) && n !== b);
    const a = rng.pick(pool);
    const right = difficulty === 1 ? frac(1, 2) : { type: 'int', value: 1 };
    // Comparing only the tops: 2/7 ? 1/2 looks like 2 > 1.
    return compareProblem({ left: frac(a, b), right }, (x, y, c) => [['frac.cmp-numerators-only', sign(x, c)]]);
  },
};

// ---------- different denominators ----------
//   1: same top, different bottoms (3/5 ? 3/8)
//   2: one bottom a multiple of the other (3/4 ? 5/8)
//   3: unrelated bottoms, close values, including "one piece missing" pairs (3/4 ? 5/6)
const unlike = {
  version: 1,
  alsoUses: [],
  generate(rng, difficulty) {
    let a;
    let b;
    let c;
    let d;
    const onePieceMissing = difficulty === 3 && rng.chance(0.4); // decided once, so retries don't skew the mix
    for (;;) {
      if (difficulty === 1) {
        [b, d] = [rng.int(3, 12), rng.int(3, 12)];
        a = rng.int(1, Math.min(b, d) - 1);
        c = a;
      } else if (difficulty === 2) {
        b = rng.int(3, 6);
        d = b * rng.pick([2, 3]);
        a = rng.int(1, b - 1);
        c = rng.int(1, d - 1);
      } else if (onePieceMissing) {
        // One piece missing from each: 3/4 ? 5/6.
        [b, d] = [rng.int(3, 9), rng.int(3, 9)];
        [a, c] = [b - 1, d - 1];
      } else {
        [b, d] = [rng.int(3, 12), rng.int(3, 12)];
        if (gcd(b, d) !== 1) continue;
        a = rng.int(1, b - 1);
        c = rng.int(1, d - 1);
        if (Math.abs(a / b - c / d) > 0.2) continue; // close, so a guess by eye won't do
      }
      if (b !== d && simplest(a, b) && simplest(c, d) && a * d !== c * b) break;
    }
    if (rng.chance(0.5)) [a, b, c, d] = [c, d, a, b]; // so "<" and ">" are equally likely
    return compareProblem({ left: frac(a, b), right: frac(c, d) }, (w, x, y, z) => [
      ['frac.cmp-numerators-only', w !== y ? sign(w, y) : null],
      ['frac.cmp-bigger-denominator-bigger', sign(x, z)],
      ['frac.cmp-gap-equal', x - w === z - y ? 1 : null],
    ]);
  },
};

const mixed = {
  version: 1,
  mixed: true, // a mix of its parts, not one whole problem (the diagnostic asks the parts instead)
  // ...but in the diagnostic, one comparison with different denominators stands for all three:
  // right credits them all, wrong checks each part.
  screener: 'frac.compare.unlike',
  covers: ['frac.compare.like', 'frac.compare.benchmark', 'frac.compare.unlike'],
  generate(rng, difficulty) {
    const part = rng.pick(this.covers);
    return { ...parts[part].generate(rng, difficulty), part };
  },
};

const parts = {
  'frac.compare.like': like,
  'frac.compare.benchmark': benchmark,
  'frac.compare.unlike': unlike,
};

export const compareGenerators = { 'frac.compare': mixed, ...parts };
