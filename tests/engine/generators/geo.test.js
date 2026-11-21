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
    default: throw new Error(id);
  }
}

for (const id of PARTS) {
  test(`${id}: answers worked out from the shown labels; mistakes wrong and recognised`, () => {
    for (const d of DIFFICULTIES) for (const seed of SEEDS) {
      const p = generateProblem(id, seed, d);
      const t = toText(p.expression);
      const want = expected(id, p);
      const a = p.answer;
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

test('measurement: every catalog mistake is generated', () => {
  const seen = new Set();
  for (const id of PARTS) for (const d of DIFFICULTIES) for (const s of SEEDS) for (const m of generateProblem(id, s, d).misconceptions) seen.add(m.id);
  const measurementIds = [...catalog.keys()].filter((k) => /^geo\.(units|area|perimeter|parallelogram|missing|triangle|trapezoid|composite|circle|half|volume|cone)/.test(k));
  for (const k of measurementIds) assert.ok(seen.has(k), k);
});
