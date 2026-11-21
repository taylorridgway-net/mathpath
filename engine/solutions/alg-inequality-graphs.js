// Worked solutions for graphing inequalities. A solution is a list of steps
// { say, show? }; the last step shows the finished graph (a "numline" node).

import { toText } from '../problem/text.js';

const n = (v) => (v < 0 ? `−${-v}` : String(v));
const t = (node) => toText(node).replace(/-/g, '−');
const FLIP = { '<': '>', '>': '<', '≤': '≥', '≥': '≤' };
const dotWords = (p) => `${p.closed ? 'a closed (filled) dot' : 'an open dot'} at ${n(p.v)}`;
const why = (closed) => (closed ? '(≤ or ≥: the number itself is included)' : '(< or >: the number itself is not included)');
const graphNode = (a) => ({ type: 'numline', lo: a.lo, hi: a.hi, points: a.points, shade: a.shade });

export function solveInequalityGraph(problem) {
  const kind = problem.part || problem.generator;
  const e = problem.expression;
  const a = problem.answer;
  if (kind === 'alg.inequality-graphs.read') {
    const [p] = e.points;
    return [
      { say: `The dot is at ${n(p.v)}. It's ${p.closed ? 'closed (filled), so ' + n(p.v) + ' is included: use ≤ or ≥' : 'open, so ' + n(p.v) + ' is not included: use < or >'}.` },
      { say: `The shading goes ${e.shade}, toward the ${e.shade === 'right' ? 'bigger' : 'smaller'} numbers, so x is ${e.shade === 'right' ? 'greater than' : 'less than'}${p.closed ? ' or equal to' : ''} ${n(p.v)}: x ${a.sign} ${n(a.value.n)}.` },
    ];
  }
  const steps = [];
  if (kind === 'alg.inequality-graphs.graph') {
    const [p] = a.points;
    if (e.left.type === 'op') {
      // a x + b (sign) c: solve first.
      const lhs = e.left;
      const coef = lhs.left.coef;
      const b = (lhs.op === '-' ? -1 : 1) * lhs.right.value;
      const c = e.right.value;
      const solved = coef < 0 ? FLIP[e.op] : e.op;
      steps.push({ say: `Solve first. ${b < 0 ? `Add ${-b}` : `Subtract ${b}`} on both sides: ${n(coef)}x ${e.op} ${n(c - b)}.` });
      steps.push({ say: `Divide both sides by ${n(coef)}${coef < 0 ? ', a negative number, so flip the sign' : ''}: x ${solved} ${n(p.v)}.` });
    } else if (e.left.type !== 'var') {
      steps.push({ say: `${t(e)} says the same as x ${FLIP[e.op]} ${n(e.left.value)}: read it from x's side, and the sign turns around.` });
    }
    const towards = a.shade === 'right' ? 'right, toward the bigger numbers' : 'left, toward the smaller numbers';
    steps.push({ say: `Put ${dotWords(p)} ${why(p.closed)}.` });
    steps.push({ say: `Shade ${towards}: those are the numbers that make it true.`, show: graphNode(a) });
    return steps;
  }
  // Compound.
  const [p, q] = a.points;
  if (e.type === 'list') {
    steps.push(e.word === 'or'
      ? { say: `"Or" means either part can be true: x ${e.items[0].op} ${n(p.v)} shades left from ${n(p.v)}, and x ${e.items[1].op} ${n(q.v)} shades right from ${n(q.v)}.` }
      : { say: `"And" means both parts must be true at once: x is between ${n(p.v)} and ${n(q.v)}.` });
  } else if (e.left.right.type === 'op') {
    // lo (s1) a x + b (s2) hi: do the same to all three parts.
    const mid = e.left.right;
    const coef = mid.left.coef;
    const b = (mid.op === '-' ? -1 : 1) * mid.right.value;
    const [lo, hi] = [e.left.left.value, e.right.value];
    steps.push({ say: `Do the same to all three parts. ${b < 0 ? `Add ${-b}` : `Subtract ${b}`}: ${n(lo - b)} ${e.left.op} ${coef}x ${e.op} ${n(hi - b)}.` });
    steps.push({ say: `Divide all three by ${coef}: ${n(p.v)} ${e.left.op} x ${e.op} ${n(q.v)}. So x is between ${n(p.v)} and ${n(q.v)}.` });
  } else {
    steps.push({ say: `${t(e)} means x is between ${n(p.v)} and ${n(q.v)}.` });
  }
  steps.push({ say: `Put ${dotWords(p)} and ${dotWords(q)}: closed for ≤ or ≥, open for < or >.` });
  steps.push({ say: a.shade === 'between' ? 'Shade between the dots.' : 'Shade outward from both dots, with arrows: the middle is not included.', show: graphNode(a) });
  return steps;
}
