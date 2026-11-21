// Generators for the ratios and percents area (docs/RATIOS-PLAN.md). Exact
// throughout (fractions and engine/math/decimal.js; never floating point). Word
// problems are short, with numbers chosen so the arithmetic stays fact-sized.
// See engine/generators/frac/add-sub.js for what a generator returns.

import { fraction, mul, div, sub, add, reduce, equals } from '../../math/fraction.js';
import { decimalText, terminates, parseDecimal } from '../../math/decimal.js';

const F = (n, d = 1) => fraction(n, d);
const int = (value) => ({ type: 'int', value });
const words = (text) => ({ type: 'words', text });
const ratio = (a, b) => ({ type: 'ratio', a, b });
const pct = (value) => ({ type: 'pct', value: String(value) });
const blank = { type: 'blank' };
const x = { type: 'var', name: 'x' };
const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const text = (f) => decimalText(f); // exact decimal text of a fraction that ends
const money = (f) => { const t = text(f); return t.includes('.') && t.split('.')[1].length === 1 ? `${t}0` : t; };
const ends = (f) => f && terminates(f);

// An answer typed as a number (whole or decimal), maybe shown with $ or %.
const answer = (f, { prefix, suffix } = {}) => ({ type: 'decimal', value: text(f), ...(prefix ? { prefix } : {}), ...(suffix ? { suffix } : {}) });
// Keep mistakes that end, aren't negative, and differ from the answer and each other.
function wrongs(right, list) {
  const out = [];
  for (const m of list) {
    if (!m || !m.value || !ends(m.value) || m.value.n < 0) continue;
    if (equals(m.value, right) || out.some((o) => equals(parseDecimal(o.value), m.value))) continue;
    out.push({ id: m.id, value: text(m.value) });
  }
  return out;
}
const problem = (instruction, expression, value, opts, mistakes) => ({
  instruction, expression, answer: answer(value, opts), misconceptions: wrongs(value, mistakes),
});

// ======================= Ratios and rates =======================

// ---------- equivalent ratios ----------
//   1: 3 : 4 = 12 : ? (a whole-number scale);  2: 6 : 10 = 9 : ? (scale through the unit ratio 3 : 5);
//   3: a recipe or mixture word problem
const equivalent = {
  version: 1,
  generate(rng, difficulty) {
    let a; let b; let c; let d;
    if (difficulty === 1) {
      [a, b] = [rng.int(1, 9), rng.int(2, 9)]; if (a === b) b += 1;
      const k = rng.int(2, 6); [c, d] = [a * k, b * k];
    } else {
      // a unit ratio p : q (coprime), shown as m·p : m·q, asked as n·p : ?
      let p; let q; do { [p, q] = [rng.int(1, 7), rng.int(2, 9)]; } while (p === q || gcd(p, q) !== 1);
      let m; let n; do { [m, n] = [rng.int(2, 5), rng.int(2, 8)]; } while (m === n);
      [a, b, c, d] = [m * p, m * q, n * p, n * q];
    }
    const mistakes = [{ id: 'rat.additive', value: F(b + (c - a)) }, { id: 'rat.ratio-swapped', value: div(F(c * a), F(b)) }];
    if (difficulty === 3) {
      const [thing, other, unit] = rng.pick([['flour', 'sugar', 'cups'], ['blue paint', 'yellow paint', 'cans'], ['red beads', 'white beads', ''], ['boys', 'girls', '']]);
      const u = unit ? ` ${unit} of` : '';
      const story = thing === 'boys'
        ? `A club has ${a} boys for every ${b} girls. If there are ${c} boys, how many girls are there?`
        : thing === 'red beads'
          ? `A bracelet pattern uses ${a} red beads for every ${b} white beads. How many white beads go with ${c} red beads?`
          : `A recipe uses ${a}${u} ${thing} for every ${b}${u} ${other}. How many${unit ? ` ${unit} of` : ''} ${other} go with ${c}${u} ${thing}?`;
      return problem('Answer the question.', words(story), F(d), {}, mistakes);
    }
    return problem('Find the missing number.', { type: 'eq', left: ratio(int(a), int(b)), right: ratio(int(c), blank) }, F(d), {}, mistakes);
  },
};

function gcd(p, q) { return q ? gcd(q, p % q) : Math.abs(p); }

