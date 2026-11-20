// Ratios and percents: every answer re-worked here from the numbers in the problem's
// own text (exact fractions), every wrong-answer pattern checked to be wrong, recognised
// and in the catalog, and the money/percent signs shown where they belong.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateProblem, generators, DIFFICULTIES } from '../../../engine/generators/index.js';
import { checkAnswer } from '../../../engine/grading/check-answer.js';
import { toText } from '../../../engine/problem/text.js';
import { keypadOptionsFor } from '../../../web/components/keypad.js';
import { fraction, mul, div, sub, add, compare } from '../../../engine/math/fraction.js';
import { parseDecimal } from '../../../engine/math/decimal.js';

const SEEDS = Array.from({ length: 250 }, (_, i) => `rat-${i}`);
const catalog = new Map(JSON.parse(readFileSync(new URL('../../../curriculum/misconceptions/rat.json', import.meta.url), 'utf8')).misconceptions.map((m) => [m.id, m.pointsTo]));
const PARTS = Object.keys(generators).filter((id) => id.startsWith('rat.') && !generators[id].mixed);
const F = (n, d = 1) => fraction(n, d);
const nums = (t) => (t.match(/\d+(?:\.\d+)?/g) || []).map(parseDecimal);
const same = (a, b) => compare(a, b) === 0;

// The right answer, worked out from the shown text alone.
function expected(id, p) {
  const t = toText(p.expression);
  const n = nums(t);
  switch (id) {
    case 'rat.ratios.equivalent': return div(mul(n[1], n[2]), n[0]); // a : b = c : ?  /  a of one for every b of the other, c of the first
    case 'rat.ratios.unit-rate': return /cost \$/.test(t) ? div(n[1], n[0]) : div(n[0], n[1]);
    case 'rat.ratios.proportion': return t.startsWith('x/') ? div(mul(n[0], n[1]), n[2]) : div(mul(n[0], n[2]), n[1]);
    case 'rat.percent.convert':
      if (p.instruction === 'Write as a decimal.') return div(n[0], F(100));
      return t.includes('/') ? mul(div(n[0], n[1]), F(100)) : mul(n[0], F(100));
    case 'rat.percent.of': return div(mul(n[0], n[1]), F(100));
    case 'rat.percent.what-percent': return mul(div(n[0], n[1]), F(100));
    case 'rat.percent-change.apply': {
      const change = div(mul(n[0], n[1]), F(100));
      return / off\./.test(t) ? sub(n[0], change) : add(n[0], change);
    }
    case 'rat.percent-change.find': return mul(div(sub(n[1], n[0]), n[0]), F(/decrease/.test(t) ? -100 : 100));
    default: throw new Error(id);
  }
}

for (const id of PARTS) {
  test(`${id}: answers re-worked from the shown numbers; mistakes are wrong and recognised`, () => {
    for (const d of DIFFICULTIES) for (const seed of SEEDS) {
      const p = generateProblem(id, seed, d);
      const t = toText(p.expression);
      const a = p.answer;
      if (a.type === 'choice') {
        const [n1, t1, n2, t2] = nums(t);
        const cheaperA = compare(div(t1, n1), div(t2, n2)) < 0;
        assert.equal(a.correct, cheaperA ? 0 : 1, t);
        for (const m of p.misconceptions) assert.notEqual(m.choice, a.correct);
        continue;
      }
      const want = expected(id, p);
      assert.ok(same(parseDecimal(a.value), want), `${id} L${d}: ${t} -> ${a.value}, want ${want.n}/${want.d}`);
      assert.equal(checkAnswer(p, { decimal: a.value }).status, 'correct');
      assert.match(a.value, /^\d+(\.\d{1,3})?$/, `${t}: ${a.value}`);
      // $ for money answers, % for percent answers, nothing otherwise.
      const opts = keypadOptionsFor(p);
      if (/Write as a percent|Find the percent/.test(p.instruction)) assert.equal(opts.suffix, '%', t);
      if (/Find the unit price|Find the new amount/.test(p.instruction)) assert.equal(opts.prefix, '$', t);
      for (const m of p.misconceptions) {
        assert.ok(catalog.get(m.id)?.startsWith('rat.'), m.id);
        const r = checkAnswer(p, { decimal: m.value });
        assert.equal(r.status, 'wrong', `${t}: ${m.id} ${m.value}`);
        assert.equal(r.misconception, m.id);
      }
    }
  });
}

test('numbers stay friendly: no long numbers, no answers needing more than 3 decimal places', () => {
  for (const id of PARTS) for (const d of DIFFICULTIES) for (const seed of SEEDS) {
    const t = toText(generateProblem(id, seed, d).expression);
    for (const x of t.match(/\d+(?:\.\d+)?/g) || []) assert.ok(x.replace('.', '').length <= 5, `${id}: ${t}`);
  }
});

test('the whole skills mix their parts; screeners are parts', () => {
  for (const id of ['rat.ratios', 'rat.percent', 'rat.percent-change']) {
    const g = generators[id];
    if (g.screener) assert.ok(PARTS.includes(g.screener));
    const seen = new Set(SEEDS.slice(0, 120).map((s) => generateProblem(id, s, 2).part));
    assert.deepEqual([...seen].sort(), [...(g.parts || g.covers)].sort(), id);
  }
});

test('every ratio and percent mistake in the catalog is generated', () => {
  const seen = new Set();
  for (const seed of SEEDS) for (const id of PARTS) for (const d of DIFFICULTIES) for (const m of generateProblem(id, seed, d).misconceptions) seen.add(m.id);
  assert.deepEqual([...seen].sort(), [...catalog.keys()].sort());
});
