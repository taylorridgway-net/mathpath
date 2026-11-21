// Generators for the decimals area (docs/DECIMALS-PLAN.md). Exact throughout:
// numbers are made as whole numbers of tenths/hundredths/thousandths and shown
// as text (engine/math/decimal.js); never JavaScript floating point.
// See engine/generators/frac/add-sub.js for what a generator returns.
//
// Each wrong-answer pattern is worked out from the problem, so a student's
// mistake is recognised whatever the numbers: "longer is bigger" (0.45 > 0.5),
// lining up the right-hand digits (3.5 + 1.25 = 1.60), the point placed from one
// factor (0.3 × 0.2 = 0.6), moving only one point (2.4 ÷ 0.3 = 0.8), and so on.

import { fraction, reduce, add, sub, mul, div } from '../../math/fraction.js';
import { fromScaled, toScaled, placesOf, parseDecimal, decimalText, terminates } from '../../math/decimal.js';

const dec = (value) => ({ type: 'dec', value });
const int = (value) => ({ type: 'int', value });
const frac = (n, d) => ({ type: 'frac', n, d });
const op = (sym, left, right) => ({ type: 'op', op: sym, left, right });
const answerDec = (value) => ({ type: 'decimal', value });
const SIGNS = ['<', '=', '>'];

// Keep wrong answers that differ from the right one (and from each other).
function wrongs(right, list) {
  const out = [];
  for (const m of list) {
    if (!m || m.value === null || m.value === undefined) continue;
    const v = parseDecimal(m.value);
    if (!v || v.n < 0) continue;
    const same = (x) => { const y = parseDecimal(x); return y && y.n * v.d === v.n * y.d; };
    if (same(right) || out.some((o) => same(o.value))) continue;
    out.push(m);
  }
  return out;
}

