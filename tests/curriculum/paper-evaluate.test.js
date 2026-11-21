// Evaluate-expressions paper test: every key matches its calculation (the numbers
// put in), the prompt shows every number used, and the usual shape rules.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const paper = JSON.parse(readFileSync(new URL('../../curriculum/paper/alg.evaluate.json', import.meta.url), 'utf8'));
const rules = JSON.parse(readFileSync(new URL('../../curriculum/mastery.json', import.meta.url), 'utf8')).default.verification;
const items = paper.versions.flatMap((v) => v.items);
const SUP = { '⁰': '0', '¹': '1', '²': '2', '³': '3' };

test('evaluate: every answer key matches its calculation', () => {
  for (const item of items) {
    const want = String(Function(`"use strict"; return (${item.math});`)());
    assert.ok(item.answer === want || item.answer.startsWith(`${want} `), `${item.id}: key "${item.answer}" but ${item.math} = ${want}`);
  }
});

test('evaluate: prompts show every number used; 6 items, 2+ word problems, a "right?" item, A and B differ', () => {
  for (const item of items) {
    const shown = item.prompt.replace(/[⁰¹²³]/g, (c) => ` ${SUP[c]} `).match(/\d+/g);
    for (const n of item.math.match(/\d+/g)) assert.ok(shown.includes(n), `${item.id}: ${n}`);
  }
  for (const v of paper.versions) {
    assert.equal(v.items.length, rules.outOf);
    assert.ok(v.items.filter((i) => i.kind === 'word').length >= 2);
    assert.ok(v.items.some((i) => /right\?/.test(i.prompt)));
  }
  const [a, b] = paper.versions.map((v) => v.items.map((i) => i.prompt));
  assert.ok(a.every((x) => !b.includes(x)));
});
