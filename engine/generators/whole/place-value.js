// Generators for "Place value and rounding" (whole.place-value).
// See engine/generators/frac/add-sub.js for what a generator returns.
// Numbers are shown with commas (46,382); students type the answer without them.

import { pickUntil, misconceptionList } from './common.js';

const PLACES = ['ones', 'tens', 'hundreds', 'thousands', 'ten thousands', 'hundred thousands'];
const commas = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const words = (text) => ({ type: 'words', text });
const answer = (value) => ({ type: 'integer', value });

// ---------- value of a digit ----------
//   1: 3-4 digits, "what is the value of the 7?"  2: 5 digits  3: 6 digits, or "how many hundreds are in 4,500?"-style
//   (a different digit in every place, so "the 7" is clear)
const digitValue = {
  version: 1,
  generate(rng, difficulty) {
    if (difficulty === 3 && rng.chance(0.35)) {
      // 10 times as much: "The 4 in 4,000 is how many times the 4 in 400?"
      const d = rng.int(2, 9);
      const lo = rng.int(1, 3);
      const hi = lo + rng.pick([1, 2]);
      const big = d * 10 ** hi;
      const small = d * 10 ** lo;
      return {
        instruction: 'Answer the question.',
        expression: words(`The ${d} in ${commas(big)} is how many times the value of the ${d} in ${commas(small)}?`),
        answer: answer(10 ** (hi - lo)),
        misconceptions: misconceptionList(10 ** (hi - lo), [
          { id: 'whole.place-value-count-zeros', value: hi - lo }, // counted the extra zeros
          { id: 'whole.place-value-count-zeros', value: big - small },
        ]),
      };
    }
    const len = { 1: rng.pick([3, 4]), 2: 5, 3: 6 }[difficulty];
    const ds = pickUntil(rng, () => Array.from({ length: len }, () => rng.int(0, 9)), (v) => v[0] !== 0 && new Set(v).size === len);
    const n = Number(ds.join(''));
    // The digit to ask about: not in the ones place, and not 0.
    const at = pickUntil(rng, () => rng.int(1, len - 1), (i) => ds[len - 1 - i] !== 0);
    const d = ds[len - 1 - at];
    const value = d * 10 ** at;
    return {
      instruction: `What is the value of the ${d}?`,
      expression: words(commas(n)),
      answer: answer(value),
      misconceptions: misconceptionList(value, [
        { id: 'whole.place-value-digit', value: d }, // just the digit
        { id: 'whole.place-value-off-by-one', value: d * 10 ** (at + 1) }, // one place too far
        { id: 'whole.place-value-off-by-one', value: d * 10 ** (at - 1) },
      ]),
    };
  },
};

// ---------- rounding ----------
//   1: to the nearest ten or hundred (3-digit)  2: to the nearest hundred or thousand (4-5 digits)
//   3: rounding that carries (9,962 to the nearest hundred = 10,000; 46,973 to the nearest thousand)
const round = {
  version: 1,
  generate(rng, difficulty) {
    let n;
    let to;
    if (difficulty === 1) {
      to = rng.pick([1, 2]);
      n = pickUntil(rng, () => rng.int(101, 999), (v) => v % 10 !== 0);
    } else if (difficulty === 2) {
      to = rng.pick([2, 3]);
      n = pickUntil(rng, () => rng.int(1001, 99999), (v) => v % 10 ** to !== 0);
    } else {
      to = rng.pick([2, 3]);
      const unit = 10 ** to;
      // A 9 just before the rounding place makes it carry: 9,962 -> 10,000.
      const top = rng.int(1, 9) * 10 + 9;
      n = top * unit + rng.int(unit / 2, unit - 1);
    }
    const unit = 10 ** to;
    const down = Math.floor(n / unit) * unit;
    const up = down + unit;
    const value = n - down >= unit / 2 ? up : down;
    const otherWay = value === up ? down : up;
    // Rounded to the next place along (hundreds when asked for thousands).
    const u = unit / 10;
    const nextPlace = u >= 10 ? (n - Math.floor(n / u) * u >= u / 2 ? Math.floor(n / u) * u + u : Math.floor(n / u) * u) : null;
    return {
      instruction: `Round to the nearest ${PLACES[to].replace(/s$/, '')}.`,
      expression: words(commas(n)),
      answer: answer(value),
      misconceptions: misconceptionList(value, [
        { id: 'whole.round-truncate', value: down }, // just changed the digits after it to zeros
        { id: 'whole.round-wrong-way', value: otherWay },
        { id: 'whole.round-wrong-place', value: nextPlace },
      ]),
    };
  },
};

const parts = {
  'whole.place-value.digits': digitValue,
  'whole.place-value.round': round,
};

export const placeValueGenerators = {
  // Reading place value and rounding are both asked (rounding uses place value, but a
  // student can know what a digit is worth and still round the wrong way).
  'whole.place-value': {
    version: 1,
    mixed: true,
    covers: ['whole.place-value.digits', 'whole.place-value.round'],
    generate(rng, difficulty) {
      const part = rng.pick(this.covers);
      return { ...parts[part].generate(rng, difficulty), part };
    },
  },
  ...parts,
};
