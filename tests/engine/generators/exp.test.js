// Exponents and roots: every answer worked out here from the shown text alone (exact
// fractions for scientific notation, never floating point), and every wrong-answer
// pattern is wrong, recognised and in the catalog.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateProblem, generators, DIFFICULTIES } from '../../../engine/generators/index.js';
import { checkAnswer } from '../../../engine/grading/check-answer.js';
import { toText } from '../../../engine/problem/text.js';
import { fraction, mul, equals, reduce } from '../../../engine/math/fraction.js';
import { parseDecimal } from '../../../engine/math/decimal.js';

const SEEDS = Array.from({ length: 250 }, (_, i) => `ex-${i}`);
const catalog = new Map(JSON.parse(readFileSync(new URL('../../../curriculum/misconceptions/exp.json', import.meta.url), 'utf8')).misconceptions.map((m) => [m.id, m.pointsTo]));
const PARTS = Object.keys(generators).filter((id) => id.startsWith('exp.') && id.split('.').length === 3);
const F = (n, d = 1) => fraction(n, d);
const ten = (n) => (n >= 0 ? F(10 ** n) : F(1, 10 ** -n));
const isqrt = (n) => { const r = Math.round(Math.sqrt(n)); return r * r === n ? r : null; };

function expected(id, p) {
  const t = toText(p.expression);
  let m;
  switch (id) {
    case 'exp.rules.product': m = /\^(-?\d+) · .+\^(-?\d+) =/.exec(t); return +m[1] + +m[2];
    case 'exp.rules.quotient': m = /\^(-?\d+)\/.+\^(-?\d+) =/.exec(t); return m[1] - m[2];
    case 'exp.rules.power': m = /\(.+\^(-?\d+)\)\^(-?\d+) =/.exec(t); return m[1] * m[2];
    case 'exp.rules.negative': {
      if ((m = /^x\^(-\d+) = 1\/x\^\?$/.exec(t))) return -m[1];
      if ((m = /^\((\d+)\/(\d+)\)\^(-\d+)$/.exec(t))) { const k = -m[3]; return F(m[2] ** k, m[1] ** k); }
      m = /^(\d+)\^(-?\d+)$/.exec(t);
      const [b, e] = [+m[1], +m[2]];
      return e >= 0 ? F(b ** e) : F(1, b ** -e);
    }
    case 'exp.roots.perfect': {
      if ((m = /^∛(-?\d+)$/.exec(t))) return F(Math.round(Math.cbrt(+m[1])));
      if ((m = /^√\((\d+)\/(\d+)\)$/.exec(t))) return F(isqrt(+m[1]), isqrt(+m[2]));
      return F(isqrt(+/^√(\d+)$/.exec(t)[1]));
    }
    case 'exp.roots.estimate': {
      const n = +/^√(\d+)$/.exec(t)[1];
      const lo = Math.floor(Math.sqrt(n));
      assert.ok(lo * lo < n && n < (lo + 1) ** 2, `${n} isn't a perfect square`);
      if (p.answer.options.length === 2) return n - lo * lo < (lo + 1) ** 2 - n ? String(lo) : String(lo + 1);
      return `${lo} and ${lo + 1}`;
    }
    case 'exp.roots.rational': {
      if (t === 'π') return 'Irrational';
      if ((m = /^√(\d+)$/.exec(t))) return isqrt(+m[1]) ? 'Rational' : 'Irrational';
      if ((m = /^√\((\d+)\/(\d+)\)$/.exec(t))) return isqrt(+m[1]) && isqrt(+m[2]) ? 'Rational' : 'Irrational';
      return 'Rational'; // a fraction, an ending decimal, or a repeating decimal
    }
    case 'exp.scinot.write': {
      if ((m = /^([\d.]+) = \? × 10\^(-?\d+)$/.exec(t))) return mul(parseDecimal(m[1]), ten(-m[2]));
      m = /^([\d.]+) = ([\d.]+) × 10\^\?$/.exec(t);
      const [value, mant] = [parseDecimal(m[1]), parseDecimal(m[2])];
      for (let n = -10; n <= 10; n++) if (equals(mul(mant, ten(n)), value)) return n;
      throw new Error(t);
    }
    case 'exp.scinot.standard': m = /^([\d.]+) × 10\^(-?\d+)$/.exec(t); return mul(parseDecimal(m[1]), ten(+m[2]));
    case 'exp.scinot.operate': {
      m = /^\((\d+) × 10\^(-?\d+)\) ([·÷]) \((\d+) × 10\^(-?\d+)\) = (\d+) × 10\^\?$/.exec(t);
      const [a, e1, o, b, e2, front] = [+m[1], +m[2], m[3], +m[4], +m[5], +m[6]];
      assert.equal(o === '·' ? a * b : a / b, front, `${t}: the number in front`);
      return o === '·' ? e1 + e2 : e1 - e2;
    }
    default: throw new Error(id);
  }
}
const typed = (a, v) => {
  if (a.type === 'integer') return { whole: Math.abs(v), ...(v < 0 ? { negative: true } : {}) };
  if (a.type === 'decimal') return { decimal: v };
  const r = reduce(v);
  return r.d === 1 ? { whole: Math.abs(r.n), ...(r.n < 0 ? { negative: true } : {}) } : { num: Math.abs(r.n), den: r.d, ...(r.n < 0 ? { negative: true } : {}) };
};

for (const id of PARTS) {
  test(`${id}: answers worked out from the shown text; mistakes are wrong and recognised`, () => {
    for (const d of DIFFICULTIES) for (const seed of SEEDS) {
      const p = generateProblem(id, seed, d);
      const t = toText(p.expression);
      const want = expected(id, p);
      const a = p.answer;
      if (a.type === 'choice') {
        assert.equal(a.options[a.correct], want, t);
        assert.equal(new Set(a.options).size, a.options.length, `${t}: no repeated buttons ${a.options}`);
        for (const m of p.misconceptions) assert.equal(checkAnswer(p, { choice: m.choice }).misconception, m.id, t);
      } else {
        if (a.type === 'integer') assert.equal(a.value, want, t);
        else if (a.type === 'decimal') assert.ok(equals(parseDecimal(a.value), want), `${t}: ${a.value}`);
        else assert.ok(equals(a.value, want), `${t}: ${a.value.n}/${a.value.d}`);
        assert.equal(checkAnswer(p, typed(a, a.type === 'decimal' ? a.value : a.type === 'integer' ? a.value : a.value)).status, 'correct', t);
        for (const m of p.misconceptions) {
          const r = checkAnswer(p, typed(a, m.value));
          assert.equal(r.status, 'wrong', `${t}: ${m.id}`);
          assert.equal(r.misconception, m.id, t);
        }
      }
      for (const m of p.misconceptions) assert.ok(catalog.get(m.id), m.id);
    }
  });
}

test('exponents: every catalog mistake is generated', () => {
  const seen = new Set();
  for (const id of PARTS) for (const d of DIFFICULTIES) for (const s of SEEDS) for (const m of generateProblem(id, s, d).misconceptions) seen.add(m.id);
  assert.deepEqual([...seen].sort(), [...catalog.keys()].sort());
});
