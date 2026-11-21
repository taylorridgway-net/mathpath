// Generators for "Exponents and roots" (area exp, grade 8): exponent rules (including zero and
// negative exponents), square and cube roots, and scientific notation.
// Answers stay on the existing keypads: an exponent typed into the box (x³ · x⁴ = x^□, an
// integer), a number or fraction (2⁻³ = 1/8), a decimal (3.2 × 10⁴ in standard form), or
// buttons ("between 7 and 8", "Rational / Irrational").
// See engine/generators/frac/add-sub.js for what a generator returns.

import { fraction, reduce, equals } from '../../math/fraction.js';
import { fromScaled } from '../../math/decimal.js';

const int = (value) => ({ type: 'int', value });
const dec = (value) => ({ type: 'dec', value });
const op = (sym, left, right) => ({ type: 'op', op: sym, left, right });
const eq = (left, right) => ({ type: 'eq', left, right });
const pow = (base, exp) => ({ type: 'pow', base, exp });
const frac = (n, d) => ({ type: 'frac', n, d });
const x = { type: 'var', name: 'x' };
const nonZero = (rng, lo, hi) => { for (;;) { const v = rng.int(lo, hi); if (v !== 0) return v; } };
const F = (n, d = 1) => fraction(n, d);
const shuffled = (rng, list) => { const out = [...list]; for (let i = out.length - 1; i > 0; i--) { const j = rng.int(0, i); [out[i], out[j]] = [out[j], out[i]]; } return out; };

// An integer answer (an exponent): wrong values kept if different and new.
function integerProblem(instruction, expression, value, candidates) {
  const out = [];
  for (const c of candidates) {
    if (c == null || c.value == null || !Number.isInteger(c.value) || c.value === value || out.some((o) => o.value === c.value)) continue;
    out.push(c);
  }
  return { instruction, expression, answer: { type: 'integer', value, allowNegative: true }, misconceptions: out };
}
function fractionProblem(instruction, expression, value, candidates) {
  const v = reduce(value);
  const out = [];
  for (const c of candidates) {
    if (!c || !c.value || !Number.isSafeInteger(c.value.n)) continue;
    const w = reduce(c.value);
    if (equals(w, v) || out.some((o) => equals(o.value, w))) continue;
    out.push({ id: c.id, value: w });
  }
  return { instruction, expression, answer: { type: 'fraction', value: v, form: 'any', allowNegative: true }, misconceptions: out };
}
const blankPow = (base) => pow(base, 'blank');
const base = (rng, difficulty) => (difficulty === 2 ? int(rng.int(2, 9)) : x);

// ======================= Exponent rules =======================

// ---------- product: x³ · x⁴ = x^7 ----------
//   1: positive exponents;  2: a number base (2³ · 2⁵);  3: a negative exponent (x⁵ · x⁻²)
const product = {
  version: 1,
  generate(rng, difficulty) {
    const a = rng.int(2, 8);
    const b = difficulty === 3 ? -rng.int(1, 9) : rng.int(2, 7);
    const B = base(rng, difficulty);
    return integerProblem('Simplify. Type the exponent.', eq(op('·', pow(B, a), pow(B, b)), blankPow(B)), a + b, [
      { id: 'exp.multiplied-exponents', value: a * b }, // x³ · x⁴ = x¹²
    ]);
  },
};

// ---------- quotient: x⁷ / x³ = x^4 ----------
//   1: the bigger exponent on top;  2: a number base;  3: the answer is negative (x² / x⁶ = x⁻⁴)
const quotient = {
  version: 1,
  generate(rng, difficulty) {
    let a; let b;
    if (difficulty === 3) { a = rng.int(1, 5); b = a + rng.int(1, 5); } else {
      b = rng.int(2, 5); a = b * rng.int(2, 3) + (rng.chance(0.5) ? 0 : rng.int(1, 2));
    }
    const B = base(rng, difficulty);
    return integerProblem('Simplify. Type the exponent.', eq(frac(pow(B, a), pow(B, b)), blankPow(B)), a - b, [
      { id: 'exp.divided-exponents', value: a % b === 0 ? a / b : null }, // x⁶ / x² = x³
      { id: 'exp.quotient-added', value: a + b },
      { id: 'exp.quotient-backwards', value: b - a },
    ]);
  },
};

