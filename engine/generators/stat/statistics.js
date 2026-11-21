// Generators for statistics and probability (area stat, grades 6-7): mean, median, mode and
// range; reading dot plots, bar graphs and box plots; probability (simple, complement,
// two events, expected counts). Exact fractions throughout.
// See engine/generators/frac/add-sub.js for what a generator returns.

import { fraction, reduce, equals, mul } from '../../math/fraction.js';
import { decimalText, terminates } from '../../math/decimal.js';

const F = (n, d = 1) => fraction(n, d);
const words = (text) => ({ type: 'words', text });
const shuffled = (rng, list) => { const out = [...list]; for (let i = out.length - 1; i > 0; i--) { const j = rng.int(0, i); [out[i], out[j]] = [out[j], out[i]]; } return out; };
const sum = (xs) => xs.reduce((a, b) => a + b, 0);

// A decimal answer (mean, median) with wrong values kept if they end and are new.
function decimalProblem(instruction, expression, value, mistakes, suffix) {
  const out = [];
  for (const m of mistakes) {
    if (!m || !m.value || m.value.n < 0 || !terminates(m.value)) continue;
    if (equals(m.value, value) || out.some((o) => equals(o.f, m.value))) continue;
    out.push({ id: m.id, f: m.value });
  }
  return { instruction, expression, answer: { type: 'decimal', value: decimalText(value), ...(suffix ? { suffix } : {}) }, misconceptions: out.map(({ id, f }) => ({ id, value: decimalText(f) })) };
}
function fractionProblem(instruction, expression, value, mistakes) {
  const v = reduce(value);
  const out = [];
  for (const m of mistakes) {
    if (!m || !m.value || m.value.n <= 0) continue;
    const w = reduce(m.value);
    if (equals(w, v) || out.some((o) => equals(o.value, w))) continue;
    out.push({ id: m.id, value: w });
  }
  return { instruction, expression, answer: { type: 'fraction', value: v, form: 'any' }, misconceptions: out };
}
const listText = (xs) => xs.join(', ');

// ======================= Mean, median, mode, range =======================

// ---------- mean ----------
//   1: a whole-number mean;  2: a decimal mean (.5, .25…);  3: the missing value for a given mean
const mean = {
  version: 1,
  generate(rng, difficulty) {
    const n = rng.int(4, 6);
    if (difficulty === 3) {
      const target = rng.int(6, 20);
      const xs = Array.from({ length: n - 1 }, () => rng.int(Math.max(1, target - 8), target + 8));
      const missing = target * n - sum(xs);
      if (missing <= 0 || missing > 40) return mean.generate(rng, difficulty);
      return decimalProblem('Find the missing number.', words(`The mean of ${n} numbers is ${target}. ${n - 1} of them are ${listText(xs)}. What is the last number?`), F(missing), [
        { id: 'stat.mean-sum', value: F(target * n) }, // found the total but didn't take the others away
        { id: 'stat.mean-missing-average', value: F(target) }, // the mean itself
      ]);
    }
    let xs;
    do xs = Array.from({ length: n }, () => rng.int(2, 20)); while ((difficulty === 1) !== (sum(xs) % n === 0) || !terminates(F(sum(xs), n)));
    return decimalProblem('Find the mean.', words(`Data: ${listText(xs)}`), F(sum(xs), n), [
      { id: 'stat.mean-sum', value: F(sum(xs)) }, // forgot to divide
      { id: 'stat.mean-wrong-count', value: terminates(F(sum(xs), n - 1)) ? F(sum(xs), n - 1) : null },
    ]);
  },
};

// ---------- median ----------
//   1: an odd number of values, already in order;  2: odd, out of order;  3: an even number of values (average the middle two)
const median = {
  version: 1,
  generate(rng, difficulty) {
    const n = difficulty === 3 ? rng.pick([4, 6, 8]) : rng.pick([5, 7, 9]);
    let xs;
    do xs = Array.from({ length: n }, () => rng.int(1, 30)); while (new Set(xs).size < n - 1);
    const sorted = [...xs].sort((a, b) => a - b);
    const shown = difficulty === 1 ? sorted : (() => { let s; do s = shuffled(rng, xs); while (s[Math.floor(n / 2)] === sorted[Math.floor(n / 2)]); return s; })();
    const value = n % 2 ? F(sorted[(n - 1) / 2]) : F(sorted[n / 2 - 1] + sorted[n / 2], 2);
    return decimalProblem('Find the median.', words(`Data: ${listText(shown)}`), value, [
      { id: 'stat.median-unsorted', value: n % 2 ? F(shown[(n - 1) / 2]) : F(shown[n / 2 - 1] + shown[n / 2], 2) }, // the middle of the unsorted list
      { id: 'stat.median-even', value: n % 2 ? null : F(sorted[n / 2 - 1]) }, // picked one of the middle two
      { id: 'stat.median-even', value: n % 2 ? null : F(sorted[n / 2]) },
      { id: 'stat.median-mean', value: terminates(F(sum(xs), n)) ? F(sum(xs), n) : null },
    ]);
  },
};

