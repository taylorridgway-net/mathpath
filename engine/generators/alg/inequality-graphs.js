// Generators for "Graph inequalities" (alg.inequality-graphs): graph x > 3 on a number
// line, read an inequality from a graph, and compound inequalities (−2 < x ≤ 4;
// x < −1 or x ≥ 3). Students answer a graph on the number-line pad: tap for a dot,
// tap again for an open dot, then choose the shading (answer type 'numline').
// See engine/generators/frac/add-sub.js for what a generator returns.

import { fraction, equals } from '../../math/fraction.js';

const int = (value) => ({ type: 'int', value });
const op = (sym, left, right) => ({ type: 'op', op: sym, left, right });
const ineq = (sign, left, right) => ({ type: 'ineq', op: sign, left, right });
const x = { type: 'var', name: 'x' };
const term = (coef) => (coef === 1 ? x : { type: 'term', coef, name: 'x' });
const F = (n, d = 1) => fraction(n, d);
const nonZero = (rng, lo, hi) => { for (;;) { const v = rng.int(lo, hi); if (v !== 0) return v; } };
const FLIP = { '<': '>', '>': '<', '≤': '≥', '≥': '≤' };
const STRICT = { '<': '≤', '≤': '<', '>': '≥', '≥': '>' };
const SIGNS = ['<', '≤', '>', '≥'];
const closedFor = (sign) => sign === '≤' || sign === '≥';
const OTHER_SHADE = { left: 'right', right: 'left', between: 'outside', outside: 'between' };

// The 13 whole numbers shown on the line, with the dots well inside.
function windowFor(values) {
  const mid = Math.round((Math.min(...values) + Math.max(...values)) / 2);
  return { lo: mid - 6, hi: mid + 6 };
}
// x (sign) n as a graph: one dot, shaded toward the solutions.
const rayGraph = (sign, n) => ({ points: [{ v: n, closed: closedFor(sign) }], shade: sign === '<' || sign === '≤' ? 'left' : 'right' });
const sameGraph = (g, h) => g.shade === h.shade && g.points.length === h.points.length
  && g.points.every((p, i) => p.v === h.points[i].v && p.closed === h.points[i].closed);

function graphProblem(instruction, expression, graph, candidates) {
  const sorted = { ...graph, points: [...graph.points].sort((a, b) => a.v - b.v) };
  const out = [];
  for (const c of candidates) {
    if (!c || !c.value) continue;
    const w = { ...c.value, points: [...c.value.points].sort((a, b) => a.v - b.v) };
    if (sameGraph(w, sorted) || out.some((m) => sameGraph(m.value, w))) continue;
    out.push({ id: c.id, value: w });
  }
  const { lo, hi } = windowFor(sorted.points.map((p) => p.v));
  return { instruction, expression, answer: { type: 'numline', ...sorted, lo, hi }, misconceptions: out };
}
const dotsSwapped = (g) => ({ ...g, points: g.points.map((p) => ({ ...p, closed: !p.closed })) });
const shadeSwapped = (g) => ({ ...g, shade: OTHER_SHADE[g.shade] });

// ---------- graph an inequality ----------
//   1: x > 3, x ≤ −2;  2: the number first (3 < x, −2 ≥ x);  3: solve first, maybe flipping (−2x + 4 > 10 -> x < −3)
const graphIneq = {
  version: 1,
  generate(rng, difficulty) {
    const sign = rng.pick(SIGNS);
    if (difficulty < 3) {
      const n = rng.int(-6, 6);
      const reversed = difficulty === 2;
      // "3 < x" means x > 3.
      const g = rayGraph(reversed ? FLIP[sign] : sign, n);
      return graphProblem('Graph the inequality.', reversed ? ineq(sign, int(n), x) : ineq(sign, x, int(n)), g, [
        { id: 'alg.ineq-graph-dot', value: dotsSwapped(g) },
        { id: reversed ? 'alg.ineq-graph-reversed' : 'alg.ineq-graph-direction', value: shadeSwapped(g) },
      ]);
    }
    // a x + b (sign) c with a whole answer.
    const a = rng.chance(0.5) ? -rng.int(2, 5) : rng.int(2, 5);
    const b = nonZero(rng, -9, 9);
    const v = rng.int(-6, 6);
    const c = a * v + b;
    const lhs = op(b < 0 ? '-' : '+', term(a), int(Math.abs(b)));
    const solved = a < 0 ? FLIP[sign] : sign;
    const g = rayGraph(solved, v);
    return graphProblem('Solve, then graph.', ineq(sign, lhs, int(c)), g, [
      a < 0 ? { id: 'alg.ineq-no-flip', value: rayGraph(sign, v) } : null,
      { id: 'alg.ineq-graph-dot', value: dotsSwapped(g) },
      a > 0 ? { id: 'alg.ineq-graph-direction', value: shadeSwapped(g) } : null,
    ]);
  },
};

