// Generators for "Write expressions and equations from words" (alg.translate).
//   expression: a phrase -> ax + b, typed in the two boxes ("5 less than twice a number" -> 2x − 5)
//   equation:   a sentence or a short story -> the number (solve what you wrote)
// Each wording knows its own right meaning and the classic wrong readings, so mistakes are
// recognised: "4 less than x" read as 4 − x, "twice x" as x + 2, "twice the sum" not distributed.
// See engine/generators/frac/add-sub.js for what a generator returns.

import { fraction, reduce, equals } from '../../math/fraction.js';

const words = (text) => ({ type: 'words', text });
const TIMES = { 2: 'twice', 3: 'three times', 4: 'four times', 5: 'five times', 6: 'six times' };
const cap = (s) => s[0].toUpperCase() + s.slice(1);

// Phrases about "a number" (x). Each gives { text, a, b } (meaning ax + b) and wrong readings.
//   level 1: one operation;  2: two operations;  3: the trickier wordings (subtract FROM, "the sum ... times")
function phrase(rng, difficulty) {
  const k = rng.int(2, 12);
  if (difficulty === 1) {
    return rng.pick([
      () => ({ text: `${k} more than a number`, a: 1, b: k, wrong: [] }),
      () => ({ text: `a number increased by ${k}`, a: 1, b: k, wrong: [] }),
      () => ({ text: `a number decreased by ${k}`, a: 1, b: -k, wrong: [{ id: 'alg.translate-order', a: -1, b: k }] }),
      () => ({ text: `${k} less than a number`, a: 1, b: -k, wrong: [{ id: 'alg.translate-order', a: -1, b: k }] }),
      () => { const m = rng.int(2, 9); return { text: `the product of ${m} and a number`, a: m, b: 0, wrong: [{ id: 'alg.translate-add-for-times', a: 1, b: m }] }; },
      () => { const m = rng.int(2, 6); return { text: `${TIMES[m]} a number`, a: m, b: 0, wrong: [{ id: 'alg.translate-add-for-times', a: 1, b: m }] }; },
    ])();
  }
  if (difficulty === 2) {
    const m = rng.int(2, 6);
    return rng.pick([
      () => ({ text: `${k} less than ${TIMES[m]} a number`, a: m, b: -k, wrong: [{ id: 'alg.translate-order', a: -m, b: k }, { id: 'alg.translate-add-for-times', a: 1, b: m - k }] }),
      () => ({ text: `${k} more than ${TIMES[m]} a number`, a: m, b: k, wrong: [{ id: 'alg.translate-add-for-times', a: 1, b: m + k }] }),
      () => ({ text: `${TIMES[m]} a number, decreased by ${k}`, a: m, b: -k, wrong: [{ id: 'alg.translate-order', a: -m, b: k }, { id: 'alg.translate-add-for-times', a: 1, b: m - k }] }),
      () => ({ text: `the product of ${m} and a number, plus ${k}`, a: m, b: k, wrong: [{ id: 'alg.translate-add-for-times', a: 1, b: m + k }] }),
    ])();
  }
  const m = rng.int(2, 5);
  return rng.pick([
    () => ({ text: `${k} decreased by ${TIMES[m]} a number`, a: -m, b: k, wrong: [{ id: 'alg.translate-order', a: m, b: -k }] }),
    () => ({ text: `subtract ${TIMES[m]} a number from ${k}`, a: -m, b: k, wrong: [{ id: 'alg.translate-order', a: m, b: -k }] }),
    () => ({ text: `${TIMES[m]} the sum of a number and ${k}`, a: m, b: m * k, wrong: [{ id: 'alg.translate-sum-grouping', a: m, b: k }] }),
    () => ({ text: `${TIMES[m]} the difference of a number and ${k}`, a: m, b: -m * k, wrong: [{ id: 'alg.translate-sum-grouping', a: m, b: -k }, { id: 'alg.translate-order', a: -m, b: m * k }] }),
  ])();
}

