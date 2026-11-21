// Place value and rounding (whole.place-value) and comparing integers / absolute value
// (int.compare): every answer worked out here from what's shown, every wrong-answer
// pattern wrong, recognised, in the catalog, and pointing to the right part.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateProblem, generators, DIFFICULTIES } from '../../../engine/generators/index.js';
import { checkAnswer } from '../../../engine/grading/check-answer.js';
import { toText } from '../../../engine/problem/text.js';

const SEEDS = Array.from({ length: 300 }, (_, i) => `ns-${i}`);
const load = (f) => JSON.parse(readFileSync(new URL(`../../../curriculum/misconceptions/${f}.json`, import.meta.url), 'utf8')).misconceptions;
const catalog = new Map([...load('whole'), ...load('int')].map((m) => [m.id, m.pointsTo]));
const PARTS = ['whole.place-value.digits', 'whole.place-value.round', 'int.compare.order', 'int.compare.abs'];
const num = (s) => Number(s.replace(/,/g, '').replace('−', '-'));
const typed = (v) => ({ whole: Math.abs(v), ...(v < 0 ? { negative: true } : {}) });

function expected(p) {
  const t = toText(p.expression);
  const ins = p.instruction;
  let m;
  if ((m = /value of the (\d)\?/.exec(ins))) {
    const digits = t.replace(/,/g, '');
    const i = digits.indexOf(m[1]);
    assert.equal(digits.lastIndexOf(m[1]), i, `the ${m[1]} appears once in ${t}`);
    return Number(m[1]) * 10 ** (digits.length - 1 - i);
  }
  if ((m = /The \d in ([\d,]+) is how many times the value of the \d in ([\d,]+)\?/.exec(t))) return num(m[1]) / num(m[2]);
  if ((m = /Round to the nearest (ten|hundred|thousand)\./.exec(ins))) {
    const unit = { ten: 10, hundred: 100, thousand: 1000 }[m[1]];
    return Math.round(num(t) / unit) * unit; // whole numbers: .5 rounds up
  }
  if (p.expression.type === 'compare') {
    const [l, r] = t.split(' ? ').map(num);
    return { choice: l < r ? '<' : l === r ? '=' : '>' };
  }
  if ((m = /the (least|greatest)\?/.exec(ins))) {
    const xs = t.split(',').map((s) => num(s.trim()));
    return { choice: String(m[1] === 'least' ? Math.min(...xs) : Math.max(...xs)).replace('-', '−') };
  }
  if (t.includes('|')) {
    // |a|, -|a|, |a - b|, |a| + |b|
    const js = t.replace(/\|([^|]+)\|/g, 'Math.abs($1)');
    return Function(`"use strict"; return (${js});`)();
  }
  if ((m = /(−?\d+)\D+?(−?\d+)\D*$/.exec(t.replace(/°F/g, '')))) {
    const xs = (t.match(/−?\d+/g) || []).map(num);
    return Math.abs(xs[0] - xs[1]);
  }
  throw new Error(`can't read ${ins} ${t}`);
}

for (const id of PARTS) {
  test(`${id}: answers worked out from what's shown; mistakes wrong, recognised, and point here`, () => {
    for (const d of DIFFICULTIES) for (const seed of SEEDS) {
      const p = generateProblem(id, seed, d);
      const t = toText(p.expression);
      const want = expected(p);
      const a = p.answer;
      if (a.type === 'choice') {
        assert.equal(a.options[a.correct], want.choice, `${p.instruction} ${t}`);
        assert.equal(new Set(a.options).size, a.options.length, t);
        assert.equal(checkAnswer(p, { choice: a.correct }).status, 'correct');
        for (const m of p.misconceptions) {
          assert.equal(catalog.get(m.id), id, m.id);
          const r = checkAnswer(p, { choice: m.choice });
          assert.equal(r.status, 'wrong', `${t}: ${m.id}`);
          assert.equal(r.misconception, m.id, t);
        }
      } else {
        assert.equal(a.value, want, `${p.instruction} ${t}`);
        assert.equal(checkAnswer(p, typed(a.value)).status, 'correct', t);
        for (const m of p.misconceptions) {
          assert.equal(catalog.get(m.id), id, m.id);
          const r = checkAnswer(p, typed(m.value));
          assert.equal(r.status, 'wrong', `${t}: ${m.id} = ${m.value}`);
          assert.equal(r.misconception, m.id, t);
        }
      }
    }
  });
}

test('number sense: every new catalog mistake is generated', () => {
  const seen = new Set();
  for (const id of PARTS) for (const d of DIFFICULTIES) for (const s of SEEDS) for (const m of generateProblem(id, s, d).misconceptions) seen.add(m.id);
  const mine = [...catalog.keys()].filter((k) => PARTS.includes(catalog.get(k)));
  assert.deepEqual([...seen].sort(), mine.sort());
});

test('levels: two negatives at level 2 (where "bigger digit is bigger" goes wrong); level-3 rounding carries', () => {
  for (const seed of SEEDS) {
    const p = generateProblem('int.compare.order', seed, 2);
    assert.ok(p.expression.left.value < 0 && p.expression.right.value < 0);
    assert.ok(p.misconceptions.some((m) => m.id === 'int.compare-size'), 'the size mistake always gives a different sign');
    const r = generateProblem('whole.place-value.round', seed, 3);
    const unit = { ten: 10, hundred: 100, thousand: 1000 }[/nearest (\w+)\./.exec(r.instruction)[1]];
    assert.equal(r.answer.value % (unit * 10), 0, `${toText(r.expression)} -> ${r.answer.value}: the 9 before it carries`);
  }
});

test('the whole skills cover both parts (each is asked in the diagnostic)', () => {
  assert.deepEqual(generators['whole.place-value'].covers, ['whole.place-value.digits', 'whole.place-value.round']);
  assert.deepEqual(generators['int.compare'].covers, ['int.compare.order', 'int.compare.abs']);
  assert.equal(generators['int.compare'].screener, undefined);
});
