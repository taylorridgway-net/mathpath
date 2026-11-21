// Generators for "Systems of equations" (alg.systems), grade 8.
// See engine/generators/frac/add-sub.js for what a generator returns.
//   alg.systems.graph       the solution is where the lines cross (read from a graph);
//                           level 3: how many solutions (one, none, infinitely many)?
//   alg.systems.substitute  y = 2x + 1 and y = −x + 7;  y = 3x − 2 and 2x + y = 13
//   alg.systems.eliminate   x + y = 10 and x − y = 4;  multiply one equation first at level 3
// Answers are typed as (x, y) (answer type 'point', the two-box pad). Any method is fine:
// only the solution is graded, so a student who substitutes on an elimination problem is right.

const int = (value) => ({ type: 'int', value });
const op = (sym, left, right) => ({ type: 'op', op: sym, left, right });
const eq = (left, right) => ({ type: 'eq', left, right });
const term = (coef, name) => (coef === 1 ? { type: 'var', name } : { type: 'term', coef, name });
const system = (a, b) => ({ type: 'system', eqs: [a, b] });
const nonZero = (rng, lo, hi) => { for (;;) { const v = rng.int(lo, hi); if (v !== 0) return v; } };
const R = 6;
const onGrid = ([a, b]) => Math.abs(a) <= R && Math.abs(b) <= R;

// ax + by (a, b whole, not both 0) as an expression node: 2x + 3y, x − y, −x + 4y.
function sum(a, b) {
  if (b === 0) return term(a, 'x');
  if (a === 0) return term(b, 'y');
  return op(b < 0 ? '-' : '+', term(a, 'x'), term(Math.abs(b), 'y'));
}
// y = mx + c
function slopeForm(m, c) {
  const right = m === 0 ? int(c) : c === 0 ? term(m, 'x') : op(c < 0 ? '-' : '+', term(m, 'x'), int(Math.abs(c)));
  return eq({ type: 'var', name: 'y' }, right);
}

function pointProblem(instruction, expression, x, y, candidates) {
  const misconceptions = [];
  for (const c of candidates) {
    if (!c || (c.value.x === x && c.value.y === y)) continue;
    if (!Number.isSafeInteger(c.value.x) || !Number.isSafeInteger(c.value.y)) continue;
    if (misconceptions.some((m) => m.value.x === c.value.x && m.value.y === c.value.y)) continue;
    misconceptions.push(c);
  }
  return { instruction, expression, answer: { type: 'point', x, y }, misconceptions };
}
const swapped = (x, y) => ({ id: 'alg.systems-swapped', value: { x: y, y: x } });

// ---------- solve by graphing ----------
//   1: both lines cross at a point with positive coordinates, whole slopes
//   2: any point on the grid, slopes like 1/2 too
//   3: how many solutions? (from the equations: same slope, same line, or crossing)
const SOLUTIONS = ['One solution', 'No solution', 'Infinitely many'];
const graph = {
  version: 1,
  generate(rng, difficulty) {
    if (difficulty === 3) {
      const kind = rng.pick(['one', 'none', 'many']);
      const m = nonZero(rng, -3, 3);
      const c = rng.int(-6, 6);
      let second;
      if (kind === 'one') second = slopeForm(m + nonZero(rng, -2, 2) || m + 1, rng.int(-6, 6));
      else if (kind === 'none') second = slopeForm(m, c + nonZero(rng, -5, 5));
      else {
        // The same line, written another way: 2y = 2mx + 2c, or mx − y = −c.
        const k = rng.pick([2, 3]);
        second = rng.chance(0.5)
          ? eq(term(k, 'y'), c === 0 ? term(k * m, 'x') : op(c < 0 ? '-' : '+', term(k * m, 'x'), int(Math.abs(k * c))))
          : eq(sum(m, -1), int(-c));
      }
      const correct = SOLUTIONS.indexOf({ one: 'One solution', none: 'No solution', many: 'Infinitely many' }[kind]);
      const predictions = {
        // Two different-looking equations "must" cross once; parallel lines "meet somewhere".
        none: [['alg.systems-parallel-one', 0]],
        many: [['alg.systems-same-line-one', 0], ['alg.systems-same-line-none', 1]],
        one: [],
      }[kind];
      return {
        instruction: 'How many solutions does the system have?',
        expression: system(slopeForm(m, c), second),
        answer: { type: 'choice', options: SOLUTIONS, correct },
        misconceptions: predictions.map(([id, choice]) => ({ id, choice })),
      };
    }
    for (;;) {
      const [h, k] = difficulty === 1 ? [rng.int(1, 4), rng.int(1, 4)] : [rng.int(-4, 4), rng.int(-4, 4)];
      // Each line: through (h, k) with slope p/q, drawn through (h, k) and (h + q, k + p).
      const slope = () => (difficulty === 2 && rng.chance(0.4) ? [rng.pick([1, -1]), 2] : [nonZero(rng, -3, 3), 1]);
      const [p1, q1] = slope();
      const [p2, q2] = slope();
      if (p1 * q2 === p2 * q1) continue;
      const lineA = [[h - q1, k - p1], [h + q1, k + p1]];
      const lineB = [[h - q2, k - p2], [h + q2, k + p2]];
      if (![...lineA, ...lineB].every(onGrid)) continue;
      // y-intercepts (for the "read where a line crosses the y-axis" mistake), when whole.
      const yInt = (p, q) => ((k * q - p * h) % q === 0 ? (k * q - p * h) / q : null);
      const bA = yInt(p1, q1);
      return pointProblem('The graph shows a system of two equations. What is its solution? Type it as (x, y).', { type: 'graph', lines: [lineA, lineB] }, h, k, [
        swapped(h, k),
        bA !== null && onGrid([0, bA]) ? { id: 'alg.systems-intercept', value: { x: 0, y: bA } } : null,
      ]);
    }
  },
};

