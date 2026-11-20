// "Understanding fractions" paper test: every answer key re-computed here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseLessonText } from '../../web/components/lesson-text.js';

const paper = JSON.parse(readFileSync(new URL('../../curriculum/paper/frac.meaning.json', import.meta.url), 'utf8'));
const rules = JSON.parse(readFileSync(new URL('../../curriculum/mastery.json', import.meta.url), 'utf8')).default.verification;
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const simplest = (n, d) => { const g = gcd(n, d); return d / g === 1 ? String(n / g) : `${n / g}/${d / g}`; };

function expected(math) {
  const [kind, ...rest] = math.split(' ');
  if (kind === 'model') { const [n, d] = rest[0].split('/').map(Number); return simplest(n, d); }
  if (kind === 'line') { const [, per, point] = rest.map(Number); return simplest(point, per); }
  if (kind === 'div') { const [a, b] = rest.map(Number); return simplest(a, b); }
  if (kind === 'whole') { const [n, d] = rest[0].split('/').map(Number); return simplest(n, d); }
  throw new Error(math);
}
const items = paper.versions.flatMap((v) => v.items);

test('understanding fractions: every answer key matches its calculation', () => {
  for (const item of items) {
    const want = expected(item.math);
    assert.ok(item.answer === want || item.answer.startsWith(`${want} `), `${item.id}: key "${item.answer}" but ${item.math} gives ${want}`);
  }
});

test('understanding fractions: every picture parses and matches its calculation', () => {
  for (const item of items) {
    const pics = parseLessonText(item.prompt).filter((p) => typeof p !== 'string' && p.type !== 'frac');
    if (item.math.startsWith('line')) {
      const [, max, per, point] = item.math.split(' ').map(Number);
      assert.deepEqual(pics, [{ type: 'numberline', max, perUnit: per, point }], item.id);
    }
    if (item.math.startsWith('model') && pics.length) {
      const [n, d] = item.math.split(' ')[1].split('/').map(Number);
      assert.equal(pics[0].shaded, n, item.id);
      assert.equal(pics[0].parts, d, item.id);
    }
  }
});

test('understanding fractions: 6 items per version, 2+ word problems', () => {
  for (const v of paper.versions) {
    assert.equal(v.items.length, rules.outOf);
    assert.ok(v.items.filter((i) => i.kind === 'word').length >= 2);
  }
});