// ---------- mode and range ----------
//   1: the range;  2: the mode;  3: the range of an unsorted list with negatives (temperatures)
const modeRange = {
  version: 1,
  generate(rng, difficulty) {
    if (difficulty === 2) {
      const mode = rng.int(3, 15);
      const others = Array.from({ length: rng.int(4, 6) }, () => rng.int(1, 20)).filter((v) => v !== mode);
      const xs = shuffled(rng, [mode, mode, mode, ...new Set(others)]);
      return decimalProblem('Find the mode.', words(`Data: ${listText(xs)}`), F(mode), [
        { id: 'stat.mode-count', value: F(3) }, // how many times, not which value
        { id: 'stat.mode-median', value: F([...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]) },
      ]);
    }
    const xs = Array.from({ length: rng.int(5, 7) }, () => (difficulty === 3 ? rng.int(-9, 15) : rng.int(2, 40)));
    if (new Set(xs).size < 3) return modeRange.generate(rng, difficulty);
    const [lo, hi] = [Math.min(...xs), Math.max(...xs)];
    if (hi === lo) return modeRange.generate(rng, difficulty);
    return decimalProblem('Find the range.', words(difficulty === 3 ? `Morning temperatures (°F): ${listText(xs)}` : `Data: ${listText(xs)}`), F(hi - lo), [
      { id: 'stat.range-ends', value: F(Math.abs(xs.at(-1) - xs[0])) }, // last minus first, as listed
      { id: 'stat.range-max', value: F(hi) },
      { id: 'stat.range-sign', value: lo < 0 ? F(hi + lo) : null }, // 15 − (−4) done as 15 − 4
    ]);
  },
};

// ======================= Data displays =======================

// ---------- dot plots ----------
//   1: how many data values;  2: the mode or the number above a value;  3: the median
const dotplot = {
  version: 1,
  generate(rng, difficulty) {
    const lo = rng.int(0, 5);
    const hi = lo + rng.int(5, 7);
    const counts = {};
    for (let v = lo; v <= hi; v++) counts[v] = rng.int(0, 4);
    const values = Object.entries(counts).flatMap(([v, c]) => Array(c).fill(Number(v)));
    if (values.length < 6 || values.length % 2 === 0 && difficulty === 3) return dotplot.generate(rng, difficulty);
    const node = { type: 'shape', kind: 'dotplot', lo, hi, counts };
    if (difficulty === 1) {
      return decimalProblem('How many data values are shown?', node, F(values.length), [
        { id: 'stat.dotplot-columns', value: F(Object.values(counts).filter((c) => c > 0).length) }, // counted columns
      ]);
    }
    if (difficulty === 2) {
      const top = Math.max(...Object.values(counts));
      const modes = Object.keys(counts).filter((v) => counts[v] === top);
      if (modes.length > 1) return dotplot.generate(rng, difficulty);
      return decimalProblem('What is the mode?', node, F(Number(modes[0])), [{ id: 'stat.mode-count', value: F(top) }]);
    }
    const sorted = values;
    return decimalProblem('What is the median?', node, F(sorted[(sorted.length - 1) / 2]), [
      { id: 'stat.dotplot-middle-value', value: F(Math.round((lo + hi) / 2)) }, // the middle of the number line
      { id: 'stat.median-mean', value: terminates(F(sum(values), values.length)) ? F(sum(values), values.length) : null },
    ]);
  },
};

