// Generators for the linear functions area (docs/LINEAR-PLAN.md). Exact fractions
// throughout. Graphs are pictures (a line through two marked grid points), never drawn
// by the student. Equations are answered in the expressions keypad: y = [ ]x + [ ].
// See engine/generators/frac/add-sub.js for what a generator returns.

import { fraction, reduce, equals } from '../../math/fraction.js';

const F = (n, d = 1) => fraction(n, d);
const int = (value) => ({ type: 'int', value });
const op = (sym, left, right) => ({ type: 'op', op: sym, left, right });
const eq = (left, right) => ({ type: 'eq', left, right });
const x = { type: 'var', name: 'x' };
const y = { type: 'var', name: 'y' };
const term = (coef) => (coef === 1 ? x : { type: 'term', coef, name: 'x' });
const point = (px, py) => ({ type: 'point', x: px, y: py });
const nonZero = (rng, lo, hi) => { for (;;) { const v = rng.int(lo, hi); if (v !== 0) return v; } };
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
// "mx + b" as an expression node (b may be 0 or negative; m whole).
const line = (m, b) => (m === 0 ? int(b) : b === 0 ? term(m) : op(b < 0 ? '-' : '+', term(m), int(Math.abs(b))));

const numberAnswer = (v) => ({ type: 'fraction', value: reduce(v), form: 'any', allowNegative: true });
function numberProblem(instruction, expression, value, candidates) {
  const v = reduce(value);
  const out = [];
  for (const c of candidates) {
    if (!c || !c.value || !Number.isSafeInteger(c.value.n)) continue;
    const w = reduce(c.value);
    if (equals(w, v) || out.some((m) => equals(m.value, w))) continue;
    out.push({ id: c.id, value: w });
  }
  return { instruction, expression, answer: numberAnswer(v), misconceptions: out };
}
// An equation answer: y = coef·x + constant, typed in the two boxes.
function equationProblem(instruction, expression, m, b, candidates) {
  const out = [];
  for (const c of candidates) {
    if (!c || !Number.isInteger(c.coef) || !Number.isInteger(c.constant)) continue;
    if ((c.coef === m && c.constant === b) || out.some((o) => o.value.coef === c.coef && o.value.constant === c.constant)) continue;
    out.push({ id: c.id, value: { coef: c.coef, constant: c.constant } });
  }
  return { instruction, expression, answer: { type: 'linear', coef: m, constant: b, prefix: 'y =' }, misconceptions: out };
}

// A slope p/q (q > 0) and a y-intercept b, chosen so the line has two grid points
// on a −6..6 grid: (0, b) and (q, b + p).
function lineOnGrid(rng, { whole = false, negativeOk = true } = {}) {
  for (;;) {
    const q = whole ? 1 : rng.pick([1, 1, 2, 3]);
    const p = negativeOk ? nonZero(rng, -4, 4) : rng.int(1, 4);
    if (gcd(p, q) !== 1) continue;
    const b = rng.int(-4, 4);
    const k = q === 1 ? rng.int(1, 2) : 1; // the second marked point, k steps along
    const [x2, y2] = [q * k, b + p * k];
    if (Math.abs(y2) > 6 || x2 > 6) continue;
    return { p, q, b, points: [[0, b], [x2, y2]] };
  }
}
const graph = (points) => ({ type: 'graph', points });

// ======================= Function inputs and outputs =======================

// ---------- f(x) ----------
//   1: f(x) = 2x + 3, find f(4);  2: a negative input or rule (f(x) = −3x + 5, find f(−2));  3: f(x) = x² − 4x, or find x when f(x) = 11
const evaluateF = {
  version: 1,
  generate(rng, difficulty) {
    const name = rng.pick(['f', 'g', 'h']);
    const call = (arg) => ({ type: 'call', name, arg });
    if (difficulty === 3 && rng.chance(0.5)) {
      // Work backwards: f(x) = mx + b, f(x) = value, find x.
      const [m, b, v] = [rng.int(2, 6), nonZero(rng, -9, 9), rng.int(-5, 8)];
      const out = m * v + b;
      return numberProblem(`${name}(x) = ${m}x ${b < 0 ? '−' : '+'} ${Math.abs(b)}. For what x is ${name}(x) = ${out < 0 ? `−${-out}` : out}?`, eq(call(x), line(m, b)), F(v), [
        { id: 'lin.f-input-output', value: F(m * out + b) }, // found f(value) instead
      ]);
    }
    let m; let b; let v; let rule;
    if (difficulty === 1) { [m, b, v] = [rng.int(2, 9), rng.int(1, 12), rng.int(1, 9)]; rule = line(m, b); } else if (difficulty === 2) {
      [m, b, v] = [nonZero(rng, -6, 6), nonZero(rng, -9, 9), nonZero(rng, -6, 6)]; rule = line(m, b);
    } else { [m, b, v] = [rng.int(2, 5), 0, nonZero(rng, -5, 6)]; rule = op('-', { type: 'pow', base: x, exp: 2 }, term(m)); }
    const at = (u) => (difficulty === 3 ? u * u - m * u : m * u + b);
    return numberProblem(`Find ${name}(${v < 0 ? `−${-v}` : v}).`, eq(call(x), rule), F(at(v)), [
      { id: 'lin.f-sign', value: v < 0 ? F(at(-v)) : null }, // dropped the input's minus sign
    ]);
  },
};

