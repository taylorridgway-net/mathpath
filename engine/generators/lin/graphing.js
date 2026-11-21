// Generators for "Graph points and lines" (lin.graphing): plot a point, and graph a line
// from its equation. Students answer on the grid pad (web/components/grid-pad.js): tap
// the point, or tap any two points on the line (answer type 'gridpoints'). A line answer
// is right when both tapped points are on the line, wherever they are.
// See engine/generators/frac/add-sub.js for what a generator returns.

import { fraction, reduce } from '../../math/fraction.js';

const F = (n, d = 1) => fraction(n, d);
const int = (value) => ({ type: 'int', value });
const op = (sym, left, right) => ({ type: 'op', op: sym, left, right });
const eq = (left, right) => ({ type: 'eq', left, right });
const x = { type: 'var', name: 'x' };
const y = { type: 'var', name: 'y' };
const nonZero = (rng, lo, hi) => { for (;;) { const v = rng.int(lo, hi); if (v !== 0) return v; } };
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
const R = 6;
const onGrid = ([a, b]) => Math.abs(a) <= R && Math.abs(b) <= R;

// y = (m)x + b as an expression node; m a fraction, b whole.
function lineNode(m, b) {
  const coef = m.d === 1 ? m.n : m.n < 0 ? { type: 'neg', of: { type: 'frac', n: -m.n, d: m.d } } : { type: 'frac', n: m.n, d: m.d };
  const t = coef === 1 ? x : { type: 'term', coef, name: 'x' };
  return eq(y, b === 0 ? t : op(b < 0 ? '-' : '+', t, int(Math.abs(b))));
}

// ---------- plot a point ----------
//   1: both coordinates positive;  2: negatives;  3: a point on an axis ((0, −4), (5, 0))
const plotPoint = {
  version: 1,
  generate(rng, difficulty) {
    let a; let b;
    if (difficulty === 1) { a = rng.int(1, 6); b = rng.int(1, 6); if (a === b) b = a === 6 ? 5 : a + 1; } else if (difficulty === 2) {
      do { a = nonZero(rng, -6, 6); b = nonZero(rng, -6, 6); } while (a > 0 && b > 0 || Math.abs(a) === Math.abs(b));
    } else if (rng.chance(0.5)) { a = 0; b = nonZero(rng, -6, 6); } else { a = nonZero(rng, -6, 6); b = 0; }
    const candidates = [
      { id: 'lin.plot-swapped', value: { points: [[b, a]] } }, // went up first, then across
      a !== 0 ? { id: 'lin.plot-sign', value: { points: [[-a, b]] } } : null,
      b !== 0 ? { id: 'lin.plot-sign', value: { points: [[a, -b]] } } : null,
    ];
    const out = [];
    for (const c of candidates) {
      if (!c) continue;
      const [p] = c.value.points;
      if ((p[0] === a && p[1] === b) || out.some((o) => o.value.points[0][0] === p[0] && o.value.points[0][1] === p[1])) continue;
      out.push(c);
    }
    return {
      instruction: 'Plot the point.',
      expression: { type: 'point', x: a, y: b },
      answer: { type: 'gridpoints', mode: 'points', count: 1, points: [[a, b]] },
      misconceptions: out,
    };
  },
};

// ---------- graph a line ----------
//   1: y = 2x − 3 (whole slope, going up);  2: a negative slope, or a slope like 1/2;  3: a slope like −2/3
const graphLine = {
  version: 1,
  alsoUses: ['lin.graphing.points'],
  generate(rng, difficulty) {
    for (;;) {
      let p; let q;
      if (difficulty === 1) [p, q] = [rng.int(1, 3), 1];
      else if (difficulty === 2) [p, q] = rng.chance(0.5) ? [-rng.int(1, 3), 1] : [rng.pick([1, -1]), 2];
      else [p, q] = [nonZero(rng, -3, 3), rng.pick([2, 3])];
      if (gcd(p, q) !== 1) continue;
      const b = rng.int(-4, 4);
      const m = F(p, q);
      // Two grid points on the line, for the worked solution and the pretend students.
      const example = [[0, b], [q, b + p]];
      if (!example.every(onGrid)) continue;
      const mistakes = [
        { id: 'lin.mb-swapped', m: F(b), b: F(p, q) }, // slope and intercept swapped
        { id: 'lin.slope-run-over-rise', m: F(q, p), b: F(b) },
        { id: 'lin.slope-mixed-order', m: F(-p, q), b: F(b) }, // went the wrong way
        { id: 'lin.intercept-x', m, b: reduce(F(-p * b, q)) }, // started at (b, 0) on the x-axis
      ];
      const same = (a, c) => a.m.n * c.m.d === c.m.n * a.m.d && a.b.n * c.b.d === c.b.n * a.b.d;
      const right = { m, b: F(b) };
      const out = [];
      for (const k of mistakes) {
        if (same(k, right) || out.some((o) => same(o.value, k))) continue;
        out.push({ id: k.id, value: { m: reduce(k.m), b: reduce(k.b) } });
      }
      return {
        instruction: 'Graph the line: tap two points on it.',
        expression: lineNode(m, b),
        answer: { type: 'gridpoints', mode: 'line', count: 2, m: reduce(m), b: F(b), example },
        misconceptions: out,
      };
    }
  },
};

const parts = { 'lin.graphing.points': plotPoint, 'lin.graphing.line': graphLine };

// Graphing a line needs plotting points: it stands for both in the diagnostic.
const full = {
  version: 1,
  mixed: true,
  screener: 'lin.graphing.line',
  covers: ['lin.graphing.points', 'lin.graphing.line'],
  generate(rng, difficulty) {
    const part = rng.pick(this.covers);
    return { ...parts[part].generate(rng, difficulty), part };
  },
};

export const graphingGenerators = { 'lin.graphing': full, ...parts };