// ---------- bar graphs ----------
//   1: read one bar;  2: how many more (difference);  3: the total of all bars
const bars = {
  version: 1,
  generate(rng, difficulty) {
    const names = shuffled(rng, ['Apples', 'Bananas', 'Grapes', 'Pears', 'Plums']).slice(0, 4);
    const stepSize = rng.pick([2, 5, 10]);
    const data = names.map((n) => [n, stepSize * rng.int(1, 8)]);
    const max = Math.max(...data.map(([, v]) => v)) + stepSize;
    const node = { type: 'shape', kind: 'bars', bars: data, max: Math.ceil(max / stepSize) * stepSize, step: stepSize };
    const [a, b] = rng.pick([[0, 1], [1, 2], [2, 3], [0, 3]]);
    if (difficulty === 1) return decimalProblem(`How many students chose ${data[a][0]}?`, node, F(data[a][1]), []);
    if (difficulty === 2) {
      if (data[a][1] === data[b][1]) return bars.generate(rng, difficulty);
      const [big, small] = data[a][1] > data[b][1] ? [data[a], data[b]] : [data[b], data[a]];
      return decimalProblem(`How many more students chose ${big[0]} than ${small[0]}?`, node, F(big[1] - small[1]), [
        { id: 'stat.bar-read-one', value: F(big[1]) }, // just read the bigger bar
        { id: 'stat.bar-added', value: F(big[1] + small[1]) },
      ]);
    }
    return decimalProblem('How many students were asked in all?', node, F(sum(data.map(([, v]) => v))), [
      { id: 'stat.bar-read-one', value: F(Math.max(...data.map(([, v]) => v))) },
    ]);
  },
};

// ---------- box plots ----------
//   1: the median;  2: the range;  3: the interquartile range (Q3 − Q1)
const boxplot = {
  version: 1,
  generate(rng, difficulty) {
    const min = rng.int(0, 10);
    const q1 = min + rng.int(2, 6);
    const med = q1 + rng.int(2, 6);
    const q3 = med + rng.int(2, 6);
    const max = q3 + rng.int(2, 8);
    const lo = Math.floor(min / 5) * 5;
    const hi = Math.ceil(max / 5) * 5;
    const node = { type: 'shape', kind: 'boxplot', lo, hi, min, q1, med, q3, max };
    if (difficulty === 1) return decimalProblem('What is the median?', node, F(med), [{ id: 'stat.box-quartile', value: F(q1) }, { id: 'stat.box-quartile', value: F(q3) }, { id: 'stat.box-middle', value: F(min + max, 2) }]);
    if (difficulty === 2) return decimalProblem('What is the range?', node, F(max - min), [{ id: 'stat.iqr-range', value: F(q3 - q1) }]);
    return decimalProblem('What is the interquartile range (IQR)?', node, F(q3 - q1), [
      { id: 'stat.iqr-range', value: F(max - min) }, // used the whole range
      { id: 'stat.box-quartile', value: F(q3) },
    ]);
  },
};

// ======================= Probability =======================

const COLORS = ['red', 'blue', 'green', 'yellow'];

// ---------- simple probability ----------
//   1: one color from a bag;  2: not that color (the complement);  3: one of two colors, or a number cube (P(even), P(greater than 4))
const simple = {
  version: 1,
  generate(rng, difficulty) {
    if (difficulty === 3 && rng.chance(0.5)) {
      const ask = rng.pick([['an even number', 3], ['a number greater than 4', 2], ['a 6', 1], ['a number less than 3', 2], ['a multiple of 3', 2]]);
      return fractionProblem('Find the probability. Write a fraction in simplest form.', words(`You roll a number cube (1 to 6). What is the probability of rolling ${ask[0]}?`), F(ask[1], 6), [
        { id: 'stat.prob-part-part', value: ask[1] === 6 ? null : F(ask[1], 6 - ask[1]) },
      ]);
    }
    const counts = COLORS.slice(0, 3).map(() => rng.int(1, 9));
    const total = sum(counts);
    const [c0, c1] = [counts[0], counts[1]];
    const bag = `A bag has ${counts[0]} red, ${counts[1]} blue and ${counts[2]} green marbles. You pick one without looking.`;
    if (difficulty === 1) {
      return fractionProblem('Find the probability. Write a fraction in simplest form.', words(`${bag} What is the probability it's red?`), F(c0, total), [
        { id: 'stat.prob-part-part', value: F(c0, total - c0) }, // red to not-red
        { id: 'stat.prob-wrong-total', value: F(c0, total - c0 - counts[1]) },
      ]);
    }
    if (difficulty === 2) {
      return fractionProblem('Find the probability. Write a fraction in simplest form.', words(`${bag} What is the probability it's NOT blue?`), F(total - c1, total), [
        { id: 'stat.prob-complement', value: F(c1, total) }, // P(blue) instead
        { id: 'stat.prob-part-part', value: F(total - c1, c1) },
      ]);
    }
    return fractionProblem('Find the probability. Write a fraction in simplest form.', words(`${bag} What is the probability it's red or blue?`), F(c0 + c1, total), [
      { id: 'stat.prob-multiplied', value: mul(F(c0, total), F(c1, total)) }, // multiplied instead of adding
      { id: 'stat.prob-part-part', value: F(c0 + c1, total - c0 - c1) },
    ]);
  },
};

