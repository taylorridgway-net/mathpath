// Inequalities paper test: each key (x, sign, number) describes exactly the x that
// make the item's inequality true (tried at the boundary and on both sides of it).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const paper = JSON.parse(readFileSync(new URL('../../curriculum/paper/alg.inequalities.json', import.meta.url), 'utf8'));
const rules = JSON.parse(readFileSync(new URL('../../curriculum/mastery.json', import.meta.url), 'utf8')).default.verification;
const items = paper.versions.flatMap((v) => v.items);
const OPS = { '<': (a, b) => a < b, '≤': (a, b) => a <= b, '>': (a, b) => a > b, '≥': (a, b) => a >= b };

test('inequalities: every key describes exactly the solutions', () => {
  for (const item of items) {
    const m = /^x ([<≤>≥]) (-?\d+)(?: |$)/.exec(item.answer);
    assert.ok(m, `${item.id}: key "${item.answer}"`);
    const [sign, n] = [m[1], Number(m[2])];
    const holds = Function('x', `"use strict"; return (${item.math});`);
    for (const x of [n, n - 0.5, n + 0.5, n - 3, n + 3]) assert.equal(holds(x), OPS[sign](x, n), `${item.id} at x = ${x}`);
  }
});

test('inequalities: prompts show every number; 6 items, 2+ word problems, an "is this right?", A and B differ', () => {
  for (const item of items) for (const n of item.math.match(/\d+/g)) assert.ok(item.prompt.match(/\d+/g).includes(n), `${item.id}: ${n}`);
  for (const v of paper.versions) {
    assert.equal(v.items.length, rules.outOf);
    assert.ok(v.items.filter((i) => i.kind === 'word').length >= 2);
    assert.ok(v.items.some((i) => /right\?/.test(i.prompt)));
    assert.ok(v.items.some((i) => /^-\d?\*?x|^-x/.test(i.math)), `${v.id}: a flip item`);
  }
  const [a, b] = paper.versions.map((v) => v.items.map((i) => i.math));
  assert.ok(a.every((m) => !b.includes(m)));
});