// ---------- solve by substitution ----------
//   1: y = m1x + c1 and y = m2x + c2 (set them equal)
//   2: y = mx + c and ax + y = d
//   3: y = mx + c and ax + by = d with b > 1 (distribute when substituting)
const substitute = {
  version: 1,
  generate(rng, difficulty) {
    for (;;) {
      const [x, y] = [nonZero(rng, -6, 6), nonZero(rng, -6, 6)];
      if (Math.abs(x) === Math.abs(y)) continue;
      const m = nonZero(rng, -3, 3);
      const c = y - m * x;
      if (Math.abs(c) > 12) continue;
      if (difficulty === 1) {
        const m2 = nonZero(rng, -3, 3);
        const c2 = y - m2 * x;
        if (m2 === m || Math.abs(c2) > 12) continue;
        return pointProblem('Solve the system. Type the solution as (x, y).', system(slopeForm(m, c), slopeForm(m2, c2)), x, y, [swapped(x, y)]);
      }
      const a = nonZero(rng, -3, 3);
      const b = difficulty === 2 ? 1 : rng.pick([2, 3]);
      if (a + b * m === 0) continue; // the x's would cancel
      const d = a * x + b * y;
      const candidates = [swapped(x, y)];
      if (b > 1) {
        // ax + b(mx + c) = d done as ax + bmx + c = d (didn't distribute to c).
        const xs = (d - c) / (a + b * m);
        if (Number.isInteger(xs)) candidates.push({ id: 'alg.systems-distribute', value: { x: xs, y: m * xs + c } });
      }
      return pointProblem('Solve the system. Type the solution as (x, y).', system(slopeForm(m, c), eq(sum(a, b), int(d))), x, y, candidates);
    }
  },
};

// ---------- solve by elimination ----------
//   1: x + y = s and x − y = d (add them)
//   2: ax + by = c1 and ex − by = c2 (add) or the same y-term in both (subtract)
//   3: multiply one equation first: ax + by = c1 and x + y = c2 (or x − y)
const eliminate = {
  version: 1,
  generate(rng, difficulty) {
    for (;;) {
      const [x, y] = [nonZero(rng, -6, 6), nonZero(rng, -6, 6)];
      if (Math.abs(x) === Math.abs(y)) continue;
      if (difficulty === 1) {
        if (x + y === 0 || x - y === 0) continue;
        return pointProblem('Solve the system. Type the solution as (x, y).', system(eq(sum(1, 1), int(x + y)), eq(sum(1, -1), int(x - y))), x, y, [
          swapped(x, y),
          // Added the equations but kept 2x: x = x + y + x − y ... i.e. forgot to divide by 2.
          { id: 'alg.systems-forgot-divide', value: { x: 2 * x, y: x + y - 2 * x } },
        ]);
      }
      if (difficulty === 2) {
        const b = rng.int(1, 3);
        const [a, e] = [rng.int(1, 4), rng.int(1, 4)];
        const add = rng.chance(0.5);
        const first = eq(sum(a, b), int(a * x + b * y));
        const second = add ? eq(sum(e, -b), int(e * x - b * y)) : eq(sum(e, b), int(e * x + b * y));
        if (!add && a === e) continue;
        const candidates = [swapped(x, y)];
        if (!add) {
          // Subtracted the x's but added the numbers on the right: (a − e)x = c1 + c2.
          const xs = (a * x + b * y + e * x + b * y) / (a - e);
          const ys = (a * x + b * y - a * xs) / b;
          if (Number.isInteger(xs) && Number.isInteger(ys)) candidates.push({ id: 'alg.systems-subtract-one-side', value: { x: xs, y: ys } });
        }
        return pointProblem('Solve the system. Type the solution as (x, y).', system(first, second), x, y, candidates);
      }
      const a = rng.pick([2, 3, 4]);
      const b = rng.pick([-3, -2, 2, 3, 5].filter((v) => v !== a));
      const s = rng.pick([1, -1]); // x + y or x − y
      const c1 = a * x + b * y;
      const c2 = x + s * y;
      // Multiply the second by a; then subtract: (b − a·s)y = c1 − a·c2.
      if (b - a * s === 0) continue;
      // Multiplied only the left side: (b − a·s)y = c1 − c2, then x from the first equation.
      const yw = (c1 - c2) / (b - a * s);
      const xw = (c1 - b * yw) / a;
      const candidates = [swapped(x, y)];
      if (Number.isInteger(yw) && Number.isInteger(xw)) candidates.push({ id: 'alg.systems-multiply-one-side', value: { x: xw, y: yw } });
      return pointProblem('Solve the system. Type the solution as (x, y).', system(eq(sum(a, b), int(c1)), eq(sum(1, s), int(c2))), x, y, candidates);
    }
  },
};

const parts = {
  'alg.systems.graph': graph,
  'alg.systems.substitute': substitute,
  'alg.systems.eliminate': eliminate,
};

export const systemsGenerators = {
  // Solving a system that needs multiplying first shows solving algebraically by any method
  // (substitution too); reading the solution from a graph is asked on its own.
  'alg.systems': {
    version: 1,
    mixed: true,
    screener: 'alg.systems.eliminate',
    covers: ['alg.systems.substitute', 'alg.systems.eliminate'],
    parts: ['alg.systems.graph', 'alg.systems.substitute', 'alg.systems.eliminate'],
    generate(rng, difficulty) {
      const part = rng.pick(this.parts);
      return { ...parts[part].generate(rng, difficulty), part };
    },
  },
  ...parts,
};
