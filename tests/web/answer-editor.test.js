// Tests for the keypad logic: typing sequences a student might use, and what the
// grader receives. Ends with every typed answer being graded the way we expect.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createAnswerState, applyKey, toRawAnswer, describeAnswer, rawToText, canSubmit, MAX_DIGITS,
} from '../../web/components/answer-editor.js';
import { checkAnswer } from '../../engine/grading/check-answer.js';
import { fraction } from '../../engine/math/fraction.js';

// Type a sequence like ['3', 'fraction', '4'] starting from an empty answer.
const type = (keys, options) => keys.reduce(applyKey, createAnswerState(options));
const raw = (keys, options) => toRawAnswer(type(keys, options));

test('a whole number', () => {
  assert.deepEqual(raw(['1', '2']), { whole: 12 });
});

test('a fraction typed numerator-first: 3 / 4', () => {
  const s = type(['3', 'fraction', '4']);
  assert.equal(s.mode, 'fraction');
  assert.deepEqual(toRawAnswer(s), { num: 3, den: 4 });
});

test('a fraction started with the fraction key: / 3 / 4', () => {
  assert.deepEqual(raw(['fraction', '3', 'fraction', '4']), { num: 3, den: 4 });
});

test('a mixed number: 2 (space) 3 / 4', () => {
  assert.deepEqual(raw(['2', 'mixed', '3', 'fraction', '4']), { whole: 2, num: 3, den: 4 });
});

test('a mixed number started from a fraction: 3 / 4, then add the whole part', () => {
  assert.deepEqual(raw(['3', 'fraction', '4', 'mixed', '2']), { whole: 2, num: 3, den: 4 });
});

test('tapping boxes moves focus, but only to boxes that are showing', () => {
  let s = type(['fraction', '5']);
  s = applyKey(s, 'focus:den');
  s = applyKey(s, '8');
  assert.deepEqual(toRawAnswer(s), { num: 5, den: 8 });
  assert.equal(applyKey(s, 'focus:whole').focus, 'den'); // no whole box in a plain fraction
});

test('backspace deletes, then steps back through the boxes', () => {
  let s = type(['2', 'mixed', '3', 'fraction', '4']);
  s = applyKey(s, 'backspace'); // removes 4
  assert.deepEqual(toRawAnswer(s), { whole: 2, num: 3 });
  s = applyKey(s, 'backspace'); // empty denominator -> move to numerator
  assert.equal(s.focus, 'num');
  s = applyKey(s, 'backspace'); // removes 3
  s = applyKey(s, 'backspace'); // empty numerator -> move to whole
  assert.equal(s.focus, 'whole');
  s = applyKey(s, 'backspace'); // removes 2
  s = applyKey(s, 'backspace'); // everything empty -> plain number again
  assert.equal(s.mode, 'number');
  assert.deepEqual(toRawAnswer(s), {});
});

test('backspace out of an empty fraction returns to a plain number', () => {
  const s = type(['fraction', 'backspace']);
  assert.equal(s.mode, 'number');
});

test('leading zero is replaced, and boxes have a digit limit', () => {
  assert.deepEqual(raw(['0', '7']), { whole: 7 });
  assert.deepEqual(raw(['0']), { whole: 0 });
  const long = type(Array(MAX_DIGITS + 3).fill('9'));
  assert.equal(long.whole.length, MAX_DIGITS);
});

test('whole-number-only questions ignore the fraction and mixed keys', () => {
  const opts = { allowFractions: false };
  assert.deepEqual(raw(['1', 'fraction', '2', 'mixed', '3'], opts), { whole: 123 });
});

test('negative sign only where allowed', () => {
  assert.deepEqual(raw(['negate', '3', 'fraction', '4']), { num: 3, den: 4 });
  assert.deepEqual(raw(['negate', '3', 'fraction', '4'], { allowNegative: true }), { negative: true, num: 3, den: 4 });
});

test('clear starts over but keeps the question settings', () => {
  const s = type(['3', 'fraction', '4', 'clear'], { allowFractions: false });
  assert.deepEqual(toRawAnswer(s), {});
  assert.equal(s.allowFractions, false);
});

test('screen-reader descriptions', () => {
  assert.equal(describeAnswer(type([])), 'empty');
  assert.equal(describeAnswer(type(['5'])), '5');
  assert.equal(describeAnswer(type(['3', 'fraction'])), '3 over blank');
  assert.equal(describeAnswer(type(['2', 'mixed', '3', 'fraction', '4'])), '2 and 3 over 4');
});

test('log text', () => {
  assert.equal(rawToText({}), '(blank)');
  assert.equal(rawToText({ whole: 2, num: 3, den: 4 }), '2 3/4');
  assert.equal(rawToText({ points: [{ v: -2, closed: false }, { v: 4, closed: true }], shade: 'between' }), 'open dot at -2 and closed dot at 4, shaded between');
  assert.equal(rawToText({ points: [[1, -3], [2, 0]] }), '(1, -3) and (2, 0)');
  assert.equal(rawToText({ num: 3, den: 4, negative: true }), '-3/4');
  assert.equal(rawToText({ whole: 12 }), '12');
});

