// Worked solutions for linear functions, built from what the problem shows.
// A solution is a list of steps: { say, show? }.

import { fraction, reduce } from '../math/fraction.js';
import { toText } from '../problem/text.js';
import { substitute } from '../generators/alg/substitute.js';
import { solveAlg } from './alg.js';

const n = (v) => (v < 0 ? `−${-v}` : String(v));
const fr = (num, den) => { const r = reduce(fraction(num, den)); return r.d === 1 ? n(r.n) : `${r.n < 0 ? '−' : ''}${Math.abs(r.n)}/${r.d}`; };
const eqText = (m, b) => `y = ${m === 1 ? '' : m === -1 ? '−' : n(m)}x${b === 0 ? '' : b < 0 ? ` − ${-b}` : ` + ${b}`}`;
// The slope of an "mx + b" node: m is a number, a fraction, or a negative fraction.
function slopeOfNode(node) {
  const t = node.type === 'op' ? node.left : node;
  if (t.type === 'var') return fraction(1);
  const c = t.coef;
  if (typeof c === 'number') return fraction(c);
  if (c.type === 'neg') return fraction(-c.of.n, c.of.d);
  return fraction(c.n, c.d);
}
const frF = (f) => { const r = reduce(f); return fr(r.n, r.d); };
const pts = (node) => (node.type === 'graph' ? node.points : node.items.map((p) => [p.x, p.y]));