// ---------- unit rate ----------
//   1: price for one ($12 for 4 notebooks);  2: speed or rate (150 miles in 3 hours);
//   3: a unit price with cents ($7.50 for 3), or which is the better buy
const unitRate = {
  version: 1,
  generate(rng, difficulty) {
    if (difficulty === 3 && rng.chance(0.5)) return betterBuy(rng);
    const n = rng.int(2, difficulty === 1 ? 6 : 8);
    let each;
    if (difficulty === 1) each = F(rng.int(2, 9));
    else if (difficulty === 2) each = F(rng.int(3, 12) * (rng.chance(0.5) ? 5 : 1));
    else each = F(rng.int(5, 39) * 25, 100); // $1.25, $2.50, ...
    const total = mul(each, F(n));
    const mistakes = [{ id: 'rat.rate-flipped', value: div(F(n), total) }, { id: 'rat.rate-multiplied', value: mul(total, F(n)) }];
    if (difficulty === 2) {
      const [what, per, verb] = rng.pick([['miles', 'hour', 'drives'], ['words', 'minute', 'types'], ['pages', 'day', 'reads']]);
      const story = `Ana ${verb} ${text(total)} ${what} in ${n} ${per}s. How many ${what} is that per ${per}?`;
      return problem('Find the unit rate.', words(story), each, {}, mistakes);
    }
    const item = rng.pick(['notebooks', 'tickets', 'bottles of water', 'pens', 'snacks']);
    const story = `${n} ${item} cost $${money(total)}. How much does 1 cost?`;
    return problem('Find the unit price.', words(story), each, { prefix: '$' }, mistakes);
  },
};

// Which pack costs less for each item? Answered with buttons.
function betterBuy(rng) {
  for (;;) {
    const [n1, n2] = [rng.int(2, 6), rng.int(3, 8)];
    const [e1, e2] = [F(rng.int(2, 9) * 25, 100), F(rng.int(2, 9) * 25, 100)];
    if (n1 === n2 || equals(e1, e2)) continue;
    const [t1, t2] = [mul(e1, F(n1)), mul(e2, F(n2))];
    const cheaperEach = e1.n * e2.d < e2.n * e1.d ? 0 : 1;
    const cheaperTotal = t1.n * t2.d < t2.n * t1.d ? 0 : 1;
    if (cheaperEach === cheaperTotal) continue; // only the ones where the total misleads
    return {
      instruction: 'Which is the better buy (less for each one)?',
      expression: words(`Pack A: ${n1} for $${money(t1)}.  Pack B: ${n2} for $${money(t2)}.`),
      answer: { type: 'choice', options: ['Pack A', 'Pack B'], correct: cheaperEach },
      misconceptions: [{ id: 'rat.better-buy-total', choice: cheaperTotal }],
    };
  }
}

// ---------- proportions ----------
//   1: x/4 = 6/8 (a whole-number scale);  2: x/6 = 10/15 (through the unit ratio);  3: a word problem
const proportion = {
  version: 1,
  alsoUses: ['rat.ratios.equivalent'],
  generate(rng, difficulty) {
    // Small numbers: the unit ratio p : q, shown as m·p : m·q. Word problems have rates bigger than 1 (p > q).
    let p; let q; do { [p, q] = difficulty === 3 ? [rng.int(2, 9), rng.int(1, 5)] : [rng.int(1, 6), rng.int(2, 7)]; } while (p === q || gcd(p, q) !== 1 || (difficulty === 3 && p < q));
    let m; let n; do { [m, n] = [rng.int(2, 4), rng.int(2, 6)]; } while (m === n);
    if (difficulty === 1) m = 1;
    // x / (n·q) = (m·p) / (m·q)  ->  x = n·p
    const [b, c, d] = [n * q, m * p, m * q];
    const right = F(n * p);
    const mistakes = [
      { id: 'rat.proportion-cross-wrong', value: div(F(b * d), F(c)) }, // multiplied the wrong pair
      { id: 'rat.additive', value: F(b + (c - d)) },
    ];
    if (difficulty === 3) {
      const story = rng.pick([
        `A car goes ${c} miles on ${d} gallons of gas. At that rate, how many miles does it go on ${b} gallons?`,
        `You earn $${c} for ${d} hours of work. At that rate, how many dollars do you earn for ${b} hours?`,
        `A machine fills ${c} bottles in ${d} minutes. At that rate, how many bottles does it fill in ${b} minutes?`,
      ]);
      return problem('Answer the question.', words(story), right, {}, mistakes);
    }
    return problem('Solve the proportion.', { type: 'eq', left: { type: 'frac', n: x, d: b }, right: { type: 'frac', n: c, d } }, right, {}, mistakes);
  },
};