// ---------- power of a power: (x²)³ = x^6 ----------
//   1: positive;  2: a number base;  3: a negative exponent inside or out
const power = {
  version: 1,
  generate(rng, difficulty) {
    const a = difficulty === 3 ? nonZero(rng, -4, 5) : rng.int(2, 5);
    let b = rng.int(2, 4);
    if (difficulty === 3 && a > 0) b = -b;
    const B = base(rng, difficulty);
    return integerProblem('Simplify. Type the exponent.', eq(pow({ type: 'group', of: pow(B, a) }, b), blankPow(B)), a * b, [
      { id: 'exp.power-added', value: a + b }, // (x²)³ = x⁵
    ]);
  },
};

// ---------- zero and negative exponents ----------
//   1: 2⁻³ = 1/8, or 7⁰ = 1;  2: x⁻⁴ = 1/x^□;  3: a fraction to a negative power ((2/3)⁻² = 9/4)
const negative = {
  version: 1,
  generate(rng, difficulty) {
    if (difficulty === 2) {
      const k = rng.int(2, 9);
      return integerProblem('Write with a positive exponent. Type the exponent.', eq(pow(x, -k), frac(int(1), blankPow(x))), k, [
        { id: 'exp.negative-kept', value: -k }, // 1/x⁻⁴
      ]);
    }
    if (difficulty === 1) {
      if (rng.chance(0.25)) {
        const b = rng.int(2, 12);
        return fractionProblem('Find the value.', pow(int(b), 0), F(1), [{ id: 'exp.zero-is-zero', value: F(0) }, { id: 'exp.zero-is-base', value: F(b) }]);
      }
      const b = rng.int(2, 5);
      const k = rng.int(1, b === 2 ? 4 : 3);
      return fractionProblem('Find the value. Write a fraction if you need to.', pow(int(b), -k), F(1, b ** k), [
        { id: 'exp.negative-means-negative', value: F(-(b ** k)) }, // 2⁻³ = −8
        { id: 'exp.base-times-exponent', value: F(-b * k) }, // 2⁻³ = −6
        { id: 'exp.negative-means-negative', value: F(-1, b ** k) },
      ]);
    }
    const [p, q] = rng.pick([[2, 3], [3, 4], [1, 2], [2, 5], [3, 2], [1, 3], [4, 5]]);
    const k = rng.int(1, 2);
    return fractionProblem('Find the value. Write a fraction if you need to.', pow({ type: 'group', of: frac(p, q) }, -k), F(q ** k, p ** k), [
      { id: 'exp.negative-means-negative', value: F(-(p ** k), q ** k) }, // (2/3)⁻² = −4/9
      { id: 'exp.negative-not-flipped', value: F(p ** k, q ** k) }, // (2/3)⁻² = 4/9
    ]);
  },
};

// ======================= Square and cube roots =======================

// ---------- perfect squares and cubes ----------
//   1: √49 = 7;  2: √144, √(4/9);  3: cube roots (∛27 = 3, ∛−8 = −2)
const perfect = {
  version: 1,
  generate(rng, difficulty) {
    if (difficulty === 3) {
      const r = nonZero(rng, -5, 5);
      return fractionProblem('Find the cube root.', { type: 'root', index: 3, of: int(r ** 3) }, F(r), [
        { id: 'exp.root-divided', value: (r ** 3) % 3 === 0 ? F(r ** 3 / 3) : null }, // ∛27 = 9
        { id: 'exp.cube-root-sign', value: r < 0 ? F(-r) : null },
      ]);
    }
    if (difficulty === 2 && rng.chance(0.4)) {
      const [p, q] = rng.pick([[2, 3], [3, 4], [1, 5], [5, 6], [2, 7], [3, 8], [4, 9]]);
      return fractionProblem('Find the square root.', { type: 'root', index: 2, of: frac(p * p, q * q) }, F(p, q), [
        { id: 'exp.root-halved', value: F(p * p, 2 * q * q) },
      ]);
    }
    const r = difficulty === 1 ? rng.int(2, 10) : rng.int(11, 15);
    return fractionProblem('Find the square root.', { type: 'root', index: 2, of: int(r * r) }, F(r), [
      { id: 'exp.root-halved', value: F(r * r, 2) }, // √64 = 32
    ]);
  },
};

