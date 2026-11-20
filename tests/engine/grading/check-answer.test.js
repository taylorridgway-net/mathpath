import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkAnswer, readAnswer } from '../../../engine/grading/check-answer.js';
import { fraction } from '../../../engine/math/fraction.js';

// A hand-made problem whose answer is 5/4.
const fiveQuarters = {
  answer: { type: 'fraction', value: fraction(5, 4), form: 'any' },
  misconceptions: [{ id: 'frac.add-across', value: fraction(5, 8) }],
};
const status = (problem, raw) => checkAnswer(problem, raw).status;

test('reading keypad answers', () => {
  assert.deepEqual(readAnswer({ whole: 3 }).value, fraction(3, 1));
  assert.deepEqual(readAnswer({ num: 3, den: 4 }).value, fraction(3, 4));
  assert.deepEqual(readAnswer({ whole: 1, num: 3, den: 4 }).value, fraction(7, 4));
  assert.deepEqual(readAnswer({ negative: true, whole: 1, num: 3, den: 4 }).value, fraction(-7, 4));
  assert.equal(readAnswer({ num: '', den: 4 }).reason, 'incomplete-fraction');
  assert.equal(readAnswer({}).reason, 'empty');
  assert.equal(readAnswer(null).reason, 'empty');
  assert.equal(readAnswer({ num: 3, den: 0 }).reason, 'zero-denominator');
  assert.equal(readAnswer({ num: 1.5, den: 4 }).reason, 'not-a-number');
  assert.equal(readAnswer({ num: -3, den: 4 }).reason, 'not-a-number');
});

test('fraction answers: right value, accepted forms', () => {
  assert.equal(status(fiveQuarters, { num: 5, den: 4 }), 'correct');
  assert.equal(status(fiveQuarters, { whole: 1, num: 1, den: 4 }), 'correct');
});

test('fraction answers: right value but not simplified -> retry with hint', () => {
  assert.deepEqual(checkAnswer(fiveQuarters, { num: 10, den: 8 }), { status: 'not-simplified', hint: 'simplify' });
  assert.equal(status(fiveQuarters, { whole: 1, num: 2, den: 8 }), 'not-simplified');
  assert.equal(status(fiveQuarters, { whole: 0, num: 5, den: 4 }), 'not-simplified');
});

test('carrying not finished counts as not simplified (1 5/4 for 2 1/4)', () => {
  const p = { answer: { type: 'fraction', value: fraction(9, 4), form: 'any' } };
  assert.equal(status(p, { whole: 1, num: 5, den: 4 }), 'not-simplified');
  assert.equal(status(p, { whole: 2, num: 1, den: 4 }), 'correct');
});

test('whole-number answers must be written as whole numbers to count as simplified', () => {
  const one = { answer: { type: 'fraction', value: fraction(1, 1), form: 'any' } };
  assert.equal(status(one, { whole: 1 }), 'correct');
  assert.equal(status(one, { num: 4, den: 4 }), 'not-simplified');
  assert.equal(status(one, { num: 1, den: 1 }), 'not-simplified');
  const zero = { answer: { type: 'fraction', value: fraction(0, 1), form: 'any' } };
  assert.equal(status(zero, { whole: 0 }), 'correct');
  assert.equal(status(zero, { num: 0, den: 5 }), 'not-simplified');
});

test('wrong answers, with and without a known misconception', () => {
  assert.deepEqual(checkAnswer(fiveQuarters, { num: 5, den: 8 }), { status: 'wrong', misconception: 'frac.add-across' });
  // Same misconception even if the student also simplified it differently (10/16).
  assert.equal(checkAnswer(fiveQuarters, { num: 10, den: 16 }).misconception, 'frac.add-across');
  assert.deepEqual(checkAnswer(fiveQuarters, { num: 3, den: 4 }), { status: 'wrong' });
  assert.equal(status(fiveQuarters, { negative: true, num: 5, den: 4 }), 'wrong');
});

test('invalid answers', () => {
  assert.equal(status(fiveQuarters, {}), 'invalid');
  assert.equal(status(fiveQuarters, { num: 5 }), 'invalid');
});

test('form requirements', () => {
  const mixedOnly = { answer: { type: 'fraction', value: fraction(5, 4), form: 'mixed' } };
  assert.deepEqual(checkAnswer(mixedOnly, { num: 5, den: 4 }), { status: 'wrong-form', hint: 'use-mixed' });
  assert.equal(status(mixedOnly, { whole: 1, num: 1, den: 4 }), 'correct');
  const improperOnly = { answer: { type: 'fraction', value: fraction(5, 4), form: 'improper' } };
  assert.equal(status(improperOnly, { whole: 1, num: 1, den: 4 }), 'wrong-form');
  assert.equal(status(improperOnly, { num: 5, den: 4 }), 'correct');
  // A proper fraction is fine under "mixed".
  const half = { answer: { type: 'fraction', value: fraction(1, 2), form: 'mixed' } };
  assert.equal(status(half, { num: 1, den: 2 }), 'correct');
});

test('whole-number (integer) answers', () => {
  const p = { answer: { type: 'integer', value: 9 }, misconceptions: [{ id: 'frac.numerator-unchanged', value: 3 }] };
  assert.equal(status(p, { whole: 9 }), 'correct');
  assert.deepEqual(checkAnswer(p, { whole: 3 }), { status: 'wrong', misconception: 'frac.numerator-unchanged' });
  assert.equal(status(p, { whole: 8 }), 'wrong');
  assert.deepEqual(checkAnswer(p, { num: 9, den: 1 }), { status: 'invalid', reason: 'expected-whole-number' });
});

test('common-denominator answers: any common multiple is right', () => {
  const p = {
    answer: { type: 'common-multiple', of: [4, 6], least: 12 },
    misconceptions: [{ id: 'frac.add-denominators', value: 10 }],
  };
  assert.deepEqual(checkAnswer(p, { whole: 12 }), { status: 'correct' });
  assert.deepEqual(checkAnswer(p, { whole: 24 }), { status: 'correct', note: 'not-least' });
  assert.deepEqual(checkAnswer(p, { whole: 10 }), { status: 'wrong', misconception: 'frac.add-denominators' });
  assert.equal(status(p, { whole: 6 }), 'wrong');
  assert.equal(status(p, { whole: 0 }), 'wrong');
});

test('unknown answer type is a programming error', () => {
  assert.throws(() => checkAnswer({ answer: { type: 'essay' } }, { whole: 1 }));
});

// ---- decimals ----
test('decimal answers: any way of writing the same number counts; misconceptions match by value', () => {
  const p = { answer: { type: 'decimal', value: '0.75' }, misconceptions: [{ id: 'dec.x', value: '7.5' }] };
  for (const typed of ['0.75', '.75', '0.750']) assert.equal(checkAnswer(p, { decimal: typed }).status, 'correct', typed);
  assert.deepEqual(checkAnswer(p, { decimal: '7.50' }), { status: 'wrong', misconception: 'dec.x' });
  assert.equal(checkAnswer(p, { decimal: '0.7' }).status, 'wrong');
  assert.equal(checkAnswer(p, { decimal: '.' }).status, 'invalid');
  assert.equal(checkAnswer(p, {}).status, 'invalid');
  assert.equal(checkAnswer(p, { negative: true, decimal: '0.75' }).status, 'wrong');
  const n = { answer: { type: 'decimal', value: '-1.2', allowNegative: true } };
  assert.equal(checkAnswer(n, { negative: true, decimal: '1.20' }).status, 'correct');
  assert.equal(checkAnswer({ answer: { type: 'decimal', value: '6' } }, { whole: 6 }).status, 'correct');
});
