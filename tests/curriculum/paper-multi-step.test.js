// Multi-step equations paper test: every answer key, put into the item's equation,
// makes both sides equal; keys are in simplest form; the prompt shows every number.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const paper = JSON.parse(readFileSync(new URL('../../curriculum/paper/alg.multi-step.json', import.meta.url), 'utf8'));
const rules = JSON.parse(readFileSync(new URL('../../curriculum/mastery.json', import.meta.url), 'utf8')).default.verification;
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const items = paper.versions.flatMap((v) => v.items);

test('multi-step: every answer key solves its equation, in simplest form', () => {
  for (const item of items) {
    const key = item.answer.split(' ')[0];
    const m = /^(-?\d+)(?:\/(\d+))?$/.exec(key);
    assert.ok(m, `${item.id}: key "${key}" is a number`);
    if (m[2]) assert.equal(gcd(Math.abs(Number(m[1])), Number(m[2])), 1, `${item.id}: simplest form`);
    const x = Number(m[1]) / Number(m[2] || 1);
    const [l, r] = item.math.split(' = ').map((s) => Function('x', `"use strict"; return (${s});`)(x));
    assert.ok(Math.abs(l - r) < 1e-9, `${item.id}: ${item.math} with x = ${key}: ${l} vs ${r}`);
    // Only one answer: the x's don't cancel.
    const [l0, r0, l1, r1] = [0, 1].flatMap((t) => item.math.split(' = ').map((s) => Function('x', `return (${s});`)(t)));
    assert.notEqual(l1 - l0, r1 - r0, `${item.id}: x cancels`);
  }
});

test('multi-step: prompts show every number; 6 items, 2+ word problems, one "is this right?", A and B differ', () => {
  for (const item of items) for (const n of item.math.match(/\d+/g)) assert.ok(item.prompt.match(/\d+/g).includes(n), `${item.id}: ${n}`);
  for (const v of paper.versions) {
    assert.equal(v.items.length, rules.outOf);
    assert.ok(v.items.filter((i) => i.kind === 'word').length >= 2);
    assert.ok(v.items.some((i) => /right\?/.test(i.prompt)));
  }
  const [a, b] = paper.versions.map((v) => v.items.map((i) => i.math));
  assert.ok(a.every((m) => !b.includes(m)));
});
