// Compare-fractions paper test: every answer key re-computed here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const paper = JSON.parse(readFileSync(new URL('../../curriculum/paper/frac.compare.json', import.meta.url), 'utf8'));
const rules = JSON.parse(readFileSync(new URL('../../curriculum/mastery.json', import.meta.url), 'utf8')).default.verification;
const f = (t) => t.split('/').map(Number);
const less = (x, y) => { const [a, b] = f(x); const [c, d] = f(y); return a * d - c * b; };

function expected(math) {
  const [kind, ...fs] = math.split(' ');
  if (kind === 'sign') { const s = less(fs[0], fs[1]); return s < 0 ? '<' : s === 0 ? '=' : '>'; }
  if (kind === 'order') return [...fs].sort(less).join(', ');
  if (kind === 'bigger') return less(fs[0], fs[1]) > 0 ? fs[0] : fs[1];
  throw new Error(math);
}
const items = paper.versions.flatMap((v) => v.items);

test('compare fractions: every answer key matches its calculation', () => {
  for (const item of items) {
    const want = expected(item.math);
    assert.ok(item.answer === want || item.answer.startsWith(`${want} `), `${item.id}: key "${item.answer}" but ${item.math} gives ${want}`);
  }
});

test('compare fractions: the prompt shows the fractions the calculation uses; 6 items, 2+ word problems', () => {
  for (const item of items) {
    for (const t of item.math.split(' ').slice(1)) {
      assert.ok(item.prompt.includes(t === '1/1' ? ' 1' : `{${t}}`), `${item.id}: ${t}`);
    }
  }
  for (const v of paper.versions) {
    assert.equal(v.items.length, rules.outOf);
    assert.ok(v.items.filter((i) => i.kind === 'word').length >= 2);
  }
});