test('typed answers are graded correctly end to end', () => {
  const p = { answer: { type: 'fraction', value: fraction(7, 4), form: 'any' }, misconceptions: [] };
  const grade = (keys) => checkAnswer(p, raw(keys)).status;
  assert.equal(grade(['7', 'fraction', '4']), 'correct');
  assert.equal(grade(['1', 'mixed', '3', 'fraction', '4']), 'correct');
  assert.equal(grade(['1', '4', 'fraction', '8']), 'not-simplified');
  assert.equal(grade(['7', 'fraction']), 'invalid');
  assert.equal(grade([]), 'invalid');
  assert.equal(grade(['3', 'fraction', '4']), 'wrong');
});

// ---------- whole numbers: remainders and lists ----------

test('a remainder: 9 R 2, and backspace from an empty remainder box goes back to the quotient', () => {
  const opts = { kind: 'remainder' };
  assert.deepEqual(raw(['9', 'remainder', '2'], opts), { whole: 9, rem: 2 });
  const s = type(['9', 'remainder', 'backspace', 'backspace'], opts);
  assert.equal(s.focus, 'whole');
  assert.deepEqual(toRawAnswer(s), {});
  assert.deepEqual(raw(['9'], opts), { whole: 9 }, 'remainder left empty means 0');
  assert.deepEqual(raw(['3', 'fraction', '4'], opts), { whole: 34 }, 'no fractions in a remainder answer');
});

test('a list: type, next, type...; backspace in an empty box takes the last number back', () => {
  const opts = { kind: 'list' };
  assert.deepEqual(raw(['1', 'next', '2', 'next', '1', '2'], opts), { list: [1, 2, 12] });
  assert.deepEqual(raw(['1', 'next', '2', 'next'], opts), { list: [1, 2] }, 'a trailing next is fine');
  assert.deepEqual(raw(['1', 'next', '2', '4', 'next', 'backspace', 'backspace'], opts), { list: [1, 2] }, 'took 24 back, deleted the 4');
  assert.deepEqual(raw(['next', 'next'], opts), { list: [] }, 'empty boxes are never added');
});

test('remainder and list answers are graded as the student typed them', () => {
  const remProblem = { answer: { type: 'quotient-remainder', quotient: 9, remainder: 2 }, misconceptions: [] };
  assert.equal(checkAnswer(remProblem, raw(['9', 'remainder', '2'], { kind: 'remainder' })).status, 'correct');
  const listProblem = { answer: { type: 'set', values: [1, 2, 3, 6], of: 6 }, misconceptions: [] };
  assert.equal(checkAnswer(listProblem, raw(['6', 'next', '3', 'next', '2', 'next', '1'], { kind: 'list' })).status, 'correct');
  assert.equal(rawToText({ list: [2, 2, 3] }), '2, 2, 3');
  assert.equal(rawToText({ whole: 9, rem: 2 }), '9 R 2');
});

// ---------- linear (pre-algebra): [coef] x + [constant] ----------

const keys = (state, list) => list.reduce(applyKey, state);

test('linear: type 3, Next, 12 -> 3x + 12', () => {
  const s = keys(createAnswerState({ kind: 'linear' }), ['3', 'next', '1', '2']);
  assert.deepEqual(toRawAnswer(s), { coef: 3, constant: 12 });
  assert.equal(canSubmit(s), true);
  assert.equal(describeAnswer(s), '3 x plus 12');
});

test('linear: (−) makes the box with focus negative; each box has its own sign', () => {
  const s = keys(createAnswerState({ kind: 'linear' }), ['negate', '2', 'next', '1', '0', 'negate']);
  assert.deepEqual(toRawAnswer(s), { coef: -2, constant: -10 });
  assert.equal(describeAnswer(s), 'negative 2 x minus 10');
});

test('linear: backspace in the empty second box goes back to the first; Check needs both boxes', () => {
  let s = keys(createAnswerState({ kind: 'linear' }), ['4', 'next']);
  assert.equal(canSubmit(s), false);
  s = keys(s, ['backspace', 'backspace']);
  assert.equal(s.focus, 'coef');
  assert.equal(s.coef, '');
  assert.equal(rawToText({ coef: -1, constant: 5 }), '-x + 5');
  assert.equal(rawToText({ coef: 3, constant: -12 }), '3x - 12');
});

// ---- decimals ----
test('a decimal: digits, one point, more digits; a leading point gets a 0', () => {
  const d = { kind: 'decimal' };
  assert.deepEqual(raw(['3', 'point', '2', '5'], d), { decimal: '3.25' });
  assert.deepEqual(raw(['point', '5'], d), { decimal: '0.5' });
  assert.deepEqual(raw(['1', 'point', 'point', '5'], d), { decimal: '1.5' }, 'only one point');
  assert.deepEqual(raw(['1', 'point', '5', 'backspace', 'backspace'], d), { decimal: '1' });
  assert.deepEqual(raw(['1', '2', 'point', '3', '7', '5', '9', '9'], d), { decimal: '12.3759' }, 'stops at 7 characters');
  assert.deepEqual(raw(['4', 'negate', 'point', '2'], { kind: 'decimal', allowNegative: true }), { negative: true, decimal: '4.2' });
  assert.equal(canSubmit(type(['point'], d)), false, 'a point alone can’t be sent');
  assert.equal(canSubmit(type(['point', '5'], d)), true);
  assert.equal(rawToText({ negative: true, decimal: '0.4' }), '-0.4');
  assert.equal(checkAnswer({ answer: { type: 'decimal', value: '0.5' } }, raw(['point', '5', '0'], d)).status, 'correct');
});
