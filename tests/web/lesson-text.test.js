// The {a/b} math markup in lesson text.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseLessonText } from '../../web/components/lesson-text.js';

test('braced math becomes fractions, mixed numbers and blanks', () => {
  assert.deepEqual(parseLessonText('Add {1/2} and {1 3/4}, or {?/12}.'), [
    'Add ', { type: 'frac', n: 1, d: 2 }, ' and ', { type: 'mixed', whole: 1, n: 3, d: 4 }, ', or ',
    { type: 'frac', n: { type: 'blank' }, d: 12 }, '.',
  ]);
});

test('plain a/b only becomes a fraction when asked (worked-solution sentences)', () => {
  assert.deepEqual(parseLessonText('So 1/4 is 3/12.'), ['So 1/4 is 3/12.']);
  assert.deepEqual(parseLessonText('So 1/4 = 3/12.', { autoFractions: true }), [
    'So ', { type: 'frac', n: 1, d: 4 }, '\u00a0=\u00a0', { type: 'frac', n: 3, d: 12 }, '.',
  ]);
});

test('every piece of text in the lesson file parses', () => {
  const lesson = JSON.parse(readFileSync(new URL('../../curriculum/lessons/frac.add-sub.json', import.meta.url), 'utf8'));
  const texts = [
    ...lesson.sections.flatMap((s) => [...s.explain, s.visual?.caption].filter(Boolean)),
    ...Object.values(lesson.hints), ...Object.values(lesson.misconceptionMessages), lesson.simplifyHint,
  ];
  for (const t of texts) assert.doesNotThrow(() => parseLessonText(t, { autoFractions: true }), t);
});

test('picture markup for paper tests: bars, dots, number lines', () => {
  assert.deepEqual(parseLessonText('{bar 3/5}'), [{ type: 'model', shape: 'bar', shaded: 3, parts: 5 }]);
  assert.deepEqual(parseLessonText('{dots 4/9}'), [{ type: 'model', shape: 'set', shaded: 4, parts: 9 }]);
  assert.deepEqual(parseLessonText('{line 2 4 7}'), [{ type: 'numberline', max: 2, perUnit: 4, point: 7 }]);
});

test('[[...]] marks the part being worked on, and math inside it still works', () => {
  const plain = (x) => JSON.parse(JSON.stringify(x).replace(/\u00a0/g, ' '));
  assert.deepEqual(plain(parseLessonText('2 + [[3 × 4]] = 14')), ['2 + ', { type: 'mark', pieces: ['3 × 4'] }, ' = 14']);
  assert.deepEqual(parseLessonText('[[{1/2}]] of 8'), [{ type: 'mark', pieces: [{ type: 'frac', n: 1, d: 2 }] }, ' of 8']);
});