// ---------- estimate a square root ----------
//   1: √50 (between 7 and 8);  2: bigger (√110);  3: closer to which? (√80 is closer to 9 than 8)
const estimate = {
  version: 1,
  generate(rng, difficulty) {
    const lo = difficulty === 1 ? rng.int(2, 7) : rng.int(7, 11);
    const n = lo * lo + rng.int(1, 2 * lo);
    if (difficulty === 3) {
      const closerHi = (lo + 1) ** 2 - n < n - lo * lo;
      if ((lo + 1) ** 2 - n === n - lo * lo) return estimate.generate(rng, difficulty);
      const options = [String(lo), String(lo + 1)];
      return {
        instruction: `Which whole number is √${n} closest to?`,
        expression: { type: 'root', index: 2, of: int(n) },
        answer: { type: 'choice', options, correct: closerHi ? 1 : 0 },
        misconceptions: [],
      };
    }
    const pair = (a) => `${a} and ${a + 1}`;
    const half = Math.floor(n / 2);
    const pool = [{ label: pair(lo) }, { label: pair(lo - 1) }, { label: pair(lo + 1) }, { label: `${half} and ${half + 1}`, id: 'exp.root-halved' }];
    const seen = new Set();
    const options = shuffled(rng, pool.filter((o) => (seen.has(o.label) || o.label.startsWith('0 ') ? false : seen.add(o.label))));
    return {
      instruction: 'Between which two whole numbers is this square root?',
      expression: { type: 'root', index: 2, of: int(n) },
      answer: { type: 'choice', options: options.map((o) => o.label), correct: options.findIndex((o) => o.label === pair(lo)) },
      misconceptions: options.map((o, i) => (o.id ? { id: o.id, choice: i } : null)).filter(Boolean),
    };
  },
};

// ---------- rational or irrational ----------
//   1: square roots (√16 rational, √20 irrational);  2: decimals and fractions (0.333…, 3/4, π);  3: a mix, including √(9/16) and 2√9
const rational = {
  version: 1,
  generate(rng, difficulty) {
    const items = {
      1: [
        () => { const r = rng.int(2, 12); return { node: { type: 'root', index: 2, of: int(r * r) }, rational: true, trap: 'exp.roots-all-irrational' }; },
        () => { let n; do n = rng.int(2, 99); while (Number.isInteger(Math.sqrt(n))); return { node: { type: 'root', index: 2, of: int(n) }, rational: false }; },
      ],
      2: [
        () => ({ node: dec(`0.${String(rng.int(1, 9)).repeat(3)}…`), rational: true, trap: 'exp.repeating-irrational' }),
        () => ({ node: frac(rng.int(1, 8), 9), rational: true }),
        () => ({ node: { type: 'var', name: 'π' }, rational: false, trap: 'exp.pi-rational' }),
        () => ({ node: dec(fromScaled(rng.int(101, 999), 2)), rational: true }),
      ],
      3: [
        () => { const [p, q] = rng.pick([[3, 4], [2, 5], [5, 6]]); return { node: { type: 'root', index: 2, of: frac(p * p, q * q) }, rational: true, trap: 'exp.roots-all-irrational' }; },
        () => { let n; do n = rng.int(2, 30); while (Number.isInteger(Math.sqrt(n))); return { node: { type: 'root', index: 2, of: int(n) }, rational: false }; },
        () => ({ node: { type: 'var', name: 'π' }, rational: false, trap: 'exp.pi-rational' }),
        () => ({ node: dec(`0.${String(rng.int(10, 99)).repeat(3)}…`), rational: true, trap: 'exp.repeating-irrational' }),
      ],
    }[difficulty];
    const it = rng.pick(items)();
    return {
      instruction: 'Is this number rational or irrational?',
      expression: it.node,
      answer: { type: 'choice', options: ['Rational', 'Irrational'], correct: it.rational ? 0 : 1 },
      misconceptions: it.trap ? [{ id: it.trap, choice: it.rational ? 1 : 0 }] : [],
    };
  },
};

// ======================= Scientific notation =======================

// A number a × 10^n with a = digits / 10 (one or two digits after the point).
function sciNumber(rng) {
  const twoDigits = rng.chance(0.6);
  const mant = twoDigits ? rng.int(11, 99) : rng.int(2, 9); // 4.5 or 7
  return { scaled: mant, places: twoDigits ? 1 : 0 };
}
// mantissa × 10^n as exact decimal text.
const standard = (scaled, places, n) => {
  const shift = n - places;
  return shift >= 0 ? String(scaled * 10 ** shift) : fromScaled(scaled, -shift);
};

// ---------- write in scientific notation ----------
//   1: a big number (45000 = 4.5 × 10^□);  2: a small number (0.0032 = 3.2 × 10^□);  3: find the number in front (320000 = □ × 10⁵)
const writeSci = {
  version: 1,
  generate(rng, difficulty) {
    const { scaled, places } = sciNumber(rng);
    const n = difficulty === 2 ? -rng.int(1, 5) : rng.int(3, 7);
    const value = standard(scaled, places, n);
    const mant = fromScaled(scaled, places);
    if (difficulty === 3) {
      const answer = { type: 'decimal', value: mant };
      return {
        instruction: 'Fill in the number in front.',
        expression: eq(dec(value), op('×', { type: 'blank' }, pow(int(10), n))),
        answer,
        misconceptions: [
          { id: 'exp.sci-not-between', value: fromScaled(scaled * 10, places) }, // 32 × 10⁵: not between 1 and 10
        ].filter((m) => m.value !== mant),
      };
    }
    const zeros = (value.match(/0/g) || []).length;
    return integerProblem('Fill in the exponent.', eq(dec(value), op('×', dec(mant), blankPow(int(10)))), n, [
      { id: 'exp.sci-sign', value: -n }, // 0.0032 = 3.2 × 10³
      { id: 'exp.sci-count-zeros', value: n > 0 ? zeros : -zeros }, // counted the zeros
    ]);
  },
};

