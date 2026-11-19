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
    default:
      throw new Error(`checkAnswer: unknown answer type "${expected.type}"`);
  }
}

function checkFraction(problem, raw) {
  const read = readAnswer(raw);
  if (!read.ok) return { status: 'invalid', reason: read.reason };

  const { value: correct, form = 'any' } = problem.answer;
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

function wrong(problem, matches) {
  const match = (problem.misconceptions || []).find(matches);
  return match ? { status: 'wrong', misconception: match.id } : { status: 'wrong' };
}
