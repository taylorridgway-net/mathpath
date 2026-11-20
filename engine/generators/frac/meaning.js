// Generators for "Understand fractions" (frac.meaning): name a fraction from a
// picture, read a number line (including past 1), and fractions as division.
// See engine/generators/frac/add-sub.js for what a generator returns.
//
// Pictures always have a shaded count that can't be simplified (3 of 5, never
// 3 of 6), so "name the fraction" has one answer under the simplest-form rule.

import { fraction, gcd, equals, reduce } from '../../math/fraction.js';

const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const int = (value) => ({ type: 'int', value });
const op = (sym, left, right) => ({ type: 'op', op: sym, left, right });
const coprimeTo = (d, from = 1, to = d - 1) => range(from, to).filter((n) => gcd(n, d) === 1);
const answerOf = (n, d) => ({ type: 'fraction', value: reduce(fraction(n, d)), form: 'any' });
const keepWrong = (right, list) => list.filter((m) => m.value && m.value.d > 0 && !equals(m.value, right));

// ---------- name a fraction from a picture ----------
//   1: a bar cut into 2-6 parts;  2: a rectangle grid or a group of dots, up to 12;  3: any, 5-12 parts
const GRIDS = [[2, 2], [2, 3], [2, 4], [3, 3], [2, 5], [3, 4], [2, 6]];

const readModels = {
  version: 1,
  generate(rng, difficulty) {
    let model;
    if (difficulty === 1) {
      const parts = rng.int(2, 6);
      model = { type: 'model', shape: 'bar', parts, shaded: rng.pick(coprimeTo(parts)) };
    } else {
      const shape = difficulty === 3 ? rng.pick(['bar', 'area', 'set']) : rng.pick(['area', 'set']);
      if (shape === 'area') {
        const [rows, cols] = rng.pick(difficulty === 3 ? GRIDS.slice(3) : GRIDS.slice(0, 5));
        const parts = rows * cols;
        model = { type: 'model', shape, rows, cols, parts, shaded: rng.pick(coprimeTo(parts)) };
      } else {
        const parts = difficulty === 3 ? rng.int(5, 12) : rng.int(3, 8);
        model = { type: 'model', shape, parts, shaded: rng.pick(coprimeTo(parts)) };
      }
    }
    const { parts, shaded } = model;
    const right = fraction(shaded, parts);
    const noun = { bar: 'the bar', area: 'the rectangle', set: 'the dots' }[model.shape];
    return {
      instruction: `What fraction of ${noun} ${model.shape === 'set' ? 'are' : 'is'} shaded?`,
      expression: model,
      answer: answerOf(shaded, parts),
      misconceptions: keepWrong(right, [
        { id: 'frac.model-part-to-part', value: parts - shaded > 0 ? fraction(shaded, parts - shaded) : null },
        { id: 'frac.model-unshaded', value: fraction(parts - shaded, parts) },
      ]),
    };
  },
};

// ---------- read a number line ----------
//   1: 0 to 1, cut into 2-6;  2: 0 to 1, cut into 6-10;  3: 0 to 2 or 3, cut into 2-5, the dot past 1 (5/4)
const numberLine = {
  version: 1,
  generate(rng, difficulty) {
    let max = 1;
    let perUnit;
    let point;
    if (difficulty < 3) {
      perUnit = difficulty === 1 ? rng.int(2, 6) : rng.int(6, 10);
      point = rng.pick(coprimeTo(perUnit));
    } else {
      max = rng.pick([2, 3]);
      perUnit = rng.int(2, 5);
      point = rng.pick(range(perUnit + 1, max * perUnit - 1).filter((p) => gcd(p, perUnit) === 1));
    }
    const right = fraction(point, perUnit);
    return {
      instruction: max === 1 ? 'What number is at the dot? Write it as a fraction.' : 'What number is at the dot? Write it as a fraction or a mixed number.',
      expression: { type: 'numberline', max, perUnit, point },
      answer: answerOf(point, perUnit),
      misconceptions: keepWrong(right, [
        { id: 'frac.nl-counted-ticks', value: fraction(point, perUnit + 1) },
        { id: 'frac.nl-whole-line', value: max > 1 ? fraction(point, perUnit * max) : null },
      ]),
    };
  },
};

// ---------- fractions as division ----------
//   1: a ÷ b with a < b, as a fraction (3 ÷ 4 = 3/4)
//   2: a fraction that is a whole number (12/4 = 3, 6/6 = 1)
//   3: a ÷ b with a > b (7 ÷ 3 = 7/3 or 2 1/3)
const division = {
  version: 1,
  generate(rng, difficulty) {
    if (difficulty === 2) {
      const d = rng.int(2, 6);
      const k = rng.int(1, 5);
      return {
        instruction: 'What whole number is this fraction equal to?',
        expression: { type: 'frac', n: k * d, d },
        answer: answerOf(k * d, d),
        misconceptions: keepWrong(fraction(k, 1), [
          { id: 'frac.whole-subtracted', value: k * d - d > 0 ? fraction(k * d - d, 1) : null },
          { id: 'frac.division-flipped', value: fraction(d, k * d) },
        ]),
      };
    }
    const b = difficulty === 1 ? rng.int(2, 10) : rng.int(2, 6);
    const a = difficulty === 1 ? rng.pick(coprimeTo(b)) : rng.pick(range(b + 1, 4 * b).filter((x) => gcd(x, b) === 1));
    return {
      instruction: difficulty === 1 ? 'Write the division as a fraction.' : 'Write the division as a fraction or a mixed number.',
      expression: op('÷', int(a), int(b)),
      answer: answerOf(a, b),
      misconceptions: keepWrong(fraction(a, b), [{ id: 'frac.division-flipped', value: fraction(b, a) }]),
    };
  },
};

const mixed = {
  version: 1,
  mixed: true, // a mix of its parts, not one whole problem (the diagnostic asks the parts instead)
  covers: ['frac.meaning.read-models', 'frac.meaning.number-line', 'frac.meaning.division'],
  generate(rng, difficulty) {
    const part = rng.pick(this.covers);
    return { ...parts[part].generate(rng, difficulty), part };
  },
};

const parts = {
  'frac.meaning.read-models': readModels,
  'frac.meaning.number-line': numberLine,
  'frac.meaning.division': division,
};

export const meaningGenerators = { 'frac.meaning': mixed, ...parts };