export function solveLinear(problem) {
  const kind = problem.part || problem.generator;
  const e = problem.expression;
  const a = problem.answer;
  switch (kind) {
    case 'lin.functions.evaluate': {
      const name = e.left.name;
      const back = /is \w\(x\) = (−?\d+)\?/.exec(problem.instruction);
      if (back) {
        // m x + b = target: undo + b, then ÷ m.
        const ruleNode = e.right;
        const m = ruleNode.type === 'op' ? ruleNode.left.coef ?? 1 : ruleNode.coef ?? 1;
        const b = ruleNode.type === 'op' ? (ruleNode.op === '+' ? 1 : -1) * ruleNode.right.value : 0;
        const target = Number(back[1].replace('−', '-'));
        const x = (target - b) / m;
        return [
          { say: `${name}(x) = ${n(target)} means the rule's output is ${n(target)}: solve ${toText(ruleNode).replace(/-/g, '−')} = ${n(target)} for x.` },
          { say: `${b >= 0 ? `Subtract ${b}` : `Add ${-b}`}: ${m}x = ${n(target - b)}. Divide by ${m}: x = ${n(x)}.` },
          { say: `Check: ${name}(${n(x)}) = ${m} × ${x < 0 ? `(${n(x)})` : x} ${b < 0 ? '−' : '+'} ${Math.abs(b)} = ${n(target)}. So x = ${n(x)}.` },
        ];
      }
      const v = Number(/\((−?\d+)\)/.exec(problem.instruction)[1].replace('−', '-'));
      const filled = substitute(e.right, { x: v });
      return [
        { say: `${name}(${n(v)}) means: put ${n(v)} in for x in the rule.` },
        ...solveAlg({ ...problem, expression: filled }),
      ];
    }
    case 'lin.functions.table': {
      const rows = e.rows;
      const step = rows[1][1] - rows[0][1];
      const at = Number(/x = (−?\d+)/.exec(problem.instruction)[1].replace('−', '-'));
      const from = at >= rows[0][0] ? rows.at(-1) : rows[0];
      const jumps = at - from[0];
      return [
        { say: `Each time x goes up 1, y ${step >= 0 ? 'goes up' : 'goes down'} by ${Math.abs(step)}.` },
        { say: `From x = ${n(from[0])} to x = ${n(at)} is ${Math.abs(jumps)} ${Math.abs(jumps) === 1 ? 'step' : 'steps'} ${jumps >= 0 ? 'up' : 'back'}: ${n(from[1])} ${jumps * step >= 0 ? '+' : '−'} ${Math.abs(jumps)} × ${Math.abs(step)} = ${n(from[1] + jumps * step)}.` },
        { say: `So y = ${n(a.value.n)} when x = ${n(at)}.` },
      ];
    }
    case 'lin.slope.points':
    case 'lin.slope.graph': {
      let p1; let p2;
      if (e.type === 'table') [p1, p2] = [e.rows[0], e.rows.at(-1)];
      else [p1, p2] = pts(e);
      const [rise, run] = [p2[1] - p1[1], p2[0] - p1[0]];
      return [
        { say: `${e.type === 'graph' ? 'Use the two marked points' : 'Use two of the points'}: (${p1.map(n).join(', ')}) and (${p2.map(n).join(', ')}).` },
        { say: `Rise (change in y): ${n(p2[1])} − ${p1[1] < 0 ? `(${n(p1[1])})` : p1[1]} = ${n(rise)}. Run (change in x): ${n(p2[0])} − ${p1[0] < 0 ? `(${n(p1[0])})` : p1[0]} = ${n(run)}. Subtract in the same order both times.` },
        { say: `Slope = rise ÷ run = ${n(rise)}/${n(run)} = ${fr(rise, run)}.` },
      ];
    }
    case 'lin.slope-intercept.read': {
      const slope = /slope/.test(problem.instruction);
      return [
        { say: `In y = mx + b, the number multiplying x is the slope m, and the number on its own is the y-intercept b. The order they're written in doesn't matter; keep each one's sign.` },
        { say: `In ${toText(e).replace(/-/g, '−')}, the ${slope ? 'slope' : 'y-intercept'} is ${n(a.value.n)}.` },
      ];
    }
    case 'lin.slope-intercept.write':
    case 'lin.slope-intercept.two-points': {
      const { coef: m, constant: b } = a;
      if (e.type === 'words') {
        return [{ say: `Put the slope in front of x and the y-intercept on its own: ${eqText(m, b)}.` }];
      }
      const [p1, p2] = pts(e);
      const steps = [{ say: `Slope first: rise ÷ run between (${p1.map(n).join(', ')}) and (${p2.map(n).join(', ')}) = ${n(p2[1] - p1[1])}/${n(p2[0] - p1[0])} = ${n(m)}.` }];
      if (p1[0] === 0) steps.push({ say: `(0, ${n(p1[1])}) is on the y-axis, so the y-intercept is ${n(b)}.` });
      else steps.push({ say: `Find b: put a point into y = ${n(m)}x + b. ${n(p1[1])} = ${n(m)} × ${p1[0]} + b, so b = ${n(p1[1])} − ${n(m * p1[0])} = ${n(b)}.` });
      steps.push({ say: `So the equation is ${eqText(m, b)}.` });
      return steps;
    }
    case 'lin.functions.linear': {
      if (e.type === 'eq') {
        const square = /\^2/.test(toText(e.right));
        return square
          ? [{ say: `A linear function has x only to the first power: y = mx + b. Here x is squared, so the change in y grows as x grows.` }, { say: `So it's ${a.options[a.correct]}.` }]
          : [{ say: `${toText(e).replace(/-/g, '−')} has x only to the first power (it can be written y = mx + b), so y changes by the same amount for each step in x.` }, { say: `So it's ${a.options[a.correct]}.` }];
      }
      const rows = e.rows;
      const rates = rows.slice(1).map((r, i) => [r[1] - rows[i][1], r[0] - rows[i][0]]);
      const uneven = rates.some(([, dx]) => dx !== rates[0][1]);
      return [
        { say: `Compare each row with the next: change in y over change in x. ${rates.map(([dy, dx]) => `${n(dy)}/${dx} = ${fr(dy, dx)}`).join(', ')}.` },
        ...(uneven ? [{ say: 'x doesn\'t go up by the same amount each time, so compare change in y with change in x, not the y changes alone.' }] : []),
        { say: `${a.correct === 0 ? 'The rate is the same every time' : 'The rate isn\'t the same every time'}, so it's ${a.options[a.correct]}.` },
      ];
    }
    case 'lin.forms.point-slope': {
      const { coef: m, constant: b } = a;
      let x1; let y1;
      const words = /slope (−?\d+) through \((−?\d+), (−?\d+)\)/.exec(problem.instruction);
      if (words) [x1, y1] = [words[2], words[3]].map((t) => Number(t.replace('−', '-')));
      else {
        y1 = (e.left.op === '-' ? 1 : -1) * e.left.right.value;
        x1 = (e.right.of.op === '-' ? 1 : -1) * e.right.of.right.value;
      }
      const yPart = `y ${y1 < 0 ? '+' : '−'} ${Math.abs(y1)}`;
      const xPart = `x ${x1 < 0 ? '+' : '−'} ${Math.abs(x1)}`;
      return [
        { say: words ? `Point-slope form: y − y₁ = m(x − x₁). With slope ${n(m)} and the point (${n(x1)}, ${n(y1)}): ${yPart} = ${n(m)}(${xPart}).`
          : `This is point-slope form: slope ${n(m)}, through the point (${n(x1)}, ${n(y1)}).` },
        { say: `Distribute: ${n(m)} × x = ${m === 1 ? '' : m === -1 ? '−' : n(m)}x and ${n(m)} × ${n(-x1)} = ${n(-m * x1)}. So ${yPart} = ${eqText(m, -m * x1).slice(4)}.` },
        { say: `${y1 < 0 ? `Subtract ${-y1}` : `Add ${y1}`} on both sides to get y alone: ${n(-m * x1)} ${y1 < 0 ? '−' : '+'} ${Math.abs(y1)} = ${n(b)}. So ${eqText(m, b)}.` },
      ];
    }
    case 'lin.forms.standard': {
      const A = e.left.left.coef ?? 1;
      const B = (e.left.op === '-' ? -1 : 1) * (e.left.right.coef ?? 1);
      const C = e.right.value;
      const shown = toText(e).replace(/-/g, '−');
      if (/intercept/.test(problem.instruction)) {
        const isX = /x-intercept/.test(problem.instruction);
        return [
          { say: `The ${isX ? 'x' : 'y'}-intercept is where ${isX ? 'y' : 'x'} = 0. Cover up the ${isX ? 'y' : 'x'} term in ${shown}.` },
          { say: `${isX ? `${A}x` : `${B}y`} = ${n(C)}, so ${isX ? 'x' : 'y'} = ${n(C)} ÷ ${isX ? n(A) : n(B)} = ${fr(C, isX ? A : B)}.` },
        ];
      }
      const steps = [
        { say: `Get y alone. Move the x term to the other side by ${A > 0 ? 'subtracting' : 'adding'} it: ${B === 1 ? '' : B === -1 ? '−' : n(B)}y = ${A > 0 ? '−' : ''}${Math.abs(A) === 1 ? '' : Math.abs(A)}x ${C < 0 ? '−' : '+'} ${Math.abs(C)}.` },
      ];
      if (B !== 1) steps.push({ say: `Divide every term by ${n(B)}: the x term becomes ${(-A) % B === 0 ? fr(-A, B) : `(${fr(-A, B)})`}x and the number ${fr(C, B)}.` });
      if (a.type === 'linear') steps.push({ say: `So ${eqText(a.coef, a.constant)}.` });
      else steps.push({ say: `The number with x is the slope: ${fr(-A, B)}. (A shortcut for Ax + By = C: slope = −A/B.)` });
      return steps;
    }
    case 'lin.parallel.slopes': {
      if (a.type === 'choice') {
        const [m1, m2] = e.items.map((l) => slopeOfNode(l.right));
        return [
          { say: `The slopes are ${frF(m1)} and ${frF(m2)}.` },
          { say: `Parallel lines have the same slope. Perpendicular slopes are negative reciprocals: flip one and change its sign (their product is −1).` },
          { say: `${m1.n * m2.d === m2.n * m1.d ? 'The slopes are the same' : `Multiplied together the slopes make ${frF(reduce(fraction(m1.n * m2.n, m1.d * m2.d)))}`}. So the lines are: ${a.options[a.correct]}.` },
        ];
      }
      const m = slopeOfNode(e.right);
      const par = /parallel/.test(problem.instruction);
      return par
        ? [{ say: `The line's slope is ${frF(m)}. Parallel lines go the same way, so they have the same slope: ${frF(m)}.` }]
        : [{ say: `The line's slope is ${frF(m)}. A perpendicular slope is the negative reciprocal: flip it and change the sign.` },
          { say: `Flip ${frF(m)}: ${frF(fraction(m.d, m.n))}. Change the sign: ${frF(fraction(-m.d, m.n))}.` }];
    }
    case 'lin.parallel.equation': {
      const given = e.left.type === 'var' ? slopeOfNode(e.right) : fraction(-(e.left.left.coef ?? 1));
      const par = /parallel/.test(problem.instruction);
      const [x1, y1] = /through \((−?\d+), (−?\d+)\)/.exec(problem.instruction).slice(1).map((t) => Number(t.replace('−', '-')));
      const { coef: m, constant: b } = a;
      const steps = [];
      if (e.left.type !== 'var') steps.push({ say: `Get y alone first: ${toText(e).replace(/-/g, '−')} is y = ${frF(given)}x ${e.right.value < 0 ? '−' : '+'} ${Math.abs(e.right.value)}, so its slope is ${frF(given)}.` });
      else steps.push({ say: `The given line's slope is ${frF(given)}.` });
      steps.push({ say: par ? `Parallel: the same slope, ${n(m)}.` : `Perpendicular: flip and change the sign, so the new slope is ${n(m)}.` });
      steps.push({ say: `Find b: put the point into y = ${n(m)}x + b. ${n(y1)} = ${n(m)} × ${x1 < 0 ? `(${n(x1)})` : x1} + b, so b = ${n(y1)} − ${n(m * x1) === n(m * x1) && m * x1 < 0 ? `(${n(m * x1)})` : n(m * x1)} = ${n(b)}.` });
      steps.push({ say: `So the equation is ${eqText(m, b)}.` });
      return steps;
    }
    default: throw new Error(`No worked solution for "${kind}"`);
  }
}
