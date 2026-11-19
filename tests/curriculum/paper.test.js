// Paper-test answer keys, checked with exact fraction math.
// The answer key is authored text; this test re-computes every item from its
// calculation and checks the key agrees (and is in simplest form).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fraction, add, sub, equals, reduce } from '../../engine/math/fraction.js';

const paper = JSON.parse(readFileSync(new URL('../../curriculum/paper/frac.add-sub.json', import.meta.url), 'utf8'));
const rules = JSON.parse(readFileSync(new URL('../../curriculum/mastery.json', import.meta.url), 'utf8')).default.verification;

// "2/3 + 1/5 - 1/6" -> exact value
function evaluate(math) {
  const tokens = math.split(' ');
  const parse = (t) => { const [n, d] = t.split('/').map(Number); return fraction(n, d ?? 1); };
  let value = parse(tokens[0]);
  for (let i = 1; i < tokens.length; i += 2) value = tokens[i] === '+' ? add(value, parse(tokens[i + 1])) : sub(value, parse(tokens[i + 1]));
  return value;
}

// The first number in the answer key: "1 5/12 cups (or 17/12 cups)" -> 17/12, and whether it's simplest.
function readKey(answer) {
  let m = /^(\d+) (\d+)\/(\d+)/.exec(answer);
  if (m) return { value: fraction(+m[1] * +m[3] + +m[2], +m[3]), simplest: +m[2] < +m[3] && reduce(fraction(+m[2], +m[3])).d === +m[3] };
  m = /^(\d+)\/(\d+)/.exec(answer);
  if (m) return { value: fraction(+m[1], +m[2]), simplest: +m[2] !== 1 && reduce(fraction(+m[1], +m[2])).d === +m[2] };
  m = /^(\d+)/.exec(answer);
  return { value: fraction(+m[1], 1), simplest: true };
}

const items = paper.versions.flatMap((v) => v.items);

test('every answer key matches its calculation, in simplest form', () => {
  for (const item of items) {
    const key = readKey(item.answer);
    assert.ok(equals(key.value, evaluate(item.math)), `${item.id}: key ${item.answer} but ${item.math} = ${reduce(evaluate(item.math)).n}/${reduce(evaluate(item.math)).d}`);
    assert.ok(key.simplest, `${item.id}: key not in simplest form`);
  }
});

test('the prompt shows the same numbers as the calculation', () => {
  for (const item of items) {
    const shown = [...item.prompt.matchAll(/\{(\d+\/\d+)\}/g)].map((m) => m[1]).sort();
    const used = item.math.split(' ').filter((t) => t.includes('/')).sort();
    assert.deepEqual(shown, used, item.id);
  }
});

test('each version has the number of items the verification rule expects, with some word problems', () => {
  for (const v of paper.versions) {
    assert.equal(v.items.length, rules.outOf, v.id);
    assert.ok(v.items.filter((i) => i.kind === 'word').length >= 2, v.id);
  }
  assert.equal(new Set(items.map((i) => i.id)).size, items.length, 'item ids are unique');
});
