// Generators for "Compare integers and absolute value" (int.compare).
// See engine/generators/frac/add-sub.js for what a generator returns.
//   int.compare.order: <, =, > buttons for two integers; "which is least / greatest?" buttons.
//   int.compare.abs:   absolute value, and distance between two numbers on the number line.

import { int, op, pickUntil } from '../whole/common.js';

const SIGNS = ['<', '=', '>'];
const sign = (x, y) => (x < y ? 0 : x === y ? 1 : 2);
const abs = (of) => ({ type: 'abs', of });
const neg = (of) => ({ type: 'neg', of });
const show = (v) => (v < 0 ? `−${-v}` : String(v));
const SIZE = { 1: 10, 2: 20, 3: 50 };

function choice(instruction, expression, options, correct, predictions) {
  const seen = new Set([correct]);
  const misconceptions = [];
  for (const [id, c] of predictions) {
    if (c === null || c < 0 || seen.has(c)) continue;
    seen.add(c);
    misconceptions.push({ id, choice: c });
  }
  return { instruction, expression, answer: { type: 'choice', options, correct }, misconceptions };
}

function integer(instruction, expression, value, candidates) {
  const misconceptions = [];
  for (const c of candidates) {
    if (c.value === null || c.value === value || misconceptions.some((m) => m.value === c.value)) continue;
    misconceptions.push(c);
  }
  return { instruction, expression, answer: { type: 'integer', value, allowNegative: true }, misconceptions };
}

// ---------- order ----------
//   1: a negative and a positive, or a negative and 0 (−7 ? 3)
//   2: two negatives (−3 ? −8): "the bigger digit is bigger" goes wrong
//   3: which of four is the least / the greatest (mixed signs)
const order = {
  version: 1,
  generate(rng, difficulty) {
    const n = SIZE[difficulty];
    if (difficulty === 3) {
      const xs = pickUntil(rng, () => Array.from({ length: 4 }, () => rng.int(-n, n)), (v) => new Set(v).size === 4 && v.filter((x) => x < 0).length >= 2 && v.some((x) => x > 0));
      const least = rng.chance(0.5);
      const right = least ? Math.min(...xs) : Math.max(...xs);
      const negs = xs.filter((x) => x < 0);
      // Thinks the negative with the biggest size... reads sizes only: least = smallest size, greatest = biggest size.
      const bySize = least ? xs.reduce((a, b) => (Math.abs(b) < Math.abs(a) ? b : a)) : xs.reduce((a, b) => (Math.abs(b) > Math.abs(a) ? b : a));
      // Least: picks the negative closest to 0 ("−2 is less than −9").
      const closest = least ? negs.reduce((a, b) => (b > a ? b : a)) : null;
      return choice(`Which number is the ${least ? 'least' : 'greatest'}?`, { type: 'words', text: xs.map(show).join(',  ') }, xs.map(show), xs.indexOf(right), [
        ['int.compare-size', xs.indexOf(bySize)],
        ['int.compare-closest-negative', closest === null ? null : xs.indexOf(closest)],
      ]);
    }
    let x;
    let y;
    if (difficulty === 1) {
      const a = -rng.int(1, n);
      const b = rng.chance(0.2) ? 0 : rng.int(1, n);
      [x, y] = rng.chance(0.5) ? [a, b] : [b, a];
    } else {
      [x, y] = pickUntil(rng, () => [-rng.int(1, n), -rng.int(1, n)], ([p, q]) => p !== q);
    }
    const correct = sign(x, y);
    return choice('Which sign goes in the box?', { type: 'compare', left: int(x), right: int(y) }, SIGNS, correct, [
      ['int.compare-size', sign(Math.abs(x), Math.abs(y))], // −8 > −3 because 8 > 3
    ]);
  },
};

// ---------- absolute value ----------
//   1: |−7|, |12|
//   2: −|−5|, |3 − 8|, |−4| + |6|
//   3: distance between two numbers on the number line (−4 and 6), in words sometimes
const absValue = {
  version: 1,
  generate(rng, difficulty) {
    const n = SIZE[difficulty];
    if (difficulty === 1) {
      const v = rng.chance(0.75) ? -rng.int(2, n) : rng.int(2, n);
      return integer('Find the value.', abs(int(v)), Math.abs(v), [
        { id: 'int.abs-opposite', value: -v }, // |−7| = −7 or |12| = −12: "the opposite"
        { id: 'int.abs-opposite', value: v },
      ]);
    }
    if (difficulty === 2) {
      const kind = rng.pick(['outside', 'inside', 'sum']);
      if (kind === 'outside') {
        const a = rng.int(2, n);
        return integer('Find the value.', neg(abs(int(-a))), -a, [
          { id: 'int.abs-outside-negative', value: a }, // the bars "cancel" the negative outside too
        ]);
      }
      if (kind === 'inside') {
        const [a, b] = pickUntil(rng, () => [rng.int(1, n), rng.int(1, n)], ([p, q]) => p < q);
        return integer('Find the value.', abs(op('-', int(a), int(b))), b - a, [
          { id: 'int.abs-opposite', value: a - b },
          { id: 'int.abs-each-first', value: a + b }, // |3 − 8| done as 3 + 8 (made each number positive... and added)
        ]);
      }
      const [a, b] = [rng.int(2, n), rng.int(2, n)];
      return integer('Find the value.', op('+', abs(int(-a)), abs(int(b))), a + b, [
        { id: 'int.abs-opposite', value: b - a },
      ]);
    }
    const [a, b] = pickUntil(rng, () => [-rng.int(1, n), rng.int(1, n)], ([p, q]) => -p !== q);
    const words = rng.chance(0.5);
    const ctx = rng.pick([
      (p, q) => `A diver is at ${p} feet. A bird is at ${q} feet. How many feet apart are they?`,
      (p, q) => `At night it was ${p} °F. At noon it was ${q} °F. How many degrees warmer was it at noon?`,
      (p, q) => `A submarine is at ${p} meters. A balloon is at ${q} meters. How many meters apart are they?`,
    ]);
    const text = words
      ? ctx(show(a), b)
      : `How far apart are ${show(a)} and ${b} on the number line?`;
    return integer('Answer the question.', { type: 'words', text }, b - a, [
      { id: 'int.distance-subtracted-sizes', value: Math.abs(b + a) }, // 6 and −4: 6 − 4 = 2
    ]);
  },
};

const parts = {
  'int.compare.order': order,
  'int.compare.abs': absValue,
};

export const intCompareGenerators = {
  // Ordering and absolute value are different ideas: each is asked.
  'int.compare': {
    version: 1,
    mixed: true,
    covers: ['int.compare.order', 'int.compare.abs'],
    generate(rng, difficulty) {
      const part = rng.pick(this.covers);
      return { ...parts[part].generate(rng, difficulty), part };
    },
  },
  ...parts,
};