// ---------- tables ----------
//   1: the next output in a table (x 1 2 3 4, y 5 8 11 ?);  2: an output further on (x = 10), negatives;
//   3: the rule's starting value: the output when x = 0, from a table that doesn't show 0
const table = {
  version: 1,
  generate(rng, difficulty) {
    const m = difficulty === 1 ? rng.int(2, 6) : nonZero(rng, -5, 6);
    const b = difficulty === 1 ? rng.int(1, 9) : rng.int(-9, 9);
    const xs = difficulty === 3 ? [2, 3, 4, 5] : [1, 2, 3, 4];
    const rows = xs.map((v) => [v, m * v + b]);
    const askX = difficulty === 1 ? 5 : difficulty === 2 ? rng.pick([8, 10, 12]) : 0;
    const value = m * askX + b;
    const last = rows.at(-1);
    return numberProblem(`What is y when x = ${askX}?`, { type: 'table', rows }, F(value), [
      { id: 'lin.table-swapped', value: F(askX) }, // gave the input back
      { id: 'lin.table-add-step', value: askX !== last[0] + 1 ? F(last[1] + m) : null }, // one more step, however far x jumped
      { id: 'lin.table-add-step', value: askX === 0 ? F(rows[0][1] - m) : null }, // went back one step instead of two to x = 0
    ]);
  },
};

// ======================= Slope =======================

// ---------- from two points (or a table) ----------
//   1: two points, a whole-number slope, going up;  2: a negative slope, or a fraction (−2/3);
//   3: points in the "wrong" order with negatives, or from a table
const slopePoints = {
  version: 1,
  generate(rng, difficulty) {
    let p; let q;
    do {
      if (difficulty === 1) [p, q] = [rng.int(1, 6), 1];
      else [p, q] = [nonZero(rng, -6, 6), rng.pick([1, 2, 3, 4])];
    } while (gcd(p, q) !== 1);
    const k = q === 1 ? rng.int(1, 4) : rng.int(1, 2);
    const [x1, y1] = difficulty === 1 ? [rng.int(0, 5), rng.int(0, 8)] : [rng.int(-6, 4), rng.int(-6, 6)];
    let a = [x1, y1];
    let c = [x1 + q * k, y1 + p * k];
    if (difficulty === 3 && rng.chance(0.5)) [a, c] = [c, a]; // the later point first
    const m = F(c[1] - a[1], c[0] - a[0]);
    const useTable = difficulty === 3 && rng.chance(0.4);
    // A table: three evenly spaced points, x going up (one step of q across, p up).
    const first = a[0] < c[0] ? a : c;
    const expression = useTable
      ? { type: 'table', rows: [0, 1, 2].map((i) => [first[0] + i * q, first[1] + i * p]) }
      : { type: 'list', items: [point(...a), point(...c)] };
    return numberProblem('Find the slope.', expression, m, [
      { id: 'lin.slope-run-over-rise', value: c[1] === a[1] ? null : F(c[0] - a[0], c[1] - a[1]) },
      { id: 'lin.slope-mixed-order', value: F(c[1] - a[1], a[0] - c[0]) }, // y's one way, x's the other: wrong sign
      { id: 'lin.slope-rise-only', value: useTable ? F(p) : F(c[1] - a[1]) }, // the change in y alone
    ]);
  },
};

// ---------- from a graph ----------
//   1: whole-number slope going up;  2: going down, or a fraction;  3: a fraction going down
const slopeGraph = {
  version: 1,
  generate(rng, difficulty) {
    let g;
    do g = lineOnGrid(rng, { whole: difficulty === 1, negativeOk: difficulty > 1 }); while (difficulty === 3 && (g.p > 0 || g.q === 1));
    const m = F(g.p, g.q);
    return numberProblem('Find the slope of the line.', graph(g.points), m, [
      { id: 'lin.slope-run-over-rise', value: F(g.q, g.p) },
      { id: 'lin.slope-mixed-order', value: F(-g.p, g.q) }, // counted down as up
    ]);
  },
};

// ======================= Slope-intercept form =======================