// ======================= Percents =======================

// ---------- percent, decimal and fraction ----------
//   1: 35% as a decimal, or 0.4 as a percent;  2: a fraction as a percent (3/5 = 60%);
//   3: one-digit and big percents (7% = 0.07, 120% = 1.2), or 3/8 = 37.5%
const convert = {
  version: 1,
  generate(rng, difficulty) {
    const kind = difficulty === 2 ? 'fraction' : rng.pick(['to-decimal', 'to-percent', ...(difficulty === 3 ? ['fraction'] : [])]);
    if (kind === 'fraction') {
      const [n, d] = difficulty === 2 ? rng.pick([[1, 2], [1, 4], [3, 4], [1, 5], [2, 5], [3, 5], [4, 5], [7, 10], [3, 20], [9, 20], [6, 25], [11, 50]]) : rng.pick([[1, 8], [3, 8], [5, 8], [7, 8], [5, 4], [3, 2], [7, 40]]);
      const v = mul(F(n, d), F(100));
      return problem('Write as a percent.', { type: 'frac', n, d }, v, { suffix: '%' }, [
        { id: 'rat.percent-digits', value: F(Number(`${n}${d}`)) }, // 3/5 = 35%
        { id: 'rat.percent-place', value: F(n, d) }, // wrote the decimal (0.6) as the percent
      ]);
    }
    let p; // the percent, as a fraction (35, 7, 120, 12.5)
    if (difficulty === 1) p = F(rng.pick(range(11, 99).filter((v) => v % 10 !== 0).concat([10, 20, 30, 40, 50, 60, 70, 80, 90])));
    else p = rng.pick([F(rng.int(1, 9)), F(rng.pick([110, 120, 125, 150, 200, 250])), F(rng.pick([25, 75, 125]), 10)]);
    const dec = div(p, F(100));
    if (kind === 'to-decimal') {
      return problem('Write as a decimal.', pct(text(p)), dec, {}, [
        { id: 'rat.percent-place', value: div(p, F(10)) }, // 7% = 0.7
        { id: 'rat.percent-place', value: div(p, F(1000)) }, // 35% = 0.035
        { id: 'rat.percent-not-converted', value: p }, // 35% = 35
      ]);
    }
    return problem('Write as a percent.', { type: 'dec', value: text(dec) }, p, { suffix: '%' }, [
      { id: 'rat.percent-place', value: div(p, F(10)) }, // 0.4 = 4%
      { id: 'rat.percent-not-converted', value: dec }, // 0.4 = 0.4%
    ]);
  },
};

// ---------- percent of a number ----------
//   1: 10%, 25%, 50% of a friendly number;  2: 15%, 30%, 75%, 40% of a multiple of 20;
//   3: 8% or 35% of a number, maybe a decimal answer (15% of 30 = 4.5)
const percentOf = {
  version: 1,
  alsoUses: ['rat.percent.convert'],
  generate(rng, difficulty) {
    let p; let n;
    if (difficulty === 1) { p = rng.pick([10, 25, 50]); n = rng.int(2, 20) * (p === 10 ? 10 : 4); } else if (difficulty === 2) { p = rng.pick([15, 30, 40, 75, 20, 60]); n = rng.int(2, 10) * 20; } else { p = rng.pick([5, 8, 12, 35, 15, 45]); n = rng.int(2, 12) * 10; }
    const v = div(mul(F(p), F(n)), F(100));
    return problem('Find the amount.', { type: 'op', op: 'of', left: pct(p), right: int(n) }, v, {}, [
      { id: 'rat.percent-of-divide', value: div(F(n), F(p)) }, // 80 ÷ 25
      { id: 'rat.percent-not-hundred', value: F(p * n) }, // forgot ÷ 100
      { id: 'rat.percent-place', value: div(mul(F(p), F(n)), F(10)) },
    ]);
  },
};

