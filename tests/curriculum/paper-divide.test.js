// Divide-fractions paper test: every answer key re-computed here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const paper = JSON.parse(readFileSync(new URL('../../curriculum/paper/frac.divide.json', import.meta.url), 'utf8'));
const rules = JSON.parse(readFileSync(new URL('../../curriculum/mastery.json', import.meta.url), 'utf8')).default.verification;
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const f = (t) => t.split('/').map(Number);
const simplest = (n, d) => { const g = gcd(n, d); return d / g === 1 ? String(n / g) : `${n / g}/${d / g}`; };

function expected(math) {
  const [kind, x, y] = math.split(' ');
  const [a, b] = f(x);
  if (kind === 'recip') return simplest(b, a);
  if (kind === 'div') { const [c, d] = f(y); return simplest(a * d, b * c); }
  throw new Error(math);
}
const items = paper.versions.flatMap((v) => v.items);
const shown = (t) => (t.endsWith('/1') ? t.slice(0, -2) : `{${t}}`);

test('divide fractions: every answer key matches its calculation', () => {
  for (const item of items) {
    const want = expected(item.math);
    assert.ok(item.answer === want || item.answer.startsWith(`${want} `), `${item.id}: key "${item.answer}" but ${item.math} gives ${want}`);
  }
});

test('divide fractions: mixed-number alternatives in the key are the same amount', () => {
  for (const item of items) {
    const m = /\(or (\d+) (\d+)\/(\d+)\)/.exec(item.answer);
    if (!m) continue;
    const [n, d] = f(item.answer.split(' ')[0]);
    assert.equal(+m[3], d, item.id);
    assert.equal(+m[1] * d + +m[2], n, item.id);
  }
});

test('divide fractions: the prompt shows the numbers the calculation uses; 6 items, 2+ word problems', () => {
  for (const item of items) {
    for (const t of item.math.split(' ').slice(1)) assert.ok(item.prompt.includes(shown(t)), `${item.id}: ${t}`);
  }
  for (const v of paper.versions) {
    assert.equal(v.items.length, rules.outOf);
    assert.ok(v.items.filter((i) => i.kind === 'word').length >= 2);
  }
});
