// Expressions paper test: every answer key equals its expression for several values of x.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const paper = JSON.parse(readFileSync(new URL('../../curriculum/paper/alg.expressions.json', import.meta.url), 'utf8'));
const rules = JSON.parse(readFileSync(new URL('../../curriculum/mastery.json', import.meta.url), 'utf8')).default.verification;
const items = paper.versions.flatMap((v) => v.items);
const value = (js, x) => Function('x', `"use strict"; return (${js});`)(x);
// "-8x - 4" -> "-8*x - 4"; "-x + 8" -> "-1*x + 8"
const keyJs = (answer) => answer.split(' (')[0].replace(/(^|[^\d])x/g, '$11x').replace(/(\d)x/g, '$1*x');

test('expressions: every answer key equals its expression for every x, and is simplified (ax + b)', () => {
  for (const item of items) {
    const key = item.answer.split(' (')[0];
    assert.match(key, /^-?\d*x [+-] \d+$/, `${item.id}: "${key}" isn't in the form ax + b`);
    for (const x of [-2, 0, 1, 3, 7]) assert.equal(value(keyJs(item.answer), x), value(item.math, x), `${item.id} at x = ${x}`);
  }
});

test('expressions: 6 items, 2+ word problems per version', () => {
  for (const v of paper.versions) {
    assert.equal(v.items.length, rules.outOf);
    assert.ok(v.items.filter((i) => i.kind === 'word').length >= 2);
  }
});
