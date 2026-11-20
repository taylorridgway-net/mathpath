// Whole-number paper tests: every answer key re-computed here from its calculation.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const rules = JSON.parse(readFileSync(new URL('../../curriculum/mastery.json', import.meta.url), 'utf8')).default.verification;
const papers = ['whole.add-sub', 'whole.mult-div', 'whole.factors-multiples']
  .map((s) => JSON.parse(readFileSync(new URL(`../../curriculum/paper/${s}.json`, import.meta.url), 'utf8')));

const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const factorsOf = (n) => Array.from({ length: n }, (_, i) => i + 1).filter((d) => n % d === 0);
const primesOf = (n) => { const out = []; for (let d = 2; n > 1; d++) while (n % d === 0) { out.push(d); n /= d; } return out; };

// The answer the key should start with, as text.
function expected(math) {
  const [a, op, b] = math.split(' ');
  if (a === 'factors') return factorsOf(+op).join(', ');
  if (a === 'primes') return primesOf(+op).join(' × ');
  if (a === 'gcf') return String(gcd(+op, +b));
  if (a === 'lcm') return String((+op * +b) / gcd(+op, +b));
  const [x, y] = [+a, +b];
  if (op === '+') return String(x + y);
  if (op === '-') return String(x - y);
  if (op === '×') return String(x * y);
  if (op === '÷') return x % y === 0 ? String(x / y) : `${Math.floor(x / y)} R ${x % y}`;
  throw new Error(`can't read ${math}`);
}

for (const paper of papers) {
  const items = paper.versions.flatMap((v) => v.items);

  test(`${paper.skill}: every answer key matches its calculation`, () => {
    for (const item of items) {
      const want = expected(item.math);
      assert.ok(item.answer === want || item.answer.startsWith(`${want} `), `${item.id}: key "${item.answer}" but ${item.math} gives ${want}`);
    }
  });

  test(`${paper.skill}: the prompt shows the numbers the calculation uses`, () => {
    for (const item of items) {
      for (const n of item.math.match(/\d+/g)) assert.ok(item.prompt.match(/\d+/g).includes(n), `${item.id}: ${n} isn't in the prompt`);
    }
  });

  test(`${paper.skill}: ${rules.outOf} items per version, at least 2 word problems, unique ids`, () => {
    for (const v of paper.versions) {
      assert.equal(v.items.length, rules.outOf, v.id);
      assert.ok(v.items.filter((i) => i.kind === 'word').length >= 2, v.id);
    }
    assert.equal(new Set(items.map((i) => i.id)).size, items.length);
  });
}
