// Worked solutions for systems of equations, from the problem's own equations.
// A solution is a list of steps { say, show? }. The methods shown are the ones each part
// teaches (substitution, elimination); any method that reaches the solution is marked right.

import { toText } from '../problem/text.js';

const show = (v) => (v < 0 ? `−${-v}` : String(v));
const pn = (v) => (v < 0 ? `(${show(v)})` : String(v));
const nice = (t) => t.replace(/-(?=\d|x|y)/g, '−').replace(/ - /g, ' − ');

// "2x - 3y" -> { x: 2, y: -3, c: 0 } (the text form of the equations).
function side(text) {
  const out = { x: 0, y: 0, c: 0 };
  let sign = 1;
  for (const tok of text.trim().split(/\s+/)) {
    if (tok === '+') { sign = 1; continue; }
    if (tok === '-') { sign = -1; continue; }
    const m = /^(-?)(\d*)([xy]?)$/.exec(tok);
    const k = (m[1] ? -1 : 1) * (m[2] === '' ? 1 : Number(m[2]));
    out[m[3] || 'c'] += sign * k;
    sign = 1;
  }
  return out;
}
const equation = (text) => { const [l, r] = text.split(' = ').map(side); return { a: l.x - r.x, b: l.y - r.y, c: r.c - l.c, text }; };
const lin = (a, b) => nice(`${a === 1 ? '' : a === -1 ? '-' : a}x ${b < 0 ? '-' : '+'} ${Math.abs(b) === 1 ? '' : Math.abs(b)}y`);

export function solveSystem(problem) {
  const t = toText(problem.expression);
  const a = problem.answer;
  if (problem.expression.type === 'graph') {
    return [
      { say: 'The solution of a system is the point that is on both lines: where they cross.' },
      { say: `The lines cross at x = ${show(a.x)}, y = ${show(a.y)}. So the solution is (${show(a.x)}, ${show(a.y)}).` },
    ];
  }
  const [e1, e2] = t.split(' and ').map(equation);
  if (a.type === 'choice') {
    const right = a.options[a.correct];
    const slope = (e) => `${e.b === 0 ? 'undefined' : show(-e.a / e.b)}`;
    return [
      { say: `Compare the slopes. Written as y = mx + b, the first line has slope ${slope(e1)} and the second has slope ${slope(e2)}.` },
      right === 'One solution'
        ? { say: 'Different slopes: the lines cross exactly once. The answer is One solution.' }
        : right === 'No solution'
          ? { say: 'Same slope but a different y-intercept: the lines are parallel and never meet. The answer is No solution.' }
          : { say: 'Same slope and the same y-intercept: it is the same line written two ways, so every point on it works. The answer is Infinitely many.' },
    ];
  }
  const kind = problem.part || problem.generator;
  const ans = `(${show(a.x)}, ${show(a.y)})`;
  const check = { say: `Check in both equations: ${e1.a * a.x + e1.b * a.y === e1.c && e2.a * a.x + e2.b * a.y === e2.c ? 'both are true' : 'one is false'}. So the solution is ${ans}.` };
  if (kind.endsWith('substitute')) {
    // First equation is y = mx + c.
    const m = -e1.a; const c = e1.c;
    const yExpr = nice(`${m === 1 ? '' : m === -1 ? '-' : m}x${c === 0 ? '' : c < 0 ? ` - ${-c}` : ` + ${c}`}`);
    if (e2.text.startsWith('y = ')) {
      return [
        { say: `Both equations say what y is, so set them equal: ${yExpr} = ${nice(e2.text.slice(4))}.` },
        { say: `Solve for x: x = ${show(a.x)}.` },
        { say: `Then y = ${yExpr.replace('x', `(${show(a.x)})`)}: y = ${show(a.y)}.` },
        check,
      ];
    }
    return [
      { say: `The first equation says y = ${yExpr}. Put that in place of y in the second equation.` },
      { say: `${nice(e2.text.replace(/(-?\d*)y/, (s, k) => `${k === '' ? '' : k === '-' ? '−' : k}(${yExpr})`))}. Solve for x: x = ${show(a.x)}.` },
      { say: `Then y = ${yExpr.replace('x', `(${show(a.x)})`)}: y = ${show(a.y)}.` },
      check,
    ];
  }
  // Elimination: make the y's (or x's) cancel.
  const steps = [];
  let [p, q] = [e1, e2];
  if (Math.abs(p.b) !== Math.abs(q.b)) {
    const k = p.a / q.a;
    steps.push({ say: `Multiply the second equation by ${k} (every term, both sides): ${lin(k * q.a, k * q.b)} = ${show(k * q.c)}. Now both have ${show(p.a)}x.` });
    q = { a: k * q.a, b: k * q.b, c: k * q.c };
    steps.push({ say: `Subtract: (${lin(p.a, p.b)}) − (${lin(q.a, q.b)}) gives ${show(p.b - q.b)}y = ${show(p.c - q.c)}, so y = ${show(a.y)}.` });
    steps.push({ say: `Put y = ${show(a.y)} into the first equation and solve: x = ${show(a.x)}.` });
  } else {
    const add = p.b === -q.b;
    const xs = add ? p.a + q.a : p.a - q.a;
    const cs = add ? p.c + q.c : p.c - q.c;
    steps.push({ say: `The y-terms are ${add ? 'opposites, so add' : 'the same, so subtract'} the equations: the y's cancel and ${xs === 1 ? '' : xs}x = ${show(cs)}.` });
    steps.push({ say: `So x = ${show(cs)} ÷ ${pn(xs)} = ${show(a.x)}.` });
    steps.push({ say: `Put x = ${show(a.x)} into the first equation and solve: y = ${show(a.y)}.` });
  }
  return [...steps, check];
}
