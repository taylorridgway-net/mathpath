// Checks one student answer against one generated problem.
//
// This runs in the browser (instant feedback) AND on the server (re-checking
// saved work), so it must never depend on anything but the engine.
//
// A student answer comes from the math keypad as a plain object:
//   { whole: 2 }                          a whole number: 2
//   { num: 3, den: 4 }                    a fraction: 3/4
//   { whole: 1, num: 3, den: 4 }          a mixed number: 1 3/4
//   { negative: true, num: 3, den: 4 }    -3/4
//   { whole: 9, rem: 2 }                  9 R 2 (a division with a remainder)
//   { list: [1, 2, 3, 4, 6, 12] }         a list of whole numbers (factors, primes)
//   { choice: 2, label: '>' }             one of the problem's answer buttons (compare)
//   { coef: 3, constant: -12 }            3x - 12 (an expression, pre-algebra)
//
// Possible results:
//   correct         right value, in an accepted form
//   not-simplified  right value but not in simplest form -> one more try, hint "simplify"
//   wrong-form      right value, but the question asked for mixed (or improper) form
//   wrong           wrong value; may include the misconception it matches
//   invalid         not a usable answer (blank, half-typed fraction, zero denominator...)
//
// What to DO with each result (e.g. allowing one retry after not-simplified)
// is decided by the practice session, not here.

import { fraction, gcd, equals } from '../math/fraction.js';

// Read a keypad answer into a value plus facts about how it was written.
export function readAnswer(raw) {
  if (!raw || typeof raw !== 'object') return { ok: false, reason: 'empty' };

  const field = (key) => (raw[key] === undefined || raw[key] === null || raw[key] === '' ? null : raw[key]);
  const whole = field('whole');
  const num = field('num');
  const den = field('den');

  for (const part of [whole, num, den]) {
    if (part !== null && (!Number.isSafeInteger(part) || part < 0)) {
      return { ok: false, reason: 'not-a-number' };
    }
  }
  if ((num === null) !== (den === null)) return { ok: false, reason: 'incomplete-fraction' };
  if (whole === null && num === null) return { ok: false, reason: 'empty' };
  if (den === 0) return { ok: false, reason: 'zero-denominator' };

  let shape;
  let size;
  let simplest;
  if (num === null) {
    shape = 'integer';
    size = fraction(whole, 1);
    simplest = true;
  } else if (whole === null) {
    shape = 'fraction';
    size = fraction(num, den);
    // 0/4 should be written 0; 5/1 should be written 5.
    simplest = num !== 0 && den !== 1 && gcd(num, den) === 1;
  } else {
    shape = 'mixed';
    size = fraction(whole * den + num, den);
    // 0 3/4 should be 3/4; 1 5/4 should be 2 1/4; 1 2/4 should be 1 1/2.
    simplest = whole > 0 && num > 0 && num < den && gcd(num, den) === 1;
  }

  const value = raw.negative === true ? fraction(-size.n, size.d) : size;
  return { ok: true, value, shape, simplest };
}

export function checkAnswer(problem, raw) {
  const expected = problem.answer;
  switch (expected.type) {
    case 'fraction':
      return checkFraction(problem, raw);
    case 'integer':
      return checkInteger(problem, raw);
    case 'common-multiple':
      return checkCommonMultiple(problem, raw);
    case 'quotient-remainder':
      return checkQuotientRemainder(problem, raw);
    case 'linear':
      return checkLinear(problem, raw);
    case 'set':
    case 'multiset':
      return checkList(problem, raw);
    case 'choice':
      return checkChoice(problem, raw);
    default:
      throw new Error(`checkAnswer: unknown answer type "${expected.type}"`);
  }
}

function checkFraction(problem, raw) {
  const read = readAnswer(raw);
  if (!read.ok) return { status: 'invalid', reason: read.reason };

  const { value: correct, form = 'any' } = problem.answer;
  // "Write the new fraction (don't simplify it)": only exactly n/d counts.
  if (form === 'exact') {
    if (read.shape === 'fraction' && raw.num === problem.answer.n && raw.den === problem.answer.d && !raw.negative) return { status: 'correct' };
    const exactMatch = (problem.misconceptions || []).find((m) => m.exact && equals(fraction(m.value.n, m.value.d), read.value));
    if (exactMatch) return { status: 'wrong', misconception: exactMatch.id };
    return wrong(problem, (m) => !m.exact && equals(fraction(m.value.n, m.value.d), read.value));
  }
  if (!equals(read.value, correct)) {
    return wrong(problem, (m) => equals(fraction(m.value.n, m.value.d), read.value));
  }
  if (!read.simplest) return { status: 'not-simplified', hint: 'simplify' };

  const biggerThanOne = Math.abs(read.value.n) > read.value.d;
  if (form === 'mixed' && read.shape === 'fraction' && biggerThanOne) {
    return { status: 'wrong-form', hint: 'use-mixed' };
  }
  if (form === 'improper' && read.shape === 'mixed') {
    return { status: 'wrong-form', hint: 'use-improper' };
  }
  return { status: 'correct' };
}

