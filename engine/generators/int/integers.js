// Generators for integers: "Add and subtract integers" (int.add-sub) and
// "Multiply and divide integers" (int.mult-div).
// See engine/generators/frac/add-sub.js for what a generator returns.
// Answers are whole numbers that may be negative (answer.allowNegative: the keypad shows a (−) key).

import { int, op, range, pickUntil } from '../whole/common.js';

const signedAnswer = (value) => ({ type: 'integer', value, allowNegative: true });
const SIZE = { 1: 10, 2: 20, 3: 50 }; // biggest number shown, by level

// Wrong answers that point at a misunderstanding: skip any equal to the answer, or repeated.
function wrongs(value, candidates) {
  const out = [];
  for (const c of candidates) {
    if (c.value === null || c.value === value || out.some((o) => o.value === c.value)) continue;
    out.push(c);
  }
  return out;
}

function problem(instruction, expression, value, candidates) {
  return { instruction, expression, answer: signedAnswer(value), misconceptions: wrongs(value, candidates) };
}

// ---------- add two negatives:  −3 + (−5) ----------
const sameSign = {
  version: 1,
  generate(rng, difficulty) {
    const a = rng.int(2, SIZE[difficulty]);
    const b = rng.int(2, SIZE[difficulty]);
    const value = -(a + b);
    return problem('Add.', op('+', int(-a), int(-b)), value, [
      { id: 'int.dropped-negative', value: a + b },
      { id: 'int.subtracted-sizes', value: -Math.abs(a - b) || null },
    ]);
  },
};

// ---------- add a positive and a negative:  −7 + 4,  6 + (−9) ----------
const differentSigns = {
  version: 1,
  generate(rng, difficulty) {
    const [a, b] = pickUntil(rng, () => [rng.int(1, SIZE[difficulty]), rng.int(1, SIZE[difficulty])], ([x, y]) => x !== y);
    const negFirst = rng.chance(0.5);
    const [x, y] = negFirst ? [-a, b] : [a, -b];
    const value = x + y;
    return problem('Add.', op('+', int(x), int(y)), value, [
      { id: 'int.wrong-sign', value: -value },
      { id: 'int.added-sizes', value: Math.sign(value) * (a + b) },
    ]);
  },
};

// ---------- subtract:  3 − 8,  4 − (−6),  −5 − 7 ----------
//   1: smaller minus bigger positive (3 − 8);  2: minus a negative (4 − (−6), −2 − (−9));
//   3: a mix, including a negative minus a positive (−5 − 7)
const subtract = {
  version: 1,
  generate(rng, difficulty) {
    const n = SIZE[difficulty];
    const kind = difficulty === 3 ? rng.pick(['small-big', 'minus-negative', 'negative-minus']) : ['small-big', 'minus-negative'][difficulty - 1];
    let x;
    let y;
    if (kind === 'small-big') {
      [x, y] = pickUntil(rng, () => [rng.int(1, n), rng.int(1, n)], ([p, q]) => p < q);
    } else if (kind === 'minus-negative') {
      [x, y] = [rng.int(-n, n) || 1, -rng.int(1, n)];
    } else {
      [x, y] = [-rng.int(1, n), rng.int(1, n)];
    }
    const value = x - y;
    return problem('Subtract.', op('-', int(x), int(y)), value, [
      // 4 − (−6) worked as 4 − 6;  −5 − 7 worked as −5 + 7
      { id: 'int.sub-ignored-sign', value: kind === 'small-big' ? null : x + y },
      // 3 − 8 = 5: subtracted the small number from the big one
      { id: 'int.sub-backwards', value: kind === 'small-big' ? y - x : null },
      { id: 'int.wrong-sign-sub', value: -value || null },
    ]);
  },
};

// ---------- multiply:  −3 × 4,  −6 × (−7) ----------
//   1: one negative, facts to 9;  2: one or two negatives, facts to 12;  3: three numbers (−2 × 3 × (−5))
const multiply = {
  version: 1,
  generate(rng, difficulty) {
    const signs = (k) => {
      const s = Array.from({ length: k }, () => (rng.chance(0.5) ? -1 : 1));
      if (!s.includes(-1)) s[rng.int(0, k - 1)] = -1; // at least one negative
      return s;
    };
    if (difficulty === 3) {
      const sizes = [rng.int(2, 6), rng.int(2, 6), rng.int(2, 5)];
      const s = signs(3);
      const xs = sizes.map((v, i) => v * s[i]);
      const value = xs[0] * xs[1] * xs[2];
      return problem('Multiply.', op('×', op('×', int(xs[0]), int(xs[1])), int(xs[2])), value, [
        { id: 'int.mult-sign', value: -value },
      ]);
    }
    const max = difficulty === 1 ? 9 : 12;
    const a = rng.int(2, max);
    const b = rng.int(2, max);
    const s = difficulty === 1 ? (rng.chance(0.5) ? [-1, 1] : [1, -1]) : signs(2);
    const [x, y] = [a * s[0], b * s[1]];
    const value = x * y;
    return problem('Multiply.', op('×', int(x), int(y)), value, [
      { id: 'int.mult-sign', value: -value },
    ]);
  },
};

// ---------- divide:  −42 ÷ 6,  −42 ÷ (−7),  56 ÷ (−8) ----------
//   1: one negative, facts to 9;  2: one or two negatives, facts to 12;  3: two negatives, bigger facts (6-12)
const divide = {
  version: 1,
  generate(rng, difficulty) {
    const lo = difficulty === 3 ? 6 : 2;
    const max = difficulty === 1 ? 9 : 12;
    const q = rng.int(lo, max);
    const d = rng.int(lo, max);
    let s;
    if (difficulty === 1) s = rng.chance(0.5) ? [-1, 1] : [1, -1];
    else if (difficulty === 3) s = [-1, -1];
    else s = rng.pick([[-1, 1], [1, -1], [-1, -1]]);
    const [x, y] = [q * d * s[0], d * s[1]];
    const value = x / y;
    return problem('Divide.', op('÷', int(x), int(y)), value, [
      { id: 'int.div-sign', value: -value },
    ]);
  },
};

const mixedOf = (covers, screener) => ({
  version: 1,
  mixed: true,
  ...(screener ? { screener } : {}),
  covers,
  generate(rng, difficulty) {
    const part = rng.pick(this.covers);
    return { ...parts[part].generate(rng, difficulty), part };
  },
});

const parts = {
  'int.add-sub.same-sign': sameSign,
  'int.add-sub.different-signs': differentSigns,
  'int.add-sub.subtract': subtract,
  'int.mult-div.multiply': multiply,
  'int.mult-div.divide': divide,
};

export const integerGenerators = {
  // One subtraction (it uses the other two parts) stands for the whole skill in the diagnostic.
  'int.add-sub': mixedOf(['int.add-sub.same-sign', 'int.add-sub.different-signs', 'int.add-sub.subtract'], 'int.add-sub.subtract'),
  // Multiplying and dividing rest on different facts (owner rule), so each is asked.
  'int.mult-div': mixedOf(['int.mult-div.multiply', 'int.mult-div.divide']),
  ...parts,
};