// ---------- what percent? ----------
//   1: 3 is what percent of 12 (25%), 6 of 10;  2: 9 is what percent of 60 (15%);
//   3: a score or survey word problem (21 out of 25 = 84%)
const whatPercent = {
  version: 1,
  alsoUses: ['rat.percent.convert'],
  generate(rng, difficulty) {
    let part; let whole;
    for (;;) {
      if (difficulty === 1) { const p = rng.pick([10, 20, 25, 50, 75]); whole = rng.pick([4, 8, 10, 12, 20, 40]); part = (p * whole) / 100; } else if (difficulty === 2) { const p = rng.pick([5, 15, 30, 35, 45, 60, 80]); whole = rng.pick([20, 40, 60, 80, 120]); part = (p * whole) / 100; } else { whole = rng.pick([20, 25, 50]); part = rng.int(1, whole - 1); }
      if (Number.isInteger(part) && part > 0) break;
    }
    const v = div(mul(F(part), F(100)), F(whole));
    const mistakes = [
      { id: 'rat.percent-flipped', value: div(mul(F(whole), F(100)), F(part)) }, // 48 is 400% of 12
      { id: 'rat.percent-part-as-percent', value: F(part) }, // 12 out of 48 = 12%
    ];
    if (difficulty === 3) {
      const story = rng.pick([
        `You got ${part} out of ${whole} questions right on a quiz. What percent did you get right?`,
        `In a survey, ${part} of ${whole} students said they walk to school. What percent walk?`,
        `A team won ${part} of its ${whole} games. What percent of its games did it win?`,
      ]);
      return problem('Find the percent.', words(story), v, { suffix: '%' }, mistakes);
    }
    return problem('Find the percent.', words(`${part} is what percent of ${whole}?`), v, { suffix: '%' }, mistakes);
  },
};


// ---------- scale drawings and maps ----------
//   1: map to real, "1 inch stands for 20 miles" (4 inches -> 80 miles);
//   2: real to drawing (1 cm for 5 m; a 12 m room -> 2.4 cm);
//   3: a scale like 2 cm : 15 m, either way (7 cm -> 52.5 m; 45 m -> 6 cm)
const scale = {
  version: 1,
  alsoUses: ['rat.ratios.proportion'],
  generate(rng, difficulty) {
    // Each context has realistic scales: maps cover miles or km, plans and blueprints a few m or feet.
    const plan = rng.chance(0.5);
    const [small, big, thing, pair, long] = plan
      ? rng.pick([['cm', 'm', 'floor plan', 'Two doors', 'A hallway'], ['inch', 'feet', 'blueprint', 'Two windows', 'A wall']])
      : rng.pick([['inch', 'miles', 'map', 'Two towns', 'A trail'], ['cm', 'km', 'map', 'Two cities', 'A bike path']]);
    const smalls = small === 'inch' ? 'inches' : small;
    const mistakes = [];
    let story; let value; let unit;
    if (difficulty === 1) {
      const per = plan ? rng.pick([2, 3, 4, 5]) : rng.pick([5, 10, 20, 25, 50]);
      const draw = rng.int(2, 9);
      value = F(draw * per);
      unit = big;
      story = `On a ${thing}, 1 ${small} stands for ${per} ${big}. ${pair} are ${draw} ${smalls} apart on the ${thing}. How far apart are they really?`;
      mistakes.push({ id: 'rat.scale-wrong-way', value: F(draw, per) }, { id: 'rat.additive', value: F(draw + per) });
    } else if (difficulty === 2) {
      const per = plan ? rng.pick([2, 4, 5]) : rng.pick([2, 4, 5, 10]);
      const draw = div(F(rng.int(3, plan ? 12 : 19)), F(rng.pick([1, 2]))); // 1.5, 7, 9.5 ...
      const real = mul(draw, F(per));
      if (real.d !== 1) return scale.generate(rng, difficulty);
      value = draw;
      unit = smalls;
      story = `A ${thing} uses 1 ${small} for every ${per} ${big}. ${long} is ${real.n} ${big} long in real life. How long is it on the ${thing}?`;
      mistakes.push({ id: 'rat.scale-wrong-way', value: mul(real, F(per)) });
    } else {
      const [a, b] = plan ? rng.pick([[2, 5], [2, 3], [4, 5], [5, 8]]) : rng.pick([[2, 15], [3, 10], [4, 25], [2, 25]]);
      const k = div(F(rng.int(3, 16)), F(2)); // how many copies of the scale
      const toReal = rng.chance(0.5);
      const draw = mul(k, F(a));
      const real = mul(k, F(b));
      if (!ends(draw) || !ends(real)) return scale.generate(rng, difficulty);
      const scaleText = `${a} ${smalls} on the ${thing} stand for ${b} ${big}`;
      if (toReal) {
        value = real; unit = big;
        story = `The scale is: ${scaleText}. ${pair} are ${text(draw)} ${smalls} apart on the ${thing}. How far apart are they really?`;
        mistakes.push({ id: 'rat.scale-ignored-first', value: mul(draw, F(b)) }, { id: 'rat.scale-wrong-way', value: div(mul(draw, F(a)), F(b)) });
      } else {
        value = draw; unit = smalls;
        story = `The scale is: ${scaleText}. ${long} is ${text(real)} ${big} long. How long is it on the ${thing}?`;
        mistakes.push({ id: 'rat.scale-ignored-first', value: div(real, F(b)) }, { id: 'rat.scale-wrong-way', value: div(mul(real, F(b)), F(a)) });
      }
    }
    return problem('Answer the question.', words(story), value, { suffix: unit }, mistakes);
  },
};

