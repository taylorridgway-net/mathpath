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
const ids = (path) => path.map((p) => p.section ?? `not-built:${p.gap}`); // not-built and unchecked both show as "not-built:"

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

test('a possible cause the diagnostic couldn\'t check (no questions yet) comes first, deepest first', () => {
  // Common denominators missed twice; the diagnostic followed it down to
  // multiplication facts and factors but has no questions for them yet.
  const r = {
    ...result({ 'frac.add-sub.common-denom': 'gap', 'frac.add-sub.combine': 'known' }, ['frac.add-sub.common-denom']),
    uncheckedCauses: ['whole.factors-multiples', 'whole.mult-div.mult-facts'],
  };
  const path = buildPath({ result: r, lessons: [lesson], graph });
  assert.deepEqual(ids(path), [
    'not-built:whole.mult-div.mult-facts', 'not-built:whole.factors-multiples',
    'frac.add-sub.common-denom', 'frac.add-sub.whole',
  ]);
  assert.deepEqual(path.slice(0, 2).map((p) => p.kind), ['unchecked', 'unchecked']);
});

test('lessons come in prerequisite order, whatever order they are listed in', () => {
  // A pretend lesson for negative fractions, which needs add/subtract.
  const signed = {
    skill: 'frac.signed',
    sections: [
      { id: 'signed.add-sub', forGap: 'frac.signed.add-sub', mode: 'section', title: 'Add and subtract negative fractions' },
      { id: 'signed.whole', forGap: 'frac.signed', mode: 'skill', title: 'Putting it together' },
    ],
  };
  const r = result({ 'frac.signed.add-sub': 'gap', 'frac.add-sub.combine': 'gap' }, ['frac.add-sub.combine']);
  assert.deepEqual(ids(buildPath({ result: r, lessons: [signed, lesson], graph })), [
    'frac.add-sub.combine', 'frac.add-sub.whole', 'signed.add-sub', 'signed.whole',
  ]);
});

test('sections wait until the teacher clears every foundation item (owner decision)', () => {
  const r = {
    ...result({ 'frac.add-sub.common-denom': 'gap' }, ['frac.add-sub.common-denom']),
    uncheckedCauses: ['whole.mult-div.mult-facts', 'whole.factors-multiples'],
  };
  const sections = (cleared) => buildPath({ result: r, lessons: [lesson], graph, cleared }).filter((p) => p.kind === 'section');
  assert.ok(sections([]).every((s) => s.waiting));
  assert.ok(sections(['whole.mult-div.mult-facts']).every((s) => s.waiting), 'one cleared is not enough');
  assert.ok(sections(['whole.mult-div.mult-facts', 'whole.factors-multiples']).every((s) => !s.waiting));
});

test('no foundation items: nothing waits', () => {
  const r = result({ 'frac.add-sub.combine': 'gap' }, ['frac.add-sub.combine']);
  assert.ok(buildPath({ result: r, lessons: [lesson], graph }).every((s) => !s.waiting));
});

test('shaky: a quick review of that section, in lesson order; shaky alone adds no "Putting it together" (owner decision)', () => {
  const r = result({ 'frac.add-sub.rewrite': 'shaky', 'frac.add-sub.common-denom': 'known' }, []);
  const path = buildPath({ result: r, lessons: [lesson], graph });
  assert.deepEqual(path.map((p) => [p.section, p.review]), [['frac.add-sub.rewrite', true]]);
});

test('shaky and gap together: review and full sections in lesson order, then "Putting it together"', () => {
  const r = result({ 'frac.add-sub.combine': 'gap', 'frac.add-sub.common-denom': 'shaky' }, ['frac.add-sub.combine']);
  const path = buildPath({ result: r, lessons: [lesson], graph });
  assert.deepEqual(path.map((p) => [p.section, p.review]), [
    ['frac.add-sub.common-denom', true], ['frac.add-sub.combine', false], ['frac.add-sub.whole', false],
  ]);
});