function checkInteger(problem, raw) {
  const read = readAnswer(raw);
  if (!read.ok) return { status: 'invalid', reason: read.reason };
  if (read.shape !== 'integer') return { status: 'invalid', reason: 'expected-whole-number' };

  const given = read.value.n;
  if (given === problem.answer.value) return { status: 'correct' };
  return wrong(problem, (m) => m.value === given);
}

// "Find a common denominator": any positive common multiple is right
// (multiplying the denominators always works). The least one is nice but not required.
function checkCommonMultiple(problem, raw) {
  const read = readAnswer(raw);
  if (!read.ok) return { status: 'invalid', reason: read.reason };
  if (read.shape !== 'integer') return { status: 'invalid', reason: 'expected-whole-number' };

  const given = read.value.n;
  const { of, least } = problem.answer;
  if (given > 0 && of.every((d) => given % d === 0)) {
    return given === least ? { status: 'correct' } : { status: 'correct', note: 'not-least' };
  }
  return wrong(problem, (m) => m.value === given);
}

// One of the answer buttons (<, =, >; or 0, 1/2, 1). A wrong button may match a
// misconception: { id, choice } means "this wrong button comes from that mistake".
function checkChoice(problem, raw) {
  const c = raw?.choice;
  if (!Number.isInteger(c) || c < 0 || c >= problem.answer.options.length) return { status: 'invalid', reason: 'empty' };
  if (c === problem.answer.correct) return { status: 'correct' };
  return wrong(problem, (m) => m.choice === c);
}

// 47 ÷ 5 = 9 R 2. The remainder box may be left empty when it's 0.
// "3x + 12": answer { type: 'linear', coef, constant }; raw { coef, constant } (whole
// numbers, signed). Both boxes are needed (0 is typed as 0). A misconception
// matches when both numbers match its { coef, constant }.
function checkLinear(problem, raw) {
  const ok = (v) => Number.isInteger(v) && Math.abs(v) < 100000;
  if (!ok(raw?.coef) || !ok(raw?.constant)) return { status: 'invalid', reason: 'empty' };
  const { coef, constant } = problem.answer;
  if (raw.coef === coef && raw.constant === constant) return { status: 'correct' };
  return wrong(problem, (m) => m.value && m.value.coef === raw.coef && m.value.constant === raw.constant);
}

function checkQuotientRemainder(problem, raw) {
  const q = raw?.whole;
  const r = raw?.rem === undefined || raw?.rem === null || raw?.rem === '' ? 0 : raw.rem;
  if (!Number.isSafeInteger(q) || q < 0 || !Number.isSafeInteger(r) || r < 0) return { status: 'invalid', reason: 'empty' };
  const { quotient, remainder } = problem.answer;
  if (q === quotient && r === remainder) return { status: 'correct' };
  return wrong(problem, (m) => m.value.quotient === q && m.value.remainder === r);
}

// "All the factors of 24" (set: each once, any order) or "60 as a product of
// primes" (multiset: repeats matter, any order).
function checkList(problem, raw) {
  const list = Array.isArray(raw?.list) ? raw.list : null;
  if (!list || !list.length || !list.every((x) => Number.isSafeInteger(x) && x >= 0)) return { status: 'invalid', reason: 'empty' };
  const given = problem.answer.type === 'set' ? [...new Set(list)] : list;
  const key = (xs) => [...xs].sort((a, b) => a - b).join(',');
  if (key(given) === key(problem.answer.values)) return { status: 'correct' };
  const match = (problem.misconceptions || []).find((m) => (m.test ? listTests[m.test](given, problem) : key(m.value) === key(given)));
  return match ? { status: 'wrong', misconception: match.id } : { status: 'wrong' };
}

// Wrong-answer patterns that are a rule rather than one fixed wrong answer.
const listTests = {
  // Product is right, but some numbers in it aren't prime (60 = 4 × 15).
  'product-right-not-all-prime': (given, problem) => given.reduce((p, x) => p * x, 1) === problem.answer.product
    && given.some((x) => !isPrime(x)),
  // Lists multiples of the number instead of factors.
  'multiples-not-factors': (given, problem) => given.some((x) => x > problem.answer.of && x % problem.answer.of === 0),
  // Every number is a factor, but some are missing.
  'some-factors-missing': (given, problem) => given.every((x) => problem.answer.values.includes(x)) && given.length < problem.answer.values.length,
};

export function isPrime(n) {
  if (!Number.isInteger(n) || n < 2) return false;
  for (let d = 2; d * d <= n; d++) if (n % d === 0) return false;
  return true;
}

function wrong(problem, matches) {
  const match = (problem.misconceptions || []).find(matches);
  return match ? { status: 'wrong', misconception: match.id } : { status: 'wrong' };
}
