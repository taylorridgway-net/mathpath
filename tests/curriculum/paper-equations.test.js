// Equations paper test: every answer key solves its equation (exact fractions).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const paper = JSON.parse(readFileSync(new URL('../../curriculum/paper/alg.equations.json', import.meta.url), 'utf8'));
const rules = JSON.parse(readFileSync(new URL('../../curriculum/mastery.json', import.meta.url), 'utf8')).default.verification;
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const f = (t) => { const [n, d = 1] = t.split('/').map(Number); return [n, d]; };
const items = paper.versions.flatMap((v) => v.items);

// a·x + b = c  ->  x = (c − b) / a
function solve(math) {
  const [, a, b, c] = math.split(' ');
  const [an, ad] = f(a); const [bn, bd] = f(b); const [cn, cd] = f(c);
  let n = (cn * bd - bn * cd) * ad;
  let d = cd * bd * an;
  if (d < 0) { n = -n; d = -d; }
  const g = gcd(Math.abs(n), d);
  return d / g === 1 ? String(n / g) : `${n / g}/${d / g}`;
}

test('equations: every answer key solves its equation', () => {
  for (const item of items) {
    const want = solve(item.math);
    assert.ok(item.answer === want || item.answer.startsWith(`${want} `), `${item.id}: key "${item.answer}" but ${item.math} gives ${want}`);
  }
});

test('equations: computation items show the numbers of their equation; 6 items, 2+ word problems', () => {
  for (const item of items) {
    if (item.kind !== 'computation') continue;
    for (const n of item.math.split(' ').slice(1).flatMap((t) => t.match(/\d+/g)).filter((n) => n !== '0' && n !== '1')) {
      assert.ok(item.prompt.match(/\d+/g).includes(n), `${item.id}: ${n}`);
    }
  }
  for (const v of paper.versions) {
    assert.equal(v.items.length, rules.outOf);
    assert.ok(v.items.filter((i) => i.kind === 'word').length >= 2);
  }
});