// ---------- two events and expected counts ----------
//   1: two coins, or a coin and a number cube (multiply);  2: two spinners or cubes (P(both));  3: how many times to expect (300 rolls)
const compound = {
  version: 1,
  alsoUses: ['stat.prob.simple'],
  generate(rng, difficulty) {
    if (difficulty === 3) {
      const [act, what, p] = rng.pick([['roll a number cube', 'a 5', F(1, 6)], ['flip a coin', 'heads', F(1, 2)], ['roll a number cube', 'an even number', F(1, 2)], ['spin a spinner with 4 equal parts (1 of them blue)', 'blue', F(1, 4)]]);
      const n = p.d * rng.int(5, 30);
      return decimalProblem('Answer the question.', words(`You ${act} ${n} times. About how many times would you expect ${what}?`), mul(F(n), p), [
        { id: 'stat.expected-complement', value: F(n - n / p.d) }, // the times it doesn't happen
      ]);
    }
    const events = difficulty === 1
      ? rng.pick([[['heads on the first coin', F(1, 2)], ['heads on the second coin', F(1, 2)]], [['heads on a coin', F(1, 2)], ['a 4 on a number cube', F(1, 6)]], [['tails on a coin', F(1, 2)], ['an even number on a number cube', F(1, 2)]]])
      : rng.pick([[['red on a spinner with 3 equal parts (1 red)', F(1, 3)], ['a 2 on a number cube', F(1, 6)]], [['a number less than 3 on a number cube', F(1, 3)], ['an odd number on a second number cube', F(1, 2)]], [['blue on a spinner with 4 equal parts (1 blue)', F(1, 4)], ['heads on a coin', F(1, 2)]]]);
    const [[aw, ap], [bw, bp]] = events;
    return fractionProblem('Find the probability. Write a fraction in simplest form.', words(`What is the probability of getting ${aw} and ${bw}?`), mul(ap, bp), [
      { id: 'stat.prob-added', value: F(ap.n * bp.d + bp.n * ap.d, ap.d * bp.d) }, // added instead of multiplied
    ]);
  },
};

const parts = {
  'stat.center.mean': mean,
  'stat.center.median': median,
  'stat.center.mode-range': modeRange,
  'stat.displays.dotplot': dotplot,
  'stat.displays.bars': bars,
  'stat.displays.boxplot': boxplot,
  'stat.prob.simple': simple,
  'stat.prob.compound': compound,
};

const mixedOf = ({ covers, screener, parts: own }) => ({
  version: 1,
  mixed: true,
  ...(screener ? { screener } : {}),
  covers,
  ...(own ? { parts: own } : {}),
  generate(rng, difficulty) {
    const part = rng.pick(own || covers);
    return { ...parts[part].generate(rng, difficulty), part };
  },
});

export const statisticsGenerators = {
  // Mean and median are different ideas (a classic mix-up): both asked; mode and range too.
  'stat.center': mixedOf({ covers: ['stat.center.mean', 'stat.center.median', 'stat.center.mode-range'] }),
  // Reading a box plot needs reading a number line like a dot plot: it stands for dot plots; bar graphs asked too.
  'stat.displays': mixedOf({ screener: 'stat.displays.boxplot', covers: ['stat.displays.dotplot', 'stat.displays.boxplot'], parts: ['stat.displays.dotplot', 'stat.displays.bars', 'stat.displays.boxplot'] }),
  // Two events needs single probabilities: it stands for both.
  'stat.prob': mixedOf({ screener: 'stat.prob.compound', covers: ['stat.prob.simple', 'stat.prob.compound'] }),
  ...parts,
};