// ---------- phrase -> expression ----------
const expression = {
  version: 1,
  generate(rng, difficulty) {
    const p = phrase(rng, difficulty);
    const out = [];
    for (const w of p.wrong) {
      if ((w.a === p.a && w.b === p.b) || out.some((o) => o.value.coef === w.a && o.value.constant === w.b)) continue;
      out.push({ id: w.id, value: { coef: w.a, constant: w.b } });
    }
    return {
      instruction: 'Write as an expression. Use x for the number.',
      expression: words(cap(p.text)),
      answer: { type: 'linear', coef: p.a, constant: p.b },
      misconceptions: out,
    };
  },
};

// ---------- sentence or story -> equation -> the number ----------
//   1: one step ("A number decreased by 8 is 15");  2: two steps ("Five more than three times a number is 26");
//   3: a short story (saving, a phone plan, tickets): start + rate × n = total
const equation = {
  version: 1,
  alsoUses: ['alg.translate.expression'],
  generate(rng, difficulty) {
    const n = difficulty === 1 ? rng.int(2, 20) : rng.int(2, 12);
    let text; let candidates;
    if (difficulty < 3) {
      const p = phrase(rng, difficulty);
      const total = p.a * n + p.b;
      if (total <= 0) return equation.generate(rng, difficulty); // keep the sentences' totals positive
      text = `${cap(p.text)} is ${total < 0 ? `negative ${-total}` : total}. What is the number?`;
      // Each wrong reading, solved honestly: a'x + b' = total.
      candidates = p.wrong.map((w) => ({ id: w.id, value: w.a === 0 ? null : fraction(total - w.b, w.a) }));
    } else {
      const story = rng.pick([
        () => { const s = rng.int(5, 30); const r = rng.int(3, 9); return { text: `Maya has $${s} saved. She saves $${r} more each week. After how many weeks will she have $${s + r * n}?`, s, r, total: s + r * n }; },
        () => { const s = rng.int(10, 40); const r = rng.int(5, 15); return { text: `A phone plan costs $${s} a month plus $${r} for each gigabyte of data. One month the bill was $${s + r * n}. How many gigabytes were used?`, s, r, total: s + r * n }; },
        () => { const s = rng.int(2, 9); const r = rng.int(4, 12); return { text: `A school club pays a $${s * 5} entry fee and $${r} per student for a museum trip. The total was $${s * 5 + r * n}. How many students went?`, s: s * 5, r, total: s * 5 + r * n }; },
        () => { const s = rng.int(20, 60); const r = rng.int(2, 6); return { text: `A plant is ${s} cm tall and grows ${r} cm a week. In how many weeks will it be ${s + r * n} cm tall?`, s, r, total: s + r * n }; },
      ])();
      text = story.text;
      candidates = [
        { id: 'alg.translate-add-for-times', value: fraction(story.total - story.s - story.r) }, // r + s + n = total
        { id: 'alg.translate-start-ignored', value: fraction(story.total, story.r) }, // r·n = total
      ];
    }
    const v = fraction(n);
    const out = [];
    for (const c of candidates) {
      if (!c.value) continue;
      const w = reduce(c.value);
      if (equals(w, v) || out.some((o) => equals(o.value, w))) continue;
      out.push({ id: c.id, value: w });
    }
    return {
      instruction: 'Write an equation and solve it.',
      expression: words(text),
      answer: { type: 'fraction', value: v, form: 'any', allowNegative: true },
      misconceptions: out,
    };
  },
};

const parts = { 'alg.translate.expression': expression, 'alg.translate.equation': equation };

// In the diagnostic one two-step sentence ("Five more than three times a number is 26")
// stands for both parts: setting it up right shows the phrase was read right.
const full = {
  version: 1,
  mixed: true,
  screener: 'alg.translate.equation',
  covers: ['alg.translate.expression', 'alg.translate.equation'],
  generate(rng, difficulty) {
    const part = rng.pick(this.covers);
    return { ...parts[part].generate(rng, difficulty), part };
  },
};

export const translateGenerators = { 'alg.translate': full, ...parts };