// ======================= Percent change =======================

// ---------- the new amount ----------
//   1: 10%, 25% or 50% off or more;  2: 20%, 30% or 15% (a sale, a raise);
//   3: tax or a tip with cents ($24 plus 15% = $27.60)
const applyChange = {
  version: 1,
  alsoUses: ['rat.percent.of'],
  generate(rng, difficulty) {
    let p; let old; let up;
    if (difficulty === 1) { p = rng.pick([10, 25, 50]); old = rng.int(2, 12) * (p === 10 ? 10 : 4); up = rng.chance(0.3); } else if (difficulty === 2) { p = rng.pick([20, 30, 15, 40]); old = rng.int(2, 10) * 20; up = rng.chance(0.4); } else { p = rng.pick([6, 8, 15, 18, 20]); old = rng.int(6, 40) * (p % 2 ? 2 : 1); up = true; }
    const change = div(mul(F(p), F(old)), F(100));
    const v = up ? add(F(old), change) : sub(F(old), change);
    const story = difficulty === 3
      ? rng.pick([`A meal costs $${old}. You add a ${p}% tip. What is the total?`, `A game costs $${old} plus ${p}% sales tax. What is the total?`])
      : up ? `A $${old} ticket price goes up ${p}%. What is the new price?` : `A $${old} jacket is ${p}% off. What is the sale price?`;
    return problem('Find the new amount.', words(story), v, { prefix: '$' }, [
      { id: 'rat.change-only-amount', value: change }, // just the discount (or the tip)
      { id: 'rat.change-wrong-way', value: up ? sub(F(old), change) : add(F(old), change) },
      { id: 'rat.change-subtract-percent', value: up ? F(old + p) : F(old - p) }, // $40 − 25
    ]);
  },
};

// ---------- the percent change ----------
//   1: from 20 to 25 (25% increase), 40 to 30;  2: other friendly numbers (50 -> 40 is a 20% decrease);
//   3: a price or population word problem
const findChange = {
  version: 1,
  alsoUses: ['rat.percent.what-percent'],
  generate(rng, difficulty) {
    let old; let p; let up;
    for (;;) {
      old = difficulty === 1 ? rng.pick([20, 40, 50, 80, 100]) : rng.pick([25, 40, 60, 75, 120, 150, 200]);
      p = difficulty === 1 ? rng.pick([10, 25, 50]) : rng.pick([10, 20, 30, 40, 60, 5, 15]);
      up = rng.chance(0.5);
      if (Number.isInteger((p * old) / 100) && (up || p < 100)) break;
    }
    const change = (p * old) / 100;
    const now = up ? old + change : old - change;
    const word = up ? 'increase' : 'decrease';
    const story = difficulty === 3
      ? rng.pick([`A bike's price changed from $${old} to $${now}. What is the percent ${word}?`, `A town's population went from ${old * 100} to ${now * 100}. What is the percent ${word}?`])
      : `A number goes from ${old} to ${now}. What is the percent ${word}?`;
    return problem(`Find the percent ${word}.`, words(story), F(p), { suffix: '%' }, [
      { id: 'rat.change-wrong-base', value: div(mul(F(change), F(100)), F(now)) }, // divided by the new amount
      { id: 'rat.change-amount-as-percent', value: F(difficulty === 3 && story.includes('population') ? change * 100 : change) }, // the change itself
    ]);
  },
};


