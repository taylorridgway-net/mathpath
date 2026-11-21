// Linear functions: every answer re-worked from what the student sees (the rule, the
// table, the points, or the graph's two marked points), with exact fractions; every
// mistake is wrong, recognised and in the catalog.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateProblem, generators, DIFFICULTIES } from '../../../engine/generators/index.js';
import { checkAnswer } from '../../../engine/grading/check-answer.js';
import { toText } from '../../../engine/problem/text.js';
import { keypadOptionsFor } from '../../../web/components/keypad.js';
import { fraction, reduce, equals } from '../../../engine/math/fraction.js';

const SEEDS = Array.from({ length: 250 }, (_, i) => `lin-${i}`);
const catalog = new Map(JSON.parse(readFileSync(new URL('../../../curriculum/misconceptions/lin.json', import.meta.url), 'utf8')).misconceptions.map((m) => [m.id, m.pointsTo]));
const PARTS = Object.keys(generators).filter((id) => id.startsWith('lin.') && !generators[id].mixed);
const F = (n, d = 1) => fraction(n, d);
const num = (t) => Number(t.replace('−', '-'));
// A rule's text ("-6x + 1", "x^2 - 3x", "4 - 3x") as a JavaScript function of x.
const rule = (t) => Function('x', `"use strict"; return (${t.replace(/(\d)x/g, '$1*x').replace(/\^2/g, '**2').replace(/-x/g, '-1*x')});`);
const pts = (t) => [...t.matchAll(/\((-?\d+), (-?\d+)\)/g)].map((m) => [Number(m[1]), Number(m[2])]);
const typedNumber = (f) => { const r = reduce(f); return r.d === 1 ? { whole: Math.abs(r.n), ...(r.n < 0 ? { negative: true } : {}) } : { num: Math.abs(r.n), den: r.d, ...(r.n < 0 ? { negative: true } : {}) }; };

// The slope of "y = (1/2)x + 5", "y = -3x - 6", "y = x" as a fraction.
function slopeOf(t) {
  const m = /y = (\((-?\d+)\/(\d+)\)|-?\d*)x/.exec(t);
  if (m[2]) return F(Number(m[2]), Number(m[3]));
  return F(m[1] === '' ? 1 : m[1] === '-' ? -1 : Number(m[1]));
}
// Ax + By = C ("2x - 3y = 6", "-x + y = 4") as numbers.
function standardOf(t) {
  const m = /^(-?\d*)x ([+-]) (\d*)y = (-?\d+)$/.exec(t);
  const c = (v) => (v === '' ? 1 : v === '-' ? -1 : Number(v));
  return { A: c(m[1]), B: (m[2] === '-' ? -1 : 1) * c(m[3]), C: Number(m[4]) };
}

