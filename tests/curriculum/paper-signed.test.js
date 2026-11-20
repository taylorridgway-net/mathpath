// Negative-fractions paper test: every answer key re-computed here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const paper = JSON.parse(readFileSync(new URL('../../curriculum/paper/frac.signed.json', import.meta.url), 'utf8'));
const rules = JSON.parse(readFileSync(new URL('../../curriculum/mastery.json', import.meta.url), 'utf8')).default.verification;
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const f = (t) => { const [n, d] = t.split('/').map(Number); return d < 0 ? [-n, -d] : [n, d]; };
const simplest = ([n, d]) => { const g = gcd(Math.abs(n), d); return d / g === 1 ? String(n / g) : `${n / g}/${d / g}`; };

function expected(math) {
  const [kind, x, y] = math.split(' ');
  const [a, b] = f(x);
  if (kind === 'frac') return simplest([a, b]);
  const [c, d] = f(y);
  if (kind === 'add') return simplest([a * d + c * b, b * d]);
  if (kind === 'sub') return simplest([a * d - c * b, b * d]);
  if (kind === 'mul') return simplest([a * c, b * d]);
  if (kind === 'div') return simplest(c < 0 ? [-a * d, -b * c] : [a * d, b * c]);
  throw new Error(math);
}
const items = paper.versions.flatMap((v) => v.items);

test('negative fractions: every answer key matches its calculation', () => {
  for (const item of items) {
    const want = expected(item.math);
    assert.ok(item.answer === want || item.answer.startsWith(`${want} `), `${item.id}: key "${item.answer}" but ${item.math} gives ${want}`);
  }
});

test('negative fractions: the prompt shows the numbers used; computation items show the minus signs; 6 items, 2+ word problems', () => {
  for (const item of items) {
    for (const n of item.math.match(/\d+/g).filter((x) => x !== '1' || !item.math.includes('/1'))) assert.ok(item.prompt.match(/\d+/g).includes(n), `${item.id}: ${n}`);
    if (item.kind === 'computation') {
      const negatives = (item.math.match(/-\d/g) || []).length;
      assert.equal((item.prompt.match(/−/g) || []).length - (item.prompt.match(/\) − |\} − | − \(/g) || []).length, negatives, `${item.id}: minus signs`);
    }
  }
  for (const v of paper.versions) {
    assert.equal(v.items.length, rules.outOf);
    assert.ok(v.items.filter((i) => i.kind === 'word').length >= 2);
  }
});