// ---------- simple interest (I = P x r x t) ----------
//   1: one year's interest ($200 at 5%);  2: interest for several years ($400 at 3% for 4 years);
//   3: the total after several years, saving or borrowing ($1,500 at 4% for 3 years -> $1,680), or a rate like 2.5%
const interest = {
  version: 1,
  alsoUses: ['rat.percent.of'],
  generate(rng, difficulty) {
    const P = difficulty === 1 ? rng.int(1, 10) * 100 : difficulty === 2 ? rng.int(2, 12) * 100 : rng.int(4, 30) * 100;
    const r = difficulty === 3 && rng.chance(0.3) ? F(5, 2) : F(difficulty === 1 ? rng.pick([2, 3, 4, 5, 10]) : rng.pick([2, 3, 4, 5, 6, 8]));
    const t = difficulty === 1 ? 1 : rng.int(2, difficulty === 2 ? 5 : 6);
    const yearly = div(mul(F(P), r), F(100));
    const I = mul(yearly, F(t));
    const total = difficulty === 3;
    const rate = text(r);
    const dollars = P >= 1000 ? `${Math.floor(P / 1000)},${String(P % 1000).padStart(3, '0')}` : String(P);
    const years = t === 1 ? '1 year' : `${t} years`;
    const borrow = total && rng.chance(0.5);
    const story = borrow
      ? `You borrow $${dollars} at ${rate}% simple interest a year. You pay it all back after ${years}. How much do you pay back in all?`
      : total
        ? `You put $${dollars} in a savings account that pays ${rate}% simple interest a year. How much is in the account after ${years}?`
        : `You put $${dollars} in a savings account that pays ${rate}% simple interest a year. How much interest do you earn in ${years}?`;
    const value = total ? add(F(P), I) : I;
    return problem(total ? 'Find the total.' : 'Find the interest.', words(story), value, { prefix: '$' }, [
      { id: 'rat.interest-one-year', value: t > 1 ? (total ? add(F(P), yearly) : yearly) : null }, // forgot the years
      { id: 'rat.percent-not-hundred', value: total ? add(F(P), mul(mul(F(P), r), F(t))) : mul(mul(F(P), r), F(t)) }, // forgot to divide by 100
      { id: 'rat.interest-total', value: total ? I : add(F(P), I) }, // interest vs. the total
    ]);
  },
};

// ======================= whole skills =======================

const mixedOf = ({ covers, screener, parts: own, version = 1 }) => ({
  version,
  mixed: true,
  ...(screener ? { screener } : {}),
  covers,
  ...(own ? { parts: own } : {}),
  generate(rng, difficulty) {
    const part = rng.pick(own || covers);
    return { ...parts[part].generate(rng, difficulty), part };
  },
});

const parts = {
  'rat.ratios.equivalent': equivalent,
  'rat.ratios.unit-rate': unitRate,
  'rat.ratios.proportion': proportion,
  'rat.ratios.scale': scale,
  'rat.percent.convert': convert,
  'rat.percent.of': percentOf,
  'rat.percent.what-percent': whatPercent,
  'rat.percent-change.apply': applyChange,
  'rat.percent-change.find': findChange,
  'rat.percent-change.interest': interest,
};

export const ratioGenerators = {
  // A proportion solved right shows equivalent ratios and scale drawings (a scale is a proportion) too;
  // unit rates are asked on their own.
  'rat.ratios': mixedOf({ version: 2, screener: 'rat.ratios.proportion', covers: ['rat.ratios.equivalent', 'rat.ratios.proportion', 'rat.ratios.scale'], parts: ['rat.ratios.equivalent', 'rat.ratios.unit-rate', 'rat.ratios.proportion', 'rat.ratios.scale'] }),
  // A percent of a number shows converting too; "what percent?" is asked on its own.
  'rat.percent': mixedOf({ screener: 'rat.percent.of', covers: ['rat.percent.convert', 'rat.percent.of'], parts: ['rat.percent.convert', 'rat.percent.of', 'rat.percent.what-percent'] }),
  // The two directions rest on different percent skills: both asked.
  // Simple interest is a new amount from a percent, over several years: asked on its own too.
  'rat.percent-change': mixedOf({ version: 2, covers: ['rat.percent-change.apply', 'rat.percent-change.find', 'rat.percent-change.interest'] }),
  ...parts,
};
