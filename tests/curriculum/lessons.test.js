// Checks lesson data files: every reference is real, every misconception has a
// student message, and the {a/b} math markup is well formed.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { generators } from '../../engine/generators/index.js';
import { loadFractions } from '../helpers/fractions-setup.js';

const dir = new URL('../../curriculum/lessons/', import.meta.url);
const lessons = readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(new URL(f, dir), 'utf8')));
const WIDGETS = ['fraction-bars', 'area-model', 'fraction-area', 'int-line', 'balance', 'column', 'steps', 'groups', 'factor-pairs', 'place-chart', 'balance-steps', 'flip-line', 'ratio-table', 'slope-graph', 'ineq-line', 'box-method', 'shape-steps'];
const { graph, misconceptions } = loadFractions();
const MARKUP = /\{([^}]*)\}/g;
const VALID = /^\d+( \d+)?\/(\d+|\?)$|^\?\/\d+$|^(bar|dots) \d+\/\d+$|^line \d+ \d+ \d+$|^grid \d+\/100$/; // fractions; pictures in worked lines

for (const lesson of lessons) test(`${lesson.skill}: sections point at real skills and real problem generators`, () => {
  for (const s of lesson.sections) {
    assert.ok(graph.has(s.forGap), `${s.id}: unknown gap ${s.forGap}`);
    assert.ok(generators[s.generator], `${s.id}: no generator ${s.generator}`);
    assert.ok(['section', 'skill'].includes(s.mode), s.id);
    assert.ok(s.explain.length > 0 && s.title && s.objective, s.id);
  }
});

for (const lesson of lessons) test(`${lesson.skill}: every subskill of the skill has a section, plus one for the whole skill`, () => {
  const gaps = lesson.sections.map((s) => s.forGap).sort();
  assert.deepEqual(gaps, [lesson.skill, ...graph.subskillsOf(lesson.skill)].sort());
});

for (const lesson of lessons) test(`${lesson.skill}: every hint is for a generator used here, and every generator used has a hint`, () => {
  const used = new Set(lesson.sections.map((s) => s.generator));
  assert.deepEqual(Object.keys(lesson.hints).sort(), [...used].sort());
});

for (const lesson of lessons) test(`${lesson.skill}: every wrong-answer pattern for this skill has a student message`, () => {
  const ids = misconceptions.filter((m) => m.pointsTo === lesson.skill || m.pointsTo.startsWith(`${lesson.skill}.`)).map((m) => m.id).sort();
  assert.deepEqual(Object.keys(lesson.misconceptionMessages).sort(), ids);
});

for (const lesson of lessons) test(`${lesson.skill}: math markup is well formed`, () => {
  const texts = [
    ...lesson.sections.flatMap((s) => [...s.explain, ...(s.key ? [s.key] : []), ...(s.worked || []).flatMap((l) => [l.math, ...(l.note ? [l.note] : [])])]),
    ...Object.values(lesson.hints), ...Object.values(lesson.misconceptionMessages),
  ].map((t) => t.replace(/\[\[|\]\]/g, ''));
  for (const t of texts) {
    assert.equal((t.match(/\{/g) || []).length, (t.match(/\}/g) || []).length, `unbalanced braces: ${t}`);
    for (const [, inner] of t.matchAll(MARKUP)) assert.ok(VALID.test(inner), `bad math markup {${inner}} in: ${t}`);
  }
});

for (const lesson of lessons) test(`${lesson.skill}: section checks and pictures are well formed`, () => {
  for (const sec of lesson.sections) {
    if (sec.check) assert.ok(sec.check.outOf >= sec.check.rightNeeded && sec.check.rightNeeded > 0, sec.id);
    if (sec.visual) assert.ok(WIDGETS.includes(sec.visual.widget), `${sec.id}: unknown widget ${sec.visual.widget}`);
  }
});

test('there are lessons for the built skills (fractions meaning, equivalent, compare, add/subtract; three whole-number skills)', () => {
  assert.deepEqual(lessons.map((l) => l.skill).sort(), ['alg.equations', 'alg.exponents', 'alg.expressions', 'alg.order-ops', 'frac.add-sub', 'frac.compare', 'frac.divide', 'frac.equivalent', 'frac.meaning', 'frac.multiply', 'frac.signed', 'int.add-sub', 'int.mult-div', 'whole.add-sub', 'whole.factors-multiples', 'whole.mult-div', 'dec.add-sub', 'dec.convert', 'dec.divide', 'dec.signed', 'dec.multiply', 'dec.place-value', 'alg.multi-step', 'alg.inequalities', 'alg.inequality-graphs', 'alg.translate', 'alg.evaluate', 'rat.ratios', 'rat.percent', 'rat.percent-change', 'lin.functions', 'lin.slope', 'lin.slope-intercept', 'lin.forms', 'lin.parallel', 'lin.graphing', 'poly.multiply', 'poly.factor', 'exp.rules', 'exp.roots', 'exp.scinot', 'geo.units', 'geo.area', 'geo.circles', 'geo.volume', 'geo.angles', 'geo.pythag'].sort());
});
