// Equivalent-fractions paper test: every answer key re-computed here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const paper = JSON.parse(readFileSync(new URL('../../curriculum/paper/frac.equivalent.json', import.meta.url), 'utf8'));
const rules = JSON.parse(readFileSync(new URL('../../curriculum/mastery.json', import.meta.url), 'utf8')).default.verification;
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const f = (t) => t.split('/').map(Number);

function expected(math) {
  const [kind, x, y] = math.split(' ');
  const [a, b] = f(x);
  if (kind === 'scale') return `${(a * +y) / b}/${y}`;
  if (kind === 'missing-den') return String((b * +y) / a);
  if (kind === 'missing-num') return String((a * +y) / b);
  if (kind === 'simplify') { const g = gcd(a, b); return `${a / g}/${b / g}`; }
  if (kind === 'same') { const [c, d] = f(y); return a * d === b * c ? 'Yes' : 'No'; }
  throw new Error(math);
}
const items = paper.versions.flatMap((v) => v.items);

test('equivalent fractions: every answer key matches its calculation', () => {
  for (const item of items) {
    const want = expected(item.math);
    assert.ok(item.answer === want || item.answer.startsWith(`${want} `), `${item.id}: key "${item.answer}" but ${item.math} gives ${want}`);
  }
});

test('equivalent fractions: whole-number answers really are whole numbers, and "same" answers name the simplest form', () => {
  for (const item of items) {
    if (item.math.startsWith('missing')) assert.ok(Number.isInteger(Number(item.answer)), item.id);
    if (item.math.startsWith('same')) {
      const [a, b] = f(item.math.split(' ')[1]);
      const g = gcd(a, b);
      assert.ok(item.answer.includes(`${a / g}/${b / g}`), item.id);
    }
  }
});

test('equivalent fractions: the prompt shows the numbers the calculation uses; 6 items, 2+ word problems', () => {
  // Word problems may name a number in words ("marked in twelfths").
  const words = { 12: 'twelfths', 16: 'sixteenths', 8: 'eighths' };
  for (const item of items) {
    for (const n of item.math.match(/\d+/g)) {
      const said = item.prompt.match(/\d+/g).includes(n) || (item.kind === 'word' && item.prompt.includes(words[n]));
      assert.ok(said, `${item.id}: ${n}`);
    }
  }
  for (const v of paper.versions) {
    assert.equal(v.items.length, rules.outOf);
    assert.ok(v.items.filter((i) => i.kind === 'word').length >= 2);
  }
});
