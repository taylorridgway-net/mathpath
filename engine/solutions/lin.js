// Worked solutions for linear functions, built from what the problem shows.
// A solution is a list of steps: { say, show? }.

import { fraction, reduce } from '../math/fraction.js';
import { toText } from '../problem/text.js';
import { substitute } from '../generators/alg/substitute.js';
import { solveAlg } from './alg.js';

const n = (v) => (v < 0 ? `−${-v}` : String(v));
const fr = (num, den) => { const r = reduce(fraction(num, den)); return r.d === 1 ? n(r.n) : `${r.n < 0 ? '−' : ''}${Math.abs(r.n)}/${r.d}`; };
const eqText = (m, b) => `y = ${m === 1 ? '' : m === -1 ? '−' : n(m)}x${b === 0 ? '' : b < 0 ? ` − ${-b}` : ` + ${b}`}`;
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
    default: throw new Error(`No worked solution for "${kind}"`);
  }
}