// ---------- read a graph ----------
//   1: shaded right or left from a closed or open dot;  2: negatives;  3: the same, the dot anywhere on the line
// Answered as x (sign) n with the sign buttons.
const readGraph = {
  version: 1,
  generate(rng, difficulty) {
    const sign = rng.pick(SIGNS);
    const n = difficulty === 1 ? rng.int(0, 6) : rng.int(-6, 6);
    const g = rayGraph(sign, n);
    const { lo, hi } = windowFor([n]);
    const v = F(n);
    const out = [
      { id: 'alg.ineq-graph-dot', sign: STRICT[sign], value: v },
      { id: 'alg.ineq-graph-direction', sign: FLIP[sign], value: v },
    ];
    return {
      instruction: 'Write the inequality the graph shows.',
      expression: { type: 'numline', lo, hi, ...g },
      answer: { type: 'inequality', sign, value: v },
      misconceptions: out.filter((m) => !(m.sign === sign && equals(m.value, v))),
    };
  },
};

// ---------- compound inequalities ----------
//   1: between (−2 < x ≤ 4);  2: "and" written out, or "or" (x < −1 or x ≥ 3);
//   3: solve first (−3 ≤ 2x + 1 < 7 -> −2 ≤ x < 3)
const compound = {
  version: 1,
  alsoUses: ['alg.inequality-graphs.graph'],
  generate(rng, difficulty) {
    const lo = rng.int(-6, 2);
    const hi = lo + rng.int(2, 7);
    const [s1, s2] = [rng.pick(['<', '≤']), rng.pick(['<', '≤'])];
    const pts = [{ v: lo, closed: s1 === '≤' }, { v: hi, closed: s2 === '≤' }];
    if (difficulty === 2 && rng.chance(0.6)) {
      // x < lo or x > hi (shaded outward); the signs face away from the middle.
      const [o1, o2] = [rng.pick(['<', '≤']), rng.pick(['>', '≥'])];
      const g = { points: [{ v: lo, closed: o1 === '≤' }, { v: hi, closed: o2 === '≥' }], shade: 'outside' };
      return graphProblem('Graph the inequality.', { type: 'list', word: 'or', items: [ineq(o1, x, int(lo)), ineq(o2, x, int(hi))] }, g, [
        { id: 'alg.compound-and-or', value: shadeSwapped(g) },
        { id: 'alg.ineq-graph-dot', value: dotsSwapped(g) },
      ]);
    }
    const g = { points: pts, shade: 'between' };
    let expression;
    if (difficulty === 1) expression = ineq(s2, ineq(s1, int(lo), x), int(hi));
    else if (difficulty === 2) expression = { type: 'list', word: 'and', items: [ineq(FLIP[s1], x, int(lo)), ineq(s2, x, int(hi))] };
    else {
      // a·lo + b (s1) a x + b (s2) a·hi + b, with a > 0.
      const a = rng.int(2, 4);
      const b = nonZero(rng, -6, 6);
      const middle = op(b < 0 ? '-' : '+', term(a), int(Math.abs(b)));
      expression = ineq(s2, ineq(s1, int(a * lo + b), middle), int(a * hi + b));
    }
    return graphProblem(difficulty === 3 ? 'Solve, then graph.' : 'Graph the inequality.', expression, g, [
      { id: 'alg.compound-and-or', value: shadeSwapped(g) },
      { id: 'alg.ineq-graph-dot', value: dotsSwapped(g) },
    ]);
  },
};

const parts = {
  'alg.inequality-graphs.graph': graphIneq,
  'alg.inequality-graphs.read': readGraph,
  'alg.inequality-graphs.compound': compound,
};

// In the diagnostic one compound inequality stands for graphing a single one too; reading a
// graph is asked on its own.
const full = {
  version: 1,
  mixed: true,
  screener: 'alg.inequality-graphs.compound',
  covers: ['alg.inequality-graphs.graph', 'alg.inequality-graphs.compound'],
  parts: ['alg.inequality-graphs.graph', 'alg.inequality-graphs.read', 'alg.inequality-graphs.compound'],
  generate(rng, difficulty) {
    const part = rng.pick(this.parts);
    return { ...parts[part].generate(rng, difficulty), part };
  },
};

export const inequalityGraphGenerators = { 'alg.inequality-graphs': full, ...parts };