function expected(id, p) {
  const t = toText(p.expression);
  switch (id) {
    case 'lin.functions.linear': {
      if (t.startsWith('y = ')) return t.includes('^2') ? 1 : 0;
      const xs = /x ([^;]+);/.exec(t)[1].split(', ').map(Number);
      const ys = /y (.+)\]/.exec(t)[1].split(', ').map(Number);
      const rates = xs.slice(1).map((v, i) => F(ys[i + 1] - ys[i], v - xs[i]));
      return rates.every((r) => equals(r, rates[0])) ? 0 : 1;
    }
    case 'lin.forms.point-slope': {
      let m; let x1; let y1;
      const words = /slope (−?\d+) through \((−?\d+), (−?\d+)\)/.exec(p.instruction);
      if (words) [m, x1, y1] = words.slice(1).map(num);
      else {
        const e = /^y ([+-]) (\d+) = (-?\d*)\(x ([+-]) (\d+)\)$/.exec(t);
        y1 = (e[1] === '-' ? 1 : -1) * Number(e[2]);
        m = e[3] === '' ? 1 : e[3] === '-' ? -1 : Number(e[3]);
        x1 = (e[4] === '-' ? 1 : -1) * Number(e[5]);
      }
      return { m, b: y1 - m * x1 };
    }
    case 'lin.forms.standard': {
      const { A, B, C } = standardOf(t);
      if (/x-intercept/.test(p.instruction)) return F(C, A);
      if (/y-intercept/.test(p.instruction)) return F(C, B);
      if (p.answer.type === 'linear') return { m: -A / B, b: C / B };
      return F(-A, B);
    }
    case 'lin.parallel.slopes': {
      if (p.answer.type === 'choice') {
        const [l1, l2] = t.split(' and ');
        const [m1, m2] = [slopeOf(l1), slopeOf(l2)];
        const prod = reduce(fraction(m1.n * m2.n, m1.d * m2.d));
        return equals(m1, m2) ? 0 : prod.n === -1 && prod.d === 1 ? 1 : 2;
      }
      const m = slopeOf(t);
      return /parallel/.test(p.instruction) ? m : F(-m.d, m.n);
    }
    case 'lin.parallel.equation': {
      const given = t.startsWith('y = ') ? slopeOf(t) : F(-standardOf(t).A / standardOf(t).B);
      const [x1, y1] = /through \((−?\d+), (−?\d+)\)/.exec(p.instruction).slice(1).map(num);
      const m = /parallel/.test(p.instruction) ? given : F(-given.d, given.n);
      assert.equal(m.d, 1, 'the new slope is whole');
      return { m: m.n, b: y1 - m.n * x1 };
    }
    case 'lin.functions.evaluate': {
      const f = rule(t.split(' = ')[1]);
      const back = /is \w\(x\) = (−?\d+)\?/.exec(p.instruction);
      if (back) { assert.equal(f(p.answer.value.n / p.answer.value.d), num(back[1]), t); return p.answer.value; }
      return F(f(num(/\((−?\d+)\)/.exec(p.instruction)[1])));
    }
    case 'lin.functions.table': {
      const xs = /x ([^;]+);/.exec(t)[1].split(', ').map(Number);
      const ys = /y (.+)\]/.exec(t)[1].split(', ').map(Number);
      const m = (ys[1] - ys[0]) / (xs[1] - xs[0]);
      const at = num(/x = (−?\d+)/.exec(p.instruction)[1]);
      return F(ys[0] + m * (at - xs[0]));
    }
    case 'lin.slope.points':
    case 'lin.slope.graph': {
      let a; let c;
      if (t.startsWith('[a table')) {
        const xs = /x ([^;]+);/.exec(t)[1].split(', ').map(Number);
        const ys = /y (.+)\]/.exec(t)[1].split(', ').map(Number);
        [a, c] = [[xs[0], ys[0]], [xs.at(-1), ys.at(-1)]];
      } else [a, c] = pts(t);
      return F(c[1] - a[1], c[0] - a[0]);
    }
    case 'lin.slope-intercept.read': {
      const f = rule(t.split(' = ')[1]);
      return F(p.instruction.includes('slope') ? f(1) - f(0) : f(0));
    }
    default: { // equations: y = mx + b from the slope/intercept, the graph, or two points
      const given = /slope (−?\d+) and y-intercept (−?\d+)/.exec(p.instruction);
      if (given) return { m: num(given[1]), b: num(given[2]) };
      const [a, c] = pts(t);
      const m = (c[1] - a[1]) / (c[0] - a[0]);
      return { m, b: a[1] - m * a[0] };
    }
  }
}

for (const id of PARTS) {
  test(`${id}: answers re-worked from what's shown; mistakes are wrong and recognised`, () => {
    for (const d of DIFFICULTIES) for (const seed of SEEDS) {
      const p = generateProblem(id, seed, d);
      const t = toText(p.expression);
      const want = expected(id, p);
      const a = p.answer;
      if (a.type === 'choice') {
        assert.equal(a.correct, want, `${p.instruction} ${t}`);
        assert.equal(checkAnswer(p, { choice: a.correct }).status, 'correct');
      } else if (a.type === 'linear') {
        assert.deepEqual([a.coef, a.constant], [want.m, want.b], `${p.instruction} ${t}`);
        assert.equal(keypadOptionsFor(p).answerKind, 'linear');
        assert.equal(keypadOptionsFor(p).prefix, 'y =');
        assert.equal(checkAnswer(p, { coef: a.coef, constant: a.constant }).status, 'correct');
      } else {
        assert.ok(equals(a.value, want), `${p.instruction} ${t}: ${a.value.n}/${a.value.d} vs ${want.n}/${want.d}`);
        assert.equal(checkAnswer(p, typedNumber(a.value)).status, 'correct');
      }
      for (const m of p.misconceptions) {
        assert.ok(catalog.get(m.id)?.startsWith('lin.'), m.id);
        const raw = a.type === 'choice' ? { choice: m.choice } : a.type === 'linear' ? { coef: m.value.coef, constant: m.value.constant } : typedNumber(m.value);
        const r = checkAnswer(p, raw);
        assert.equal(r.status, 'wrong', `${t}: ${m.id}`);
        assert.equal(r.misconception, m.id);
      }
      // Graph points stay on the −6..6 grid.
      if (p.expression.type === 'graph') for (const [px, py] of p.expression.points) assert.ok(Math.abs(px) <= 6 && Math.abs(py) <= 6, t);
    }
  });
}

test('every linear-functions mistake in the catalog is generated', () => {
  const seen = new Set();
  for (const seed of SEEDS) for (const id of PARTS) for (const d of DIFFICULTIES) for (const m of generateProblem(id, seed, d).misconceptions) seen.add(m.id);
  assert.deepEqual([...seen].sort(), [...catalog.keys()].sort());
});

test('the whole skills mix their parts; the screener is a part', () => {
  for (const id of ['lin.functions', 'lin.slope', 'lin.slope-intercept']) {
    const g = generators[id];
    if (g.screener) assert.ok(PARTS.includes(g.screener));
    const seen = new Set(SEEDS.slice(0, 120).map((s) => generateProblem(id, s, 2).part));
    assert.deepEqual([...seen].sort(), [...(g.parts || g.covers)].sort(), id);
  }
});
