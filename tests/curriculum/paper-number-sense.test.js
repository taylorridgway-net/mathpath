// Paper tests for place value and rounding and for comparing integers / absolute value:
// each item's "math" (JavaScript: a number, or a sign as text) is worked out here and the
// answer key must start with it (numbers may have commas and a − sign).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const load = (id) => JSON.parse(readFileSync(new URL(`../../curriculum/paper/${id}.json`, import.meta.url), 'utf8'));
const rules = JSON.parse(readFileSync(new URL('../../curriculum/mastery.json', import.meta.url), 'utf8')).default.verification;
const IDS = ['whole.place-value', 'int.compare'];

export function keyMatches(math, answer) {
  const want = Function(`"use strict"; return (${math});`)();
  if (typeof want === 'string') return answer.startsWith(want);
  const m = /^(−?[\d,]+)/.exec(answer);
  return Boolean(m) && Number(m[1].replace(/,/g, '').replace('−', '-')) === want;
}

for (const id of IDS) {
  const paper = load(id);
  test(`${id}: every key matches its calculation`, () => {
    for (const v of paper.versions) for (const i of v.items) assert.ok(keyMatches(i.math, i.answer), `${i.id}: "${i.answer}" vs ${i.math}`);
  });
  test(`${id}: 6 items per version, word problems and an "is ... right?" item, no repeats`, () => {
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
  assert.ok(!keyMatches('Math.round(6849/100)*100', '6,900'), 'rounded the wrong way');
  assert.ok(!keyMatches('-Math.abs(-8)', '8'), 'dropped the outside negative');
  assert.ok(!keyMatches("'<'", '>'));
  assert.ok(keyMatches('Math.round(23519/1000)*1000', '24,000'));
});
