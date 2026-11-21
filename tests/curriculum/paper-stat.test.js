// Paper tests for statistics and probability: each item's "math" (a JavaScript calculation)
// is worked out here and the answer key's first number or fraction must equal it exactly.
// Items with a picture also say what they read from it ("reads"), and that is worked out
// from the picture's own data, so the picture, the calculation and the key all agree.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const load = (id) => JSON.parse(readFileSync(new URL(`../../curriculum/paper/${id}.json`, import.meta.url), 'utf8'));
const rules = JSON.parse(readFileSync(new URL('../../curriculum/mastery.json', import.meta.url), 'utf8')).default.verification;
const IDS = ['stat.center', 'stat.displays', 'stat.prob'];

export function keyMatches(math, answer) {
  const m = /^(?:[A-Za-z]+ )?\$?(\d+)(?: (\d+)\/(\d+)|\/(\d+))?/.exec(answer);
  if (!m) return false;
  const got = m[2] ? Number(m[1]) + m[2] / m[3] : m[4] ? m[1] / m[4] : Number(m[1]);
  const want = Function(`"use strict"; return (${math});`)();
  return Math.abs(got - want) < 1e-9;
}

export function readPicture(shape, reads) {
  if (shape.kind === 'dotplot') {
    const values = Object.entries(shape.counts).flatMap(([v, c]) => Array(c).fill(Number(v))).sort((a, b) => a - b);
    const n = values.length;
    if (reads === 'count') return n;
    if (reads === 'median') return n % 2 ? values[(n - 1) / 2] : (values[n / 2 - 1] + values[n / 2]) / 2;
    if (reads === 'mode') { const top = Math.max(...Object.values(shape.counts)); return Number(Object.keys(shape.counts).find((k) => shape.counts[k] === top)); }
  }
  if (shape.kind === 'bars') {
    const bars = Object.fromEntries(shape.bars);
    if (reads === 'total') return shape.bars.reduce((s, [, v]) => s + v, 0);
    const m = /^more:(\w+)-(\w+)$/.exec(reads);
    if (m) return bars[m[1]] - bars[m[2]];
  }
  if (shape.kind === 'boxplot') return { median: shape.med, iqr: shape.q3 - shape.q1, range: shape.max - shape.min }[reads];
  throw new Error(`can't read ${reads} from ${shape.kind}`);
}

for (const id of IDS) {
  const paper = load(id);
  test(`${id}: every key matches its calculation (and its picture)`, () => {
    for (const v of paper.versions) for (const i of v.items) {
      assert.ok(keyMatches(i.math, i.answer), `${i.id}: "${i.answer}" vs ${i.math}`);
      // A two-part key ("Mode 9; range 7"): the second part is checked against math2.
      if (i.answer.includes(';')) assert.ok(i.math2 && keyMatches(i.math2, i.answer.split('; ')[1]), `${i.id}: second part "${i.answer}" vs ${i.math2}`);
      if (i.shape) {
        assert.ok(i.reads, `${i.id} has a picture but no "reads"`);
        assert.equal(readPicture(i.shape, i.reads), Function(`"use strict"; return (${i.math});`)(), i.id);
        for (const k of ['min', 'q1', 'med', 'q3']) if (i.shape.kind === 'boxplot') assert.ok(i.shape[k] <= i.shape[{ min: 'q1', q1: 'med', med: 'q3', q3: 'max' }[k]], i.id);
      }
    }
  });
  test(`${id}: 6 items per version, word problems and an "is he/she right?" item, no repeats`, () => {
    const seen = new Set();
    for (const v of paper.versions) {
      assert.equal(v.items.length, rules.outOf);
      assert.ok(v.items.filter((i) => i.kind === 'word').length >= 2);
      assert.ok(v.items.some((i) => /right\?/.test(i.prompt)));
      for (const i of v.items) { assert.ok(!seen.has(i.prompt), i.id); seen.add(i.prompt); }
    }
  });
}

test('the key checker catches wrong keys', () => {
  assert.ok(!keyMatches('(9+11)/2', '9'), 'picked one middle value');
  assert.ok(!keyMatches('2/8', '1/3'), 'part to part');
  assert.ok(!keyMatches('1/6*1/6', '1/3'), 'added the probabilities');
  assert.ok(keyMatches('25/3', '8 1/3 or 25/3'));
  assert.notEqual(readPicture({ kind: 'boxplot', min: 1, q1: 4, med: 6, q3: 9, max: 12 }, 'iqr'), 11, 'IQR is not the range');
});
