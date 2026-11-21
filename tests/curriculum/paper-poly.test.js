// Paper tests for multiplying and factoring. Each key is turned into JavaScript and
// compared with the item's "math" at several values of x (exact: whole numbers only).
// Multiply keys must be written ax² + bx + c; factor keys must be a product that is
// fully factored: the greatest common factor out front, no factor with a common factor left.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const load = (id) => JSON.parse(readFileSync(new URL(`../../curriculum/paper/${id}.json`, import.meta.url), 'utf8'));
const rules = JSON.parse(readFileSync(new URL('../../curriculum/mastery.json', import.meta.url), 'utf8')).default.verification;
const XS = [-3, -1, 0, 2, 5, 7];
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
const keyOf = (answer) => answer.split(/ \(|:/)[0].trim(); // drop the teacher's note
const js = (t) => t.replace(/−/g, '-').replace(/²/g, '**2').replace(/(\d)x/g, '$1*x').replace(/\)\(/g, ')*(').replace(/(\d)\(/g, '$1*(').replace(/x\*\*2/g, '(x**2)');
const value = (expr, x) => Function('x', `"use strict"; return (${expr});`)(x);
const sameFunction = (a, b) => XS.every((x) => value(a, x) === value(b, x));

// "3x + 4" -> [3, 4];  "x − 4" -> [1, -4]
function linearParts(t) {
  const m = /^(-?\d*)x(?: ([+-]) (\d+))?$/.exec(t.replace(/−/g, '-').trim());
  assert.ok(m, `a binomial: "${t}"`);
  const a = m[1] === '' ? 1 : m[1] === '-' ? -1 : Number(m[1]);
  return [a, m[2] ? (m[2] === '-' ? -1 : 1) * Number(m[3]) : 0];
}

for (const id of ['poly.multiply', 'poly.factor']) {
  const paper = load(id);
  test(`${id}: 6 items per version, word problems and a "right?" item, no repeats`, () => {
    const seen = new Set();
    for (const v of paper.versions) {
      assert.equal(v.items.length, rules.outOf);
      assert.ok(v.items.filter((i) => i.kind === 'word').length >= 2, v.id);
      assert.ok(v.items.some((i) => /right\?/.test(i.prompt)), v.id);
      for (const i of v.items) { assert.ok(!seen.has(i.math), `${i.id} repeats`); seen.add(i.math); }
    }
  });
  test(`${id}: every key equals its calculation and is written the right way`, () => {
    for (const v of paper.versions) for (const i of v.items) {
      const key = keyOf(i.answer);
      assert.ok(sameFunction(js(key), i.math), `${i.id}: key "${key}" doesn't match ${i.math}`);
      if (id === 'poly.multiply') {
        assert.match(key, /^-?\d*x²( [+−] \d*x)?( [+−] \d+)?$/, `${i.id}: written as ax² + bx + c`);
        continue;
      }
      // Factored: a product, with nothing left to factor.
      const m = /^(\d*)\((.+)\)$/.exec(key);
      assert.ok(m && key.includes('('), `${i.id}: written as a product`);
      const outside = m[1] ? Number(m[1]) : 1;
      const factors = m[1] ? [m[2]] : m[2].split(')(');
      for (const f of factors) { const [a, b] = linearParts(f); assert.equal(gcd(a, b), 1, `${i.id}: ${f} still has a common factor`); }
      if (m[1]) {
        const coefs = [...i.math.matchAll(/(\d+)\*x|- (\d+)$|\+ (\d+)$/g)].map((x) => Number(x[1] || x[2] || x[3]));
        assert.equal(outside, coefs.reduce(gcd), `${i.id}: the greatest common factor`);
      } else assert.ok(factors.length === 2, `${i.id}: two binomials`);
    }
  });
}

test('the key checker catches wrong and unfinished keys', () => {
  assert.ok(!sameFunction(js('(x + 2)(x + 6)'), 'x*x + 7*x + 12'), 'wrong pair');
  assert.ok(!sameFunction(js('x² + 9'), '(x - 3)*(x - 3)'), 'missing middle term');
  assert.ok(sameFunction(js('2(6x + 8)'), '12*x + 16'), 'equal, but...');
  const [a, b] = linearParts('6x + 8');
  assert.notEqual(gcd(a, b), 1, '...not fully factored, and the test would say so');
});