function shuffled(rng, list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// A decimal with exactly `places` digits after the point, the last one not 0.
function randomDecimal(rng, wholeMax, places) {
  const whole = rng.int(0, wholeMax);
  let frac = rng.int(1, 10 ** places - 1);
  if (frac % 10 === 0) frac += rng.int(1, 9);
  if (frac >= 10 ** places) frac = 10 ** places - 1;
  return fromScaled(whole * 10 ** places + frac, places);
}

// Lining up the right-hand digits instead of the points: treat both as whole
// numbers and put the point back by the longer one. 3.5 + 1.25 -> 35 + 125 = 160 -> 1.60.
function rightAligned(a, b, sym) {
  const digits = (x) => Number(x.replace('.', ''));
  const places = Math.max(placesOf(a), placesOf(b));
  const v = sym === '+' ? digits(a) + digits(b) : digits(a) - digits(b);
  return v < 0 ? null : fromScaled(v, places);
}

// ======================= Understand decimals =======================

// ---------- place value ----------
//   1: tenths and hundredths as fractions (3/10, 45/100) -> decimal
//   2: hundredths with a zero (7/100 = 0.07), mixed numbers (3 45/100), or "which digit is in the tenths place?"
//   3: thousandths (25/1000 = 0.025), or "which digit is in the hundredths/thousandths place?"
const PLACES = ['tenths', 'hundredths', 'thousandths'];
const read = {
  version: 1,
  generate(rng, difficulty) {
    if (difficulty >= 2 && rng.chance(0.35)) {
      // Which digit is in a place? Digits all different, so the answer is clear.
      const digits = shuffled(rng, [1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, 5);
      const places = difficulty === 2 ? 2 : 3;
      const text = `${digits[0]}${digits[1]}.${digits.slice(2, 2 + places).join('')}`;
      const at = difficulty === 2 ? rng.int(0, 1) : rng.int(1, 2);
      const after = text.split('.')[1];
      const right = Number(after[at]);
      const ones = Number(text.split('.')[0].slice(-1));
      return {
        instruction: `Which digit is in the ${PLACES[at]} place?`,
        expression: dec(text),
        answer: { type: 'integer', value: right },
        misconceptions: [
          { id: 'dec.place-value-shift', value: at === 0 ? ones : Number(after[at - 1]) }, // counts the tenths as "first" in the wrong direction
          { id: 'dec.place-value-shift', value: after[at + 1] !== undefined ? Number(after[at + 1]) : null },
        ].filter((m) => m.value !== null && m.value !== right),
      };
    }
    let places;
    let n;
    let whole = 0;
    if (difficulty === 1) {
      places = rng.pick([1, 2]);
      n = places === 1 ? rng.int(1, 9) : rng.int(11, 99);
      if (n % 10 === 0) n += 1;
    } else if (difficulty === 2) {
      places = 2;
      n = rng.int(1, 9); // 7/100 = 0.07
      if (rng.chance(0.4)) {
        whole = rng.int(1, 9);
        n = rng.int(1, 99);
        if (n % 10 === 0) n += 1;
      }
    } else {
      places = 3;
      n = rng.pick([rng.int(1, 9), rng.int(11, 99)]);
      if (n % 10 === 0) n += 1;
    }
    const d = 10 ** places;
    const right = fromScaled(whole * d + n, places);
    const expression = whole ? { type: 'mixed', whole, n, d } : frac(n, d);
    return {
      instruction: 'Write as a decimal.',
      expression,
      answer: answerDec(right),
      misconceptions: wrongs(right, [
        { id: 'dec.place-value-shift', value: `${whole}.${n}` }, // 7/100 = 0.7, 25/1000 = 0.25
        { id: 'dec.place-value-shift', value: fromScaled(whole * d * 10 + n, places + 1) }, // one place too far
      ]),
    };
  },
};

// ---------- compare ----------
//   1: same number of decimal places (0.6 ? 0.4, 2.35 ? 2.53)
//   2: different lengths where "longer is bigger" goes wrong (0.5 ? 0.45)
//   3: zeros and the other trap (0.4 ? 0.45 "shorter is bigger"; 0.3 ? 0.30; 1.05 ? 1.5; 0.09 ? 0.1)
const compare = {
  version: 1,
  generate(rng, difficulty) {
    let a;
    let b;
    const whole = rng.int(0, 3);
    if (difficulty === 1) {
      const places = rng.pick([1, 2]);
      const x = rng.int(1, 10 ** places - 1);
      let y = rng.int(1, 10 ** places - 1);
      if (y === x) y = x === 1 ? 2 : x - 1;
      [a, b] = [fromScaled(whole * 10 ** places + x, places, { keepZeros: true }), fromScaled(whole * 10 ** places + y, places, { keepZeros: true })];
    } else if (difficulty === 2) {
      // a has one place, b two; b's digits make a bigger whole number but a smaller decimal.
      const t = rng.int(2, 9);
      const h = rng.int(10 * (t - 1) + 1, 10 * t - 1); // e.g. t = 5 -> 41..49
      [a, b] = [`${whole}.${t}`, `${whole}.${String(h).padStart(2, '0')}`];
    } else {
      const kind = rng.pick(['shorter', 'zero', 'gap', 'equal']);
      if (kind === 'shorter') {
        const t = rng.int(1, 8);
        [a, b] = [`${whole}.${t}`, `${whole}.${t}${rng.int(1, 9)}`]; // 0.4 ? 0.45
      } else if (kind === 'zero') {
        const t = rng.int(1, 9);
        [a, b] = [`${whole}.0${t}`, `${whole}.${t}`]; // 1.05 ? 1.5
      } else if (kind === 'gap') {
        const t = rng.int(1, 8);
        [a, b] = [`${whole}.0${rng.int(t + 1, 9)}`, `${whole}.${t}`]; // 0.09 ? 0.1
      } else {
        const t = rng.int(1, 9);
        [a, b] = [`${whole}.${t}`, `${whole}.${t}0`]; // 0.3 ? 0.30
      }
    }
    if (rng.chance(0.5)) [a, b] = [b, a];
    const x = parseDecimal(a);
    const y = parseDecimal(b);
    const sign = (p, q) => (p < q ? 0 : p === q ? 1 : 2);
    const correct = sign(x.n * y.d, y.n * x.d);
    // The two classic mistakes, as the button they would press.
    const after = (s) => s.split('.')[1] || '';
    const longer = sign(Number(after(a)), Number(after(b))); // "0.45 > 0.5 because 45 > 5"
    const la = after(a).length;
    const lb = after(b).length;
    const shorter = la === lb ? null : la < lb ? 2 : 0; // "fewer digits means bigger pieces"
    const misconceptions = [];
    if (longer !== correct) misconceptions.push({ id: 'dec.longer-is-larger', choice: longer });
    if (shorter !== null && shorter !== correct && shorter !== longer) misconceptions.push({ id: 'dec.shorter-is-larger', choice: shorter });
    return {
      instruction: 'Which sign goes in the box?',
      expression: { type: 'compare', left: dec(a), right: dec(b) },
      answer: { type: 'choice', options: SIGNS, correct },
      misconceptions,
    };
  },
};

// ---------- round ----------
//   1: to the nearest whole (4.7 -> 5)
//   2: to the nearest tenth (3.47 -> 3.5; 2.94 -> 2.9)
//   3: a tenth that carries (4.96 -> 5.0), or thousandths to the nearest hundredth or tenth (5.168)
const round = {
  version: 1,
  generate(rng, difficulty) {
    let to;
    let text;
    if (difficulty === 1) {
      to = 0;
      text = fromScaled(rng.int(1, 19) * 10 + rng.int(1, 9), 1);
    } else if (difficulty === 2) {
      to = 1;
      text = fromScaled(rng.int(0, 9) * 100 + rng.int(1, 9) * 10 + rng.int(1, 9), 2);
    } else if (rng.chance(0.5)) {
      to = 1;
      text = fromScaled(rng.int(1, 9) * 100 + 90 + rng.int(5, 9), 2); // 4.96 -> 5.0
    } else {
      to = rng.pick([1, 2]); // 5.168 to the nearest hundredth, or to the nearest tenth
      text = fromScaled(rng.int(0, 9) * 1000 + rng.int(1, 99) * 10 + rng.int(1, 9), 3);
    }
    const places = placesOf(text);
    const scaled = toScaled(text, places);
    const unit = 10 ** (places - to);
    const down = Math.floor(scaled / unit) * unit;
    const up = down + unit;
    const nearest = scaled - down >= unit / 2 ? up : down;
    const right = fromScaled(nearest, places);
    const otherWay = fromScaled(nearest === up ? down : up, places);
    const names = ['whole number', 'tenth', 'hundredth'];
    return {
      instruction: `Round to the nearest ${names[to]}.`,
      expression: dec(text),
      answer: answerDec(right),
      misconceptions: wrongs(right, [
        { id: 'dec.round-truncate', value: fromScaled(down, places) }, // just cuts the digits off
        { id: 'dec.round-wrong-way', value: otherWay },
        // Rounded to the next place along instead (to tenths when asked for wholes); not when that's just the number itself.
        { id: 'dec.round-wrong-place', value: to < 2 && places > to + 1 ? (() => { const u = 10 ** (places - to - 1); const d = Math.floor(scaled / u) * u; return fromScaled(scaled - d >= u / 2 ? d + u : d, places); })() : null },
      ]),
    };
  },
};

// ======================= Fractions and decimals =======================

// ---------- fraction to decimal ----------
//   1: halves, fifths, tenths (1/2, 3/5);  2: quarters, twentieths, 25ths, 50ths (3/4, 7/20);  3: eighths, 40ths, more than 1 (3/8, 7/4)
const toDecimal = {
  version: 1,
  generate(rng, difficulty) {
    const pool = {
      1: [[1, 2], [1, 5], [2, 5], [3, 5], [4, 5], [3, 10], [7, 10], [9, 10]],
      2: [[1, 4], [3, 4], [3, 20], [7, 20], [9, 20], [11, 20], [3, 25], [8, 25], [7, 50], [21, 50]],
      3: [[1, 8], [3, 8], [5, 8], [7, 8], [7, 40], [3, 40], [7, 4], [9, 8], [6, 5]],
    }[difficulty];
    const [n, d] = rng.pick(pool);
    const right = decimalText(fraction(n, d));
    return {
      instruction: 'Write as a decimal.',
      expression: frac(n, d),
      answer: answerDec(right),
      misconceptions: wrongs(right, [
        { id: 'dec.convert-digits', value: `0.${n}${d}` }, // 3/4 = 0.34
        { id: 'dec.convert-digits', value: `${n}.${d}` }, // 3/4 = 3.4
        { id: 'dec.convert-flipped', value: (() => { try { return decimalText(fraction(d, n)); } catch { return null; } })() }, // 4 ÷ 3
      ]),
    };
  },
};

// ---------- decimal to fraction ----------
//   1: tenths (0.4 = 2/5, 0.7 = 7/10);  2: hundredths (0.35 = 7/20, 0.75 = 3/4);  3: thousandths, or more than 1 (0.125 = 1/8, 2.5 = 5/2)
const toFraction = {
  version: 1,
  ifNotSimplified: 'frac.equivalent.simplify',
  generate(rng, difficulty) {
    let text;
    if (difficulty === 1) text = `0.${rng.int(1, 9)}`;
    else if (difficulty === 2) text = fromScaled(rng.pick([5, 15, 25, 35, 45, 55, 65, 75, 85, 95, 4, 8, 12, 16, 24, 36, 44, 48, 52, 64, 76, 88, 96]), 2);
    else text = rng.chance(0.5) ? fromScaled(rng.pick([125, 375, 625, 875]), 3) : fromScaled(rng.int(1, 4) * 10 + rng.pick([2, 4, 5, 6, 8]), 1);
    const value = parseDecimal(text);
    const places = placesOf(text);
    const scaled = toScaled(text, places);
    const r = reduce(value);
    return {
      instruction: 'Write as a fraction in simplest form.',
      expression: dec(text),
      answer: { type: 'fraction', value: r },
      misconceptions: [
        places > 1 ? { id: 'dec.convert-over-ten', value: { n: scaled, d: 10 } } : null, // 0.35 = 35/10
        { id: 'dec.place-value-shift', value: { n: scaled, d: 10 ** (places + 1) } }, // 0.4 = 4/100
      ].filter((m) => m && m.value.n * r.d !== r.n * m.value.d),
    };
  },
};


// ---------- repeating decimals ----------
//   1: pick the decimal for n/3 or n/9 from buttons (2/3 = 0.666…, not 0.6 or 0.67)
//   2: write 0.555… as a fraction (n/9, simplest form: 0.666… = 2/3), or pick the decimal for 1/6, 5/6, n/11
//   3: does it end or repeat? (7/12 repeats, 3/15 = 1/5 ends), or a two-digit repeat as a fraction (0.2727… = 3/11)
const repeatText = (block, times = 3) => `0.${block.repeat(times)}…`;
const REPEATING = {
  1: [[1, 3, '3'], [2, 3, '6'], [1, 9, '1'], [2, 9, '2'], [4, 9, '4'], [5, 9, '5'], [7, 9, '7'], [8, 9, '8']],
  2: [[1, 6, '1', '6'], [5, 6, '8', '3'], [1, 11, '09'], [2, 11, '18'], [3, 11, '27'], [5, 11, '45']],
};
// The decimal text for a repeating fraction: [n, d, start, block?] -> "0.1666…" / "0.0909…".
const repeatingOf = ([, , a, b]) => (b ? `0.${a}${b.repeat(3)}…` : a.length > 1 ? `0.${a.repeat(2)}…` : repeatText(a));

const repeating = {
  version: 1,
  ifNotSimplified: 'frac.equivalent.simplify',
  generate(rng, difficulty) {
    const kind = difficulty === 1 ? 'choose' : difficulty === 2 ? rng.pick(['choose', 'to-fraction']) : rng.pick(['ends', 'to-fraction']);
    if (kind === 'choose') {
      const item = rng.pick(REPEATING[difficulty]);
      const [n, d] = item;
      const right = repeatingOf(item);
      const cut = `0.${item[2]}${item[3] || ''}`; // stopped after one repeat: 0.6 for 0.666…, 0.16 for 0.1666…
      const rounded = decimalText(fraction(Math.round((n * 100) / d), 100)); // 0.67
      const pool = [
        { label: right },
        { label: cut, id: 'dec.repeat-cut-off' },
        { label: rounded, id: 'dec.repeat-cut-off' },
        { label: `0.${n}${d}`, id: 'dec.convert-digits' },
      ];
      const seen = new Set();
      const options = shuffled(rng, pool.filter((o) => (seen.has(o.label) ? false : seen.add(o.label))));
      return {
        instruction: 'Which decimal is equal to this fraction?',
        expression: frac(n, d),
        answer: { type: 'choice', options: options.map((o) => o.label), correct: options.findIndex((o) => o.label === right) },
        misconceptions: options.map((o, i) => (o.id ? { id: o.id, choice: i } : null)).filter(Boolean)
          .filter((m, i, all) => all.findIndex((x) => x.id === m.id) === i),
      };
    }
    if (kind === 'ends') {
      // Ends exactly when the simplified denominator has only 2s and 5s.
      const pool = [[7, 12], [1, 12], [5, 6], [3, 14], [4, 15], [3, 15], [6, 15], [7, 20], [9, 25], [3, 8], [2, 7], [5, 18], [9, 12], [11, 40], [14, 35]];
      const [n, d] = rng.pick(pool);
      const ends = terminates(fraction(n, d));
      // "Odd denominators repeat, even ones end."
      const oddEven = d % 2 === 1 ? 1 : 0;
      return {
        instruction: 'Does the decimal for this fraction end, or repeat forever?',
        expression: frac(n, d),
        answer: { type: 'choice', options: ['It ends', 'It repeats'], correct: ends ? 0 : 1 },
        misconceptions: oddEven !== (ends ? 0 : 1) ? [{ id: 'dec.repeat-odd-even', choice: oddEven }] : [],
      };
    }
    // A repeating decimal as a fraction: 0.555… = 5/9; 0.2727… = 27/99 = 3/11.
    const two = difficulty === 3;
    const block = two ? rng.pick(['27', '18', '36', '45', '63', '81', '12', '24', '15', '42']) : String(rng.int(1, 8));
    const shown = two ? `0.${block.repeat(3)}…` : repeatText(block, 4);
    const over = two ? 99 : 9;
    const value = reduce(fraction(Number(block), over));
    return {
      instruction: 'Write as a fraction in simplest form.',
      expression: dec(shown),
      answer: { type: 'fraction', value },
      misconceptions: [
        { id: 'dec.repeat-as-ending', value: reduce(fraction(Number(block), two ? 100 : 10)) }, // 0.555… = 5/10
      ].filter((m) => m.value.n * value.d !== value.n * m.value.d),
    };
  },
};

// ======================= Add and subtract decimals =======================

// ---------- line up the points ----------
//   1: same number of places (4.6 + 2.3, 7.85 − 2.41);  2: different places (3.5 + 1.25, 8.4 − 2.15);
//   3: regrouping across the point, bigger numbers (12.75 + 8.6, 10.3 − 4.65)
const lineUp = {
  version: 1,
  generate(rng, difficulty) {
    const sym = rng.pick(['+', '-']);
    let a;
    let b;
    if (difficulty === 1) {
      const p = rng.pick([1, 2]);
      [a, b] = [randomDecimal(rng, 9, p), randomDecimal(rng, 9, p)];
    } else if (difficulty === 2) {
      [a, b] = rng.chance(0.5) ? [randomDecimal(rng, 9, 1), randomDecimal(rng, 9, 2)] : [randomDecimal(rng, 9, 2), randomDecimal(rng, 9, 1)];
    } else {
      [a, b] = rng.chance(0.5) ? [randomDecimal(rng, 19, 2), randomDecimal(rng, 9, 1)] : [randomDecimal(rng, 19, 1), randomDecimal(rng, 9, 2)];
    }
    if (sym === '-' && parseDecimal(a).n * parseDecimal(b).d < parseDecimal(b).n * parseDecimal(a).d) [a, b] = [b, a];
    const p = Math.max(placesOf(a), placesOf(b));
    const v = sym === '+' ? toScaled(a, p) + toScaled(b, p) : toScaled(a, p) - toScaled(b, p);
    if (v === 0) return lineUp.generate(rng, difficulty);
    const right = fromScaled(v, p);
    return {
      instruction: sym === '+' ? 'Add.' : 'Subtract.',
      expression: op(sym, dec(a), dec(b)),
      answer: answerDec(right),
      misconceptions: wrongs(right, [{ id: 'dec.right-align', value: rightAligned(a, b, sym) }]),
    };
  },
};

// ---------- a whole number and a decimal ----------
//   1: whole + decimal (4 + 0.6, 3.25 + 2);  2: whole − decimal (6 − 2.4);  3: whole − hundredths (10 − 3.75, 7 − 0.08)
const wholeNumbers = {
  version: 1,
  alsoUses: ['dec.add-sub.line-up'],
  generate(rng, difficulty) {
    let a;
    let b;
    let sym;
    if (difficulty === 1) {
      sym = '+';
      const w = String(rng.int(1, 9));
      const d = randomDecimal(rng, 9, rng.pick([1, 2]));
      [a, b] = rng.chance(0.5) ? [w, d] : [d, w];
    } else {
      sym = '-';
      a = String(difficulty === 2 ? rng.int(3, 9) : rng.pick([10, 20, rng.int(5, 15)]));
      b = difficulty === 2 ? randomDecimal(rng, Number(a) - 1, 1) : rng.chance(0.3) ? fromScaled(rng.int(1, 9), 2) : randomDecimal(rng, Number(a) - 1, 2);
    }
    const p = Math.max(placesOf(a), placesOf(b));
    const v = sym === '+' ? toScaled(a, p) + toScaled(b, p) : toScaled(a, p) - toScaled(b, p);
    const right = fromScaled(v, p);
    // 6 − 2.35 = 4.35: subtracts the whole numbers and brings the decimal part down.
    const dropped = sym === '-' ? fromScaled(toScaled(String(Number(a) - Math.floor(Number(b.split('.')[0]))), p) + (toScaled(b, p) % 10 ** p), p) : null;
    return {
      instruction: sym === '+' ? 'Add.' : 'Subtract.',
      expression: op(sym, a.includes('.') ? dec(a) : int(Number(a)), b.includes('.') ? dec(b) : int(Number(b))),
      answer: answerDec(right),
      misconceptions: wrongs(right, [
        { id: 'dec.whole-ignored', value: dropped },
        { id: 'dec.right-align', value: rightAligned(a, b, sym) },
      ]),
    };
  },
};

// ======================= Multiply decimals =======================

// ---------- by 10, 100, 1000 ----------
//   1: × 10 or × 100 (4.5 × 10);  2: ÷ 10 or ÷ 100, or × 1000 (37 ÷ 10, 0.6 × 1000);  3: × 0.1 or × 0.01, ÷ 1000 (25 × 0.1)
const powersOfTen = {
  version: 1,
  generate(rng, difficulty) {
    let sym;
    let k; // the power of ten: 10^k
    if (difficulty === 1) [sym, k] = ['×', rng.int(1, 2)];
    else if (difficulty === 2) [sym, k] = rng.chance(0.65) ? ['÷', rng.int(1, 2)] : ['×', 3];
    else [sym, k] = rng.pick([['×', -1], ['×', -2], ['÷', 3]]);
    const text = difficulty === 1 ? randomDecimal(rng, 9, rng.pick([1, 2])) : rng.chance(0.5) ? String(rng.int(2, 99)) : randomDecimal(rng, 99, 1);
    const factor = k > 0 ? String(10 ** k) : fromScaled(1, -k);
    const shift = (sym === '×' ? 1 : -1) * k; // + moves the point right
    const v = parseDecimal(text);
    const move = (s) => decimalText(s >= 0 ? fraction(v.n * 10 ** s, v.d) : fraction(v.n, v.d * 10 ** -s));
    const right = move(shift);
    return {
      instruction: sym === '×' ? 'Multiply.' : 'Divide.',
      expression: op(sym, text.includes('.') ? dec(text) : int(Number(text)), k > 0 ? int(10 ** k) : dec(factor)),
      answer: answerDec(right),
      misconceptions: wrongs(right, [
        { id: 'dec.point-wrong-way', value: move(-shift) },
        { id: 'dec.append-zero', value: shift > 0 && text.includes('.') ? `${text}${'0'.repeat(shift)}` : null }, // 4.5 × 10 = 4.50
        { id: 'dec.point-wrong-way', value: Math.abs(shift) > 1 ? move(Math.sign(shift)) : null }, // moved one place, not two
      ]),
    };
  },
};

// ---------- multiply decimals ----------
//   1: a decimal times a whole number (0.7 × 6, 1.2 × 3);  2: tenths × tenths (0.3 × 0.2 = 0.06);
//   3: tenths × hundredths, or a two-digit decimal × tenths (0.06 × 0.7, 1.2 × 0.4)
const multiplyPlace = {
  version: 1,
  generate(rng, difficulty) {
    let x;
    let y;
    let px;
    let py;
    if (difficulty === 1) [x, px, y, py] = [rng.pick([rng.int(2, 9), rng.int(11, 12)]), 1, rng.int(2, 9), 0];
    else if (difficulty === 2) [x, px, y, py] = [rng.int(2, 9), 1, rng.int(2, 9), 1];
    else [x, px, y, py] = rng.chance(0.5) ? [rng.int(2, 9), 2, rng.int(2, 9), 1] : [rng.int(11, 12), 1, rng.int(2, 9), 1];
    const a = fromScaled(x, px);
    const b = fromScaled(y, py);
    const right = fromScaled(x * y, px + py);
    const sides = rng.chance(0.5);
    return {
      instruction: 'Multiply.',
      expression: op('×', ...(sides ? [dec(a), py ? dec(b) : int(y)] : [py ? dec(b) : int(y), dec(a)])),
      answer: answerDec(right),
      misconceptions: wrongs(right, [
        { id: 'dec.point-one-factor', value: fromScaled(x * y, Math.max(px, py)) }, // 0.3 × 0.2 = 0.6
        { id: 'dec.point-one-factor', value: fromScaled(x * y, px + py + 1) },
      ]),
    };
  },
};

// ======================= Divide decimals =======================

// ---------- by a whole number ----------
//   1: tenths, one digit at a time (6.3 ÷ 3 = 2.1, 4.8 ÷ 6 = 0.8);  2: hundredths (0.56 ÷ 7 = 0.08, 3.6 ÷ 4 = 0.9);
//   3: two-digit quotients and thousandths (1.25 ÷ 5 = 0.25, 0.072 ÷ 8 = 0.009, 8.4 ÷ 12 = 0.7)
const byWhole = {
  version: 1,
  generate(rng, difficulty) {
    let d;
    let q; // quotient as a whole number of 10^-places
    let places;
    if (difficulty === 1) {
      d = rng.int(2, 9);
      places = 1;
      q = rng.chance(0.5) ? rng.int(2, 9) : rng.int(1, 3) * 10 + 1; // 0.8, or 2.1 (6.3 ÷ 3)
      if (q > 9 && d > 4) d = rng.int(2, 4);
    } else if (difficulty === 2) {
      d = rng.int(2, 9);
      [q, places] = rng.chance(0.5) ? [rng.int(2, 9), 2] : [rng.int(2, 9), 1];
    } else {
      d = rng.pick([rng.int(2, 9), 12]);
      [q, places] = rng.pick([[rng.int(11, 25), 2], [rng.int(2, 9), 3], [rng.int(2, 9), 1]]);
    }
    const dividend = fromScaled(q * d, places);
    const right = fromScaled(q, places);
    return {
      instruction: 'Divide.',
      expression: op('÷', dec(dividend), int(d)),
      answer: answerDec(right),
      misconceptions: wrongs(right, [
        { id: 'dec.divide-point', value: fromScaled(q, places - 1 >= 0 ? places - 1 : 0) }, // the point in the wrong place
        { id: 'dec.divide-point', value: fromScaled(q, places + 1) },
      ]),
    };
  },
};

// ---------- by a decimal ----------
//   1: by tenths, whole-number answer (2.4 ÷ 0.3 = 8, 3.5 ÷ 0.5 = 7);  2: by hundredths (0.36 ÷ 0.04 = 9, 4.5 ÷ 0.05 = 90);
//   3: a decimal answer, or a big one (0.48 ÷ 0.6 = 0.8, 1.2 ÷ 0.04 = 30)
const byDecimal = {
  version: 1,
  alsoUses: ['dec.divide.by-whole'],
  generate(rng, difficulty) {
    const f = rng.int(2, 9);
    const g = rng.int(2, 9);
    let k; // divisor = f × 10^-k
    let m; // quotient = g × 10^m
    if (difficulty === 1) [k, m] = [1, 0];
    else if (difficulty === 2) [k, m] = [2, rng.pick([0, 1])];
    else [k, m] = rng.pick([[1, -1], [2, 1], [2, -1]]);
    const divisor = fromScaled(f, k);
    const q = m >= 0 ? fraction(g * 10 ** m) : fraction(g, 10 ** -m);
    const dividend = decimalText(fraction(q.n * f, q.d * 10 ** k));
    const right = decimalText(q);
    return {
      instruction: 'Divide.',
      expression: op('÷', dec(dividend), dec(divisor)),
      answer: answerDec(right),
      misconceptions: wrongs(right, [
        { id: 'dec.move-one-point', value: decimalText(fraction(q.n, q.d * 10 ** k)) }, // 2.4 ÷ 0.3 = 0.8
        { id: 'dec.move-one-point', value: decimalText(fraction(q.n * 10 ** k, q.d)) },
      ]),
    };
  },
};


// ======================= Negative decimals =======================

const signedText = (f) => decimalText(f);
const negText = (t) => (t.startsWith('-') ? t.slice(1) : `-${t}`);
// Signed wrong answers: keep those that differ from the right one and from each other.
function signedWrongs(right, list) {
  const out = [];
  const same = (x, y) => { const a = parseDecimal(x); const b = parseDecimal(y); return a && b && a.n * b.d === b.n * a.d; };
  for (const m of list) {
    if (!m || m.value == null || same(m.value, right) || out.some((o) => same(o.value, m.value))) continue;
    out.push(m);
  }
  return out;
}
const answerSigned = (value) => ({ type: 'decimal', value, allowNegative: true });

// ---------- add and subtract ----------
//   1: add, one negative, same places (−3.5 + 1.2, 4.6 + (−2.8));
//   2: subtract into the negatives, or a negative minus a positive, different places (2.4 − 5.15, −1.2 − 0.35);
//   3: subtract a negative (3.25 − (−1.4), −0.6 − (−2.45))
const signedAddSub = {
  version: 1,
  generate(rng, difficulty) {
    for (;;) {
      const p = difficulty === 1 ? rng.pick([1, 2]) : 0;
      let [a, b] = difficulty === 1 ? [randomDecimal(rng, 9, p), randomDecimal(rng, 9, p)]
        : rng.chance(0.5) ? [randomDecimal(rng, 9, 1), randomDecimal(rng, 9, 2)] : [randomDecimal(rng, 9, 2), randomDecimal(rng, 9, 1)];
      let sym;
      if (difficulty === 1) {
        sym = '+';
        if (rng.chance(0.5)) a = negText(a); else b = negText(b);
      } else if (difficulty === 2) {
        sym = '-';
        if (rng.chance(0.5)) a = negText(a); // −1.2 − 0.35
        else if (parseDecimal(a).n * parseDecimal(b).d > parseDecimal(b).n * parseDecimal(a).d) [a, b] = [b, a]; // 2.4 − 5.15
      } else {
        sym = '-';
        b = negText(b);
        if (rng.chance(0.5)) a = negText(a);
      }
      const [x, y] = [parseDecimal(a), parseDecimal(b)];
      const value = sym === '+' ? add(x, y) : sub(x, y);
      if (value.n === 0) continue;
      const right = signedText(value);
      return {
        instruction: sym === '+' ? 'Add.' : 'Subtract.',
        expression: op(sym, dec(a), dec(b)),
        answer: answerSigned(right),
        misconceptions: signedWrongs(right, [
          { id: 'dec.signed-wrong-sign', value: negText(right) },
          // 3.25 − (−1.4) worked as 3.25 − 1.4
          { id: 'dec.signed-sub-ignored-sign', value: sym === '-' && y.n < 0 ? signedText(add(x, y)) : null },
        ]),
      };
    }
  },
};

// ---------- multiply and divide ----------
//   1: multiply, one negative (−0.3 × 4, 6 × (−0.7));  2: divide, one negative (−4.8 ÷ 6, 2.4 ÷ (−0.3));
//   3: two negatives, decimal by decimal (−0.3 × (−0.2), −0.48 ÷ (−0.6))
const signedMultDiv = {
  version: 1,
  generate(rng, difficulty) {
    const divide = difficulty === 2 || (difficulty === 3 && rng.chance(0.5));
    let a;
    let b;
    if (!divide) {
      const f = rng.int(2, 9);
      const g = rng.int(2, 9);
      if (difficulty === 1) [a, b] = rng.chance(0.5) ? [fromScaled(f, 1), String(g)] : [String(g), fromScaled(f, 1)];
      else [a, b] = [fromScaled(f, rng.pick([1, 2])), fromScaled(g, 1)];
    } else {
      const g = rng.int(2, 9); // the quotient's digit
      const f = rng.int(2, 9); // the divisor's digit
      const byDecimalToo = difficulty === 3 || rng.chance(0.5);
      const divisor = byDecimalToo ? fromScaled(f, 1) : String(f);
      const q = byDecimalToo ? fraction(g, rng.pick([1, 10])) : fraction(g, 10);
      [a, b] = [decimalText(mul(q, parseDecimal(divisor))), divisor];
    }
    const signs = difficulty === 3 ? [-1, -1] : rng.pick([[-1, 1], [1, -1]]);
    if (signs[0] < 0) a = negText(a);
    if (signs[1] < 0) b = negText(b);
    const [x, y] = [parseDecimal(a), parseDecimal(b)];
    const right = signedText(divide ? div(x, y) : mul(x, y));
    const show = (t) => (t.replace('-', '').includes('.') ? dec(t) : int(Number(t)));
    return {
      instruction: divide ? 'Divide.' : 'Multiply.',
      expression: op(divide ? '÷' : '×', show(a), show(b)),
      answer: answerSigned(right),
      misconceptions: signedWrongs(right, [{ id: 'dec.signed-mult-sign', value: negText(right) }]),
    };
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
  'dec.place-value.read': read,
  'dec.place-value.compare': compare,
  'dec.place-value.round': round,
  'dec.convert.to-decimal': toDecimal,
  'dec.convert.to-fraction': toFraction,
  'dec.convert.repeating': repeating,
  'dec.add-sub.line-up': lineUp,
  'dec.add-sub.whole-numbers': wholeNumbers,
  'dec.multiply.powers-of-ten': powersOfTen,
  'dec.multiply.place': multiplyPlace,
  'dec.divide.by-whole': byWhole,
  'dec.divide.by-decimal': byDecimal,
  'dec.signed.add-sub': signedAddSub,
  'dec.signed.mult-div': signedMultDiv,
};

export const decimalGenerators = {
  // One hard comparison (0.5 ? 0.45) stands for reading place value too; rounding is asked on its own.
  'dec.place-value': mixedOf({ screener: 'dec.place-value.compare', covers: ['dec.place-value.read', 'dec.place-value.compare'], parts: ['dec.place-value.read', 'dec.place-value.compare', 'dec.place-value.round'] }),
  // The two directions rest on different fraction skills: each is asked.
  'dec.convert': mixedOf({ version: 2, covers: ['dec.convert.to-decimal', 'dec.convert.to-fraction', 'dec.convert.repeating'] }),
  // A whole number minus a decimal (6 − 2.35) needs lining up too.
  'dec.add-sub': mixedOf({ screener: 'dec.add-sub.whole-numbers', covers: ['dec.add-sub.line-up', 'dec.add-sub.whole-numbers'] }),
  // Multiplying decimals and moving the point by 10, 100 are different ideas: both asked.
  'dec.multiply': mixedOf({ screener: 'dec.multiply.place', covers: ['dec.multiply.place'], parts: ['dec.multiply.powers-of-ten', 'dec.multiply.place'] }),
  // Dividing by a decimal (2.4 ÷ 0.3) needs dividing by a whole number too.
  'dec.divide': mixedOf({ screener: 'dec.divide.by-decimal', covers: ['dec.divide.by-whole', 'dec.divide.by-decimal'] }),
  // Adding and multiplying with negatives rest on different integer skills: each is asked.
  'dec.signed': mixedOf({ covers: ['dec.signed.add-sub', 'dec.signed.mult-div'] }),
  ...parts,
};
