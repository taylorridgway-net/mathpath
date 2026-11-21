// Measurement (and later geometry): every answer worked out here from the shown labels or
// words (exact fractions), every wrong-answer pattern wrong, recognised and in the catalog.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateProblem, generators, DIFFICULTIES } from '../../../engine/generators/index.js';
import { checkAnswer } from '../../../engine/grading/check-answer.js';
import { toText } from '../../../engine/problem/text.js';
import { fraction, equals } from '../../../engine/math/fraction.js';
import { parseDecimal } from '../../../engine/math/decimal.js';

const SEEDS = Array.from({ length: 250 }, (_, i) => `geo-${i}`);
const catalog = new Map(JSON.parse(readFileSync(new URL('../../../curriculum/misconceptions/geo.json', import.meta.url), 'utf8')).misconceptions.map((m) => [m.id, m.pointsTo]));
const PARTS = Object.keys(generators).filter((id) => id.startsWith('geo.') && id.split('.').length === 3);
const F = (n, d = 1) => fraction(n, d);
const FACTOR = { 'feet>inches': 12, 'yards>feet': 3, 'hours>minutes': 60, 'minutes>seconds': 60, 'pounds>ounces': 16, 'gallons>quarts': 4, 'meters>centimeters': 100, 'kilometers>meters': 1000, 'kilograms>grams': 1000, 'liters>milliliters': 1000, 'quarts>cups': 4, 'days>hours': 24 };
// How many of unit b make one a (following chains: yards > feet > inches).
function factor(a, b) {
  if (FACTOR[`${a}>${b}`]) return F(FACTOR[`${a}>${b}`]);
  if (FACTOR[`${b}>${a}`]) return F(1, FACTOR[`${b}>${a}`]);
  for (const [k, v] of Object.entries(FACTOR)) {
    const [x, y] = k.split('>');
    if (x === a) { const rest = factor(y, b); if (rest) return F(v * rest.n, rest.d); }
    if (y === a) { const rest = factor(x, b); if (rest) return F(rest.n, v * rest.d); }
  }
  return null;
}
const label = (t, name) => { const m = new RegExp(`${name} (\\d+)`).exec(t); return m ? Number(m[1]) : null; };
let m; // eslint-disable-line no-unused-vars

