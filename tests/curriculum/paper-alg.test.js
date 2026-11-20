// Pre-algebra paper tests: every answer key re-computed from its calculation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const rules = JSON.parse(readFileSync(new URL('../../curriculum/mastery.json', import.meta.url), 'utf8')).default.verification;
const papers = ['alg.order-ops', 'alg.exponents'].map((s) => JSON.parse(readFileSync(new URL(`../../curriculum/paper/${s}.json`, import.meta.url), 'utf8')));
const SUP = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9' };

for (const paper of papers) {
  const items = paper.versions.flatMap((v) => v.items);
  test(`${paper.skill}: every answer key matches its calculation`, () => {
    for (const item of items) {
      const want = String(Function(`"use strict"; return (${item.math});`)());
      assert.ok(item.answer === want || item.answer.startsWith(`${want} `), `${item.id}: key "${item.answer}" but ${item.math} = ${want}`);
    }
  });
  test(`${paper.skill}: the prompt shows every number used (powers as superscripts); ${rules.outOf} items, 2+ word problems`, () => {
    for (const item of items) {
      const shown = item.prompt.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, (c) => ` ${SUP[c]} `);
      // A word problem may leave an exponent unsaid ("write its area as a power").
      const used = item.kind === 'word' ? item.math.replace(/\*\*\d+/g, '') : item.math;
      for (const n of used.match(/\d+/g)) assert.ok(shown.match(/\d+/g).includes(n), `${item.id}: ${n}`);
    }
    for (const v of paper.versions) {
      assert.equal(v.items.length, rules.outOf);
      assert.ok(v.items.filter((i) => i.kind === 'word').length >= 2, `${paper.skill} ${v.id}: word problems`);
    }
  });
}
