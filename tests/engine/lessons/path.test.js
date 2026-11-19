// The learning path built from a diagnostic result.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildPath } from '../../../engine/lessons/path.js';
import { loadFractions } from '../../helpers/fractions-setup.js';

const lesson = JSON.parse(readFileSync(new URL('../../../curriculum/lessons/frac.add-sub.json', import.meta.url), 'utf8'));
const { graph } = loadFractions();

// A pretend diagnostic result: only the fields buildPath reads.
const result = (statuses, rootGaps) => ({
  nodes: Object.fromEntries(Object.entries(statuses).map(([id, status]) => [id, { status }])),
  rootGaps,
});
const ids = (path) => path.map((p) => p.section ?? `not-built:${p.gap}`);

test('subskill gaps come in the lesson\'s order, then "Putting it together"', () => {
  const r = result({
    'frac.add-sub.simplify-result': 'gap',
    'frac.add-sub.common-denom': 'gap',
    'frac.add-sub.combine': 'known',
  }, ['frac.add-sub.common-denom', 'frac.add-sub.simplify-result']);
  assert.deepEqual(ids(buildPath({ result: r, lessons: [lesson], graph })), [
    'frac.add-sub.common-denom', 'frac.add-sub.simplify-result', 'frac.add-sub.whole',
  ]);
});

test('"each step fine, whole problem missed": only "Putting it together"', () => {
  const r = result({ 'frac.add-sub': 'gap', 'frac.add-sub.combine': 'known' }, ['frac.add-sub']);
  assert.deepEqual(ids(buildPath({ result: r, lessons: [lesson], graph })), ['frac.add-sub.whole']);
});

test('a gap with no lesson yet comes first, flagged for the teacher', () => {
  const r = result({
    'whole.mult-div.mult-facts': 'gap',
    'frac.add-sub.common-denom': 'gap',
  }, ['whole.mult-div.mult-facts']);
  const path = buildPath({ result: r, lessons: [lesson], graph });
  assert.deepEqual(ids(path), ['not-built:whole.mult-div.mult-facts', 'frac.add-sub.common-denom', 'frac.add-sub.whole']);
  assert.equal(path[0].kind, 'not-built');
});

test('a student who knows add/subtract gets no add/subtract sections', () => {
  const r = result({ 'frac.add-sub': 'known', 'frac.multiply': 'gap' }, ['frac.multiply']);
  assert.deepEqual(ids(buildPath({ result: r, lessons: [lesson], graph })), ['not-built:frac.multiply']);
});