// ---------- scientific notation to standard form ----------
//   1: × 10³ to 10⁶;  2: × 10⁻¹ to 10⁻⁴;  3: either, with a two-digit number in front
const toStandard = {
  version: 1,
  generate(rng, difficulty) {
    const { scaled, places } = difficulty === 3 ? { scaled: rng.int(11, 99), places: 1 } : sciNumber(rng);
    const n = difficulty === 1 ? rng.int(3, 6) : difficulty === 2 ? -rng.int(1, 4) : nonZero(rng, -4, 6);
    const value = standard(scaled, places, n);
    const mant = fromScaled(scaled, places);
    return {
      instruction: 'Write in standard form.',
      expression: op('×', dec(mant), pow(int(10), n)),
      answer: { type: 'decimal', value },
      misconceptions: [
        { id: 'exp.sci-wrong-way', value: standard(scaled, places, -n) }, // moved the point the wrong way
        { id: 'exp.sci-off-by-one', value: standard(scaled, places, n > 0 ? n - 1 : n + 1) }, // wrote n zeros after the digits
      ].filter((m, i, all) => m.value !== value && all.findIndex((o) => o.value === m.value) === i),
    };
  },
};

// ---------- multiply and divide ----------
//   1: (2 × 10³)(4 × 10⁵) = 8 × 10^□;  2: divide ((6 × 10⁸) ÷ (2 × 10³));  3: negative exponents
const operate = {
  version: 1,
  generate(rng, difficulty) {
    const divide = difficulty === 2 || (difficulty === 3 && rng.chance(0.5));
    let [p, q] = [rng.int(2, 4), rng.int(2, 3)];
    if (p * q >= 10) q = 2;
    const [m, k] = difficulty === 3 ? [nonZero(rng, -6, 8), nonZero(rng, -6, 5)] : [rng.int(3, 9), rng.int(2, 6)];
    const left = divide ? op('×', int(p * q), pow(int(10), m)) : op('×', int(p), pow(int(10), m));
    const right = divide ? op('×', int(q), pow(int(10), k)) : op('×', int(q), pow(int(10), k));
    const n = divide ? m - k : m + k;
    const front = divide ? p : p * q;
    return integerProblem('Fill in the exponent.', eq(op(divide ? '÷' : '·', { type: 'group', of: left }, { type: 'group', of: right }), op('×', int(front), blankPow(int(10)))), n, [
      { id: 'exp.multiplied-exponents', value: divide ? null : m * k },
      { id: 'exp.quotient-added', value: divide ? m + k : null },
    ]);
  },
};

const parts = {
  'exp.rules.product': product,
  'exp.rules.quotient': quotient,
  'exp.rules.power': power,
  'exp.rules.negative': negative,
  'exp.roots.perfect': perfect,
  'exp.roots.estimate': estimate,
  'exp.roots.rational': rational,
  'exp.scinot.write': writeSci,
  'exp.scinot.standard': toStandard,
  'exp.scinot.operate': operate,
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

export const expAreaGenerators = {
  // Each rule is its own idea (and its own classic mistake): each is asked.
  'exp.rules': mixedOf({ covers: ['exp.rules.product', 'exp.rules.quotient', 'exp.rules.power', 'exp.rules.negative'] }),
  // Estimating √50 needs knowing the perfect squares: it stands for both. Rational or irrational is asked on its own.
  'exp.roots': mixedOf({ screener: 'exp.roots.estimate', covers: ['exp.roots.perfect', 'exp.roots.estimate'], parts: ['exp.roots.perfect', 'exp.roots.estimate', 'exp.roots.rational'] }),
  // Multiplying in scientific notation needs writing it; standard form is asked on its own.
  'exp.scinot': mixedOf({ screener: 'exp.scinot.operate', covers: ['exp.scinot.write', 'exp.scinot.operate'], parts: ['exp.scinot.write', 'exp.scinot.standard', 'exp.scinot.operate'] }),
  ...parts,
};