function expected(id, p) {
  const t = toText(p.expression);
  let m;
  switch (id) {
    case 'geo.units.convert':
    case 'geo.units.two-step': {
      m = /^([\d.]+) (\w+) = \? (\w+)$/.exec(t);
      const f = factor(m[2], m[3]);
      const a = parseDecimal(m[1]);
      return F(a.n * f.n, a.d * f.d);
    }
    case 'geo.area.perimeter': {
      if (t.startsWith('[a rectangle')) return F(2 * (label(t, 'width') + label(t, 'height')));
      if (t.startsWith('[an L-shape')) return F(2 * (label(t, 'width') + label(t, 'height')));
      if ((m = /square has sides of (\d+)/.exec(t))) return F(4 * +m[1]);
      m = /sides (\d+) \w+, (\d+) \w+ and (\d+)/.exec(t); return F(+m[1] + +m[2] + +m[3]);
    }
    case 'geo.area.rectangle':
      if (t.startsWith('[a rectangle')) return F(label(t, 'width') * label(t, 'height'));
      if (t.startsWith('[a parallelogram')) return F(label(t, 'base') * label(t, 'height'));
      m = /area of (\d+) \S+ and a width of (\d+)/.exec(t); return F(+m[1], +m[2]);
    case 'geo.area.triangle':
      if (t.startsWith('[a trapezoid')) return F((label(t, 'top') + label(t, 'bottom')) * label(t, 'height'), 2);
      return F(label(t, 'base') * label(t, 'height'), 2);
    case 'geo.area.composite': {
      const [w, h, top, right] = ['width', 'height', 'top', 'right side'].map((n) => label(t, n));
      return F(top * (h - right) + w * right); // left column below the cut + the full-width bottom strip
    }
    case 'geo.circles.circumference': {
      const d = label(t, 'diameter') ?? (/(\d+) \w+ across/.exec(t) || [])[1];
      const r = label(t, 'radius') ?? (/radius of (\d+)/.exec(t) || [])[1];
      return d ? F(+d) : F(2 * r);
    }
    case 'geo.circles.area': {
      if ((m = /half circle has a radius of (\d+)/.exec(t))) return F(m[1] * m[1], 2);
      const r = label(t, 'radius') ?? label(t, 'diameter') / 2;
      return F(r * r);
    }
    case 'geo.volume.prism':
      if ((m = /volume of (\d+) \S+ Its base is (\d+) \w+ by (\d+)/.exec(t))) return F(+m[1], m[2] * m[3]);
      if ((m = /(\d+) \w+ long, (\d+) \w+ wide and (\d+)/.exec(t))) return F(m[1] * m[2] * m[3]);
      return F(label(t, 'length') * label(t, 'width') * label(t, 'height'));
    case 'geo.volume.cylinder': {
      const r = label(t, 'radius') ?? label(t, 'diameter') / 2;
      const h = label(t, 'height');
      return t.startsWith('[a cone') ? F(r * r * h, 3) : F(r * r * h);
    }
    case 'geo.angles.pairs': {
      if ((m = /are (\w+)\. One of them is (\d+)°/.exec(t))) return F({ complementary: 90 - m[2], supplementary: 180 - m[2], vertical: +m[2] }[m[1]]);
      const a = label(t, 'angle a');
      return F(t.includes('right angle') ? 90 - a : t.includes('straight') ? 180 - a : a);
    }
    case 'geo.angles.triangle':
      if ((m = /third angle is (\d+)°/.exec(t))) return F((180 - m[1]) / 2);
      return F(180 - label(t, 'angle a') - label(t, 'angle b'));
    case 'geo.angles.parallel': {
      // Same size when both are in {2, 3, 6, 7} or both in {1, 4, 5, 8} (the transversal leans right).
      m = /angle (\d) (\d+)°/.exec(t);
      const ask = Number(/angle (\d) x/.exec(t)[1]);
      const group = (k) => ([2, 3, 6, 7].includes(k) ? 'B' : 'A');
      return F(group(+m[1]) === group(ask) ? +m[2] : 180 - m[2]);
    }
    case 'geo.pythag.hypotenuse': {
      const [a, b] = (m = /goes (\d+) \w+ east and then (\d+)/.exec(t)) ? [+m[1], +m[2]] : [...t.matchAll(/leg (\d+)/g)].map((x) => +x[1]);
      return F(Math.round(Math.sqrt(a * a + b * b)));
    }
    case 'geo.pythag.leg': {
      const [a, c] = (m = /A (\d+) \w+ ladder .* foot is (\d+)/.exec(t)) ? [+m[2], +m[1]] : [label(t, 'leg'), label(t, 'hypotenuse')];
      return F(Math.round(Math.sqrt(c * c - a * a)));
    }
    default: throw new Error(id);
  }
}

for (const id of PARTS) {
  test(`${id}: answers worked out from the shown labels; mistakes wrong and recognised`, () => {
    for (const d of DIFFICULTIES) for (const seed of SEEDS) {
      const p = generateProblem(id, seed, d);
      const t = toText(p.expression);
      const a = p.answer;
      if (a.type === 'choice') { // is it a right triangle?
        const [x, y, z] = /sides are (\d+), (\d+), (\d+)/.exec(t).slice(1).map(Number).sort((u, v) => u - v);
        assert.equal(a.options[a.correct], x * x + y * y === z * z ? 'Yes' : 'No', t);
        for (const m of p.misconceptions) { assert.ok(catalog.get(m.id)); assert.equal(checkAnswer(p, { choice: m.choice }).misconception, m.id); }
        continue;
      }
      const want = expected(id, p);
      assert.ok(Number.isInteger(want.n / want.d) || id.startsWith('geo.area') || id.startsWith('geo.units') || id.startsWith('geo.circles'), `${t}: whole-number answer`);
      assert.ok(equals(parseDecimal(a.value), want), `${t}: ${a.value} vs ${want.n}/${want.d}`);
      assert.ok(a.suffix, 'a unit after the box');
      assert.equal(checkAnswer(p, { decimal: a.value }).status, 'correct', t);
      for (const m of p.misconceptions) {
        assert.ok(catalog.get(m.id), m.id);
        const r = checkAnswer(p, { decimal: m.value });
        assert.equal(r.status, 'wrong', `${t}: ${m.id} ${m.value}`);
        assert.equal(r.misconception, m.id, t);
      }
    }
  });
}

test('geometry and measurement: every catalog mistake is generated', () => {
  const seen = new Set();
  for (const id of PARTS) for (const d of DIFFICULTIES) for (const s of SEEDS) for (const m of generateProblem(id, s, d).misconceptions) seen.add(m.id);
  assert.deepEqual([...seen].sort(), [...catalog.keys()].sort());
});
