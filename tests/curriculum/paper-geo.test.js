// Paper tests for geometry and measurement: each item's "math" (a JavaScript calculation,
// or "yes"/"no") is worked out here; the answer key's number (the number in front of π
// for circle answers) must equal it exactly, and Yes/No keys must match.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const load = (id) => JSON.parse(readFileSync(new URL(`../../curriculum/paper/${id}.json`, import.meta.url), 'utf8'));
const rules = JSON.parse(readFileSync(new URL('../../curriculum/mastery.json', import.meta.url), 'utf8')).default.verification;
const IDS = ['geo.units', 'geo.area', 'geo.circles', 'geo.volume', 'geo.angles', 'geo.pythag'];

export function keyMatches(math, answer) {
  if (math === 'yes' || math === 'no') return answer.toLowerCase().startsWith(math);
  const m = /^(\d+(?:\.\d+)?)/.exec(answer);
  if (!m) return false;
  const want = Function(`"use strict"; return (${math});`)();
  return Math.abs(Number(m[1]) - want) < 1e-9;
}

for (const id of IDS) {
  const paper = load(id);
  test(`${id}: every key matches its calculation`, () => {
    for (const v of paper.versions) for (const i of v.items) assert.ok(keyMatches(i.math, i.answer), `${i.id}: "${i.answer}" vs ${i.math}`);
  });
  test(`${id}: 6 items per version, word problems and a "right?" item, no repeats`, () => {
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
  assert.ok(!keyMatches('14 * 5 / 2', '70 in²'), 'forgot the half');
  assert.ok(!keyMatches('5 * 5', '100π ft²'), 'used the diameter');
  assert.ok(!keyMatches('Math.sqrt(6*6 + 8*8)', '14'), 'added the legs');
  assert.ok(!keyMatches('no', 'Yes'));
});