// ---------- read m and b ----------
//   1: y = 3x + 5: the slope;  2: the y-intercept, with negatives (y = −2x − 7);  3: y = 4 − 3x (written the other way round)
const readMB = {
  version: 1,
  generate(rng, difficulty) {
    const m = difficulty === 1 ? rng.int(2, 9) : nonZero(rng, -9, 9);
    const b = nonZero(rng, -12, 12);
    const askSlope = difficulty === 1 || (difficulty === 3 && rng.chance(0.5)) || (difficulty === 2 && rng.chance(0.3));
    const right = difficulty === 3 ? (m < 0 ? op('-', int(b), term(-m)) : op('+', int(b), term(m))) : line(m, b);
    return numberProblem(askSlope ? 'What is the slope?' : 'What is the y-intercept?', eq(y, right), F(askSlope ? m : b), [
      { id: 'lin.mb-swapped', value: F(askSlope ? b : m) },
      { id: 'lin.mb-sign', value: F(askSlope ? -m : -b) },
    ]);
  },
};

// ---------- write the equation ----------
//   1: from a slope and a y-intercept (slope 3, y-intercept −2);  2: from a graph (whole-number slope);
//   3: from a graph going down
const writeEquation = {
  version: 1,
  alsoUses: ['lin.slope-intercept.read'],
  generate(rng, difficulty) {
    if (difficulty === 1) {
      const [m, b] = [nonZero(rng, -6, 6), nonZero(rng, -9, 9)];
      return equationProblem(`Write the equation of the line with slope ${m < 0 ? `−${-m}` : m} and y-intercept ${b < 0 ? `−${-b}` : b}.`, { type: 'words', text: 'y = mx + b' }, m, b, [
        { id: 'lin.mb-swapped', coef: b, constant: m },
      ]);
    }
    let g;
    do g = lineOnGrid(rng, { whole: true, negativeOk: difficulty === 3 }); while (difficulty === 3 && g.p > 0);
    return equationProblem('Write the equation of the line.', graph(g.points), g.p, g.b, [
      { id: 'lin.mb-swapped', coef: g.b, constant: g.p },
      { id: 'lin.intercept-x', coef: g.p, constant: g.p === 0 ? null : (-g.b / g.p) }, // used the x-intercept as b
      { id: 'lin.slope-mixed-order', coef: -g.p, constant: g.b },
    ]);
  },
};

// ---------- from two points ----------
//   1: one of the points is the y-intercept ((0, 4) and (2, 10));  2: neither is ((1, 5) and (3, 11));  3: a negative slope
const twoPoints = {
  version: 1,
  alsoUses: ['lin.slope.points', 'lin.slope-intercept.write'],
  generate(rng, difficulty) {
    const m = difficulty === 3 ? -rng.int(1, 5) : rng.int(1, 5);
    const b = nonZero(rng, -8, 8);
    const x1 = difficulty === 1 ? 0 : rng.int(1, 4);
    const x2 = x1 + rng.int(1, 3);
    const P = [x1, m * x1 + b];
    const Q = [x2, m * x2 + b];
    return equationProblem('Write the equation of the line through these points.', { type: 'list', items: [point(...P), point(...Q)] }, m, b, [
      { id: 'lin.b-from-point', coef: m, constant: P[1] === b ? null : P[1] }, // used a point's y as the intercept
      { id: 'lin.mb-swapped', coef: b, constant: m },
      { id: 'lin.slope-mixed-order', coef: -m, constant: P[1] + m * P[0] },
    ]);
  },
};

// ======================= whole skills =======================

const mixedOf = ({ covers, screener, parts: own }) => ({
  version: 1,
  mixed: true,
  ...(screener ? { screener } : {}),
  covers,
  ...(own ? { parts: own } : {}),
  generate(rng, difficulty) {
    const part = rng.pick(own || covers);
    return { ...parts[part].generate(rng, difficulty), part };
  },
});

const parts = {
  'lin.functions.evaluate': evaluateF,
  'lin.functions.table': table,
  'lin.slope.points': slopePoints,
  'lin.slope.graph': slopeGraph,
  'lin.slope-intercept.read': readMB,
  'lin.slope-intercept.write': writeEquation,
  'lin.slope-intercept.two-points': twoPoints,
};

export const linearGenerators = {
  // f(x) and tables rest on different ideas: both asked.
  'lin.functions': mixedOf({ covers: ['lin.functions.evaluate', 'lin.functions.table'] }),
  // Slope from points and from a graph: both asked (reading a graph is its own skill).
  'lin.slope': mixedOf({ covers: ['lin.slope.points', 'lin.slope.graph'] }),
  // The equation through two points needs everything in the skill: it stands for all three.
  'lin.slope-intercept': mixedOf({ screener: 'lin.slope-intercept.two-points', covers: ['lin.slope-intercept.read', 'lin.slope-intercept.write', 'lin.slope-intercept.two-points'] }),
  ...parts,
};

